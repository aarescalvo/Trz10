import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Listar pagos de una factura
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { id } = await params
    
    const pagos = await db.pagoFactura.findMany({
      where: { facturaId: id },
      orderBy: { fecha: 'desc' }
    })

    const factura = await db.factura.findUnique({
      where: { id },
      select: { total: true }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0)
    const saldoPendiente = factura.total - totalPagado

    return NextResponse.json({
      success: true,
      data: pagos,
      resumen: {
        totalFactura: factura.total,
        totalPagado,
        saldoPendiente
      }
    })
  } catch (error) {
    console.error('Error fetching pagos:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener pagos' },
      { status: 500 }
    )
  }
}

// POST - Registrar pago parcial
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const { monto, formaPago, referencia, observaciones, operadorId } = body

    if (!monto || monto <= 0) {
      return NextResponse.json(
        { success: false, error: 'El monto debe ser mayor a cero' },
        { status: 400 }
      )
    }

    // Verificar factura
    const factura = await db.factura.findUnique({
      where: { id },
      include: { pagosFactura: true }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    if (factura.estado === 'ANULADA') {
      return NextResponse.json(
        { success: false, error: 'No se pueden registrar pagos en una factura anulada' },
        { status: 400 }
      )
    }

    const totalPagado = factura.pagosFactura.reduce((sum, p) => sum + p.monto, 0)
    const saldoPendiente = factura.total - totalPagado

    if (monto > saldoPendiente) {
      return NextResponse.json(
        { success: false, error: `El monto excede el saldo pendiente ($${saldoPendiente.toFixed(2)})` },
        { status: 400 }
      )
    }

    // Crear pago
    const pago = await db.pagoFactura.create({
      data: {
        facturaId: id,
        monto,
        metodoPago: formaPago || 'EFECTIVO',
        referencia,
        observaciones,
        operadorId,
        fecha: new Date()
      }
    })

    // Verificar si la factura quedó pagada
    const nuevoTotalPagado = totalPagado + monto
    if (nuevoTotalPagado >= factura.total) {
      await db.factura.update({
        where: { id },
        data: {
          estado: 'PAGADA',
        }
      })
    } else {
      // Cambiar a EMITIDA si estaba PENDIENTE
      if (factura.estado === 'PENDIENTE') {
        await db.factura.update({
          where: { id },
          data: { estado: 'EMITIDA' }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: pago,
      message: `Pago de $${monto.toFixed(2)} registrado exitosamente`
    })
  } catch (error) {
    console.error('Error creating pago:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar pago' },
      { status: 500 }
    )
  }
}
