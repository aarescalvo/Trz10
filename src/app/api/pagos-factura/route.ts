import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Listar pagos de factura
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const facturaId = searchParams.get('facturaId')
    const clienteId = searchParams.get('clienteId')
    const metodoPago = searchParams.get('metodoPago')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    const where: Record<string, unknown> = {}

    if (facturaId) where.facturaId = facturaId
    if (metodoPago) where.metodoPago = metodoPago
    
    if (desde || hasta) {
      (where as Record<string, unknown>).fecha = {}
      if (desde) (where as Record<string, { gte?: Date; lte?: Date }>).fecha.gte = new Date(desde)
      if (hasta) (where as Record<string, { gte?: Date; lte?: Date }>).fecha.lte = new Date(hasta + 'T23:59:59')
    }

    // Si se busca por cliente, hay que join con factura
    if (clienteId) {
      where.factura = { clienteId }
    }

    const pagos = await db.pagoFactura.findMany({
      where,
      include: {
        factura: {
          include: {
            cliente: {
              select: {
                id: true,
                nombre: true,
                cuit: true,
                razonSocial: true
              }
            }
          }
        },
        operador: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: { fecha: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: pagos
    })
  } catch (error) {
    console.error('Error fetching pagos factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener pagos de factura' },
      { status: 500 }
    )
  }
}

// POST - Registrar nuevo pago
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { 
      facturaId, 
      monto, 
      metodoPago, 
      referencia, 
      banco, 
      numeroCheque, 
      fechaCheque, 
      observaciones, 
      operadorId 
    } = body

    if (!facturaId || monto === undefined) {
      return NextResponse.json(
        { success: false, error: 'Factura y monto son requeridos' },
        { status: 400 }
      )
    }

    // Obtener factura actual
    const factura = await db.factura.findUnique({
      where: { id: facturaId }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Crear el pago y actualizar saldo en transacción
    const resultado = await db.$transaction(async (tx) => {
      // Crear pago
      const pago = await tx.pagoFactura.create({
        data: {
          facturaId,
          monto,
          metodoPago: metodoPago || 'EFECTIVO',
          referencia,
          banco,
          numeroCheque,
          fechaCheque: fechaCheque ? new Date(fechaCheque) : null,
          observaciones,
          operadorId
        },
        include: {
          factura: {
            include: {
              cliente: {
                select: {
                  id: true,
                  nombre: true,
                  cuit: true,
                  razonSocial: true
                }
              }
            }
          }
        }
      })

      // Calcular saldo dinámicamente (no hay campo saldo en Factura)
      const pagosExistentes = await tx.pagoFactura.findMany({ where: { facturaId } })
      const totalPagadoAntes = pagosExistentes.reduce((s, p) => s + p.monto, 0)
      const nuevoSaldo = factura.total - totalPagadoAntes - monto
      const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADA' as const : 
                    (factura.estado === 'EMITIDA' || factura.estado === 'PENDIENTE') ? 'EMITIDA' as const : factura.estado

      await tx.factura.update({
        where: { id: facturaId },
        data: {
          estado: nuevoEstado,
        }
      })

      return pago
    })

    return NextResponse.json({
      success: true,
      data: resultado
    })
  } catch (error) {
    console.error('Error creating pago factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar pago' },
      { status: 500 }
    )
  }
}

// DELETE - Anular pago
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
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

    const resultado = await db.$transaction(async (tx) => {
      // Obtener pago
      const pago = await tx.pagoFactura.findUnique({
        where: { id },
        include: { factura: true }
      })

      if (!pago) {
        throw new Error('Pago no encontrado')
      }

      // Restaurar estado de factura (saldo se calcula dinámicamente)
      const factura = pago.factura

      await tx.factura.update({
        where: { id: factura.id },
        data: {
          estado: 'EMITIDA' as const,
        }
      })

      // Eliminar pago
      await tx.pagoFactura.delete({ where: { id } })

      return { message: 'Pago anulado correctamente' }
    })

    return NextResponse.json({
      success: true,
      ...resultado
    })
  } catch (error) {
    console.error('Error deleting pago factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al anular pago' },
      { status: 500 }
    )
  }
}

// Función auxiliar para obtener resumen de cuenta corriente
export async function obtenerCuentaCorriente(clienteId: string) {
  const facturas = await db.factura.findMany({
    where: {
      clienteId,
      estado: { in: ['PENDIENTE', 'EMITIDA'] }
    },
    include: {
      pagosFactura: true,
      detalles: true
    },
    orderBy: { fecha: 'asc' }
  })

  const pagos = await db.pagoFactura.findMany({
    where: {
      factura: { clienteId }
    },
    include: {
      factura: {
        select: {
          numero: true,
          fecha: true
        }
      }
    },
    orderBy: { fecha: 'asc' }
  })

  let saldo = 0
  const movimientos: Array<{
    fecha: Date
    tipo: 'FACTURA' | 'PAGO'
    comprobante: string
    detalle: string
    debe: number
    haber: number
    saldo: number
  }> = []

  for (const factura of facturas) {
    movimientos.push({
      fecha: factura.fecha,
      tipo: 'FACTURA',
      comprobante: factura.numero,
      detalle: `Factura ${factura.tipoComprobante}`,
      debe: factura.total,
      haber: 0,
      saldo: saldo += factura.total
    })

    for (const pago of factura.pagosFactura) {
      movimientos.push({
        fecha: pago.fecha,
        tipo: 'PAGO',
        comprobante: `REC-${pago.id.slice(-6)}`,
        detalle: `Pago ${pago.metodoPago}`,
        debe: 0,
        haber: pago.monto,
        saldo: saldo -= pago.monto
      })
    }
  }

  return {
    saldoActual: saldo,
    movimientos: movimientos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
  }
}
