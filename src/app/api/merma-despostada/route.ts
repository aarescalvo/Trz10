import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Nota: No existe un modelo MermaDespostada. Las mermas se registran
// como MovimientoDespostada con tipo HUESO, GRASA, MERMA o DESECHO.

// GET - Listar mermas de despostada
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const loteId = searchParams.get('loteId')
    const tipo = searchParams.get('tipo')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    const where: any = {}
    if (loteId) where.loteId = loteId
    // Solo mostrar movimientos de tipo merma (no CORTE)
    where.tipo = { in: ['HUESO', 'GRASA', 'MERMA', 'DESPERDICIO'] }
    if (tipo) where.tipo = tipo
    if (fechaDesde || fechaHasta) {
      where.createdAt = {}
      if (fechaDesde) where.createdAt.gte = new Date(fechaDesde)
      if (fechaHasta) where.createdAt.lte = new Date(fechaHasta)
    }

    const mermas = await db.movimientoDespostada.findMany({
      where,
      include: {
        lote: {
          select: { 
            id: true, 
            numero: true, 
            totalKg: true
          }
        },
        operador: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular estadísticas
    const stats = {
      total: mermas.length,
      pesoTotal: mermas.reduce((acc, m) => acc + (m.pesoDesperdicio || 0), 0),
      porTipo: {
        hueso: mermas.filter(m => m.tipo === 'HUESO').reduce((acc, m) => acc + (m.pesoDesperdicio || 0), 0),
        grasa: mermas.filter(m => m.tipo === 'GRASA').reduce((acc, m) => acc + (m.pesoDesperdicio || 0), 0),
        merma: mermas.filter(m => m.tipo === 'MERMA').reduce((acc, m) => acc + (m.pesoDesperdicio || 0), 0),
        desperdicio: mermas.filter(m => m.tipo === 'DESPERDICIO').reduce((acc, m) => acc + (m.pesoDesperdicio || 0), 0),
      }
    }

    return NextResponse.json({ success: true, data: mermas, stats })
  } catch (error) {
    console.error('Error al obtener mermas:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener mermas' }, { status: 500 })
  }
}

// POST - Registrar nueva merma
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const body = await request.json()
    const { loteId, tipo, pesoKg, observaciones, operadorId, productoNombre } = body

    if (!loteId || !tipo || !pesoKg) {
      return NextResponse.json({ 
        success: false, 
        error: 'Lote, tipo y peso son requeridos' 
      }, { status: 400 })
    }

    // Verificar que el lote existe y está abierto
    const lote = await db.loteDespostada.findUnique({
      where: { id: loteId }
    })

    if (!lote) {
      return NextResponse.json({ success: false, error: 'Lote no encontrado' }, { status: 404 })
    }

    if (lote.estado !== 'ABIERTO') {
      return NextResponse.json({ 
        success: false, 
        error: 'No se pueden agregar mermas a un lote cerrado' 
      }, { status: 400 })
    }

    // Crear merma como MovimientoDespostada
    const merma = await db.movimientoDespostada.create({
      data: {
        loteId,
        tipo,
        pesoOriginal: 0,
        pesoDesperdicio: pesoKg,
        observaciones,
        operadorId
      },
      include: {
        lote: {
          select: { id: true, numero: true }
        },
        operador: {
          select: { id: true, nombre: true }
        }
      }
    })

    // Actualizar total kg del lote
    await db.loteDespostada.update({
      where: { id: loteId },
      data: {
        totalKg: {
          increment: pesoKg
        }
      }
    })

    return NextResponse.json({ success: true, data: merma })
  } catch (error) {
    console.error('Error al crear merma:', error)
    return NextResponse.json({ success: false, error: 'Error al crear merma' }, { status: 500 })
  }
}

// PUT - Actualizar merma
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, tipo, pesoKg, observaciones } = body

    const mermaActual = await db.movimientoDespostada.findUnique({
      where: { id },
      include: { lote: true }
    })

    if (!mermaActual) {
      return NextResponse.json({ success: false, error: 'Merma no encontrada' }, { status: 404 })
    }

    if (mermaActual.lote?.estado !== 'ABIERTO') {
      return NextResponse.json({ 
        success: false, 
        error: 'No se puede modificar una merma de un lote cerrado' 
      }, { status: 400 })
    }

    const updateData: any = {}
    if (tipo) updateData.tipo = tipo
    if (observaciones) updateData.observaciones = observaciones

    // Si cambia el peso, actualizar el lote
    if (pesoKg !== undefined && mermaActual.pesoDesperdicio !== null && pesoKg !== mermaActual.pesoDesperdicio) {
      const diferencia = pesoKg - (mermaActual.pesoDesperdicio || 0)
      updateData.pesoDesperdicio = pesoKg

      if (mermaActual.loteId) {
        await db.loteDespostada.update({
          where: { id: mermaActual.loteId },
          data: {
            totalKg: {
              increment: diferencia
            }
          }
        })
      }
    }

    const merma = await db.movimientoDespostada.update({
      where: { id },
      data: updateData,
      include: {
        lote: {
          select: { id: true, numero: true }
        },
        operador: {
          select: { id: true, nombre: true }
        }
      }
    })

    return NextResponse.json({ success: true, data: merma })
  } catch (error) {
    console.error('Error al actualizar merma:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar merma' }, { status: 500 })
  }
}

// DELETE - Eliminar merma
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    }

    const merma = await db.movimientoDespostada.findUnique({
      where: { id },
      include: { lote: true }
    })

    if (!merma) {
      return NextResponse.json({ success: false, error: 'Merma no encontrada' }, { status: 404 })
    }

    if (merma.lote?.estado !== 'ABIERTO') {
      return NextResponse.json({ 
        success: false, 
        error: 'No se puede eliminar una merma de un lote cerrado' 
      }, { status: 400 })
    }

    // Restar del lote
    if (merma.loteId) {
      await db.loteDespostada.update({
        where: { id: merma.loteId },
        data: {
          totalKg: {
            decrement: merma.pesoDesperdicio || 0
          }
        }
      })
    }

    // Eliminar merma
    await db.movimientoDespostada.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar merma:', error)
    return NextResponse.json({ success: false, error: 'Error al eliminar merma' }, { status: 500 })
  }
}
