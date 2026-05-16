import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Listar registros de rendering
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const estado = searchParams.get('estado')

    const where: Record<string, unknown> = {}
    if (tipo) where.tipo = tipo
    if (estado) where.estado = estado

    const registros = await db.registroRendering.findMany({
      where,
      include: {
        operador: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular estadísticas por tipo
    const stats = {
      total: registros.length,
      pesoTotal: registros.reduce((acc, r) => acc + r.pesoKg, 0),
      porTipo: {
        GRASA: {
          cantidad: registros.filter(r => r.tipo === 'GRASA').length,
          peso: registros.filter(r => r.tipo === 'GRASA').reduce((acc, r) => acc + r.pesoKg, 0)
        },
        DESPERDICIOS: {
          cantidad: registros.filter(r => r.tipo === 'DESPERDICIOS').length,
          peso: registros.filter(r => r.tipo === 'DESPERDICIOS').reduce((acc, r) => acc + r.pesoKg, 0)
        },
        FONDO_DIGESTOR: {
          cantidad: registros.filter(r => r.tipo === 'FONDO_DIGESTOR').length,
          peso: registros.filter(r => r.tipo === 'FONDO_DIGESTOR').reduce((acc, r) => acc + r.pesoKg, 0)
        },
        SANGRE: {
          cantidad: registros.filter(r => r.tipo === 'SANGRE').length,
          peso: registros.filter(r => r.tipo === 'SANGRE').reduce((acc, r) => acc + r.pesoKg, 0)
        }
      },
      pendientes: registros.filter(r => !r.despachado).length,
      despachados: registros.filter(r => r.despachado).length
    }

    return NextResponse.json({
      success: true,
      data: registros,
      stats
    })
  } catch (error) {
    console.error('Error fetching rendering:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener registros de rendering' },
      { status: 500 }
    )
  }
}

// POST - Crear registro de rendering
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      tipo,
      fechaFaena,
      pesoKg,
      destino,
      observaciones,
      operadorId
    } = body

    if (!tipo) {
      return NextResponse.json(
        { success: false, error: 'El tipo es requerido' },
        { status: 400 }
      )
    }

    if (!pesoKg || pesoKg <= 0) {
      return NextResponse.json(
        { success: false, error: 'El peso es requerido y debe ser mayor a 0' },
        { status: 400 }
      )
    }

    const registro = await db.registroRendering.create({
      data: {
        tipo,
        fechaFaena: fechaFaena ? new Date(fechaFaena) : undefined,
        pesoKg,
        destino: destino || null,
        observaciones: observaciones || null,
        operadorId: operadorId || null
      }
    })

    return NextResponse.json({
      success: true,
      data: registro,
      message: 'Registro de rendering creado correctamente'
    })
  } catch (error) {
    console.error('Error creating rendering:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear registro de rendering' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar registro
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, ...bodyData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    // Whitelist only valid RegistroRendering fields
    const data = {
      tipo: bodyData.tipo,
      fechaFaena: bodyData.fechaFaena ? new Date(bodyData.fechaFaena) : undefined,
      pesoKg: bodyData.pesoKg ? parseFloat(bodyData.pesoKg) : undefined,
      destino: bodyData.destino,
      despachado: bodyData.despachado,
      remito: bodyData.remito,
      fechaDespacho: bodyData.fechaDespacho ? new Date(bodyData.fechaDespacho) : undefined,
      observaciones: bodyData.observaciones,
      operadorId: bodyData.operadorId,
    }

    const registro = await db.registroRendering.update({
      where: { id },
      data
    })

    return NextResponse.json({
      success: true,
      data: registro,
      message: 'Registro actualizado correctamente'
    })
  } catch (error) {
    console.error('Error updating rendering:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar registro' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar registro
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
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

    await db.registroRendering.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Registro eliminado correctamente'
    })
  } catch (error) {
    console.error('Error deleting rendering:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar registro' },
      { status: 500 }
    )
  }
}
