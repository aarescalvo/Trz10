import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener factura por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { id } = await params
    
    const factura = await db.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        detalles: true,
        pagosFactura: {
          orderBy: { fecha: 'desc' }
        }
      }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Calcular saldo
    const totalPagado = factura.pagosFactura.reduce((sum, p) => sum + p.monto, 0)
    const saldoPendiente = factura.total - totalPagado

    return NextResponse.json({
      success: true,
      data: {
        ...factura,
        totalPagado,
        saldoPendiente
      }
    })
  } catch (error) {
    console.error('Error fetching factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener factura' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar factura
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const {
      clienteId,
      condicionVenta,
      remito,
      observaciones,
      detalles,
      tipoIva = 21 // Porcentaje de IVA, default 21%
    } = body

    // Verificar que la factura existe y no está pagada
    const facturaExistente = await db.factura.findUnique({
      where: { id },
      include: { pagosFactura: true }
    })

    if (!facturaExistente) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    if (facturaExistente.estado === 'PAGADA') {
      return NextResponse.json(
        { success: false, error: 'No se puede modificar una factura pagada' },
        { status: 400 }
      )
    }

    if (facturaExistente.estado === 'ANULADA') {
      return NextResponse.json(
        { success: false, error: 'No se puede modificar una factura anulada' },
        { status: 400 }
      )
    }

    // Si hay detalles, recalcular y actualizar
    if (detalles && detalles.length > 0) {
      let subtotal = 0
      for (const det of detalles) {
        subtotal += det.cantidad * det.precioUnitario
      }
      const ivaRate = Number(tipoIva) / 100 || 0.21
      const iva = subtotal * ivaRate
      const total = subtotal + iva

      // Eliminar detalles existentes y crear nuevos
      await db.detalleFactura.deleteMany({
        where: { facturaId: id }
      })

      await db.factura.update({
        where: { id },
        data: {
          clienteId,
          condicionVenta,
          remito,
          observaciones,
          subtotal,
          iva,
          total,
          detalles: {
            create: detalles.map((det: {
              tipoProducto: string
              descripcion: string
              cantidad: number
              unidad: string
              precioUnitario: number
              tropaCodigo?: string
              garron?: number
              mediaResId?: string
              pesoKg?: number
            }) => ({
              tipoProducto: det.tipoProducto,
              descripcion: det.descripcion,
              cantidad: det.cantidad,
              unidad: det.unidad || 'KG',
              precioUnitario: det.precioUnitario,
              subtotal: det.cantidad * det.precioUnitario,
              tropaCodigo: det.tropaCodigo,
              garron: det.garron,
              mediaResId: det.mediaResId,
              pesoKg: det.pesoKg
            }))
          }
        },
        include: {
          cliente: true,
          detalles: true
        }
      })
    } else {
      // Solo actualizar campos básicos
      await db.factura.update({
        where: { id },
        data: {
          condicionVenta,
          remito,
          observaciones
        }
      })
    }

    const facturaActualizada = await db.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        detalles: true,
        pagosFactura: true
      }
    })

    return NextResponse.json({
      success: true,
      data: facturaActualizada,
      message: 'Factura actualizada exitosamente'
    })
  } catch (error) {
    console.error('Error updating factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar factura' },
      { status: 500 }
    )
  }
}

// DELETE - Anular factura
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { id } = await params

    const factura = await db.factura.findUnique({
      where: { id }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    if (factura.estado === 'ANULADA') {
      return NextResponse.json(
        { success: false, error: 'La factura ya está anulada' },
        { status: 400 }
      )
    }

    const facturaAnulada = await db.factura.update({
      where: { id },
      data: { estado: 'ANULADA' }
    })

    return NextResponse.json({
      success: true,
      data: facturaAnulada,
      message: `Factura ${factura.numero} anulada`
    })
  } catch (error) {
    console.error('Error annulling factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al anular factura' },
      { status: 500 }
    )
  }
}
