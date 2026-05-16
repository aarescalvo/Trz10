import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener precio sugerido para un cliente y tipo de producto
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    const tipoProducto = searchParams.get('tipoProducto')

    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'clienteId es requerido' },
        { status: 400 }
      )
    }

    if (!tipoProducto) {
      return NextResponse.json(
        { success: false, error: 'tipoProducto es requerido' },
        { status: 400 }
      )
    }

    // PRIORIDAD 1: Precio cliente específico vigente
    const precioCliente = await db.precioCliente.findFirst({
      where: {
        clienteId,
        tipoProducto: tipoProducto as any,
        activo: true,
        OR: [
          { fechaHasta: null },
          { fechaHasta: { gte: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })

    if (precioCliente) {
      return NextResponse.json({
        success: true,
        data: {
          precio: precioCliente.precioKg,
          moneda: 'ARS',
          fuente: 'PRECIO_CLIENTE',
          fuenteDescripcion: 'Precio especial acordado con el cliente',
          precioId: precioCliente.id,
          vigenciaDesde: precioCliente.fechaDesde,
          vigenciaHasta: precioCliente.fechaHasta
        }
      })
    }

    // PRIORIDAD 2: Último precio facturado a este cliente
    const ultimoPrecioFacturado = await db.detalleFactura.findFirst({
      where: {
        facturaId: { not: undefined },
      },
      include: {
        factura: {
          select: {
            fecha: true,
            numero: true,
            clienteId: true
          }
        }
      },
      orderBy: { factura: { fecha: 'desc' } }
    })

    if (ultimoPrecioFacturado) {
      return NextResponse.json({
        success: true,
        data: {
          precio: ultimoPrecioFacturado.precioUnitario,
          moneda: 'ARS',
          fuente: 'ULTIMA_FACTURA',
          fuenteDescripcion: `Último precio facturado (Factura ${ultimoPrecioFacturado.factura.numero})`,
          fechaUltimaFactura: ultimoPrecioFacturado.factura?.fecha,
          facturaId: ultimoPrecioFacturado.facturaId
        }
      })
    }

    // Sin precio disponible
    return NextResponse.json({
      success: true,
      data: {
        precio: 0,
        moneda: 'ARS',
        fuente: 'SIN_PRECIO',
        fuenteDescripcion: 'No hay precio registrado - debe ingresar manualmente'
      }
    })
  } catch (error) {
    console.error('Error obteniendo precio sugerido:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener precio sugerido' },
      { status: 500 }
    )
  }
}
