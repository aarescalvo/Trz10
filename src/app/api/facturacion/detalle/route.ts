import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET: Obtener detalles de una factura
// Uses existing Factura and DetalleFactura models (not the non-existent facturaServicio/detalleFacturaServicio)
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const facturaId = searchParams.get('facturaId')

    if (facturaId) {
      // Obtener detalles de una factura específica
      const detalles = await db.detalleFactura.findMany({
        where: { facturaId },
        include: {
          factura: {
            include: {
              cliente: true
            }
          },
          tiposServicio: true
        }
      })

      return NextResponse.json({
        success: true,
        data: detalles
      })
    }

    // Obtener todos los detalles con factura
    const detalles = await db.detalleFactura.findMany({
      include: {
        factura: {
          select: {
            id: true,
            numero: true,
            estado: true,
            cliente: {
              select: { id: true, nombre: true }
            }
          }
        },
        tiposServicio: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: detalles
    })
  } catch (error) {
    console.error('Error fetching detalles:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener detalles' },
      { status: 500 }
    )
  }
}

// POST: Agregar detalle a factura
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      facturaId,
      tipoServicioId,
      descripcion,
      cantidad,
      unidad,
      precioUnitario,
    } = body

    // Verificar que la factura existe y está pendiente
    const factura = await db.factura.findUnique({
      where: { id: facturaId },
      include: { cliente: true }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 400 }
      )
    }

    if (factura.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden agregar detalles a facturas pendientes' },
        { status: 400 }
      )
    }

    const subtotal = (cantidad || 1) * (precioUnitario || 0)

    // Crear detalle
    const detalle = await db.detalleFactura.create({
      data: {
        facturaId,
        tipoProducto: 'OTRO',
        descripcion: descripcion || '',
        cantidad: cantidad || 1,
        unidad: unidad || 'UN',
        precioUnitario: precioUnitario || 0,
        subtotal,
      }
    })

    // Recalcular totales de la factura
    const todosDetalles = await db.detalleFactura.findMany({
      where: { facturaId }
    })

    const nuevoSubtotal = todosDetalles.reduce((sum, d) => sum + d.subtotal, 0)
    const porcentajeIva = 21 // IVA estándar (porcentajeIva no existe en Factura)
    const nuevoIva = nuevoSubtotal * (porcentajeIva / 100)
    const nuevoTotal = nuevoSubtotal + nuevoIva

    await db.factura.update({
      where: { id: facturaId },
      data: {
        subtotal: nuevoSubtotal,
        iva: nuevoIva,
        total: nuevoTotal
      }
    })

    return NextResponse.json({
      success: true,
      data: detalle
    })
  } catch (error) {
    console.error('Error creating detalle:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear detalle: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// PUT: Actualizar detalle
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      id,
      descripcion,
      cantidad,
      precioUnitario,
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de detalle requerido' },
        { status: 400 }
      )
    }

    // Obtener detalle actual
    const detalleActual = await db.detalleFactura.findUnique({
      where: { id },
      include: { factura: true }
    })

    if (!detalleActual) {
      return NextResponse.json(
        { success: false, error: 'Detalle no encontrado' },
        { status: 400 }
      )
    }

    if (detalleActual.factura.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden modificar detalles de facturas pendientes' },
        { status: 400 }
      )
    }

    const newCantidad = cantidad ?? detalleActual.cantidad
    const newPrecioUnitario = precioUnitario ?? detalleActual.precioUnitario
    const nuevoSubtotal = newCantidad * newPrecioUnitario

    // Actualizar detalle
    const detalle = await db.detalleFactura.update({
      where: { id },
      data: {
        descripcion: descripcion ?? detalleActual.descripcion,
        cantidad: newCantidad,
        precioUnitario: newPrecioUnitario,
        subtotal: nuevoSubtotal,
      }
    })

    // Recalcular totales de la factura
    const todosDetalles = await db.detalleFactura.findMany({
      where: { facturaId: detalleActual.facturaId }
    })

    const subtotalFactura = todosDetalles.reduce((sum, d) => sum + d.subtotal, 0)
    const porcentajeIva = 21 // IVA estándar (porcentajeIva no existe en Factura)
    const nuevoIva = subtotalFactura * (porcentajeIva / 100)
    const nuevoTotal = subtotalFactura + nuevoIva

    await db.factura.update({
      where: { id: detalleActual.facturaId },
      data: {
        subtotal: subtotalFactura,
        iva: nuevoIva,
        total: nuevoTotal
      }
    })

    return NextResponse.json({
      success: true,
      data: detalle
    })
  } catch (error) {
    console.error('Error updating detalle:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar detalle' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar detalle
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de detalle requerido' },
        { status: 400 }
      )
    }

    // Obtener detalle actual
    const detalleActual = await db.detalleFactura.findUnique({
      where: { id },
      include: { factura: true }
    })

    if (!detalleActual) {
      return NextResponse.json(
        { success: false, error: 'Detalle no encontrado' },
        { status: 400 }
      )
    }

    if (detalleActual.factura.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden eliminar detalles de facturas pendientes' },
        { status: 400 }
      )
    }

    const facturaId = detalleActual.facturaId

    // Eliminar detalle
    await db.detalleFactura.delete({
      where: { id }
    })

    // Recalcular totales de la factura
    const detallesRestantes = await db.detalleFactura.findMany({
      where: { facturaId }
    })

    const subtotal = detallesRestantes.reduce((sum, d) => sum + d.subtotal, 0)
    const porcentajeIva = 21 // IVA estándar (porcentajeIva no existe en Factura)
    const nuevoIva = subtotal * (porcentajeIva / 100)
    const nuevoTotal = subtotal + nuevoIva

    await db.factura.update({
      where: { id: facturaId },
      data: {
        subtotal,
        iva: nuevoIva,
        total: nuevoTotal
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Detalle eliminado correctamente'
    })
  } catch (error) {
    console.error('Error deleting detalle:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar detalle' },
      { status: 500 }
    )
  }
}
