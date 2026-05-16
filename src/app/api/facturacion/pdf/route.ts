import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validarPermiso } from '@/lib/auth-helpers'

function getOperadorId(request: NextRequest): string | null {
  return request.headers.get('x-operador-id')
}

// Fuentes estándar para pdfmake
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
}

const TIPOS_COMPROBANTE: Record<string, string> = {
  FACTURA_A: 'FACTURA A',
  FACTURA_B: 'FACTURA B',
  FACTURA_C: 'FACTURA C',
  REMITO: 'REMITO',
  NOTA_CREDITO: 'NOTA DE CREDITO',
  NOTA_DEBITO: 'NOTA DE DEBITO',
}

const CONDICION_IVA: Record<string, string> = {
  RI: 'Responsable Inscripto',
  CF: 'Consumidor Final',
  MT: 'Monotributista',
  EX: 'Exento',
  NR: 'No Responsable',
}

const METODOS_PAGO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia Bancaria',
  CHEQUE: 'Cheque',
  TARJETA_DEBITO: 'Tarjeta Debito',
  TARJETA_CREDITO: 'Tarjeta Credito',
}

// POST /api/facturacion/pdf — Generar PDF profesional de factura
export async function POST(request: NextRequest) {
  try {
    const operadorId = getOperadorId(request)
    const puedeVer = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeVer) {
      return NextResponse.json({ success: false, error: 'Sin permisos de facturación' }, { status: 403 })
    }

    const body = await request.json()
    const { facturaId } = body

    if (!facturaId) {
      return NextResponse.json({ success: false, error: 'facturaId es requerido' }, { status: 400 })
    }

    // Obtener factura con todos sus datos
    const factura = await db.factura.findUnique({
      where: { id: facturaId },
      include: {
        cliente: true,
        detalles: { orderBy: { createdAt: 'asc' } },
        pagosFactura: { orderBy: { fecha: 'desc' } },
        tributos: { orderBy: { tributoId: 'asc' } },
        operador: { select: { id: true, nombre: true } },
      },
    })

    if (!factura) {
      return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    // Obtener configuración del frigorífico
    const config = await db.configuracionFrigorifico.findFirst()

    // @ts-ignore - pdfmake/src/printer types may not be available on all platforms
    const PdfPrinter = ((await import('pdfmake')).default || (await import('pdfmake'))) as unknown as typeof import('pdfmake/src/printer')
    const printer = new PdfPrinter(fonts)

    const docDefinition = generarFacturaPDF(factura, config)
    const pdfDoc = printer.createPdfKitDocument(docDefinition)

    const chunks: Buffer[] = []

    return new Promise<Response>((resolve, reject) => {
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
      pdfDoc.on('end', () => {
        const result = Buffer.concat(chunks)
        const tipoLabel = TIPOS_COMPROBANTE[factura.tipoComprobante || ''] || 'COMPROBANTE'
        const filename = `${tipoLabel.replace(/ /g, '_')}_${factura.numero.replace(/-/g, '_')}.pdf`
        resolve(new NextResponse(result, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        }))
      })
      pdfDoc.on('error', reject)
      pdfDoc.end()
    })
  } catch (error) {
    console.error('Error al generar PDF de factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar PDF: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

function generarFacturaPDF(factura: any, config: any) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n || 0)

  const formatDate = (d: string | Date) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const tipoLabel = TIPOS_COMPROBANTE[factura.tipoComprobante] || factura.tipoComprobante
  const esFacturaA = factura.tipoComprobante === 'FACTURA_A'
  const esFacturaB = factura.tipoComprobante === 'FACTURA_B'

  const clienteNombre = factura.clienteNombre || factura.cliente?.razonSocial || factura.cliente?.nombre || '-'
  const clienteCuit = factura.clienteCuit || factura.cliente?.cuit || '-'
  const clienteCondIva = factura.clienteCondicionIva || factura.cliente?.condicionIva || '-'
  const clienteDireccion = factura.clienteDireccion || factura.cliente?.direccion || '-'
  const condIvaLabel = CONDICION_IVA[clienteCondIva] || clienteCondIva

  const empresaNombre = config?.nombre || 'Solemar Alimentaria'
  const empresaDireccion = config?.direccion || ''
  const empresaCuit = config?.cuit || ''
  const empresaEstab = config?.numeroEstablecimiento || ''
  const empresaMatricula = config?.numeroMatricula || ''

  // Colores profesionales
  const COLOR_PRIMARY = '#92400e'   // amber-800
  const COLOR_ACCENT = '#d97706'    // amber-600
  const COLOR_TEXT = '#1c1917'      // stone-900
  const COLOR_MUTED = '#78716c'     // stone-500
  const COLOR_LIGHT = '#f5f5f4'     // stone-100
  const COLOR_BORDER = '#d6d3d1'    // stone-300

  // Encabezado empresa
  const headerEmpresa: any[] = [
    {
      text: empresaNombre,
      fontSize: 18,
      bold: true,
      color: COLOR_TEXT,
    },
  ]
  if (empresaDireccion) {
    headerEmpresa.push({ text: empresaDireccion, fontSize: 9, color: COLOR_MUTED, margin: [0, 2, 0, 0] })
  }
  const datosFiscales: string[] = []
  if (empresaCuit) datosFiscales.push(`CUIT: ${empresaCuit}`)
  if (empresaEstab) datosFiscales.push(`Est. N° ${empresaEstab}`)
  if (empresaMatricula) datosFiscales.push(`Mat. ${empresaMatricula}`)
  if (datosFiscales.length > 0) {
    headerEmpresa.push({ text: datosFiscales.join('  ·  '), fontSize: 8, color: COLOR_MUTED, margin: [0, 2, 0, 0] })
  }

  // Encabezado comprobante
  const headerComprobante: any[] = [
    {
      text: tipoLabel,
      fontSize: 16,
      bold: true,
      color: COLOR_ACCENT,
      alignment: 'right',
    },
    {
      text: factura.numero,
      fontSize: 14,
      bold: true,
      color: COLOR_TEXT,
      alignment: 'right',
      margin: [0, 2, 0, 0],
    },
    {
      text: `Fecha: ${formatDate(factura.fecha)}`,
      fontSize: 9,
      color: COLOR_MUTED,
      alignment: 'right',
      margin: [0, 4, 0, 0],
    },
    {
      text: factura.condicionVenta === 'CONTADO' ? 'Contado' : 'Cuenta Corriente',
      fontSize: 9,
      color: COLOR_MUTED,
      alignment: 'right',
      margin: [0, 2, 0, 0],
    },
  ]

  // Tabla de detalles
  const detallesHeader = [
    { text: 'Descripcion', style: 'tableHeader', alignment: 'left' },
    { text: 'Cantidad', style: 'tableHeader', alignment: 'right' },
    { text: 'Unidad', style: 'tableHeader', alignment: 'center' },
    { text: 'P. Unit.', style: 'tableHeader', alignment: 'right' },
    { text: '% IVA', style: 'tableHeader', alignment: 'right' },
    { text: 'Subtotal', style: 'tableHeader', alignment: 'right' },
  ]

  const detallesBody = (factura.detalles || []).map((d: any) => [
    { text: d.descripcion, fontSize: 9 },
    { text: String(d.cantidad), fontSize: 9, alignment: 'right' },
    { text: d.unidad || 'KG', fontSize: 9, alignment: 'center' },
    { text: formatCurrency(d.precioUnitario), fontSize: 9, alignment: 'right' },
    { text: `${d.porcentajeIva || 21}%`, fontSize: 9, alignment: 'right' },
    { text: formatCurrency(d.subtotal), fontSize: 9, alignment: 'right', bold: true },
  ])

  // Si es Factura B, los precios incluyen IVA
  if (esFacturaB) {
    detallesHeader.push({ text: 'Subtotal c/IVA', style: 'tableHeader', alignment: 'right' })
    factura.detalles?.forEach((d: any, i: number) => {
      const subtotalConIva = d.subtotal * (1 + (d.porcentajeIva || 21) / 100)
      detallesBody[i].push({ text: formatCurrency(subtotalConIva), fontSize: 9, alignment: 'right', bold: true })
    })
  }

  // Totales
  const totalRows: any[] = [
    [
      { text: 'Subtotal:', alignment: 'right', fontSize: 10, color: COLOR_MUTED },
      { text: formatCurrency(factura.subtotal), alignment: 'right', fontSize: 10, bold: true },
    ],
  ]

  if (factura.iva > 0) {
    totalRows.push([
      { text: `IVA (${factura.porcentajeIva}%):`, alignment: 'right', fontSize: 10, color: COLOR_MUTED },
      { text: formatCurrency(factura.iva), alignment: 'right', fontSize: 10 },
    ])
  }

  // Tributos
  ;(factura.tributos || []).forEach((t: any) => {
    totalRows.push([
      { text: `${t.descripcion} (${t.alicuota}%):`, alignment: 'right', fontSize: 9, color: COLOR_MUTED },
      { text: formatCurrency(t.importe), alignment: 'right', fontSize: 9 },
    ])
  })

  totalRows.push([
    { text: 'TOTAL:', alignment: 'right', fontSize: 13, bold: true, color: COLOR_PRIMARY },
    { text: formatCurrency(factura.total), alignment: 'right', fontSize: 13, bold: true, color: COLOR_PRIMARY },
  ])

  if (factura.saldo > 0 && factura.estado !== 'PAGADA' && factura.estado !== 'ANULADA') {
    totalRows.push([
      { text: 'Saldo Pendiente:', alignment: 'right', fontSize: 10, color: '#dc2626' },
      { text: formatCurrency(factura.saldo), alignment: 'right', fontSize: 10, color: '#dc2626', bold: true },
    ])
  }

  // Sección de pagos
  const pagosSection: any[] = []
  if ((factura.pagosFactura || []).length > 0) {
    pagosSection.push(
      { text: 'PAGOS REGISTRADOS', fontSize: 9, bold: true, color: COLOR_MUTED, margin: [0, 15, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto'],
          body: [
            [
              { text: 'Fecha', style: 'tableHeader' },
              { text: 'Metodo', style: 'tableHeader' },
              { text: 'Referencia', style: 'tableHeader' },
              { text: 'Monto', style: 'tableHeader', alignment: 'right' },
            ],
            ...factura.pagosFactura.map((p: any) => [
              { text: formatDate(p.fecha), fontSize: 8 },
              { text: METODOS_PAGO[p.metodoPago] || p.metodoPago, fontSize: 8 },
              { text: p.referencia || '-', fontSize: 8 },
              { text: formatCurrency(p.monto), fontSize: 8, alignment: 'right', bold: true },
            ]),
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => COLOR_BORDER,
          vLineColor: () => COLOR_BORDER,
          fillColor: (rowIndex: number) => rowIndex === 0 ? '#44403c' : undefined,
        },
      }
    )
  }

  // Sección CAE
  const caeSection: any[] = []
  if (factura.cae) {
    caeSection.push(
      {
        margin: [0, 15, 0, 0],
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              {
                stack: [
                  { text: 'CAE (Codigo de Autorizacion Electronico)', fontSize: 8, color: COLOR_MUTED },
                  { text: factura.cae, fontSize: 11, bold: true, fontFeatures: ['tnum'] },
                ],
              },
              {
                stack: [
                  { text: 'Vencimiento CAE', fontSize: 8, color: COLOR_MUTED },
                  { text: factura.caeVencimiento ? formatDate(factura.caeVencimiento) : '-', fontSize: 11, bold: true },
                ],
                alignment: 'right',
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 0,
          hLineColor: () => COLOR_BORDER,
          fillColor: () => COLOR_LIGHT,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
      }
    )
  }

  // Observaciones
  const obsSection: any[] = []
  if (factura.observaciones) {
    obsSection.push(
      {
        margin: [0, 12, 0, 0],
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'OBSERVACIONES', fontSize: 8, bold: true, color: COLOR_ACCENT },
                { text: factura.observaciones, fontSize: 9, color: COLOR_TEXT, margin: [0, 4, 0, 0] },
              ],
              margin: [8, 6, 8, 6],
            },
          ]],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => COLOR_ACCENT,
          vLineColor: () => COLOR_ACCENT,
          fillColor: () => '#fffbeb',
        },
      }
    )
  }

  // Documento completo
  const docDefinition = {
    pageSize: 'A4' as const,
    pageMargins: [35, 20, 35, 40],

    header: () => ({
      columns: [
        { stack: headerEmpresa, width: '*' },
        { stack: headerComprobante, width: 'auto' },
      ],
      margin: [35, 20, 35, 0],
    }),

    content: [
      // Línea separadora
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: COLOR_ACCENT },
        ],
        margin: [0, 0, 0, 12],
      },

      // Datos del cliente y comprobante
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'CLIENTE', fontSize: 8, bold: true, color: COLOR_MUTED, margin: [0, 0, 0, 4] },
              { text: clienteNombre, fontSize: 11, bold: true },
              { text: `CUIT: ${clienteCuit}`, fontSize: 9, color: COLOR_MUTED, margin: [0, 2, 0, 0] },
              { text: `Cond. IVA: ${condIvaLabel}`, fontSize: 9, color: COLOR_MUTED, margin: [0, 2, 0, 0] },
              { text: `Direccion: ${clienteDireccion}`, fontSize: 9, color: COLOR_MUTED, margin: [0, 2, 0, 0] },
            ],
          },
          {
            width: 'auto',
            stack: [
              { text: 'COMPROBANTE', fontSize: 8, bold: true, color: COLOR_MUTED, margin: [0, 0, 0, 4] },
              { text: `Pto. Vta.: ${String(factura.puntoVenta).padStart(4, '0')}`, fontSize: 9 },
              ...(factura.numeroAfip ? [{ text: `N° AFIP: ${factura.numeroAfip}`, fontSize: 9, margin: [0, 2, 0, 0] }] : []),
              ...(factura.remito ? [{ text: `Remito: ${factura.remito}`, fontSize: 9, margin: [0, 2, 0, 0] }] : []),
              ...(factura.operador ? [{ text: `Operador: ${factura.operador.nombre}`, fontSize: 8, color: COLOR_MUTED, margin: [0, 2, 0, 0] }] : []),
            ],
          },
        ],
        margin: [0, 0, 0, 12],
      },

      // Tabla de detalles
      {
        text: 'DETALLE',
        fontSize: 8,
        bold: true,
        color: COLOR_MUTED,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', ...(esFacturaB ? ['auto'] : [])],
          body: [detallesHeader, ...detallesBody],
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number) => i <= 1 ? '#44403c' : COLOR_BORDER,
          vLineColor: () => COLOR_BORDER,
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return '#44403c'
            return rowIndex % 2 === 0 ? COLOR_LIGHT : undefined
          },
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },

      // Totales
      {
        margin: [0, 12, 0, 0],
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              widths: ['auto', 'auto'],
              body: totalRows,
            },
            layout: {
              hLineWidth: (i: number, node: any) => i === node.table.body.length - 1 ? 1.5 : 0,
              vLineWidth: () => 0,
              hLineColor: (i: number, node: any) => i === node.table.body.length - 1 ? COLOR_TEXT : COLOR_BORDER,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
          },
        ],
      },

      // CAE
      ...caeSection,

      // Pagos
      ...pagosSection,

      // Observaciones
      ...obsSection,
    ],

    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: `Documento no valido como factura · ${empresaNombre} · Generado: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
          fontSize: 7,
          color: COLOR_MUTED,
          alignment: 'center',
        },
        {
          text: `Pag. ${currentPage} de ${pageCount}`,
          fontSize: 7,
          color: COLOR_MUTED,
          alignment: 'right',
          width: 'auto',
        },
      ],
      margin: [35, 10, 35, 0],
    }),

    styles: {
      tableHeader: {
        fontSize: 8,
        bold: true,
        color: 'white',
        fillColor: '#44403c',
      },
    },

    defaultStyle: {
      font: 'Roboto',
    },
  }

  return docDefinition
}
