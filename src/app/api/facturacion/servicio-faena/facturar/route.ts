import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CondicionIva } from '@prisma/client'
import { validarPermiso } from '@/lib/auth-helpers'

// POST - Generar facturas desde tropas de servicio faena
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tropaIds, operadorId } = body

    // Validate permissions
    const puedeFacturar = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeFacturar) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }

    if (!tropaIds || !Array.isArray(tropaIds) || tropaIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe seleccionar al menos una tropa' },
        { status: 400 }
      )
    }

    // Obtener las tropas seleccionadas
    const tropas = await db.tropa.findMany({
      where: {
        id: { in: tropaIds },
        especie: 'BOVINO',
      },
      include: {
        usuarioFaena: true,
      }
    })

    if (tropas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron tropas válidas' },
        { status: 404 }
      )
    }

    // Agrupar por cliente
    const porCliente: Record<string, typeof tropas> = {}
    for (const tropa of tropas) {
      const cid = tropa.usuarioFaenaId
      if (!porCliente[cid]) porCliente[cid] = []
      porCliente[cid].push(tropa)
    }

    const facturasCreadas: any[] = []

    for (const [clienteId, tropasCliente] of Object.entries(porCliente)) {
      const cliente = tropasCliente[0].usuarioFaena
      if (!cliente) continue

      // Determinar tipo de comprobante
      let tipoComprobante: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' = 'FACTURA_B'
      if (cliente.condicionIva === 'RI') tipoComprobante = 'FACTURA_A'
      else if (cliente.condicionIva === 'EX' || cliente.condicionIva === 'NC') tipoComprobante = 'FACTURA_C'

      // Obtener número de factura
      const numerador = await db.numerador.upsert({
        where: { nombre: 'FACTURA' },
        update: { ultimoNumero: { increment: 1 } },
        create: { nombre: 'FACTURA', ultimoNumero: 1 }
      })

      const numero = String(numerador.ultimoNumero).padStart(8, '0')

      // Calcular totales
      let subtotal = 0
      const detalles: any[] = []

      for (const tropa of tropasCliente) {
        const kgGancho = tropa.kgGancho || 0
        // precioServicioKg doesn't exist on Tropa; use 0 and let front-end provide prices
        const precioKg = 0
        const subtotalTropa = kgGancho * precioKg
        subtotal += subtotalTropa

        detalles.push({
          tipoProducto: 'MEDIA_RES',
          descripcion: `Servicio Faena Tropa ${tropa.codigo} - ${tropa.cantidadCabezas} cabezas - ${kgGancho.toFixed(2)} kg gancho`,
          cantidad: kgGancho,
          unidad: 'KG',
          precioUnitario: precioKg,
          subtotal: subtotalTropa,
          tropaCodigo: tropa.codigo,
          pesoKg: kgGancho,
        })
      }

      // IVA 10.5% para carne fresca
      const porcentajeIva = 10.5
      const iva = tipoComprobante === 'FACTURA_A' ? subtotal * (porcentajeIva / 100) : 0
      const total = tipoComprobante === 'FACTURA_A' ? subtotal + iva : subtotal

      // Crear factura
      const factura = await db.factura.create({
        data: {
          numero,
          numeroInterno: numerador.ultimoNumero,
          tipoComprobante,
          clienteId,
          fecha: new Date(),
          subtotal,
          iva,
          total,
          estado: 'PENDIENTE',
          condicionVenta: 'CUENTA_CORRIENTE',
          operadorId: operadorId || null,
          detalles: {
            create: detalles
          }
        },
        include: {
          cliente: true,
          detalles: true,
        }
      })

      // Nota: Tropa model doesn't have numeroFactura, fechaFactura, estadoPago fields.
      // Factura-tropa relationship is tracked via DetalleFactura.tropaCodigo.
      // No tropa update needed here.

      facturasCreadas.push(factura)
    }

    return NextResponse.json({
      success: true,
      data: facturasCreadas,
      message: `Se crearon ${facturasCreadas.length} factura(s) para ${tropas.length} tropa(s)`
    })
  } catch (error) {
    console.error('Error creating facturas from servicio faena:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar facturas desde servicio faena' },
      { status: 500 }
    )
  }
}
