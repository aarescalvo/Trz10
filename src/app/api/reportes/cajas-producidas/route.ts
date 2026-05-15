import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:ReportesCajas')

// GET - Reporte de Cajas Producidas
export async function GET(request: NextRequest) {
  try {
    const authError = await checkPermission(request, 'puedeReportes')
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const productoId = searchParams.get('productoId')

    const hoy = new Date()
    const fechaInicio = fechaDesde
      ? new Date(fechaDesde + 'T00:00:00')
      : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fechaFin = fechaHasta
      ? new Date(fechaHasta + 'T23:59:59')
      : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

    // Construir filtro
    const where: any = {
      createdAt: { gte: fechaInicio, lte: fechaFin },
    }

    if (productoId) {
      where.OR = [
        { productoId },
        { productoDesposteId: productoId },
      ]
    }

    // Obtener cajas de empaque
    const cajas = await db.cajaEmpaque.findMany({
      where,
      include: {
        producto: { select: { id: true, nombre: true, especie: true } },
        productoDesposte: { select: { id: true, nombre: true } },
        propietario: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const detalles = cajas.map(c => ({
      id: c.id,
      numero: c.numero,
      fecha: c.createdAt.toISOString().split('T')[0],
      tropaCodigo: c.tropaCodigo || '-',
      producto: c.productoDesposte?.nombre || c.producto?.nombre || 'Sin producto',
      pesoNeto: c.pesoNeto,
      pesoBruto: c.pesoBruto,
      tara: c.tara,
      piezas: c.piezas ?? 0,
      propietario: c.propietario?.nombre || '-',
      estado: c.estado,
      destino: c.propietario?.nombre || '-',
    }))

    // Calcular resumen
    const totalCajas = detalles.length
    const totalKg = detalles.reduce((sum, d) => sum + d.pesoNeto, 0)
    const avgKgPorCaja = totalCajas > 0 ? totalKg / totalCajas : 0

    return NextResponse.json({
      success: true,
      data: {
        detalles,
        resumen: {
          totalCajas,
          totalKg: Math.round(totalKg * 100) / 100,
          avgKgPorCaja: Math.round(avgKgPorCaja * 100) / 100,
        },
      },
    })
  } catch (error) {
    logger.error('Error en reporte de cajas', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte de cajas producidas' },
      { status: 500 }
    )
  }
}
