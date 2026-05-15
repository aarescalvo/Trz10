import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Listar ingresos a desposte C2 (usa IngresoDespostada)
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')

    const where: any = {}
    if (estado) where.estado = estado

    const ingresos = await db.ingresoDespostada.findMany({
      where,
      include: {
        camaraOrigen: { select: { id: true, nombre: true } },
        camaraDestino: { select: { id: true, nombre: true } },
        operador: { select: { id: true, nombre: true } }
      },
      orderBy: { fecha: 'desc' },
      take: 50
    })

    return NextResponse.json({ success: true, data: ingresos })
  } catch (error) {
    console.error('Error fetching ingresos desposte:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener ingresos' }, { status: 500 })
  }
}

// POST - Crear ingreso a desposte desde cuartos C2
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError
  try {
    const body = await request.json()
    const { cuartoIds, camaraDestinoId, operadorId, observaciones } = body

    if (!cuartoIds || !Array.isArray(cuartoIds) || cuartoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe seleccionar al menos un cuarto' },
        { status: 400 }
      )
    }

    // Obtener los cuartos seleccionados
    const cuartos = await db.cuarto.findMany({
      where: {
        id: { in: cuartoIds },
        estado: 'EN_CAMARA'
      },
      include: {
        mediaRes: {
          select: { id: true, codigo: true, peso: true, romaneo: { select: { tropaCodigo: true } } }
        },
        tipoCuarto: { select: { nombre: true, codigo: true } },
        camara: { select: { id: true, nombre: true } }
      }
    })

    if (cuartos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron cuartos disponibles en cámara' },
        { status: 400 }
      )
    }

    if (cuartos.length !== cuartoIds.length) {
      const foundIds = cuartos.map(c => c.id)
      const missing = cuartoIds.filter((id: string) => !foundIds.includes(id))
      return NextResponse.json(
        { success: false, error: `Algunos cuartos no están disponibles: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    // Calcular peso total de entrada
    const pesoEntrada = cuartos.reduce((sum, c) => sum + (c.peso || 0), 0)

    // Agrupar cuartos por mediaResId para crear un ingreso por cada media res
    // o crear un ingreso único si vienen de diferentes medias
    const cuartosByMediaRes = cuartos.reduce((acc: Record<string, typeof cuartos>, c) => {
      const key = c.mediaResId
      if (!acc[key]) acc[key] = []
      acc[key].push(c)
      return acc
    }, {})

    const ingresosCreated: any[] = []

    for (const [mediaResId, cuartosGrupo] of Object.entries(cuartosByMediaRes)) {
      const primerCuarto = cuartosGrupo[0]
      const pesoGrupo = cuartosGrupo.reduce((sum, c) => sum + (c.peso || 0), 0)

      // Determinar tipo de media según los cuartos
      const tieneDelantero = cuartosGrupo.some(c => c.tipo === 'DELANTERO' || c.tipoCuarto?.codigo?.toUpperCase().includes('DEL'))
      const tieneTrasero = cuartosGrupo.some(c => c.tipo === 'TRASERO' || c.tipoCuarto?.codigo?.toUpperCase().includes('TRA'))
      let tipoMedia: 'DELANTERA' | 'TRASERA' | 'ENTERA' = 'ENTERA'
      if (tieneDelantero && !tieneTrasero) tipoMedia = 'DELANTERA'
      else if (tieneTrasero && !tieneDelantero) tipoMedia = 'TRASERA'

      // Crear el ingreso a despostada
      const ingreso = await db.ingresoDespostada.create({
        data: {
          mediaResId,
          tropaCodigo: primerCuarto.mediaRes?.romaneo?.tropaCodigo || primerCuarto.tropaCodigo || null,
          mediaCodigo: primerCuarto.mediaRes?.codigo || null,
          tipoMedia,
          pesoKg: pesoGrupo,
          camaraOrigenId: primerCuarto.camaraId || null,
          camaraDestinoId: camaraDestinoId || null,
          estado: 'INGRESADO',
          operadorId,
          observaciones: observaciones?.trim() || null
        },
        include: {
          camaraOrigen: { select: { id: true, nombre: true } },
          camaraDestino: { select: { id: true, nombre: true } },
          operador: { select: { id: true, nombre: true } }
        }
      })

      // Actualizar estado de los cuartos a EN_DESPOSTADA
      await db.cuarto.updateMany({
        where: { id: { in: cuartosGrupo.map(c => c.id) } },
        data: {
          estado: 'EN_DESPOSTADA',
          fechaIngresoDespostada: new Date()
        }
      })

      ingresosCreated.push(ingreso)
    }

    return NextResponse.json({
      success: true,
      data: {
        ingresos: ingresosCreated,
        cuartosIngresados: cuartos.length,
        pesoTotal: pesoEntrada,
        ingresosCreados: ingresosCreated.length
      },
      message: `${cuartos.length} cuarto(s) ingresados a desposte en ${ingresosCreated.length} registro(s)`
    })
  } catch (error) {
    console.error('Error creating ingreso desposte:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear ingreso a desposte' },
      { status: 500 }
    )
  }
}
