import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:ReportesSIF')

/**
 * Reportes SIF - Servicio de Inspección Federal
 * Generación de reportes para presentación ante el SIF.
 * Solo genera reportes, NO integra con sistemas externos.
 */

// GET - Generar reporte SIF según tipo solicitado
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || 'faena-diaria'
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const formato = searchParams.get('formato') || 'json'

    const operadorId = request.headers.get('x-operador-id')

    // Obtener configuración del frigorífico para encabezados
    const config = await db.configuracionFrigorifico.findFirst()
    const establecimiento = config?.nombre || 'Frigorífico'
    const cuit = config?.cuit || ''
    const habilitacion = config?.numeroEstablecimiento || ''

    // Validar fechas
    const desde = fechaDesde ? new Date(fechaDesde) : new Date(new Date().setHours(0, 0, 0, 0))
    const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : new Date()

    let data: Record<string, unknown> & { _meta?: { formato: string; disponibleExportacion: boolean; endpointExportacion: string } } = {}

    switch (tipo) {
      case 'faena-diaria': {
        data = await generarReporteFaenaDiaria(desde, hasta, establecimiento, cuit, habilitacion)
        break
      }

      case 'rendimiento': {
        data = await generarReporteRendimiento(desde, hasta, establecimiento, cuit, habilitacion)
        break
      }

      case 'desposte': {
        data = await generarReporteDesposte(desde, hasta, establecimiento, cuit, habilitacion)
        break
      }

      case 'stock-camaras': {
        data = await generarReporteStockCamaras(establecimiento, cuit, habilitacion)
        break
      }

      case 'decomisos': {
        data = await generarReporteDecomisos(desde, hasta, establecimiento, cuit, habilitacion)
        break
      }

      case 'movimiento-hacienda': {
        data = await generarReporteMovimientoHacienda(desde, hasta, establecimiento, cuit, habilitacion)
        break
      }

      case 'expedicion': {
        data = await generarReporteExpedicion(desde, hasta, establecimiento, cuit, habilitacion)
        break
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Tipo de reporte no válido. Tipos disponibles: faena-diaria, rendimiento, desposte, stock-camaras, decomisos, movimiento-hacienda, expedicion'
          },
          { status: 400 }
        )
    }

    // Registrar auditoría
    if (operadorId) {
      await db.auditoria.create({
        data: {
          operadorId,
          modulo: 'REPORTES_SIF',
          accion: 'VIEW',
          entidad: 'ReporteSIF',
          descripcion: `Reporte SIF tipo: ${tipo}, período: ${desde.toISOString().slice(0, 10)} a ${hasta.toISOString().slice(0, 10)}`,
        }
      })
    }

    // Si formato es excel o pdf, agregar metadata de exportación
    if (formato === 'pdf' || formato === 'excel') {
      data._meta = {
        formato,
        disponibleExportacion: true,
        endpointExportacion: '/api/reportes/exportar'
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Error generando reporte SIF', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte SIF' },
      { status: 500 }
    )
  }
}

// ============ FUNCIONES GENERADORAS DE REPORTES ============

async function generarReporteFaenaDiaria(
  desde: Date, hasta: Date, establecimiento: string, cuit: string, habilitacion: string
) {
  // Reporte de faena diaria con detalle de tropas, especies, pesos, destinos
  // Romaneo doesn't have a tropa relation - it has tropaCodigo as a string field
  const romaneos = await db.romaneo.findMany({
    where: {
      fecha: { gte: desde, lte: hasta },
      estado: { in: ['CONFIRMADO'] }
    },
    include: {
      tipificador: { select: { matricula: true, nombre: true, apellido: true } }
    },
    orderBy: { fecha: 'asc' }
  })

  // Agrupar por tropa (using tropaCodigo string field)
  const porTropa = new Map<string, any>()
  for (const r of romaneos) {
    const tropaKey = r.tropaCodigo || 'Sin tropa'
    if (!porTropa.has(tropaKey)) {
      porTropa.set(tropaKey, {
        tropaCodigo: tropaKey,
        especie: 'BOVINO',
        procedencia: '',
        propietario: '',
        propietarioCuit: '',
        cantidadCabezas: 0,
        animales: []
      })
    }
    porTropa.get(tropaKey)!.cantidadCabezas++
    porTropa.get(tropaKey)!.animales.push({
      garron: r.garron,
      fecha: r.fecha,
      pesoVivo: r.pesoVivo,
      pesoTotal: r.pesoTotal,
      pesoMediaIzq: r.pesoMediaIzq,
      pesoMediaDer: r.pesoMediaDer,
      denticion: r.denticion,
      tipoAnimal: r.tipoAnimal,
      raza: r.raza,
      tipificador: r.tipificador?.matricula || '',
    })
  }

  // Calcular totales
  const totalAnimales = romaneos.length
  const totalPesoVivo = romaneos.reduce((s, r) => s + (r.pesoVivo || 0), 0)
  const totalPesoFrio = romaneos.reduce((s, r) => s + (r.pesoTotal || 0), 0)
  const rendimientoGeneral = totalPesoVivo > 0 ? ((totalPesoFrio / totalPesoVivo) * 100).toFixed(2) : '0'

  return {
    titulo: 'Reporte de Faena Diaria - SIF',
    tipo: 'FAENA_DIARIA',
    establecimiento,
    cuit,
    habilitacion,
    fechaGeneracion: new Date().toISOString(),
    periodo: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    resumen: {
      totalTropas: porTropa.size,
      totalAnimales,
      totalPesoVivo: Math.round(totalPesoVivo * 100) / 100,
      totalPesoFrio: Math.round(totalPesoFrio * 100) / 100,
      rendimientoGeneral: rendimientoGeneral + '%'
    },
    detalle: Array.from(porTropa.values())
  }
}

