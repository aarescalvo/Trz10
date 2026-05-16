import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Listar movimientos de despostada
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const loteId = searchParams.get('loteId')
    const tipo = searchParams.get('tipo')
    const fecha = searchParams.get('fecha')

    const where: Record<string, unknown> = {}
    if (loteId) where.loteId = loteId
    if (tipo) where.tipo = tipo
    if (fecha) {
      const fechaInicio = new Date(fecha + 'T00:00:00')
      const fechaFin = new Date(fecha + 'T23:59:59')
      where.fecha = { gte: fechaInicio, lte: fechaFin }
    }

    const movimientos = await db.movimientoDespostada.findMany({
      where,
      include: {
        lote: {
          select: { id: true, numero: true, estado: true }
        },
        operador: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular estadísticas
    const stats = {
      total: movimientos.length,
      totalKgNeto: movimientos.reduce((acc, m) => acc + (m.pesoNeto || 0), 0),
      totalKgBruto: movimientos.reduce((acc, m) => acc + (m.pesoOriginal || 0), 0),
      totalMermas: movimientos.reduce((acc, m) => acc + (m.pesoDesperdicio || 0), 0),
      porTipo: {
        CORTE: movimientos.filter(m => m.tipo === 'CORTE').length,
        HUESO: movimientos.filter(m => m.tipo === 'HUESO').length,
        GRASA: movimientos.filter(m => m.tipo === 'GRASA').length,
        MERMA: movimientos.filter(m => m.tipo === 'MERMA').length,
        DESPERDICIO: movimientos.filter(m => m.tipo === 'DESPERDICIO').length
      },
      porDestino: {
        PRODUCCION: movimientos.filter(m => m.destino === 'PRODUCCION').length,
        RECORTE: movimientos.filter(m => m.destino === 'RECORTE').length,
        DESECHO: movimientos.filter(m => m.destino === 'DESECHO').length
      }
    }

    return NextResponse.json({
      success: true,
      data: movimientos,
      stats
    })
  } catch (error) {
    console.error('Error fetching movimientos:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener movimientos' },
      { status: 500 }
    )
  }
}

// POST - Crear movimiento
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      loteId,
      tipo,
      productoId,
      pesoBruto,
      pesoNeto,
      pesoDesperdicio,
      destino,
      causa,
      tropaCodigo,
      observaciones,
      operadorId
    } = body

    if (!tipo) {
      return NextResponse.json(
        { success: false, error: 'El tipo es requerido' },
        { status: 400 }
      )
    }

    const movimiento = await db.movimientoDespostada.create({
      data: {
        loteId: loteId!,
        tipo,
        productoId: productoId || null,
        pesoOriginal: pesoBruto || 0,
        pesoNeto: pesoNeto || 0,
        pesoDesperdicio: pesoDesperdicio || 0,
        destino: destino || null,
        causa: causa || null,
        observaciones: observaciones || null,
        operadorId: operadorId || null
      }
    })

    // Si hay lote, actualizar totalKg
    if (loteId && pesoNeto) {
      const lote = await db.loteDespostada.findUnique({
        where: { id: loteId },
        include: {
          movimientos: {
            select: { pesoNeto: true }
          }
        }
      })
      
      if (lote) {
        const totalKg = lote.movimientos.reduce((acc, m) => acc + (m.pesoNeto || 0), 0)
        await db.loteDespostada.update({
          where: { id: loteId },
          data: { totalKg }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: movimiento,
      message: 'Movimiento registrado correctamente'
    })
  } catch (error) {
    console.error('Error creating movimiento:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar movimiento' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar movimiento
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const movimiento = await db.movimientoDespostada.update({
      where: { id },
      data
    })

    return NextResponse.json({
      success: true,
      data: movimiento,
      message: 'Movimiento actualizado correctamente'
    })
  } catch (error) {
    console.error('Error updating movimiento:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar movimiento' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar movimiento
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
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

    // Obtener el movimiento antes de eliminar para actualizar el lote
    const movimiento = await db.movimientoDespostada.findUnique({
      where: { id }
    })

    await db.movimientoDespostada.delete({
      where: { id }
    })

    // Actualizar totalKg del lote si corresponde
    if (movimiento?.loteId) {
      const lote = await db.loteDespostada.findUnique({
        where: { id: movimiento.loteId },
        include: {
          movimientos: {
            select: { pesoNeto: true }
          }
        }
      })
      
      if (lote) {
        const totalKg = lote.movimientos.reduce((acc, m) => acc + (m.pesoNeto || 0), 0)
        await db.loteDespostada.update({
          where: { id: movimiento.loteId },
          data: { totalKg }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Movimiento eliminado correctamente'
    })
  } catch (error) {
    console.error('Error deleting movimiento:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar movimiento' },
      { status: 500 }
    )
  }
}
