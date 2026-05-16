import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Listar lotes de despostada
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')

    const where: Record<string, unknown> = {}
    if (estado) where.estado = estado

    const lotes = await db.loteDespostada.findMany({
      where,
      include: {
        operador: {
          select: { id: true, nombre: true }
        },
        movimientos: {
          select: {
            id: true,
            tipo: true,
            pesoNeto: true,
            pesoOriginal: true
          }
        }
      },
      orderBy: { fecha: 'desc' }
    })

    // Calcular totales por lote
    const lotesConTotales = lotes.map(lote => {
      const totalCortes = lote.movimientos.filter(m => m.tipo === 'CORTE').length
      const totalKgCortes = lote.movimientos
        .filter(m => m.tipo === 'CORTE')
        .reduce((acc, m) => acc + (m.pesoNeto || 0), 0)
      const totalHuesos = lote.movimientos
        .filter(m => m.tipo === 'HUESO')
        .reduce((acc, m) => acc + (m.pesoNeto || 0), 0)
      const totalGrasas = lote.movimientos
        .filter(m => m.tipo === 'GRASA')
        .reduce((acc, m) => acc + (m.pesoNeto || 0), 0)
      const totalMermas = lote.movimientos
        .filter(m => m.tipo === 'MERMA' || m.tipo === 'DESPERDICIO')
        .reduce((acc, m) => acc + (m.pesoNeto || 0), 0)

      return {
        ...lote,
        resumen: {
          totalCortes,
          totalKgCortes,
          totalHuesos,
          totalGrasas,
          totalMermas
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: lotesConTotales
    })
  } catch (error) {
    console.error('Error fetching lotes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener lotes de despostada' },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo lote
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const body = await request.json()
    const { observaciones, operadorId } = body

    // Obtener el último número de lote
    const ultimoLote = await db.loteDespostada.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true }
    })

    const numero = (ultimoLote?.numero || 0) + 1

    const lote = await db.loteDespostada.create({
      data: {
        numero,
        anio: new Date().getFullYear(),
        estado: 'ABIERTO',
        observaciones: observaciones || null,
        operadorId: operadorId || null
      }
    })

    return NextResponse.json({
      success: true,
      data: lote,
      message: `Lote #${numero} creado correctamente`
    })
  } catch (error) {
    console.error('Error creating lote:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear lote' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar lote (cerrar/anular)
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeDesposte')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, estado, totalKg, observaciones } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (estado) updateData.estado = estado
    if (totalKg !== undefined) updateData.totalKg = totalKg
    if (observaciones !== undefined) updateData.observaciones = observaciones

    const lote = await db.loteDespostada.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: lote,
      message: 'Lote actualizado correctamente'
    })
  } catch (error) {
    console.error('Error updating lote:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar lote' },
      { status: 500 }
    )
  }
}
