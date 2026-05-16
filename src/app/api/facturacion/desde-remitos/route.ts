import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener remitos pendientes de facturar para un cliente
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    const despachoId = searchParams.get('despachoId')

    // Si se proporciona un despacho específico, obtener detalle
    if (despachoId) {
      const despacho = await db.despacho.findUnique({
        where: { id: despachoId },
        include: {
          items: {
            include: {
              mediaRes: {
                include: {
                  romaneo: true
                }
              }
            }
          },
        }
      })

      if (!despacho) {
        return NextResponse.json(
          { success: false, error: 'Despacho no encontrado' },
          { status: 404 }
        )
      }

      // Obtener precios sugeridos para cada item
      const itemsConPrecio = await Promise.all(
        despacho.items.map(async (item) => {
          // Buscar producto vendible correspondiente a media res
          const producto = await db.productoVendible.findFirst({
            where: {
              categoria: 'PRODUCTO_CARNICO',
              especie: (item.mediaRes?.romaneo as Record<string, unknown> | null)?.tropa != null
                ? String((item.mediaRes?.romaneo as Record<string, unknown>).tropa).startsWith('B') ? 'BOVINO' : 'EQUINO'
                : 'BOVINO'
            }
          })

          let precioSugerido = 0
          let fuentePrecio = 'SIN_PRECIO'

          // TODO: Despacho doesn't have clienteId. Infer from items (usuarioId on DespachoItem)
          const usuarioId = item.usuarioId
          if (producto && usuarioId) {
            // Buscar precio sugerido
            const precioCliente = await db.precioCliente.findFirst({
              where: {
                clienteId: usuarioId,
                activo: true
              }
            })

            if (precioCliente) {
              precioSugerido = precioCliente.precioKg
              fuentePrecio = 'PRECIO_CLIENTE'
            } else if (producto.precioBase) {
              precioSugerido = producto.precioBase
              fuentePrecio = 'LISTA_BASE'
            }
          }

          return {
            ...item,
            productoVendible: producto,
            precioSugerido,
            fuentePrecio,
            subtotalSugerido: precioSugerido * (item.peso || 0)
          }
        })
      )

      return NextResponse.json({
        success: true,
        data: {
          despacho,
          items: itemsConPrecio,
          resumen: {
            cantidadMedias: despacho.cantidadMedias,
            kgTotal: despacho.kgTotal,
            subtotalEstimado: itemsConPrecio.reduce((sum, item) => sum + item.subtotalSugerido, 0)
          }
        }
      })
    }

    // Listar despachos
    // TODO: Despacho doesn't have facturado or clienteId fields.
    // Consider adding these fields to the schema or filtering via items (DespachoItem.usuarioId)
    const where: Record<string, unknown> = {}
    // For now, fetch all non-ANULADO despachos
    where.estado = { not: 'ANULADO' }

    const despachos = await db.despacho.findMany({
      where,
      include: {
        items: true,
        _count: {
          select: { items: true }
        }
      },
      orderBy: { fecha: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: despachos
    })
  } catch (error) {
    console.error('Error obteniendo remitos para facturar:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener remitos' },
      { status: 500 }
    )
  }
}

// POST - Crear factura desde remitos seleccionados
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      clienteId,
      despachoIds,
      items,
      servicios,
      operadorId,
      condicionVenta,
      observaciones
    } = body

    if (!clienteId || (!despachoIds?.length && !items?.length)) {
      return NextResponse.json(
        { success: false, error: 'Cliente e items son requeridos' },
        { status: 400 }
      )
    }

    // Obtener último número de factura
    const ultimaFactura = await db.factura.findFirst({
      orderBy: { numeroInterno: 'desc' }
    })
    const numeroInterno = (ultimaFactura?.numeroInterno || 0) + 1
    const numero = `0001-${String(numeroInterno).padStart(8, '0')}`

    // Calcular totales
    let subtotal = 0
    const detallesData: Record<string, unknown>[] = []

    // Procesar items principales
    for (const item of items || []) {
      const subtotalItem = item.cantidad * item.precioUnitario
      subtotal += subtotalItem

      detallesData.push({
        tipoProducto: item.tipoProducto || 'MEDIA_RES',
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad || 'KG',
        precioUnitario: item.precioUnitario,
        subtotal: subtotalItem,
        pesoKg: item.pesoKg,
        tropaCodigo: item.tropaCodigo,
        garron: item.garron,
        mediaResId: item.mediaResId,
        despachoId: item.despachoId,
      })
    }

    // Procesar servicios adicionales
    for (const servicio of servicios || []) {
      const subtotalServicio = servicio.cantidad * servicio.precioUnitario
      subtotal += subtotalServicio

      detallesData.push({
        tipoProducto: 'OTRO',
        descripcion: servicio.descripcion,
        cantidad: servicio.cantidad,
        unidad: servicio.unidad || 'UN',
        precioUnitario: servicio.precioUnitario,
        subtotal: subtotalServicio,
      })
    }

    // Calcular IVA (21% por defecto)
    const iva = subtotal * 0.21
    const total = subtotal + iva

    // Crear factura con detalles
    const factura = await db.factura.create({
      data: {
        numero,
        numeroInterno,
        clienteId,
        subtotal,
        iva,
        total,
        estado: 'PENDIENTE',
        condicionVenta: condicionVenta || 'CONTADO',
        observaciones,
        operadorId,
        detalles: {
          create: detallesData as any[]
        }
      },
      include: {
        detalles: true,
        cliente: true
      }
    })

    // TODO: Despacho doesn't have facturado, facturaId, or fechaFacturacion fields.
    // Consider adding these fields to the schema to track billing status.
    // For now, we skip marking despachos as facturado.
    // if (despachoIds?.length) {
    //   await db.despacho.updateMany({
    //     where: { id: { in: despachoIds } },
    //     data: { facturado: true, facturaId: factura.id, fechaFacturacion: new Date() }
    //   })
    // }

    // Guardar histórico de precios usados
    for (const item of items || []) {
      if (item.productoVendibleId && item.precioUnitario > 0) {
        // Actualizar o crear histórico
        await db.historicoPrecioProducto.create({
          data: {
            productoVendibleId: item.productoVendibleId,
            precioNuevo: item.precioUnitario,
            motivo: `Facturado en ${numero}`,
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: factura,
      message: `Factura ${numero} creada exitosamente`
    })
  } catch (error) {
    console.error('Error creando factura desde remitos:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear factura' },
      { status: 500 }
    )
  }
}
