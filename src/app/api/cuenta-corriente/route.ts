import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validarPermiso } from '@/lib/auth-helpers'

function getOperadorId(request: NextRequest): string | null {
  return request.headers.get('x-operador-id')
}

// GET - Obtener estado de cuenta corriente de un cliente
export async function GET(request: NextRequest) {
  try {
    const operadorId = getOperadorId(request)
    const puedeVer = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeVer) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')

    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'clienteId es requerido' },
        { status: 400 }
      )
    }

    // Obtener todas las facturas del cliente (no anuladas)
    const facturas = await db.factura.findMany({
      where: {
        clienteId,
        estado: { not: 'ANULADA' },
      },
      include: {
        pagosFactura: {
          orderBy: { fecha: 'desc' },
        },
        detalles: {
          include: {
            tiposServicio: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    })

    // Obtener notas de crédito/débito del cliente
    const notas = await db.notaCreditoDebito.findMany({
      where: {
        factura: { clienteId },
      },
      orderBy: { fecha: 'desc' },
    })

    // Calcular resumen
    const totalFacturado = facturas.reduce((sum, f) => sum + f.total, 0)
    const totalPagado = facturas.reduce(
      (sum, f) => sum + f.pagos.reduce((s, p) => s + p.monto, 0),
      0
    )
    const saldoPendiente = facturas.reduce((sum, f) => sum + f.saldo, 0)
    const facturasVencidas = facturas.filter(f => {
      if (f.estado === 'PAGADA') return false
      const dias = Math.floor(
        (Date.now() - new Date(f.fecha).getTime()) / (1000 * 60 * 60 * 24)
      )
      return dias > 30
    })

    return NextResponse.json({
      success: true,
      data: {
        facturas,
        notas,
        resumen: {
          totalFacturado,
          totalPagado,
          saldoPendiente,
          cantidadFacturas: facturas.length,
          cantidadVencidas: facturasVencidas.length,
          ultimaActividad: facturas[0]?.fecha || null,
        },
      },
    })
  } catch (error) {
    console.error('Error cuenta corriente GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener cuenta corriente' },
      { status: 500 }
    )
  }
}

// POST - Registrar pago / imputar pago a facturas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      facturaId,
      clienteId,
      monto,
      metodoPago,
      referencia,
      banco,
      observaciones,
      operadorId,
      // Para imputación múltiple
      imputaciones,
    } = body

    // Validate permissions
    const puedeFacturar = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeFacturar) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }

    // Caso 1: Imputación múltiple (varias facturas con un solo pago)
    if (imputaciones && Array.isArray(imputaciones) && imputaciones.length > 0) {
      const resultados: any[] = []

      for (const imp of imputaciones) {
        const factura = await db.factura.findUnique({
          where: { id: imp.facturaId },
          include: { pagos: true },
        })

        if (!factura) {
          resultados.push({ facturaId: imp.facturaId, error: 'Factura no encontrada' })
          continue
        }

        if (factura.estado === 'ANULADA') {
          resultados.push({ facturaId: imp.facturaId, error: 'Factura anulada' })
          continue
        }

        const montoImputar = Math.min(Number(imp.monto), factura.saldo)
        if (montoImputar <= 0) {
          resultados.push({ facturaId: imp.facturaId, error: 'Monto inválido' })
          continue
        }

        // Crear el pago
        const pago = await db.pagoFactura.create({
          data: {
            facturaId: factura.id,
            monto: montoImputar,
            metodoPago: metodoPago || 'EFECTIVO',
            referencia: referencia || null,
            banco: banco || null,
            observaciones: observaciones || null,
            operadorId: operadorId || null,
            fecha: new Date(),
          },
        })

        // Actualizar saldo y estado de la factura
        const nuevoSaldo = factura.saldo - montoImputar
        const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADA' : 'EMITIDA'

        await db.factura.update({
          where: { id: factura.id },
          data: {
            saldo: Math.max(0, nuevoSaldo),
            estado: nuevoEstado,
          },
        })

        // Registrar en auditoría
        await db.auditoria.create({
          data: {
            modulo: 'facturacion',
            accion: 'PAGO_REGISTRADO',
            entidad: 'Factura',
            entidadId: factura.id,
            operadorId: operadorId || null,
            descripcion: `Pago $${montoImputar.toLocaleString('es-AR')} - ${metodoPago} - Saldo restante: $${nuevoSaldo.toLocaleString('es-AR')}`,
          },
        })

        resultados.push({
          facturaId: factura.id,
          numero: factura.numero,
          montoImputado: montoImputar,
          saldoRestante: Math.max(0, nuevoSaldo),
          estado: nuevoEstado,
          pagoId: pago.id,
        })
      }

      return NextResponse.json({
        success: true,
        data: resultados,
        message: `${resultados.filter(r => !r.error).length} pago(s) registrado(s) exitosamente`,
      })
    }

    // Caso 2: Pago simple a una factura
    if (!facturaId || !monto || monto <= 0) {
      return NextResponse.json(
        { success: false, error: 'facturaId y monto son requeridos' },
        { status: 400 }
      )
    }

    const factura = await db.factura.findUnique({
      where: { id: facturaId },
      include: { pagos: true },
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    if (factura.estado === 'ANULADA') {
      return NextResponse.json(
        { success: false, error: 'No se puede registrar pago en factura anulada' },
        { status: 400 }
      )
    }

    // No permitir pagar más del saldo
    const montoPago = Math.min(Number(monto), factura.saldo)

    // Crear el pago
    const pago = await db.pagoFactura.create({
      data: {
        facturaId,
        monto: montoPago,
        metodoPago: metodoPago || 'EFECTIVO',
        referencia: referencia || null,
        banco: banco || null,
        observaciones: observaciones || null,
        operadorId: operadorId || null,
        fecha: new Date(),
      },
    })

    // Actualizar saldo y estado
    const nuevoSaldo = factura.saldo - montoPago
    const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADA' : 'EMITIDA'

    await db.factura.update({
      where: { id: facturaId },
      data: {
        saldo: Math.max(0, nuevoSaldo),
        estado: nuevoEstado,
      },
    })

    // Registrar en auditoría
    await db.auditoria.create({
      data: {
        modulo: 'facturacion',
        accion: 'PAGO_REGISTRADO',
        entidad: 'Factura',
        entidadId: facturaId,
        operadorId: operadorId || null,
        descripcion: `Pago $${montoPago.toLocaleString('es-AR')} - ${metodoPago} - Saldo restante: $${Math.max(0, nuevoSaldo).toLocaleString('es-AR')}`,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        pago,
        facturaActualizada: {
          id: facturaId,
          saldo: Math.max(0, nuevoSaldo),
          estado: nuevoEstado,
        },
      },
      message: 'Pago registrado exitosamente',
    })
  } catch (error) {
    console.error('Error cuenta corriente POST:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar pago' },
      { status: 500 }
    )
  }
}
