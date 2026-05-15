import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs/promises'
import path from 'path'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:ExportarServer')

const EXPORTS_DIR = path.join(process.cwd(), 'public', 'exports')

type ReportType = 'faena' | 'stock' | 'tropas' | 'rendimiento' | 'pesajes' | 'cajas' | 'cuentas-corrientes'
type ExportFormat = 'pdf' | 'excel'

interface ExportRequestBody {
  reportType: string
  format: 'pdf' | 'excel'
  filters: {
    fechaDesde?: string
    fechaHasta?: string
    especie?: string
    [key: string]: any
  }
}

// ==================== HELPERS ====================

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-AR')
}

function formatHeader(value: string): string {
  return String(value)
    .replace(/([A-Z]{2,})(?=[A-Z][a-z]|\b)/g, '$1 ')
    .replace(/[_\-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getReportTitle(reportType: string): string {
  const titles: Record<string, string> = {
    faena: 'Reporte de Faena',
    stock: 'Reporte de Stock',
    tropas: 'Reporte de Tropas',
    rendimiento: 'Reporte de Rendimiento',
    pesajes: 'Reporte de Pesajes',
    cajas: 'Reporte de Cajas Producidas',
    'cuentas-corrientes': 'Reporte de Cuentas Corrientes',
  }
  return titles[reportType] || `Reporte ${reportType}`
}

async function ensureExportsDir() {
  await fs.mkdir(EXPORTS_DIR, { recursive: true })
}

async function cleanupOldFiles() {
  try {
    const files = await fs.readdir(EXPORTS_DIR)
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    for (const file of files) {
      if (file.startsWith('export_')) {
        const filePath = path.join(EXPORTS_DIR, file)
        const stat = await fs.stat(filePath)
        if (stat.mtimeMs < oneHourAgo) {
          await fs.unlink(filePath).catch(() => {})
        }
      }
    }
  } catch {
    // Directory may not exist yet, ignore
  }
}

// ==================== DATA FETCHERS ====================

async function fetchFaenaData(filters: ExportRequestBody['filters']): Promise<{ headers: string[]; rows: any[][]; resumen?: Record<string, any> }> {
  const fechaDesde = filters.fechaDesde || new Date().toISOString().split('T')[0]
  const fechaHasta = filters.fechaHasta || new Date().toISOString().split('T')[0]
  const fechaInicio = new Date(fechaDesde + 'T00:00:00')
  const fechaFin = new Date(fechaHasta + 'T23:59:59')

  const romaneos = await db.romaneo.findMany({
    where: {
      fecha: { gte: fechaInicio, lte: fechaFin }
    },
    include: {
      tipificador: { select: { nombre: true, apellido: true } }
    },
    orderBy: { fecha: 'asc' }
  })

  const totalAnimales = romaneos.length
  const totalPesoVivo = romaneos.reduce((acc, r) => acc + (r.pesoVivo || 0), 0)
  const totalPesoCanal = romaneos.reduce((acc, r) => acc + (r.pesoTotal || 0), 0)
  const rindeGeneral = totalPesoVivo > 0 ? (totalPesoCanal / totalPesoVivo) * 100 : 0

  return {
    headers: ['Fecha', 'Garrón', 'Tropa', 'Tipo Animal', 'Raza', 'Peso Vivo (kg)', 'Peso Canal (kg)', 'Rinde (%)', 'Denticion', 'Tipificador', 'Estado'],
    rows: romaneos.map(r => [
      formatDate(r.fecha),
      r.garron,
      r.tropaCodigo || '-',
      r.tipoAnimal || '-',
      r.raza || '-',
      r.pesoVivo || 0,
      r.pesoTotal || 0,
      r.rinde || 0,
      r.denticion || '-',
      r.tipificador ? `${r.tipificador.nombre} ${r.tipificador.apellido}` : '-',
      r.estado || '-',
    ]),
    resumen: { totalAnimales, totalPesoVivo, totalPesoCanal, rindeGeneral }
  }
}

async function fetchStockData(filters: ExportRequestBody['filters']): Promise<{ headers: string[]; rows: any[][]; resumen?: Record<string, any> }> {
  const camaras = await db.camara.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    include: {
      mediasRes: {
        where: { estado: 'EN_CAMARA' },
        include: {
          romaneo: {
            select: { tropaCodigo: true, fecha: true, pesoTotal: true }
          }
        }
      }
    }
  })

  let camarasFiltradas = camaras
  if (filters.camaraId) {
    camarasFiltradas = camaras.filter(c => c.id === filters.camaraId)
  }

  const rows: any[][] = []
  for (const camara of camarasFiltradas) {
    const medias = camara.mediasRes
    const totalMedias = medias.length
    const pesoTotal = medias.reduce((acc, m) => acc + (m.peso || 0), 0)
    const ocupacion = camara.capacidad > 0 ? Math.round((totalMedias / camara.capacidad) * 100) : 0

    // Group by tropa
    const porTropa: Record<string, { cantidad: number; peso: number }> = {}
    medias.forEach(m => {
      const tropa = m.romaneo?.tropaCodigo || 'Sin tropa'
      if (!porTropa[tropa]) porTropa[tropa] = { cantidad: 0, peso: 0 }
      porTropa[tropa].cantidad++
      porTropa[tropa].peso += m.peso || 0
    })

    rows.push([
      camara.nombre,
      camara.tipo || '-',
      camara.capacidad,
      totalMedias,
      pesoTotal,
      ocupacion + '%',
    ])

    // Add tropa breakdown
    for (const [tropa, datos] of Object.entries(porTropa)) {
      rows.push(['', '', `  Tropa: ${tropa}`, datos.cantidad, datos.peso, ''])
    }
  }

  const totalMedias = camarasFiltradas.reduce((acc, c) => acc + c.mediasRes.length, 0)
  const totalPeso = camarasFiltradas.reduce((acc, c) => acc + c.mediasRes.reduce((a, m) => a + (m.peso || 0), 0), 0)

  return {
    headers: ['Cámara', 'Tipo', 'Capacidad', 'Medias en Stock', 'Peso Total (kg)', 'Ocupación'],
    rows,
    resumen: { totalCamaras: camarasFiltradas.length, totalMedias, totalPeso }
  }
}

async function fetchTropasData(filters: ExportRequestBody['filters']): Promise<{ headers: string[]; rows: any[][]; resumen?: Record<string, any> }> {
  const desde = filters.fechaDesde
  const hasta = filters.fechaHasta
  if (!desde || !hasta) throw new Error('Fechas requeridas para el reporte de tropas')

  const fechaDesde = new Date(desde)
  const fechaHasta = new Date(hasta)
  fechaHasta.setHours(23, 59, 59, 999)

  const where: Record<string, unknown> = {
    fechaRecepcion: { gte: fechaDesde, lte: fechaHasta }
  }
  if (filters.especie && filters.especie !== 'todas') where.especie = filters.especie
  if (filters.estado && filters.estado !== 'todas') where.estado = filters.estado

  const tropas = await db.tropa.findMany({
    where,
    include: {
      productor: true,
      usuarioFaena: true,
      corral: true,
    },
    orderBy: { fechaRecepcion: 'desc' }
  })

  return {
    headers: ['Código', 'Especie', 'Estado', 'Cabezas', 'Peso Bruto (kg)', 'Peso Tara (kg)', 'Peso Neto (kg)', 'Productor', 'Usuario Faena', 'Corral', 'DTE', 'Guía', 'Fecha Recepción'],
    rows: tropas.map(t => [
      t.codigo,
      t.especie || '-',
      t.estado,
      t.cantidadCabezas,
      t.pesoBruto || 0,
      t.pesoTara || 0,
      t.pesoNeto || 0,
      t.productor?.nombre || '-',
      t.usuarioFaena?.nombre || '-',
      t.corral?.nombre || '-',
      t.dte || '-',
      t.guia || '-',
      formatDate(t.fechaRecepcion),
    ]),
    resumen: {
      totalTropas: tropas.length,
      totalCabezas: tropas.reduce((s, t) => s + t.cantidadCabezas, 0),
      totalPesoNeto: tropas.reduce((s, t) => s + (t.pesoNeto || 0), 0),
    }
  }
}

async function fetchRendimientoData(filters: ExportRequestBody['filters']): Promise<{ headers: string[]; rows: any[][]; resumen?: Record<string, any> }> {
  const fechaDesde = filters.fechaDesde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const fechaHasta = filters.fechaHasta || new Date().toISOString().split('T')[0]

  const where: Record<string, unknown> = {
    fecha: {
      gte: new Date(fechaDesde),
      lte: new Date(fechaHasta + 'T23:59:59')
    }
  }
  if (filters.tropaCodigo) where.tropaCodigo = filters.tropaCodigo

  const romaneos = await db.romaneo.findMany({
    where,
    orderBy: { fecha: 'asc' }
  })

  const totalAnimales = romaneos.length
  const totalPesoVivo = romaneos.reduce((acc, r) => acc + (r.pesoVivo || 0), 0)
  const totalPesoCanal = romaneos.reduce((acc, r) => acc + (r.pesoTotal || 0), 0)
  const rindeGeneral = totalPesoVivo > 0 ? (totalPesoCanal / totalPesoVivo) * 100 : 0

  return {
    headers: ['Fecha', 'Garrón', 'Tropa', 'Tipo Animal', 'Peso Vivo (kg)', 'Peso Canal (kg)', 'Rinde (%)', 'Denticion'],
    rows: romaneos.map(r => [
      formatDate(r.fecha),
      r.garron,
      r.tropaCodigo || '-',
      r.tipoAnimal || '-',
      r.pesoVivo || 0,
      r.pesoTotal || 0,
      r.rinde || 0,
      r.denticion || '-',
    ]),
    resumen: {
      totalAnimales,
      totalPesoVivo,
      totalPesoCanal,
      rindeGeneral,
      promedioPesoVivo: totalAnimales > 0 ? totalPesoVivo / totalAnimales : 0,
      promedioPesoCanal: totalAnimales > 0 ? totalPesoCanal / totalAnimales : 0,
    }
  }
}

async function fetchPesajesData(filters: ExportRequestBody['filters']): Promise<{ headers: string[]; rows: any[][]; resumen?: Record<string, any> }> {
  const desde = filters.fechaDesde
  const hasta = filters.fechaHasta
  if (!desde || !hasta) throw new Error('Fechas requeridas para el reporte de pesajes')

  const fechaDesde = new Date(desde)
  const fechaHasta = new Date(hasta)
  fechaHasta.setHours(23, 59, 59, 999)

  const where: Record<string, unknown> = {
    fecha: { gte: fechaDesde, lte: fechaHasta }
  }
  if (filters.tipo && filters.tipo !== 'todas') where.tipo = filters.tipo
  if (filters.estado && filters.estado !== 'todas') where.estado = filters.estado

  const pesajes = await db.pesajeCamion.findMany({
    where,
    include: {
      transportista: true,
      tropa: true
    },
    orderBy: { fecha: 'desc' }
  })

  return {
    headers: ['Ticket', 'Tipo', 'Estado', 'Patente Chasis', 'Patente Acoplado', 'Chofer', 'Transportista', 'Peso Bruto (kg)', 'Peso Tara (kg)', 'Peso Neto (kg)', 'Tropa', 'Destino', 'Remito', 'Fecha'],
    rows: pesajes.map(p => [
      p.numeroTicket,
      p.tipo,
      p.estado,
      p.patenteChasis || '-',
      p.patenteAcoplado || '-',
      p.choferNombre || '-',
      p.transportista?.nombre || '-',
      p.pesoBruto || 0,
      p.pesoTara || 0,
      p.pesoNeto || 0,
      p.tropa?.codigo || '-',
      p.destino || '-',
      p.remito || '-',
      formatDate(p.fecha),
    ]),
    resumen: {
      totalPesajes: pesajes.length,
      totalPesoNeto: pesajes.reduce((s, p) => s + (p.pesoNeto || 0), 0),
    }
  }
}

async function fetchCajasData(filters: ExportRequestBody['filters']): Promise<{ headers: string[]; rows: any[][]; resumen?: Record<string, any> }> {
  const hoy = new Date()
  const fechaInicio = filters.fechaDesde
    ? new Date(filters.fechaDesde + 'T00:00:00')
    : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const fechaFin = filters.fechaHasta
    ? new Date(filters.fechaHasta + 'T23:59:59')
    : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

  const where: Record<string, unknown> = {
    createdAt: { gte: fechaInicio, lte: fechaFin },
  }

  if (filters.productoId) {
    where.OR = [
      { productoId: filters.productoId },
      { productoDesposteId: filters.productoId },
    ]
  }

  const cajas = await db.cajaEmpaque.findMany({
    where,
    include: {
      producto: { select: { id: true, nombre: true, especie: true } },
      productoDesposte: { select: { id: true, nombre: true } },
      propietario: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    headers: ['N° Caja', 'Fecha', 'Tropa', 'Producto', 'Peso Neto (kg)', 'Peso Bruto (kg)', 'Tara (kg)', 'Piezas', 'Propietario', 'Estado'],
    rows: cajas.map(c => [
      c.numero,
      formatDate(c.createdAt),
      c.tropaCodigo || '-',
      c.productoDesposte?.nombre || c.producto?.nombre || '-',
      c.pesoNeto,
      c.pesoBruto,
      c.tara,
      c.piezas ?? 0,
      c.propietario?.nombre || '-',
      c.estado,
    ]),
    resumen: {
      totalCajas: cajas.length,
      totalKg: Math.round(cajas.reduce((s, c) => s + c.pesoNeto, 0) * 100) / 100,
      avgKgPorCaja: cajas.length > 0 ? Math.round((cajas.reduce((s, c) => s + c.pesoNeto, 0) / cajas.length) * 100) / 100 : 0,
    }
  }
}

async function fetchCuentasCorrientesData(filters: ExportRequestBody['filters']): Promise<{ headers: string[]; rows: any[][]; resumen?: Record<string, any> }> {
  const hoy = new Date()
  const fechaInicio = filters.fechaDesde
    ? new Date(filters.fechaDesde + 'T00:00:00')
    : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const fechaFin = filters.fechaHasta
    ? new Date(filters.fechaHasta + 'T23:59:59')
    : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

  const whereFacturas: Record<string, unknown> = {
    fecha: { gte: fechaInicio, lte: fechaFin },
    estado: { in: ['EMITIDA', 'PENDIENTE'] },
  }

  if (filters.clienteId) {
    whereFacturas.clienteId = filters.clienteId
  }

  const facturas = await db.factura.findMany({
    where: whereFacturas,
    include: {
      cliente: { select: { id: true, nombre: true, cuit: true } },
      pagos: {
        select: { id: true, fecha: true, monto: true, metodoPago: true },
        orderBy: { fecha: 'desc' },
      },
    },
    orderBy: { fecha: 'desc' },
  })

  // Group by client
  const clientesMap = new Map<string, any>()

  for (const f of facturas) {
    const cid = f.cliente.id
    if (!clientesMap.has(cid)) {
      clientesMap.set(cid, {
        clienteId: cid,
        clienteNombre: f.cliente.nombre,
        clienteCuit: f.cliente.cuit,
        totalFacturado: 0,
        totalPagado: 0,
        saldo: 0,
        cantidadFacturas: 0,
      })
    }
    const entry = clientesMap.get(cid)!
    entry.totalFacturado += f.total
    entry.saldo += f.saldo
    entry.cantidadFacturas++
    const pagosFactura = f.pagos.reduce((sum: number, p: any) => sum + p.monto, 0)
    entry.totalPagado += pagosFactura
  }

  const detalles = Array.from(clientesMap.values()).map(entry => ({
    ...entry,
    totalFacturado: Math.round(entry.totalFacturado * 100) / 100,
    totalPagado: Math.round(entry.totalPagado * 100) / 100,
    saldo: Math.round(entry.saldo * 100) / 100,
  }))

  const totalSaldos = detalles.reduce((sum: number, d: any) => sum + d.saldo, 0)

  return {
    headers: ['Cliente', 'CUIT', 'Total Facturado', 'Total Pagado', 'Saldo', 'Facturas'],
    rows: detalles.map(d => [
      d.clienteNombre,
      d.clienteCuit || '-',
      d.totalFacturado,
      d.totalPagado,
      d.saldo,
      d.cantidadFacturas,
    ]),
    resumen: {
      totalClientes: detalles.length,
      totalSaldos: Math.round(totalSaldos * 100) / 100,
    }
  }
}

// ==================== EXCEL GENERATOR ====================

async function generateExcel(
  reportType: string,
  data: { headers: string[]; rows: any[][]; resumen?: Record<string, any> },
  filters: ExportRequestBody['filters']
): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Solemar Alimentaria'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Reporte')
  const reportTitle = getReportTitle(reportType)

  // Title
  sheet.mergeCells('A1', `${String.fromCharCode(64 + data.headers.length)}1`)
  const titleCell = sheet.getCell('A1')
  titleCell.value = reportTitle
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1A365D' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 30

  // Subtitle with date range
  sheet.mergeCells('A2', `${String.fromCharCode(64 + data.headers.length)}2`)
  const subtitleCell = sheet.getCell('A2')
  const periodo = filters.fechaDesde || filters.fechaHasta
    ? `Período: ${filters.fechaDesde || '-'} a ${filters.fechaHasta || '-'}`
    : `Generado: ${new Date().toLocaleString('es-AR')}`
  subtitleCell.value = periodo
  subtitleCell.font = { italic: true, color: { argb: 'FF4A5568' }, size: 10 }
  subtitleCell.alignment = { horizontal: 'center' }
  sheet.getRow(2).height = 20

  let currentRow = 4

  // Summary section
  if (data.resumen && Object.keys(data.resumen).length > 0) {
    sheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + Math.min(data.headers.length, 3))}${currentRow}`)
    const resumenTitle = sheet.getCell(`A${currentRow}`)
    resumenTitle.value = 'Resumen'
    resumenTitle.font = { bold: true, size: 12, color: { argb: 'FF1A365D' } }
    currentRow++

    for (const [key, value] of Object.entries(data.resumen)) {
      const row = sheet.getRow(currentRow)
      row.getCell(1).value = formatHeader(key)
      row.getCell(1).font = { bold: true }
      row.getCell(2).value = typeof value === 'number' ? Math.round(value * 100) / 100 : String(value ?? '')
      if (typeof value === 'number' && key.toLowerCase().includes('rinde')) {
        row.getCell(2).numFmt = '0.00"%"'
        row.getCell(2).value = Number(value.toFixed(2))
      }
      currentRow++
    }
    currentRow++ // blank row
  }

  // Headers row
  const headerRow = sheet.getRow(currentRow)
  data.headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = formatHeader(header)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  headerRow.height = 24
  currentRow++

  // Data rows
  data.rows.forEach((rowValues) => {
    const row = sheet.getRow(currentRow)
    rowValues.forEach((value, index) => {
      const cell = row.getCell(index + 1)
      if (value instanceof Date) {
        cell.value = formatDate(value)
      } else {
        cell.value = value ?? ''
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: typeof value === 'number' ? 'right' : 'left',
        wrapText: true,
      }
      // Alternating row colors
      if (currentRow % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } }
      }
    })
    currentRow++
  })

  // Auto-fit columns
  sheet.columns.forEach((column, index) => {
    const maxLen = Math.max(
      data.headers[index]?.length || 10,
      ...data.rows.slice(0, 100).map(r => {
        const v = r[index]
        return v !== null && v !== undefined ? String(v).length : 0
      })
    )
    column.width = Math.min(Math.max(maxLen + 3, 12), 40)
  })

  // Freeze panes
  sheet.views = [{ state: 'frozen', ySplit: currentRow - data.rows.length, xSplit: 0 }]

  await ensureExportsDir()

  const fileName = `export_${reportType}_${Date.now()}.xlsx`
  const outputPath = path.join(EXPORTS_DIR, fileName)
  await workbook.xlsx.writeFile(outputPath)

  return `/exports/${fileName}`
}

// ==================== PDF GENERATOR ====================

async function generatePDF(
  reportType: string,
  data: { headers: string[]; rows: any[][]; resumen?: Record<string, any> },
  filters: ExportRequestBody['filters']
): Promise<string> {
  const orientation = data.headers.length > 6 ? 'landscape' : 'portrait'
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15

  // Company header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 54, 93)
  doc.text('Solemar Alimentaria', pageWidth / 2, y, { align: 'center' })
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('Ruta 2 Km 45, San Cayetano | CUIT: 30-12345678-9', pageWidth / 2, y, { align: 'center' })
  y += 6

  // Separator
  doc.setDrawColor(200, 200, 200)
  doc.line(14, y, pageWidth - 14, y)
  y += 8

  // Report title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(51, 51, 51)
  doc.text(getReportTitle(reportType), pageWidth / 2, y, { align: 'center' })
  y += 6

  // Date range
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  const periodo = filters.fechaDesde || filters.fechaHasta
    ? `Período: ${filters.fechaDesde || '-'} a ${filters.fechaHasta || '-'}`
    : `Generado: ${new Date().toLocaleString('es-AR')}`
  doc.text(periodo, pageWidth / 2, y, { align: 'center' })
  y += 4

  doc.setDrawColor(200, 200, 200)
  doc.line(14, y, pageWidth - 14, y)
  y += 8

  // Summary section
  if (data.resumen && Object.keys(data.resumen).length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 54, 93)
    doc.text('Resumen', 14, y)
    y += 6

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)

    let col = 0
    const colWidth = (pageWidth - 28) / 3
    for (const [key, value] of Object.entries(data.resumen)) {
      const displayValue = typeof value === 'number' ? value.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : String(value ?? '')
      const label = `${formatHeader(key)}: ${displayValue}`
      doc.text(label, 14 + col * colWidth, y, { maxWidth: colWidth - 5 })
      col++
      if (col >= 3) {
        col = 0
        y += 5
      }
    }
    if (col > 0) y += 5
    y += 4
  }

  // Data table
  autoTable(doc, {
    head: [data.headers.map(h => formatHeader(h))],
    body: data.rows.map(row =>
      row.map(cell => {
        if (cell instanceof Date) return formatDate(cell)
        if (cell === null || cell === undefined) return ''
        return String(cell)
      })
    ),
    startY: y,
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [245, 158, 11], // amber-500
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { top: y, left: 14, right: 14, bottom: 20 },
    tableWidth: 'auto',
  })

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, pageHeight - 8)
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
  }

  await ensureExportsDir()

  const fileName = `export_${reportType}_${Date.now()}.pdf`
  const outputPath = path.join(EXPORTS_DIR, fileName)
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  await fs.writeFile(outputPath, pdfBuffer)

  return `/exports/${fileName}`
}

// ==================== MAIN HANDLER ====================

const VALID_REPORT_TYPES: ReportType[] = ['faena', 'stock', 'tropas', 'rendimiento', 'pesajes', 'cajas', 'cuentas-corrientes']
const VALID_FORMATS: ExportFormat[] = ['pdf', 'excel']

async function fetchReportData(reportType: ReportType, filters: ExportRequestBody['filters']) {
  switch (reportType) {
    case 'faena': return fetchFaenaData(filters)
    case 'stock': return fetchStockData(filters)
    case 'tropas': return fetchTropasData(filters)
    case 'rendimiento': return fetchRendimientoData(filters)
    case 'pesajes': return fetchPesajesData(filters)
    case 'cajas': return fetchCajasData(filters)
    case 'cuentas-corrientes': return fetchCuentasCorrientesData(filters)
    default: throw new Error(`Tipo de reporte no soportado: ${reportType}`)
  }
}

export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  const startTime = Date.now()

  try {
    const body: ExportRequestBody = await request.json()

    // Validate report type
    if (!body.reportType || !VALID_REPORT_TYPES.includes(body.reportType as ReportType)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de reporte inválido. Valores permitidos: ${VALID_REPORT_TYPES.join(', ')}`
      }, { status: 400 })
    }

    // Validate format
    if (!body.format || !VALID_FORMATS.includes(body.format as ExportFormat)) {
      return NextResponse.json({
        success: false,
        error: `Formato inválido. Valores permitidos: ${VALID_FORMATS.join(', ')}`
      }, { status: 400 })
    }

    const reportType = body.reportType as ReportType
    const format = body.format as ExportFormat

    logger.info(`Iniciando exportación server-side`, { reportType, format, filters: body.filters })

    // Clean up old export files
    await cleanupOldFiles()

    // Fetch data from DB
    const data = await fetchReportData(reportType, body.filters || {})

    if (!data.rows || data.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron datos para los filtros seleccionados'
      }, { status: 404 })
    }

    // Generate file
    let url: string
    if (format === 'excel') {
      url = await generateExcel(reportType, data, body.filters || {})
    } else {
      url = await generatePDF(reportType, data, body.filters || {})
    }

    const elapsedMs = Date.now() - startTime
    logger.info(`Exportación completada`, { reportType, format, rows: data.rows.length, elapsedMs, url })

    return NextResponse.json({
      success: true,
      url,
      meta: {
        reportType,
        format,
        totalRows: data.rows.length,
        generatedIn: elapsedMs,
      }
    })

  } catch (error) {
    const elapsedMs = Date.now() - startTime
    logger.error('Error al exportar reporte server-side', { error, elapsedMs })
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al generar el reporte'
    }, { status: 500 })
  }
}
