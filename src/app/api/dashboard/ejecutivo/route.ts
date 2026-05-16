import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { checkPermission } from '@/lib/auth-helpers'

const logger = createLogger('API:DashboardEjecutivo')

// GET - Dashboard ejecutivo con KPIs y alertas
export async function GET(request: NextRequest) {
  try {
    const authError = await checkPermission(request, 'puedeReportes')
    if (authError) return authError
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // Tropas activas
    const tropasActivas = await db.tropa.count({
      where: { estado: { in: ['RECIBIDO', 'EN_CORRAL', 'EN_PESAJE', 'PESADO', 'LISTO_FAENA', 'EN_FAENA'] } }
    })

    // Faena hoy
    const faenaHoy = await db.romaneo.count({
      where: { fecha: { gte: hoy } }
    })

    // Stock crítico (medias en cámara con más de 20 días)
    const hace20Dias = new Date(hoy.getTime() - 20 * 24 * 60 * 60 * 1000)
    const stockCritico = await db.mediaRes.count({
      where: {
        estado: 'EN_CAMARA',
        createdAt: { lte: hace20Dias }
      }
    })

    // Pendientes de cobro (saldo = total - pagos)
    const facturasPendientes = await db.factura.findMany({
      where: { estado: { in: ['PENDIENTE', 'EMITIDA'] } },
      include: { pagosFactura: true }
    })
    const pendientesCobro = facturasPendientes.reduce(
      (sum, f) => sum + (f.total - f.pagosFactura.reduce((s, p) => s + (p.monto || 0), 0)),
      0
    )

    // Alertas
    const alertas: any[] = []

    // Alerta: Stock crítico
    if (stockCritico > 0) {
      alertas.push({
        tipo: 'STOCK',
        prioridad: stockCritico > 20 ? 'ALTA' : 'MEDIA',
        titulo: `${stockCritico} medias con más de 20 días en cámara`,
        descripcion: 'Verificar rotación FIFO y vencimientos'
      })
    }

    // Alerta: Tropas sin pesaje
    const tropasSinPesaje = await db.tropa.count({
      where: { estado: 'EN_CORRAL', pesoBruto: null }
    })
    if (tropasSinPesaje > 0) {
      alertas.push({
        tipo: 'PESAJE',
        prioridad: 'MEDIA',
        titulo: `${tropasSinPesaje} tropas sin pesar`,
        descripcion: 'Tropas en corral pendientes de pesaje'
      })
    }

    // Alerta: Facturas pendientes (no hay fechaVencimiento en el modelo)
    const facturasVencidas = facturasPendientes.filter(f => {
      const saldoFactura = f.total - f.pagosFactura.reduce((s, p) => s + (p.monto || 0), 0)
      return saldoFactura > 0
    }).length
    if (facturasVencidas > 0) {
      alertas.push({
        tipo: 'FINANCIERO',
        prioridad: 'ALTA',
        titulo: `${facturasVencidas} facturas vencidas`,
        descripcion: 'Facturas con saldo pendiente y fecha de vencimiento pasada'
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          tropasActivas,
          faenaHoy,
          stockCritico,
          pendientesCobro
        },
        alertas
      }
    })
  } catch (error) {
    logger.error('Error en dashboard ejecutivo', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos del dashboard' },
      { status: 500 }
    )
  }
}
