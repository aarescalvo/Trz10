import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Generar PDF de trazabilidad
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const body = await request.json()
    const { 
      mediaResId, 
      codigoBarras
    } = body

    // Buscar la media res y su información relacionada
    // MediaRes has: romaneo, camara, usuarioFaena relations
    // No fechaFaena, no fechaVencimiento
     
    let mediaRes: any = null
    if (mediaResId) {
      mediaRes = await db.mediaRes.findUnique({
        where: { id: mediaResId },
        include: {
          romaneo: {
            include: {
              tipificador: true
            }
          },
          camara: true,
          usuarioFaena: true
        }
      })
    } else if (codigoBarras) {
      mediaRes = await db.mediaRes.findFirst({
        where: { codigo: codigoBarras },
        include: {
          romaneo: {
            include: {
              tipificador: true
            }
          },
          camara: true,
          usuarioFaena: true
        }
      })
    }

    if (!mediaRes) {
      return NextResponse.json(
        { success: false, error: 'Media res no encontrada' },
        { status: 404 }
      )
    }

    // Buscar movimientos de cámara relacionados
     
    const movimientos = await db.movimientoCamara.findMany({
      where: {
        OR: [
          { mediaResId: mediaRes.id },
          { tropaCodigo: mediaRes.romaneo?.tropaCodigo }
        ]
      },
      include: {
        camaraOrigen: true,
        camaraDestino: true
      },
      orderBy: { fecha: 'asc' }
    }) as Array<Record<string, unknown>>

    // Buscar despachos
    const despachoItems = await db.despachoItem.findMany({
      where: { mediaResId: mediaRes.id },
      include: {
        despacho: {
          select: {
            id: true,
            numero: true,
            fecha: true,
            destino: true,
            estado: true,
            patenteCamion: true,
            chofer: true,
            remito: true,
          }
        }
      }
    }) as Array<Record<string, unknown>>

    // Crear PDF
    const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } }
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Título
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('REPORTE DE TRAZABILIDAD', pageWidth / 2, 20, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Código: ${mediaRes.codigo}`, pageWidth / 2, 28, { align: 'center' })
    
    // Línea separadora
    doc.setLineWidth(0.5)
    doc.line(15, 32, pageWidth - 15, 32)

    let yPos = 40

    // ==================== DATOS DE LA MEDIA RES ====================
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('DATOS DE LA MEDIA RES', 15, yPos)
    yPos += 8

    const datosMediaRes = [
      ['Código de Barras', mediaRes.codigo],
      ['Lado', mediaRes.lado || '-'],
      ['Peso', `${(mediaRes.peso || 0).toFixed(1)} kg`],
      ['Sigla', mediaRes.sigla || '-'],
      ['Estado', mediaRes.estado || '-'],
      ['Fecha Faena', mediaRes.romaneo?.fecha ? new Date(mediaRes.romaneo.fecha).toLocaleDateString('es-AR') : '-'],
      ['Cámara', mediaRes.camara?.nombre || '-'],
      ['Dueño', mediaRes.usuarioFaena?.nombre || '-']
    ]

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: datosMediaRes,
      theme: 'plain',
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: 15, right: 15 }
    })

    yPos = doc.lastAutoTable.finalY + 10

    // ==================== DATOS DEL ROMANEO ====================
    if (mediaRes.romaneo) {
      const romaneo = mediaRes.romaneo
      
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('DATOS DEL ROMANEO', 15, yPos)
      yPos += 8

      const datosRomaneo = [
        ['Garrón', String(romaneo.garron)],
        ['Tropa', romaneo.tropaCodigo || '-'],
        ['Número Animal', romaneo.numeroAnimal ? String(romaneo.numeroAnimal) : '-'],
        ['Tipo Animal', romaneo.tipoAnimal || '-'],
        ['Raza', romaneo.raza || '-'],
        ['Peso Vivo', romaneo.pesoVivo ? `${romaneo.pesoVivo.toFixed(1)} kg` : '-'],
        ['Peso Media Izq', romaneo.pesoMediaIzq ? `${romaneo.pesoMediaIzq.toFixed(1)} kg` : '-'],
        ['Peso Media Der', romaneo.pesoMediaDer ? `${romaneo.pesoMediaDer.toFixed(1)} kg` : '-'],
        ['Peso Total', romaneo.pesoTotal ? `${romaneo.pesoTotal.toFixed(1)} kg` : '-'],
        ['Rinde', romaneo.rinde ? `${romaneo.rinde.toFixed(1)}%` : '-'],
        ['Denticion', romaneo.denticion || '-'],
        ['Tipificador', romaneo.tipificador ? `${romaneo.tipificador.nombre} ${romaneo.tipificador.apellido}` : '-'],
        ['Fecha', new Date(romaneo.fecha).toLocaleDateString('es-AR')]
      ]

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: datosRomaneo,
        theme: 'plain',
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: 15, right: 15 }
      })

      yPos = doc.lastAutoTable.finalY + 10
    }

    // ==================== MOVIMIENTOS DE CÁMARA ====================
    if (movimientos.length > 0) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('MOVIMIENTOS DE CÁMARA', 15, yPos)
      yPos += 8

      const movimientosData = movimientos.map(m => [
        new Date(m.fecha as string | Date).toLocaleDateString('es-AR'),
        (m.camaraOrigen as Record<string, unknown> | undefined)?.nombre || '-',
        (m.camaraDestino as Record<string, unknown> | undefined)?.nombre || '-',
        m.producto || '-',
        m.peso ? `${Number(m.peso).toFixed(1)} kg` : '-',
        m.observaciones || '-'
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Fecha', 'Origen', 'Destino', 'Producto', 'Peso', 'Observaciones']],
        body: movimientosData,
        theme: 'striped',
        headStyles: { fillColor: [120, 53, 15] },
        margin: { left: 15, right: 15 }
      })

      yPos = doc.lastAutoTable.finalY + 10
    }

    // ==================== DESPACHOS ====================
    if (despachoItems.length > 0) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('DESPACHOS', 15, yPos)
      yPos += 8

     
      const despachosData = despachoItems.map((d: any) => [
        d.despacho?.numero?.toString() || '-',
        d.despacho?.destino || '-',
        d.despacho?.fecha ? new Date(d.despacho.fecha as string | Date).toLocaleDateString('es-AR') : '-',
        `${Number(d.peso).toFixed(1)} kg`,
        d.despacho?.estado || '-'
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Nº Despacho', 'Destino', 'Fecha', 'Peso', 'Estado']],
        body: despachosData,
        theme: 'striped',
        headStyles: { fillColor: [120, 53, 15] },
        margin: { left: 15, right: 15 }
      })
    }

    // Pie de página
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Generado el ${new Date().toLocaleString('es-AR')} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }

    // Devolver PDF como base64
    const pdfBase64 = doc.output('datauristring')
    
    return NextResponse.json({
      success: true,
      pdf: pdfBase64,
      filename: `trazabilidad_${mediaRes.codigo}.pdf`
    })
  } catch (error) {
    console.error('Error generando PDF:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar PDF de trazabilidad' },
      { status: 500 }
    )
  }
}

// GET - Listar trazabilidad disponible para exportar
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: { OR?: Array<{ codigo: { contains: string; mode: 'insensitive' } }> } = {}
    
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } }
      ]
    }

    const mediasRes = await db.mediaRes.findMany({
      where,
      include: {
        romaneo: {
          select: {
            garron: true,
            tropaCodigo: true,
            fecha: true
          }
        },
        camara: { select: { nombre: true } },
        usuarioFaena: { select: { nombre: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: mediasRes
    })
  } catch (error) {
    console.error('Error fetching trazabilidad:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener trazabilidad' },
      { status: 500 }
    )
  }
}
