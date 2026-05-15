import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// Helper: map C2TipoCuarto codigo to TipoCuarto enum
function mapTipoCuarto(codigo: string): 'DELANTERO' | 'TRASERO' | 'ASADO' {
  const code = codigo.toUpperCase()
  if (code.includes('DEL') || code.includes('D')) return 'DELANTERO'
  if (code.includes('TRA') || code.includes('T')) return 'TRASERO'
  return 'ASADO'
}

// GET - Listar registros de cuarteo (con cuartos opcionales)
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeCuarteo')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const camaraId = searchParams.get('camaraId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeCuartos = searchParams.get('includeCuartos') === 'true'

    const where: any = {}
    if (camaraId) where.camaraId = camaraId

    const [registros, total] = await Promise.all([
      db.registroCuarteo.findMany({
        where,
        include: {
          camara: { select: { id: true, nombre: true } },
          operador: { select: { id: true, nombre: true } },
          ...(includeCuartos ? {
            // NOTE: RegistroCuarteo doesn't have direct relation to Cuarto,
            // we look up cuartos separately via mediaResId
          } : {})
        },
        orderBy: { fecha: 'desc' },
        take: limit,
        skip: offset
      }),
      db.registroCuarteo.count({ where })
    ])

    // If includeCuartos, fetch related Cuarto records + pH measurements for each registro
    let enrichedRegistros = registros
    if (includeCuartos) {
      const mediaResIds = [...new Set(registros.map(r => r.mediaResId).filter(Boolean))] as string[]

      const [cuartos, medicionesPH] = mediaResIds.length > 0 ? await Promise.all([
        db.cuarto.findMany({
          where: { mediaResId: { in: mediaResIds } },
          include: {
            tipoCuarto: { select: { id: true, nombre: true, codigo: true } },
            camara: { select: { id: true, nombre: true } }
          }
        }),
        db.medicionPH.findMany({
          where: { mediaResId: { in: mediaResIds } },
          orderBy: { numeroMedicion: 'asc' }
        })
      ]) : [[], []]

      const cuartosByMediaRes = cuartos.reduce((acc: any, c: any) => {
        if (!acc[c.mediaResId]) acc[c.mediaResId] = []
        acc[c.mediaResId].push(c)
        return acc
      }, {})

      // Group pH measurements by mediaResId and extract classification
      const phByMediaRes: Record<string, { mediciones: any[]; clasificacion: string | null; valorPH: number | null }> = {}
      for (const ph of medicionesPH) {
        if (!phByMediaRes[ph.mediaResId]) {
          phByMediaRes[ph.mediaResId] = { mediciones: [], clasificacion: null, valorPH: null }
        }
        phByMediaRes[ph.mediaResId].mediciones.push(ph)
        // Use the first measurement as primary classification
        if (ph.numeroMedicion === 1 && ph.clasificacion) {
          phByMediaRes[ph.mediaResId].clasificacion = ph.clasificacion
          phByMediaRes[ph.mediaResId].valorPH = ph.valorPH
        }
      }

      enrichedRegistros = registros.map(r => ({
        ...r,
        cuartos: r.mediaResId ? (cuartosByMediaRes[r.mediaResId] || []) : [],
        datosPH: r.mediaResId ? (phByMediaRes[r.mediaResId] || null) : null
      }))
    }

    // Calcular estadísticas
    const stats = await db.registroCuarteo.aggregate({
      _count: { id: true },
      _sum: { pesoTotal: true, pesoDelantero: true, pesoTrasero: true }
    })

    return NextResponse.json({
      success: true,
      data: enrichedRegistros,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + registros.length < total
      },
      stats: {
        total: stats._count.id,
        pesoTotal: stats._sum.pesoTotal || 0,
        pesoDelantero: stats._sum.pesoDelantero || 0,
        pesoTrasero: stats._sum.pesoTrasero || 0
      }
    })
  } catch (error) {
    console.error('Error fetching cuarteos:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener registros de cuarteo' },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo registro de cuarteo (con cuartos dinámicos C2)
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeCuarteo')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      mediaResId,
      tipoCorte,
      pesoTotal,
      pesoDelantero,
      pesoTrasero,
      camaraId,
      operadorId,
      observaciones,
      // Nuevo: array de cuartos dinámicos con C2TipoCuarto
      cuartos: cuartosInput
    } = body

    if (!pesoTotal && (!cuartosInput || cuartosInput.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'El peso total o los cuartos son requeridos' },
        { status: 400 }
      )
    }

    // Buscar datos de la MediaRes si se proporcionó ID
    const mediaRes = mediaResId ? await db.mediaRes.findUnique({
      where: { id: mediaResId },
      include: {
        romaneo: {
          select: { tropaCodigo: true, garron: true }
        }
      }
    }) : null

    if (mediaResId && !mediaRes) {
      return NextResponse.json(
        { success: false, error: 'Media Res no encontrada' },
        { status: 404 }
      )
    }

    // Calcular peso total de los cuartos dinámicos
    let totalCuartos = 0
    if (cuartosInput && cuartosInput.length > 0) {
      totalCuartos = cuartosInput.reduce((sum: number, c: { peso: number }) => sum + (parseFloat(String(c.peso)) || 0), 0)
    }

    const pesoTotalFinal = parseFloat(pesoTotal) || totalCuartos

    // Crear el registro de cuarteo
    const registro = await db.registroCuarteo.create({
      data: {
        mediaResId,
        tipoCorte: tipoCorte || 'DELANTERO_TRASERO',
        pesoTotal: pesoTotalFinal,
        pesoDelantero: pesoDelantero ? parseFloat(pesoDelantero) : (cuartosInput?.find((c: any) => mapTipoCuarto(c.codigo || '') === 'DELANTERO')?.peso ? parseFloat(cuartosInput.find((c: any) => mapTipoCuarto(c.codigo || '') === 'DELANTERO').peso) : null),
        pesoTrasero: pesoTrasero ? parseFloat(pesoTrasero) : (cuartosInput?.find((c: any) => mapTipoCuarto(c.codigo || '') === 'TRASERO')?.peso ? parseFloat(cuartosInput.find((c: any) => mapTipoCuarto(c.codigo || '') === 'TRASERO').peso) : null),
        camaraId,
        operadorId,
        observaciones
      },
      include: {
        camara: { select: { id: true, nombre: true } },
        operador: { select: { id: true, nombre: true } }
      }
    })

    // Crear Cuarto records si se proporcionaron cuartos dinámicos
    const cuartosCreated: any[] = []
    if (cuartosInput && cuartosInput.length > 0 && mediaResId) {
      const timestamp = Date.now()
      for (let i = 0; i < cuartosInput.length; i++) {
        const c = cuartosInput[i]
        const peso = parseFloat(String(c.peso)) || 0
        if (peso <= 0) continue

        const tipoEnum = mapTipoCuarto(c.codigo || c.nombre || '')

        const cuarto = await db.cuarto.create({
          data: {
            mediaResId,
            tipo: tipoEnum,
            tipoCuartoId: c.tipoCuartoId || null,
            pesoOriginal: mediaRes?.peso ? mediaRes.peso / 2 : peso,
            pesoCuarto: peso,
            peso,
            codigo: `CRT-${timestamp}-${i + 1}`,
            tropaCodigo: mediaRes?.romaneo?.tropaCodigo || null,
            garron: mediaRes?.romaneo?.garron != null ? String(mediaRes.romaneo.garron) : null,
            sigla: mediaRes?.sigla || 'A',
            camaraId: camaraId || null,
            estado: 'EN_CAMARA',
            registroCuarteoId: registro.id
          },
          include: {
            tipoCuarto: { select: { id: true, nombre: true, codigo: true } },
            camara: { select: { id: true, nombre: true } }
          }
        })
        cuartosCreated.push(cuarto)
      }
    }

    // Actualizar estado de la Media Res
    if (mediaResId) {
      await db.mediaRes.update({
        where: { id: mediaResId },
        data: { estado: 'EN_CUARTEO' }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...registro,
        cuartos: cuartosCreated,
        mermaOreo: mediaRes ? {
          pesoMediaRes: mediaRes.peso,
          pesoTotalCuartos: totalCuartos || pesoTotalFinal,
          mermaKg: mediaRes.peso - (totalCuartos || pesoTotalFinal),
          mermaPorcentaje: ((mediaRes.peso - (totalCuartos || pesoTotalFinal)) / mediaRes.peso * 100).toFixed(2)
        } : null
      },
      message: 'Registro de cuarteo creado correctamente'
    })
  } catch (error) {
    console.error('Error creating cuarteo:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear registro de cuarteo' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar registro de cuarteo
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeCuarteo')
  if (authError) return authError
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const data: any = {}
    if (updateData.tipoCorte) data.tipoCorte = updateData.tipoCorte
    if (updateData.pesoTotal) data.pesoTotal = parseFloat(updateData.pesoTotal)
    if (updateData.pesoDelantero !== undefined) data.pesoDelantero = updateData.pesoDelantero ? parseFloat(updateData.pesoDelantero) : null
    if (updateData.pesoTrasero !== undefined) data.pesoTrasero = updateData.pesoTrasero ? parseFloat(updateData.pesoTrasero) : null
    if (updateData.camaraId) data.camaraId = updateData.camaraId
    if (updateData.observaciones !== undefined) data.observaciones = updateData.observaciones

    const registro = await db.registroCuarteo.update({
      where: { id },
      data,
      include: {
        camara: { select: { id: true, nombre: true } },
        operador: { select: { id: true, nombre: true } }
      }
    })

    return NextResponse.json({
      success: true,
      data: registro,
      message: 'Registro actualizado correctamente'
    })
  } catch (error) {
    console.error('Error updating cuarteo:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar registro' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar registro de cuarteo (con cleanup en transacción)
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeCuarteo')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    // Perform cleanup within a transaction: delete Cuartos, restore MediaRes, delete RegistroCuarteo
    await db.$transaction(async (tx) => {
      const registro = await tx.registroCuarteo.findUnique({
        where: { id },
        select: { mediaResId: true }
      })

      if (!registro) {
        throw new Error('Registro de cuarteo no encontrado')
      }

      // Delete associated Cuartos linked to this registroCuarteo
      await tx.cuarto.deleteMany({
        where: { registroCuarteoId: id }
      })

      // Restore MediaRes to EN_CAMARA state if it was linked
      if (registro.mediaResId) {
        await tx.mediaRes.update({
          where: { id: registro.mediaResId },
          data: { estado: 'EN_CAMARA' }
        })
      }

      // Delete the registro de cuarteo
      await tx.registroCuarteo.delete({
        where: { id }
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Registro eliminado correctamente'
    })
  } catch (error) {
    console.error('Error deleting cuarteo:', error)
    const message = error instanceof Error && error.message.includes('no encontrado')
      ? 'Registro de cuarteo no encontrado'
      : 'Error al eliminar registro'
    const status = error instanceof Error && error.message.includes('no encontrado') ? 404 : 500
    return NextResponse.json(
      { success: false, error: message },
      { status }
    )
  }
}
