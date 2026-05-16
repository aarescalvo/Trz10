import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener stock ordenado por FIFO (First In, First Out)
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    const camaraId = searchParams.get('camaraId')
    const diasVencimiento = parseInt(searchParams.get('diasVencimiento') || '30')
    const incluirAlertas = searchParams.get('alertas') === 'true'

    // Construir filtros para medias reses
    const whereMedia: Record<string, unknown> = { estado: 'EN_CAMARA' }
    if (camaraId) whereMedia.camaraId = camaraId

    // Si hay cliente, filtrar por usuario faena
    let tropasDelCliente: string[] = []
    if (clienteId) {
      const tropas = await db.tropa.findMany({
        where: { usuarioFaenaId: clienteId },
        select: { codigo: true }
      })
      tropasDelCliente = tropas.map(t => t.codigo)
    }

    // Obtener medias reses ordenadas por fecha de creación (más antiguas primero)
    // MediaRes doesn't have fechaFaena, use createdAt or romaneo.fecha
    const mediasRes = await db.mediaRes.findMany({
      where: {
        ...whereMedia,
        ...(tropasDelCliente.length > 0 ? { 
          romaneo: { tropaCodigo: { in: tropasDelCliente } } 
        } : {})
      },
      include: {
        romaneo: {
          select: {
            garron: true,
            tropaCodigo: true,
            fecha: true,
            tipoAnimal: true,
            pesoVivo: true
          }
        },
        camara: { select: { id: true, nombre: true } }
      },
      orderBy: {
        createdAt: 'asc' // FIFO: más antiguos primero
      }
    })

    const hoy = new Date()
    const alertas: Array<{
      tipo: 'CRITICO' | 'URGENTE' | 'PROXIMO'
      diasRestantes: number
      mediaRes: any
    }> = []

    // Procesar cada media res y calcular días en cámara
    // MediaRes doesn't have fechaFaena, diasVencimiento, or fechaVencimiento
    // Use romaneo.fecha as the faena date proxy and createdAt for camera date
    const stockFIFO = mediasRes.map((media: any) => {
      const fechaReferencia = media.romaneo?.fecha || media.createdAt
      const diasEnCamara = Math.floor((hoy.getTime() - new Date(fechaReferencia).getTime()) / (1000 * 60 * 60 * 24))
      const diasRestantes = diasVencimiento - diasEnCamara
      
      // Calcular estado de vencimiento
      let estadoVencimiento: 'OK' | 'PROXIMO' | 'URGENTE' | 'CRITICO' = 'OK'
      if (diasRestantes <= 0) {
        estadoVencimiento = 'CRITICO'
      } else if (diasRestantes <= 3) {
        estadoVencimiento = 'URGENTE'
      } else if (diasRestantes <= 7) {
        estadoVencimiento = 'PROXIMO'
      }

      // Agregar a alertas si corresponde
      if (incluirAlertas && (estadoVencimiento === 'CRITICO' || estadoVencimiento === 'URGENTE' || estadoVencimiento === 'PROXIMO')) {
        alertas.push({
          tipo: estadoVencimiento,
          diasRestantes,
          mediaRes: media
        })
      }

      return {
        id: media.id,
        codigo: media.codigo,
        lado: media.lado,
        sigla: media.sigla,
        peso: media.peso,
        camara: media.camara,
        tropaCodigo: media.romaneo?.tropaCodigo,
        garron: media.romaneo?.garron,
        tipoAnimal: media.romaneo?.tipoAnimal,
        fechaFaena: media.romaneo?.fecha || null,
        diasEnCamara,
        diasVencimiento,
        diasRestantes,
        fechaVencimiento: media.romaneo?.fecha 
          ? new Date(new Date(media.romaneo.fecha).getTime() + diasVencimiento * 24 * 60 * 60 * 1000).toISOString()
          : null,
        estadoVencimiento,
        prioridadFIFO: diasEnCamara // Mayor prioridad = más antiguo
      }
    })

    // Ordenar por prioridad FIFO (más antiguos primero)
    stockFIFO.sort((a, b) => b.prioridadFIFO - a.prioridadFIFO)

    // Agrupar por cámara para resumen
    const resumenPorCamara = new Map<string, {
      camaraId: string
      camaraNombre: string
      totalMedias: number
      totalKg: number
      criticos: number
      urgentes: number
      proximos: number
      ok: number
    }>()

    stockFIFO.forEach(item => {
      const camaraId = item.camara?.id || 'sin-camara'
      const camaraNombre = item.camara?.nombre || 'Sin cámara'
      
      const existing = resumenPorCamara.get(camaraId)
      if (existing) {
        existing.totalMedias++
        existing.totalKg += item.peso
        if (item.estadoVencimiento === 'CRITICO') existing.criticos++
        else if (item.estadoVencimiento === 'URGENTE') existing.urgentes++
        else if (item.estadoVencimiento === 'PROXIMO') existing.proximos++
        else existing.ok++
      } else {
        resumenPorCamara.set(camaraId, {
          camaraId,
          camaraNombre,
          totalMedias: 1,
          totalKg: item.peso,
          criticos: item.estadoVencimiento === 'CRITICO' ? 1 : 0,
          urgentes: item.estadoVencimiento === 'URGENTE' ? 1 : 0,
          proximos: item.estadoVencimiento === 'PROXIMO' ? 1 : 0,
          ok: item.estadoVencimiento === 'OK' ? 1 : 0
        })
      }
    })

    // Calcular sugerencias de despacho FIFO
    const sugerenciasDespacho: Array<{
      camaraId: string
      camaraNombre: string
      medias: Array<{
        id: string
        codigo: string
        tropaCodigo: string | null
        garron: number | null
        peso: number
        diasEnCamara: number
        diasRestantes: number
        estadoVencimiento: string
      }>
      totalKg: number
      prioridad: number // Mayor = más urgente despachar
    }> = []

    // Agrupar sugerencias por cámara
    const mediasPorCamara = new Map<string, typeof stockFIFO>()
    stockFIFO.forEach(item => {
      const camaraId = item.camara?.id || 'sin-camara'
      if (!mediasPorCamara.has(camaraId)) {
        mediasPorCamara.set(camaraId, [])
      }
      mediasPorCamara.get(camaraId)!.push(item)
    })

    // Crear sugerencias ordenadas por urgencia
    mediasPorCamara.forEach((medias, camaraId) => {
      const criticosCount = medias.filter(m => m.estadoVencimiento === 'CRITICO').length
      const urgentesCount = medias.filter(m => m.estadoVencimiento === 'URGENTE').length
      const totalKg = medias.reduce((acc, m) => acc + m.peso, 0)
      
      sugerenciasDespacho.push({
        camaraId,
        camaraNombre: medias[0]?.camara?.nombre || 'Sin cámara',
        medias: medias.map(m => ({
          id: m.id,
          codigo: m.codigo,
          tropaCodigo: m.tropaCodigo,
          garron: m.garron,
          peso: m.peso,
          diasEnCamara: m.diasEnCamara,
          diasRestantes: m.diasRestantes,
          estadoVencimiento: m.estadoVencimiento
        })),
        totalKg,
        prioridad: criticosCount * 100 + urgentesCount * 10 + (medias.length > 0 ? medias[0].diasEnCamara : 0)
      })
    })

    // Ordenar sugerencias por prioridad (mayor primero)
    sugerenciasDespacho.sort((a, b) => b.prioridad - a.prioridad)

    // Ordenar alertas por severidad
    alertas.sort((a, b) => a.diasRestantes - b.diasRestantes)

    return NextResponse.json({
      success: true,
      data: {
        stockFIFO,
        resumenPorCamara: Array.from(resumenPorCamara.values()),
        sugerenciasDespacho,
        alertas: alertas.map(a => ({
          tipo: a.tipo,
          diasRestantes: a.diasRestantes,
          id: a.mediaRes.id,
          codigo: a.mediaRes.codigo,
          tropaCodigo: a.mediaRes.romaneo?.tropaCodigo,
          garron: a.mediaRes.romaneo?.garron,
          peso: a.mediaRes.peso,
          camara: a.mediaRes.camara?.nombre
        })),
        totales: {
          totalMedias: stockFIFO.length,
          totalKg: stockFIFO.reduce((acc, m) => acc + m.peso, 0),
          criticos: stockFIFO.filter(m => m.estadoVencimiento === 'CRITICO').length,
          urgentes: stockFIFO.filter(m => m.estadoVencimiento === 'URGENTE').length,
          proximos: stockFIFO.filter(m => m.estadoVencimiento === 'PROXIMO').length
        }
      }
    })
  } catch (error) {
    console.error('Error fetching FIFO stock:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener stock FIFO' },
      { status: 500 }
    )
  }
}

