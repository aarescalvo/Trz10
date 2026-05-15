import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Fetch stock de cámaras con resumen
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const camaraId = searchParams.get('camaraId')
    const busqueda = searchParams.get('busqueda')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    // Si hay búsqueda, buscar medias por código, tropa o garrón
    if (busqueda) {
      const medias = await db.mediaRes.findMany({
        where: {
          OR: [
            { codigo: { contains: busqueda.toUpperCase() } },
            { romaneo: { tropaCodigo: { contains: busqueda.toUpperCase() } } },
            { romaneo: { garron: busqueda ? parseInt(busqueda) || 0 : 0 } }
          ]
        },
        include: {
          camara: { select: { nombre: true } },
          romaneo: { select: { garron: true, tropaCodigo: true, pesoVivo: true } }
        },
        take: 50
      })

      return NextResponse.json({
        success: true,
        data: {
          medias: medias.map(m => ({
            id: m.id,
            codigo: m.codigo,
            lado: m.lado,
            peso: m.peso,
            sigla: m.sigla,
            estado: m.estado,
            camara: m.camara?.nombre,
            romaneo: m.romaneo
          }))
        }
      })
    }

    // Si hay camaraId específico, obtener medias de esa cámara
    if (camaraId) {
      const medias = await db.mediaRes.findMany({
        where: { 
          camaraId,
          estado: 'EN_CAMARA'
        },
        include: {
          romaneo: { select: { garron: true, tropaCodigo: true, pesoVivo: true } }
        },
        orderBy: { createdAt: 'desc' }
      })

      return NextResponse.json({
        success: true,
        data: {
          medias: medias.map(m => ({
            id: m.id,
            codigo: m.codigo,
            lado: m.lado,
            peso: m.peso,
            sigla: m.sigla,
            estado: m.estado,
            romaneo: m.romaneo
          }))
        }
      })
    }

    // Obtener todas las cámaras con su stock
    const camaras = await db.camara.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        stockMedias: true,
        mediasRes: {
          where: { estado: 'EN_CAMARA' },
          include: { romaneo: { select: { tropaCodigo: true, pesoTotal: true } } }
        },
        movimientosDestino: {
          where: fechaDesde || fechaHasta ? {
            fecha: {
              gte: fechaDesde ? new Date(fechaDesde) : undefined,
              lte: fechaHasta ? new Date(fechaHasta + 'T23:59:59') : undefined
            }
          } : undefined,
          orderBy: { fecha: 'desc' },
          take: 50
        }
      }
    })

    // Calcular resumen por cámara
    const resumenCamaras = camaras.map(camara => {
      const totalMedias = camara.mediasRes.length
      const pesoTotal = camara.mediasRes.reduce((acc, m) => {
        return acc + (m.peso || 0)
      }, 0)

      const stockPorEspecie: Record<string, { cantidad: number; peso: number }> = {}

      camara.stockMedias.forEach(stock => {
        const key = stock.especie
        if (!stockPorEspecie[key]) {
          stockPorEspecie[key] = { cantidad: 0, peso: 0 }
        }
        stockPorEspecie[key].cantidad += stock.cantidad
        stockPorEspecie[key].peso += stock.pesoTotal
      })

      // Calcular ocupación
      const ocupacion = camara.capacidad > 0 
        ? Math.round((totalMedias / camara.capacidad) * 100) 
        : 0

      return {
        id: camara.id,
        nombre: camara.nombre,
        tipo: camara.tipo,
        capacidad: camara.capacidad,
        totalMedias,
        pesoTotal,
        ocupacion,
        stockPorEspecie,
        alertaStockBajo: false, // Se calcula después
        movimientosRecientes: camara.movimientosDestino.length
      }
    })

    // Obtener movimientos recientes
    const movimientos = await db.movimientoCamara.findMany({
      take: 100,
      orderBy: { fecha: 'desc' },
      include: {
        camaraOrigen: { select: { nombre: true } },
        camaraDestino: { select: { nombre: true } },
        operador: { select: { nombre: true } }
      }
    })

    // Obtener medias res en stock con detalles
    let mediasQuery: Record<string, unknown> = { estado: 'EN_CAMARA' }
    if (camaraId) {
      mediasQuery.camaraId = camaraId
    }

    const mediasEnStock = await db.mediaRes.findMany({
      where: mediasQuery,
      include: {
        camara: { select: { nombre: true, tipo: true } },
        romaneo: {
          select: {
            garron: true,
            tropaCodigo: true,
            pesoTotal: true,
            fecha: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    })

    // Calcular estadísticas generales
    const stats = {
      totalCamaras: camaras.length,
      totalMedias: mediasEnStock.length,
      pesoTotal: mediasEnStock.reduce((acc, m) => acc + (m.peso || 0), 0),
      movimientosHoy: movimientos.filter(m => 
        new Date(m.fecha).toDateString() === new Date().toDateString()
      ).length,
      alertas: resumenCamaras.filter(c => c.alertaStockBajo).length
    }

    return NextResponse.json({
      success: true,
      data: {
        resumenCamaras,
        movimientos: movimientos.map(m => ({
          id: m.id,
          fecha: m.fecha.toISOString(),
          camaraOrigen: m.camaraOrigen?.nombre || null,
          camaraDestino: m.camaraDestino?.nombre || null,
          producto: m.producto,
          cantidad: m.cantidad,
          peso: m.peso ?? null,
          tropaCodigo: m.tropaCodigo,
          observaciones: m.observaciones,
          operador: m.operador?.nombre || null
        })),
        mediasEnStock: mediasEnStock.map(m => ({
          id: m.id,
          codigo: m.codigo,
          lado: m.lado,
          peso: m.peso,
          sigla: m.sigla,
          camara: m.camara?.nombre,
          tropaCodigo: m.romaneo?.tropaCodigo,
          garron: m.romaneo?.garron,
          fechaIngreso: m.createdAt.toISOString()
        })),
        stats
      }
    })
  } catch (error) {
    console.error('[Stock Cámaras API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener stock de cámaras' },
      { status: 500 }
    )
  }
}