async function generarReporteRendimiento(
  desde: Date, hasta: Date, establecimiento: string, cuit: string, habilitacion: string
) {
  // Reporte de rendimientos de faena por tropa
  const romaneos = await db.romaneo.findMany({
    where: {
      fecha: { gte: desde, lte: hasta },
      estado: { in: ['CONFIRMADO'] },
      pesoVivo: { gt: 0 }
    },
    orderBy: { fecha: 'asc' }
  })

  // Agrupar por tropa y calcular rendimientos
  const porTropa = new Map<string, any>()
  for (const r of romaneos) {
    const key = r.tropaCodigo || 'Sin tropa'
    if (!porTropa.has(key)) {
      porTropa.set(key, {
        tropaCodigo: key,
        especie: 'BOVINO',
        animales: [],
        totalPesoVivo: 0,
        totalPesoFrio: 0,
        cantidad: 0
      })
    }
    const entry = porTropa.get(key)!
    entry.cantidad++
    entry.totalPesoVivo += r.pesoVivo || 0
    entry.totalPesoFrio += r.pesoTotal || 0
    entry.animales.push({
      garron: r.garron,
      pesoVivo: r.pesoVivo,
      pesoFrio: r.pesoTotal,
      rendimiento: r.pesoVivo ? ((r.pesoTotal || 0) / r.pesoVivo * 100).toFixed(2) : '0',
      denticion: r.denticion,
      raza: r.raza
    })
  }

  // Calcular rendimiento por tropa
  const rendimientoDetalle = Array.from(porTropa.values()).map((t: any) => ({
    ...t,
    rendimientoPromedio: t.totalPesoVivo > 0
      ? ((t.totalPesoFrio / t.totalPesoVivo) * 100).toFixed(2) + '%'
      : '0%',
    pesoPromedioPorAnimal: t.cantidad > 0
      ? Math.round((t.totalPesoFrio / t.cantidad) * 100) / 100
      : 0
  }))

  const totalGeneral = rendimientoDetalle.reduce((s: any, t: any) => ({
    pesoVivo: s.pesoVivo + t.totalPesoVivo,
    pesoFrio: s.pesoFrio + t.totalPesoFrio,
    cantidad: s.cantidad + t.cantidad
  }), { pesoVivo: 0, pesoFrio: 0, cantidad: 0 })

  return {
    titulo: 'Reporte de Rendimiento de Faena - SIF',
    tipo: 'RENDIMIENTO',
    establecimiento,
    cuit,
    habilitacion,
    fechaGeneracion: new Date().toISOString(),
    periodo: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    resumen: {
      totalAnimales: totalGeneral.cantidad,
      totalPesoVivo: Math.round(totalGeneral.pesoVivo * 100) / 100,
      totalPesoFrio: Math.round(totalGeneral.pesoFrio * 100) / 100,
      rendimientoGeneral: totalGeneral.pesoVivo > 0
        ? ((totalGeneral.pesoFrio / totalGeneral.pesoVivo) * 100).toFixed(2) + '%'
        : '0%',
      pesoPromedio: totalGeneral.cantidad > 0
        ? Math.round((totalGeneral.pesoFrio / totalGeneral.cantidad) * 100) / 100
        : 0
    },
    detalle: rendimientoDetalle
  }
}