// POST - Crear despacho automático según FIFO
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const body = await request.json()
    const { clienteId, cantidadMedias, camaraId, operadorId } = body

    if (!clienteId || !cantidadMedias) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    // Obtener medias reses según FIFO
    // MediaRes doesn't have fechaFaena, use createdAt
    const whereMedia: Record<string, unknown> = { 
      estado: 'EN_CAMARA',
      usuarioFaenaId: clienteId 
    }
    if (camaraId) whereMedia.camaraId = camaraId

    const mediasRes = await db.mediaRes.findMany({
      where: whereMedia,
      orderBy: { createdAt: 'asc' },
      take: cantidadMedias,
      include: {
        romaneo: { select: { tropaCodigo: true, garron: true } }
      }
    }) as Array<Record<string, unknown>>

    if (mediasRes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay stock disponible' },
        { status: 400 }
      )
    }

    // Crear despacho con las medias seleccionadas según FIFO
    const ultimoDespacho = await db.despacho.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true }
    })
    const nuevoNumero = (ultimoDespacho?.numero || 0) + 1

    // Despacho requires: destino (string), numero (int), kgTotal, cantidadMedias, estado
    const despacho = await db.despacho.create({
      data: {
        numero: nuevoNumero,
        destino: 'Despacho FIFO automático',
        kgTotal: mediasRes.reduce((acc, m) => acc + Number(m.peso), 0),
        cantidadMedias: mediasRes.length,
        operadorId,
        estado: 'PENDIENTE',
        items: {
           
          create: mediasRes.map(m => ({
            mediaResId: m.id,
            tropaCodigo: (m.romaneo as Record<string, unknown> | undefined)?.tropaCodigo,
            garron: (m.romaneo as Record<string, unknown> | undefined)?.garron,
            peso: m.peso
          })) as any
        }
      },
      include: { items: true }
    })

    // Marcar medias como despachadas
    await db.mediaRes.updateMany({
      where: { id: { in: mediasRes.map(m => m.id as string) } },
      data: { estado: 'DESPACHADO' }
    })

    return NextResponse.json({
      success: true,
      data: despacho,
      message: `Despacho #${despacho.numero} creado con ${mediasRes.length} medias según FIFO`
    })
  } catch (error) {
    console.error('Error creating FIFO despacho:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear despacho FIFO' },
      { status: 500 }
    )
  }
}
