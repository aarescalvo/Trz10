import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Listar degradaciones C2
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const cajaId = searchParams.get('cajaId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (tipo) where.tipo = tipo
    if (cajaId) where.cajaIdOriginal = cajaId

    const degradaciones = await db.c2MovimientoDegradacion.findMany({
      where,
      include: {
        cajaOriginal: {
          select: {
            id: true,
            numeradorCaja: true,
            pesoNeto: true,
            producto: { select: { id: true, nombre: true } }
          }
        },
        nuevoProducto: { select: { id: true, nombre: true, codigo: true } },
        operador: { select: { id: true, nombre: true } }
      },
      orderBy: { fecha: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: degradaciones
    })
  } catch (error) {
    console.error('Error fetching degradaciones:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener degradaciones' },
      { status: 500 }
    )
  }
}

// POST - Crear degradación de caja
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      cajaIdOriginal,
      tipo,
      pesoDegradado,
      pesoAprovechamiento,
      pesoDescarte,
      nuevoProductoId,
      motivo,
      operadorId,
      observaciones
    } = body

    if (!cajaIdOriginal) {
      return NextResponse.json(
        { success: false, error: 'ID de caja original es requerido' },
        { status: 400 }
      )
    }

    if (!tipo) {
      return NextResponse.json(
        { success: false, error: 'Tipo de degradación es requerido' },
        { status: 400 }
      )
    }

    if (!pesoDegradado || pesoDegradado <= 0) {
      return NextResponse.json(
        { success: false, error: 'Peso degradado debe ser mayor a 0' },
        { status: 400 }
      )
    }

    // Verificar que la caja existe
    const caja = await db.cajaEmpaque.findUnique({
      where: { id: cajaIdOriginal },
      include: {
        productoDesposte: { select: { nombre: true } }
      }
    })

    if (!caja) {
      return NextResponse.json(
        { success: false, error: 'Caja no encontrada' },
        { status: 404 }
      )
    }

    // Crear la degradación
    const degradacion = await db.c2MovimientoDegradacion.create({
      data: {
        cajaIdOriginal,
        tipo,
        pesoDegradado: parseFloat(pesoDegradado),
        pesoAprovechamiento: pesoAprovechamiento ? parseFloat(pesoAprovechamiento) : null,
        pesoDescarte: pesoDescarte ? parseFloat(pesoDescarte) : null,
        nuevoProductoId: nuevoProductoId || null,
        motivo: motivo || 'Sin motivo especificado',
        operadorId: operadorId || null,
        observaciones: observaciones || null
      },
      include: {
        cajaOriginal: {
          select: { id: true, numero: true, productoDesposte: { select: { nombre: true } } }
        },
        nuevoProducto: { select: { nombre: true, codigo: true } },
        operador: { select: { nombre: true } }
      }
    })

    // Si hay aprovechamiento, crear una nueva caja con el nuevo producto
    if (pesoAprovechamiento && pesoAprovechamiento > 0 && nuevoProductoId) {
      const ultimaCaja = await db.cajaEmpaque.findFirst({
        orderBy: { numero: 'desc' },
        select: { numero: true }
      })

      const numeroCaja = ultimaCaja?.numero
        ? (parseInt(ultimaCaja.numero.replace('CAJA-', '')) + 1).toString().padStart(6, '0')
        : '000001'

      // Calcular fecha de vencimiento basada en diasVencimiento del nuevo producto
      const nuevoProducto = await db.c2ProductoDesposte.findUnique({
        where: { id: nuevoProductoId },
        select: { diasVencimiento: true }
      })

      const diasConservacion = nuevoProducto?.diasVencimiento || 90 // Default: 90 días
      const fechaDesposte = new Date()
      const fechaVencimiento = new Date(fechaDesposte.getTime() + diasConservacion * 24 * 60 * 60 * 1000)

      await db.cajaEmpaque.create({
        data: {
          numero: `CAJA-${numeroCaja}`,
          productoDesposteId: nuevoProductoId,
          cuartoId: caja.cuartoId,
          loteId: caja.loteId,
          propietarioId: caja.propietarioId,
          pesoBruto: pesoAprovechamiento,
          pesoNeto: pesoAprovechamiento,
          tara: 0,
          piezas: 1,
          tropaCodigo: caja.tropaCodigo,
          fechaFaena: caja.fechaFaena,
          fechaDesposte: fechaDesposte,
          fechaVencimiento: fechaVencimiento,
          estado: 'ARMADA',
          codigoBarras: `CAJA-${numeroCaja}`
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: degradacion,
      message: `Degradación registrada: ${tipo} - ${pesoDegradado} kg`
    })
  } catch (error) {
    console.error('Error creating degradación:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar degradación' },
      { status: 500 }
    )
  }
}