async function generarReporteDesposte(
  desde: Date, hasta: Date, establecimiento: string, cuit: string, habilitacion: string
) {
  // Reporte de desposte/despostada con cortes y rendimientos
  // IngresoDespostada has: tropaCodigo, pesoKg (not pesoTotal), no detalles, no merma
  const despostadas = await db.ingresoDespostada.findMany({
    where: {
      fecha: { gte: desde, lte: hasta }
    },
    orderBy: { fecha: 'desc' }
  })

   
  const detalleDesposte = despostadas.map((d: any) => ({
    id: d.id,
    fecha: d.fecha,
    tropa: d.tropaCodigo || '',
    pesoTotalIngreso: d.pesoKg || 0,
    tipoMedia: d.tipoMedia || '',
    estado: d.estado || '',
    camaraOrigen: d.camaraOrigen?.nombre || '',
    camaraDestino: d.camaraDestino?.nombre || '',
  }))

  const totalPesoIngreso = despostadas.reduce((s: number, d: any) => s + (d.pesoKg || 0), 0)

  return {
    titulo: 'Reporte de Desposte - SIF',
    tipo: 'DESPOSTE',
    establecimiento,
    cuit,
    habilitacion,
    fechaGeneracion: new Date().toISOString(),
    periodo: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    resumen: {
      totalDespostadas: despostadas.length,
      totalPesoIngreso: Math.round(totalPesoIngreso * 100) / 100,
    },
    detalle: detalleDesposte
  }
}

async function generarReporteStockCamaras(
  establecimiento: string, cuit: string, habilitacion: string
) {
  // Reporte de stock actual en cámaras
  // Camara doesn't have temperatura field
  const camaras = await db.camara.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  })

  // MediaRes doesn't have especie or ingresoCamaraAt fields
  const stockDetalle: Array<{
    camaraId: string
    camaraNombre: string
    tipo: string
    totalMedias: number
    totalKg: number
    mediasAntiguas: number
    alertaStock: boolean
  }> = []

  for (const camara of camaras) {
    const medias = await db.mediaRes.findMany({
      where: { camaraId: camara.id, estado: 'EN_CAMARA' },
      select: { peso: true, createdAt: true }
    })

    // Detectar medias con más de 15 días en cámara (use createdAt as proxy)
    const hace15Dias = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    const mediasAntiguas = medias.filter(m => m.createdAt && m.createdAt < hace15Dias)

    stockDetalle.push({
      camaraId: camara.id,
      camaraNombre: camara.nombre,
      tipo: camara.tipo,
      totalMedias: medias.length,
      totalKg: Math.round(medias.reduce((s, m) => s + (m.peso || 0), 0) * 100) / 100,
      mediasAntiguas: mediasAntiguas.length,
      alertaStock: mediasAntiguas.length > 0
    })
  }

  const totalGeneral = stockDetalle.reduce((s, c) => ({
    medias: s.medias + c.totalMedias,
    kg: s.kg + c.totalKg,
    antiguas: s.antiguas + c.mediasAntiguas
  }), { medias: 0, kg: 0, antiguas: 0 })

  return {
    titulo: 'Reporte de Stock en Cámaras - SIF',
    tipo: 'STOCK_CAMARAS',
    establecimiento,
    cuit,
    habilitacion,
    fechaGeneracion: new Date().toISOString(),
    resumen: {
      totalCamaras: stockDetalle.length,
      totalMedias: totalGeneral.medias,
      totalKg: Math.round(totalGeneral.kg * 100) / 100,
      mediasAntiguas: totalGeneral.antiguas,
      alertas: totalGeneral.antiguas > 0
    },
    detalle: stockDetalle
  }
}