// POST - Registrar movimiento de stock
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const body = await request.json()
    const { 
      tipo, 
      camaraOrigenId, 
      camaraDestinoId, 
      producto, 
      cantidad, 
      peso, 
      tropaCodigo, 
      mediaResId,
      observaciones,
      operadorId 
    } = body

    if (!tipo || !producto) {
      return NextResponse.json(
        { success: false, error: 'Tipo y producto son requeridos' },
        { status: 400 }
      )
    }

    // Crear el movimiento
    const movimiento = await db.movimientoCamara.create({
      data: {
        camaraOrigenId: camaraOrigenId || null,
        camaraDestinoId: camaraDestinoId || null,
        producto,
        cantidad: cantidad || null,
        peso: peso || null,
        tropaCodigo: tropaCodigo || null,
        mediaResId: mediaResId || null,
        observaciones: observaciones || null,
        operadorId: operadorId || null
      },
      include: {
        camaraOrigen: { select: { nombre: true } },
        camaraDestino: { select: { nombre: true } }
      }
    })

    // Actualizar stock según el tipo de movimiento
    if (tipo === 'INGRESO' && camaraDestinoId) {
      // Actualizar o crear stock
      // Por ahora solo registramos el movimiento
    } else if (tipo === 'EGRESO' && camaraOrigenId) {
      // Registrar egreso
    } else if (tipo === 'TRANSFERENCIA' && camaraOrigenId && camaraDestinoId) {
      // Transferir entre cámaras
      if (mediaResId) {
        await db.mediaRes.update({
          where: { id: mediaResId },
          data: { camaraId: camaraDestinoId }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: movimiento.id,
        fecha: movimiento.fecha.toISOString(),
        camaraOrigen: movimiento.camaraOrigen?.nombre || null,
        camaraDestino: movimiento.camaraDestino?.nombre || null,
        producto: movimiento.producto,
        cantidad: movimiento.cantidad,
        peso: movimiento.peso
      }
    })
  } catch (error) {
    console.error('[Stock Cámaras API] Error creating movimiento:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar movimiento' },
      { status: 500 }
    )
  }
}
