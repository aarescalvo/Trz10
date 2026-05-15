import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Listar cajas de empaque
// Nota: Este endpoint usa el modelo CajaEmpaque (cajas de empaque de productos),
// ya que no existe un modelo "Caja" (caja registradora) en el schema.
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeEmpaque')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const estado = searchParams.get('estado')
    const productoId = searchParams.get('productoId')

    // Si se pasa un ID específico, devolver esa caja con sus relaciones
    if (id) {
      const caja = await db.cajaEmpaque.findUnique({
        where: { id },
        include: {
          producto: {
            select: { id: true, codigo: true, nombre: true }
          },
          lote: {
            select: { id: true, numero: true }
          },
          propietario: {
            select: { id: true, nombre: true }
          },
          pallet: {
            select: { id: true, numero: true, estado: true }
          }
        }
      })
      
      if (!caja) {
        return NextResponse.json(
          { success: false, error: 'Caja no encontrada' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: caja
      })
    }

    const where: Record<string, unknown> = {}
    if (estado) {
      where.estado = estado
    }
    if (productoId) {
      where.productoId = productoId
    }

    const cajas = await db.cajaEmpaque.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        producto: {
          select: { id: true, codigo: true, nombre: true }
        },
        _count: {
          select: {
            degradaciones: true,
            expedicionesItem: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: cajas
    })
  } catch (error) {
    console.error('Error al obtener cajas:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener cajas' },
      { status: 500 }
    )
  }
}

// POST - Crear caja de empaque
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeEmpaque')
  if (authError) return authError
  try {
    const data = await request.json()

    // Validaciones
    if (!data.numero) {
      return NextResponse.json(
        { success: false, error: 'El numero es requerido' },
        { status: 400 }
      )
    }

    // Verificar si ya existe una caja con el mismo numero
    const existente = await db.cajaEmpaque.findUnique({
      where: { numero: data.numero }
    })
    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una caja con ese numero' },
        { status: 400 }
      )
    }

    const caja = await db.cajaEmpaque.create({
      data: {
        numero: data.numero,
        pesoBruto: data.pesoBruto ?? 0,
        pesoNeto: data.pesoNeto ?? 0,
        tara: data.tara ?? 0,
        piezas: data.piezas ?? 1,
        productoId: data.productoId || null,
        loteId: data.loteId || null,
        propietarioId: data.propietarioId || null,
        palletId: data.palletId || null,
        tropaCodigo: data.tropaCodigo || null,
        codigoBarras: data.codigoBarras || null,
        fechaFaena: data.fechaFaena ? new Date(data.fechaFaena) : null,
        fechaDesposte: data.fechaDesposte ? new Date(data.fechaDesposte) : null,
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: caja
    })
  } catch (error) {
    console.error('Error al crear caja:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear caja' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar caja
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeEmpaque')
  if (authError) return authError
  try {
    const data = await request.json()

    if (!data.id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    // Verificar que existe
    const existente = await db.cajaEmpaque.findUnique({
      where: { id: data.id }
    })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Caja no encontrada' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (data.estado !== undefined) updateData.estado = data.estado
    if (data.palletId !== undefined) updateData.palletId = data.palletId || null

    const caja = await db.cajaEmpaque.update({
      where: { id: data.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: caja
    })
  } catch (error) {
    console.error('Error al actualizar caja:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar caja' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar caja
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeEmpaque')
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

    // Verificar que no tenga expediciones asociadas
    const expedicionesAsociadas = await db.cajaEmpaque.findUnique({
      where: { id },
      include: { _count: { select: { expedicionesItem: true } } }
    })

    if (!expedicionesAsociadas) {
      return NextResponse.json(
        { success: false, error: 'Caja no encontrada' },
        { status: 404 }
      )
    }

    if (expedicionesAsociadas._count.expedicionesItem > 0) {
      return NextResponse.json(
        { success: false, error: 'No se puede eliminar, tiene expediciones asociadas' },
        { status: 400 }
      )
    }

    await db.cajaEmpaque.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Caja eliminada correctamente'
    })
  } catch (error) {
    console.error('Error al eliminar caja:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar caja' },
      { status: 500 }
    )
  }
}
