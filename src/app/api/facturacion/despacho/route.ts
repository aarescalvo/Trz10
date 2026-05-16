import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CondicionIva } from '@prisma/client'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
const log = createLogger('app.api.facturacion.despacho.route')

interface DetalleFacturaInput {
  tipoServicioId?: string
  tipoProducto: string
  descripcion: string
  cantidad: number
  unidad: string
  precioUnitario: number
  subtotal: number
  despachoId?: string
}

// POST - Crear factura desde despacho
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { 
      despachoId, 
      operadorId,
      incluirServicios = true
    } = body

    if (!despachoId) {
      return NextResponse.json(
        { success: false, error: 'ID de despacho es requerido' },
        { status: 400 }
      )
    }

    // Obtener el despacho con sus items
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
        }
      }
    })

    if (!despacho) {
      return NextResponse.json(
        { success: false, error: 'Despacho no encontrado' },
        { status: 404 }
      )
    }

    // Agrupar items por usuario/cliente
    const itemsPorUsuario: Record<string, typeof despacho.items[0][]> = {}
    
    for (const item of despacho.items) {
      const usuarioId = item.usuarioId || item.mediaRes?.usuarioFaenaId
      if (!usuarioId) continue
      
      if (!itemsPorUsuario[usuarioId]) {
        itemsPorUsuario[usuarioId] = []
      }
      itemsPorUsuario[usuarioId].push(item)
    }

    if (Object.keys(itemsPorUsuario).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay items con usuario asignado para facturar' },
        { status: 400 }
      )
    }

    // Crear una factura por cada usuario
    const facturasCreadas: Awaited<ReturnType<typeof db.factura.create>>[] = []

    for (const [usuarioId, items] of Object.entries(itemsPorUsuario)) {
      // Obtener datos del cliente
      const cliente = await db.cliente.findUnique({
        where: { id: usuarioId }
      })

      if (!cliente) {
        log.info(`Cliente ${usuarioId} no encontrado, saltando...`)
        continue
      }

      // Calcular total de kg
      const totalKg = items.reduce((sum, item) => sum + (item.peso || 0), 0)

      // Obtener precio de servicio de faena
      let precioFaena = 0
      if (incluirServicios) {
        const tipoServicioFaena = await db.tipoServicio.findFirst({
          where: { codigo: 'FAENA', activo: true }
        })
        
        if (tipoServicioFaena) {
          const precioVigente = await db.precioServicio.findFirst({
            where: {
              tipoServicioId: tipoServicioFaena.id,
              clienteId: usuarioId,
              fechaDesde: { lte: new Date() },
              OR: [
                { fechaHasta: null },
                { fechaHasta: { gte: new Date() } }
              ]
            },
            orderBy: { fechaDesde: 'desc' }
          })
          
          precioFaena = precioVigente?.precio || 0
        }
      }

      // Determinar tipo de comprobante según IVA del cliente
      let tipoComprobante: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' = 'FACTURA_B'
      if (cliente.condicionIva === 'RI') {
        tipoComprobante = 'FACTURA_A'
      } else if (cliente.condicionIva === 'EX' || cliente.condicionIva === 'NC') {
        tipoComprobante = 'FACTURA_C'
      }

      // Obtener número de factura
      const numerador = await db.numerador.upsert({
        where: { nombre: 'FACTURA' },
        update: { ultimoNumero: { increment: 1 } },
        create: { nombre: 'FACTURA', ultimoNumero: 1 }
      })

      const numero = String(numerador.ultimoNumero).padStart(8, '0')

      // Crear detalles de factura
      const detalles: DetalleFacturaInput[] = []
      let subtotal = 0

      // Detalle de faena por kg
      if (precioFaena > 0 && totalKg > 0) {
        const tipoServicioFaena = await db.tipoServicio.findFirst({
          where: { codigo: 'FAENA', activo: true }
        })
        
        const subtotalFaena = totalKg * precioFaena
        subtotal += subtotalFaena
        
        detalles.push({
          tipoServicioId: tipoServicioFaena?.id,
          tipoProducto: 'MEDIA_RES',
          descripcion: `Servicio de Faena - ${items.length} medias - ${totalKg.toFixed(2)} kg`,
          cantidad: totalKg,
          unidad: 'KG',
          precioUnitario: precioFaena,
          subtotal: subtotalFaena,
          despachoId
        })
      }

      // Calcular IVA según tipo de comprobante
      const porcentajeIva = tipoComprobante === 'FACTURA_A' ? 10.5 : 0
      const iva = subtotal * (porcentajeIva / 100)
      const total = tipoComprobante === 'FACTURA_A' ? subtotal + iva : subtotal

      // Crear la factura
      const factura = await db.factura.create({
        data: {
          numero,
          numeroInterno: numerador.ultimoNumero,
          tipoComprobante,
          clienteId: usuarioId,
          fecha: new Date(),
          subtotal,
          iva,
          total,
          estado: 'PENDIENTE',
          condicionVenta: 'CUENTA_CORRIENTE',
          remito: despacho.remito || undefined,
          operadorId,
          detalles: {
             
            create: detalles as any
          }
        },
        include: {
          cliente: true,
          detalles: true
        }
      })

      facturasCreadas.push(factura)
    }

    return NextResponse.json({
      success: true,
      data: facturasCreadas,
      message: `Se crearon ${facturasCreadas.length} factura(s)`
    })
  } catch (error) {
    console.error('Error creating factura from despacho:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear factura desde despacho' },
      { status: 500 }
    )
  }
}
