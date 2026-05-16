import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'clienteId es requerido' },
        { status: 400 }
      )
    }

    // Get client info
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        nombre: true,
        cuit: true,
        razonSocial: true,
        condicionIva: true
      }
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // Build date filter
    const tropasWhere: any = {
      usuarioFaenaId: clienteId
    }
    if (fechaDesde || fechaHasta) {
      tropasWhere.fechaRecepcion = {}
      if (fechaDesde) tropasWhere.fechaRecepcion.gte = new Date(fechaDesde)
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        tropasWhere.fechaRecepcion.lte = hasta
      }
    }

    // Get tropas for this client
    const tropas = await db.tropa.findMany({
      where: tropasWhere,
      include: {
        animales: {
          select: {
            pesoVivo: true
          }
        }
      },
      orderBy: { fechaRecepcion: 'desc' }
    })

    // Build tropas detail
    const tropasDetail: any[] = []

    for (const tropa of tropas) {
      // Get romaneos for this tropa
      const romaneos = await db.romaneo.findMany({
        where: { tropaCodigo: tropa.codigo },
        include: {
          mediasRes: {
            select: {
              id: true,
              estado: true,
              peso: true
            }
          }
        }
      })

      const totalKgCanal = romaneos.reduce((sum, r) => sum + (r.pesoTotal || 0), 0)
      const totalKgVivo = tropa.animales.reduce((sum, a) => sum + (a.pesoVivo || 0), 0)
      const rinde = totalKgVivo > 0 ? (totalKgCanal / totalKgVivo) * 100 : 0

      const allMedias = romaneos.flatMap(r => r.mediasRes)
      const mediasDespachadas = allMedias.filter(m => m.estado === 'DESPACHADO').length
      const mediasEnCamara = allMedias.filter(m => m.estado === 'EN_CAMARA').length

      // Get facturas for this tropa
      const facturasTropa = await db.factura.findMany({
        where: {
          clienteId,
          detalles: {
            some: {
              tropaCodigo: tropa.codigo
            }
          }
        },
        include: {
          pagosFactura: true,
          detalles: {
            where: { tropaCodigo: tropa.codigo }
          }
        }
      })

      // Get pagos for facturas of this tropa
      const pagosTropa = facturasTropa.flatMap(f =>
        f.pagosFactura.map(p => ({
          id: p.id,
          fecha: p.fecha,
          monto: p.monto,
          metodoPago: p.metodoPago,
          referencia: p.referencia,
          facturaNumero: f.numero
        }))
      )

      tropasDetail.push({
        tropaCodigo: tropa.codigo,
        tropaId: tropa.id,
        fecha: tropa.fechaRecepcion,
        cabezas: tropa.cantidadCabezas,
        kgVivo: Math.round(totalKgVivo * 100) / 100,
        kgCanal: Math.round(totalKgCanal * 100) / 100,
        rinde: Math.round(rinde * 100) / 100,
        mediasDespachadas,
        mediasEnCamara,
        facturas: facturasTropa.map(f => ({
          id: f.id,
          numero: f.numero,
          fecha: f.fecha,
          total: f.total,
          saldo: f.total - f.pagosFactura.reduce((s, p) => s + p.monto, 0),
          estado: f.estado,
          tipoComprobante: f.tipoComprobante,
          montoDetallesTropa: f.detalles.reduce((sum, d) => sum + d.subtotal, 0)
        })),
        pagos: pagosTropa
      })
    }

    // Get all facturas for this client in period
    const facturasWhere: any = { clienteId }
    if (fechaDesde || fechaHasta) {
      facturasWhere.fecha = {}
      if (fechaDesde) facturasWhere.fecha.gte = new Date(fechaDesde)
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        facturasWhere.fecha.lte = hasta
      }
    }

    const facturas = await db.factura.findMany({
      where: facturasWhere,
      include: {
        detalles: true,
        pagosFactura: true
      },
      orderBy: { fecha: 'desc' }
    })

    // Summary
    const totalCabezas = tropas.reduce((sum, t) => sum + t.cantidadCabezas, 0)
    const totalKgVivo = tropasDetail.reduce((sum, t) => sum + t.kgVivo, 0)
    const totalKgCanal = tropasDetail.reduce((sum, t) => sum + t.kgCanal, 0)
    const rindePromedio = totalKgVivo > 0 ? (totalKgCanal / totalKgVivo) * 100 : 0
    const totalFacturado = facturas.reduce((sum, f) => sum + f.total, 0)
    const totalCobrado = facturas.reduce((sum, f) => sum + f.pagosFactura.reduce((s, p) => s + p.monto, 0), 0)
    const saldoPendiente = totalFacturado - totalCobrado

    return NextResponse.json({
      success: true,
      data: {
        cliente,
        tropas: tropasDetail,
        resumen: {
          totalCabezas,
          totalKgVivo: Math.round(totalKgVivo * 100) / 100,
          totalKgCanal: Math.round(totalKgCanal * 100) / 100,
          rindePromedio: Math.round(rindePromedio * 100) / 100,
          totalFacturado: Math.round(totalFacturado * 100) / 100,
          totalCobrado: Math.round(totalCobrado * 100) / 100,
          saldoPendiente: Math.round(saldoPendiente * 100) / 100
        },
        facturas: facturas.map(f => ({
          id: f.id,
          numero: f.numero,
          fecha: f.fecha,
          total: f.total,
          saldo: f.total - f.pagosFactura.reduce((s, p) => s + p.monto, 0),
          estado: f.estado,
          tipoComprobante: f.tipoComprobante,
          detalles: f.detalles.map(d => ({
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            unidad: d.unidad,
            precioUnitario: d.precioUnitario,
            subtotal: d.subtotal,
            tropaCodigo: d.tropaCodigo,
            garron: d.garron,
            pesoKg: d.pesoKg
          })),
          pagos: f.pagosFactura.map(p => ({
            id: p.id,
            fecha: p.fecha,
            monto: p.monto,
            metodoPago: p.metodoPago,
            referencia: p.referencia
          }))
        }))
      }
    })
  } catch (error) {
    console.error('Error en liquidacion-productor:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar liquidación de productor' },
      { status: 500 }
    )
  }
}