async function generarReporteDecomisos(
  desde: Date, hasta: Date, establecimiento: string, cuit: string, habilitacion: string
) {
  // Reporte de decomisos
  // Decomiso has: motivo (not causa), peso, tipo, tropaCodigo - no especie, no destino
  const decomisos = await db.decomiso.findMany({
    where: {
      fecha: { gte: desde, lte: hasta }
    },
    orderBy: { fecha: 'desc' }
  })

  // Agrupar por motivo
  const porMotivo = new Map<string, { motivo: string; cantidad: number; peso: number }>()
  for (const d of decomisos) {
    const motivo = d.motivo || 'Sin especificar'
    if (!porMotivo.has(motivo)) {
      porMotivo.set(motivo, { motivo, cantidad: 0, peso: 0 })
    }
    const entry = porMotivo.get(motivo)!
    entry.cantidad++
    entry.peso += d.peso || d.pesoKg || 0
  }

  return {
    titulo: 'Reporte de Decomisos - SIF',
    tipo: 'DECOMISOS',
    establecimiento,
    cuit,
    habilitacion,
    fechaGeneracion: new Date().toISOString(),
    periodo: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    resumen: {
      totalDecomisos: decomisos.length,
      totalPeso: Math.round(decomisos.reduce((s, d) => s + (d.peso || d.pesoKg || 0), 0) * 100) / 100,
      motivosUnicos: porMotivo.size
    },
    porMotivo: Array.from(porMotivo.values()),
    detalle: decomisos.map(d => ({
      id: d.id,
      fecha: d.fecha,
      tipo: d.tipo || '',
      tropa: d.tropaCodigo || '',
      garron: d.garron || null,
      motivo: d.motivo || '',
      peso: d.peso || d.pesoKg || 0,
      observaciones: d.observaciones || ''
    }))
  }
}

async function generarReporteMovimientoHacienda(
  desde: Date, hasta: Date, establecimiento: string, cuit: string, habilitacion: string
) {
  // Reporte de movimiento de hacienda (ingresos de tropas)
  // Tropa has: fechaRecepcion (not fechaIngreso), productor (not propietario), corral
  const tropas = await db.tropa.findMany({
    where: {
      fechaRecepcion: { gte: desde, lte: hasta }
    },
    include: {
      productor: { select: { nombre: true, cuit: true } },
      corral: { select: { nombre: true } }
    },
    orderBy: { fechaRecepcion: 'desc' }
  })

  // Agrupar por especie
  const porEspecie = new Map<string, { especie: string; cantidad: number; cabezas: number }>()
  for (const t of tropas) {
    const especie = t.especie || 'BOVINO'
    if (!porEspecie.has(especie)) {
      porEspecie.set(especie, { especie, cantidad: 0, cabezas: 0 })
    }
    const entry = porEspecie.get(especie)!
    entry.cantidad++
    entry.cabezas += t.cantidadCabezas || 0
  }

  return {
    titulo: 'Reporte de Movimiento de Hacienda - SIF',
    tipo: 'MOVIMIENTO_HACIENDA',
    establecimiento,
    cuit,
    habilitacion,
    fechaGeneracion: new Date().toISOString(),
    periodo: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    resumen: {
      totalTropas: tropas.length,
      totalCabezas: tropas.reduce((s, t) => s + (t.cantidadCabezas || 0), 0),
      especies: Array.from(porEspecie.values())
    },
    detalle: tropas.map(t => ({
      tropaCodigo: t.codigo,
      especie: t.especie || 'BOVINO',
      fechaIngreso: t.fechaRecepcion,
      cantidadCabezas: t.cantidadCabezas || 0,
      productor: t.productor?.nombre || '',
      propietarioCuit: t.productor?.cuit || '',
      corral: t.corral?.nombre || '',
      estado: t.estado || ''
    }))
  }
}

async function generarReporteExpedicion(
  desde: Date, hasta: Date, establecimiento: string, cuit: string, habilitacion: string
) {
  // Reporte de expedición/despachos
  // Despacho has: estado (EstadoDespacho enum), items, operador
  const despachos = await db.despacho.findMany({
    where: {
      fecha: { gte: desde, lte: hasta },
      estado: { in: ['DESPACHADO', 'ENTREGADO'] }
    },
    include: {
      items: {
        select: {
          peso: true,
          tropaCodigo: true
        }
      },
      operador: { select: { nombre: true } }
    },
    orderBy: { fecha: 'desc' }
  })

  return {
    titulo: 'Reporte de Expedición - SIF',
    tipo: 'EXPEDICION',
    establecimiento,
    cuit,
    habilitacion,
    fechaGeneracion: new Date().toISOString(),
    periodo: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    resumen: {
      totalDespachos: despachos.length,
      totalMedias: despachos.reduce((s, d) => s + (d.cantidadMedias || 0), 0),
      totalKg: Math.round(despachos.reduce((s, d) => s + (d.kgTotal || 0), 0) * 100) / 100
    },
    detalle: despachos.map(d => ({
      numero: d.numero,
      fecha: d.fecha,
      destino: d.destino || '',
      patenteCamion: d.patenteCamion || '',
      chofer: d.chofer || '',
      remito: d.remito || '',
      cantidadMedias: d.cantidadMedias || 0,
      kgTotal: d.kgTotal || 0,
      estado: d.estado,
      operador: d.operador?.nombre || ''
    }))
  }
}
