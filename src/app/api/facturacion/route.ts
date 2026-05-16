import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CondicionIva } from '@prisma/client'
import { validarPermiso } from '@/lib/auth-helpers'

// Helper para obtener operadorId desde header (middleware JWT)
function getOperadorId(request: NextRequest): string | null {
  return request.headers.get('x-operador-id')
}

// GET - Fetch facturas
export async function GET(request: NextRequest) {
  try {
    const operadorId = getOperadorId(request)
    const puedeVer = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeVer) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const clienteId = searchParams.get('clienteId')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const search = searchParams.get('search')
    const tipoComprobante = searchParams.get('tipoComprobante')
    
    // Parse pagination params with defaults
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Build filters with AND to avoid OR overriding other conditions
    const conditions: any[] = []
    
    if (estado && estado !== 'TODOS') {
      conditions.push({ estado })
    }
    
    if (clienteId) {
      conditions.push({ clienteId })
    }
    
    if (tipoComprobante) {
      conditions.push({ tipoComprobante })
    }
    
    if (desde || hasta) {
      const fechaFilter: any = {}
      if (desde) fechaFilter.gte = new Date(desde)
      if (hasta) {
        // Parse the date and set end of day
        const hastaDate = new Date(hasta)
        if (isNaN(hastaDate.getTime())) {
          // If it fails, try date-only format
          fechaFilter.lte = new Date(hasta + 'T23:59:59.999')
        } else {
          // If it already parsed correctly, set to end of that day
          hastaDate.setHours(23, 59, 59, 999)
          fechaFilter.lte = hastaDate
        }
      }
      conditions.push({ fecha: fechaFilter })
    }
    
    if (search) {
      conditions.push({
        OR: [
          { numero: { contains: search } },
          { cliente: { nombre: { contains: search } } },
          { cliente: { razonSocial: { contains: search } } },
          { remito: { contains: search } }
        ]
      })
    }
    
    const where = conditions.length > 0 ? { AND: conditions } : {}
    
    const [facturas, total] = await Promise.all([
      db.factura.findMany({
        where,
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              cuit: true,
              razonSocial: true,
              condicionIva: true,
              direccion: true
            }
          },
          detalles: {
            include: {
              tiposServicio: true
            },
            orderBy: { createdAt: 'asc' }
          },
          pagosFactura: {
            orderBy: { fecha: 'desc' }
          },
          operador: {
            select: {
              id: true,
              nombre: true
            }
          },
          tributos: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      db.factura.count({ where })
    ])
    
    return NextResponse.json({
      success: true,
      data: facturas,
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('Error fetching facturas:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener facturas' },
      { status: 500 }
    )
  }
}

// Función auxiliar para determinar tipo de comprobante según condición IVA
function getTipoComprobante(condicionIva: string | null): 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' {
  switch (condicionIva) {
    case 'RI':
      return 'FACTURA_A'  // Responsable Inscripto -> Factura A
    case 'CF':
    case 'MT':
      return 'FACTURA_B'  // Consumidor Final o Monotributista -> Factura B
    case 'EX':
    case 'NC':
    default:
      return 'FACTURA_C'  // Exento o No Categorizado -> Factura C
  }
}

// Función auxiliar para obtener precio vigente
async function obtenerPrecioVigente(tipoServicioId: string, clienteId: string, fecha: Date) {
  const precio = await db.precioServicio.findFirst({
    where: {
      tipoServicioId,
      clienteId,
      fechaDesde: { lte: fecha },
      OR: [
        { fechaHasta: null },
        { fechaHasta: { gte: fecha } }
      ]
    },
    orderBy: { fechaDesde: 'desc' }
  })
  
  return precio
}

// POST - Create new factura
export async function POST(request: NextRequest) {
  try {
    const operadorId = request.headers.get('x-operador-id')
    if (!operadorId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Validate permissions
    const puedeFacturar = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeFacturar) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      clienteId, 
      fecha,
      detalles,
      observaciones,
      condicionVenta,
      remito,
      despachoId
    } = body
    
    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'El cliente es requerido' },
        { status: 400 }
      )
    }
    
    if (!detalles || detalles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe agregar al menos un detalle' },
        { status: 400 }
      )
    }
    
    // Obtener datos del cliente
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId }
    })
    
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }
    
    // Determinar tipo de comprobante según condición IVA del cliente
    const tipoComprobante = getTipoComprobante(cliente.condicionIva || null)
    
    // Calcular totales y obtener precios vigentes (read-only queries, outside transaction)
    const fechaFactura = fecha ? new Date(fecha) : new Date()
    
    let subtotal = 0
    let totalIva = 0
    
    const detallesCalculados = await Promise.all(detalles.map(async (d: any) => {
      let precioUnitario = d.precioUnitario
      
      // Si no se especificó precio, buscar precio vigente
      if (!precioUnitario && d.tipoServicioId) {
        const precioVigente = await obtenerPrecioVigente(d.tipoServicioId, clienteId, fechaFactura)
        if (precioVigente) {
          precioUnitario = precioVigente.precio
        }
      }
      
      const subtotalDetalle = Number(d.cantidad) * Number(precioUnitario || 0)
      subtotal += subtotalDetalle
      
      // Calcular IVA del detalle
      const tipoServicio = d.tipoServicioId 
        ? await db.tipoServicio.findUnique({ where: { id: d.tipoServicioId } })
        : null
      // Usar ?? en lugar de || para respetar el valor 0
      const porcentajeIva = d.porcentajeIva !== undefined 
        ? Number(d.porcentajeIva) 
        : (tipoServicio?.porcentajeIva ?? 21)
      const ivaDetalle = subtotalDetalle * (porcentajeIva / 100)
      totalIva += ivaDetalle
      
      return {
        ...d,
        precioUnitario: Number(precioUnitario || 0),
        subtotal: subtotalDetalle,
        porcentajeIva,
        tipoServicioId: d.tipoServicioId || null
      }
    }))
    
    const total = subtotal + totalIva
    
    // Determinar si discriminar IVA según tipo de comprobante
    const discriminadoIva = tipoComprobante === 'FACTURA_A'
    const iva = discriminadoIva ? totalIva : 0
    const totalFinal = discriminadoIva ? total : subtotal
    // Prevent division by zero when subtotal is 0
    const porcentajeIvaCalculado = subtotal > 0 ? (totalIva / subtotal * 100) : 0
    
    // Crear la factura con numerador en una transacción atómica
    // para evitar huecos en la numeración si la creación falla
    const factura = await db.$transaction(async (tx) => {
      // Obtener el último número de factura (atomic read + increment)
      const numerador = await tx.numerador.upsert({
        where: { nombre: 'FACTURA' },
        update: { ultimoNumero: { increment: 1 } },
        create: { nombre: 'FACTURA', ultimoNumero: 1 }
      })
      
      const numeroInterno = numerador.ultimoNumero
      const numero = String(numeroInterno).padStart(8, '0')
      
      return await tx.factura.create({
        data: {
          numero,
          numeroInterno,
          tipoComprobante,
          clienteId,
          fecha: fechaFactura,
          subtotal,
          iva,
          total: totalFinal,
          estado: 'PENDIENTE',
          observaciones: observaciones || null,
          condicionVenta: condicionVenta || 'CUENTA_CORRIENTE',
          remito: remito || null,
          operadorId: operadorId || null,
          detalles: {
            create: detallesCalculados.map((d: any) => ({
              tipoServicioId: d.tipoServicioId,
              tipoProducto: d.tipoProducto || 'OTRO',
              descripcion: d.descripcion,
              cantidad: Number(d.cantidad),
              unidad: d.unidad || 'KG',
              precioUnitario: d.precioUnitario,
              subtotal: d.subtotal,
              tropaCodigo: d.tropaCodigo || null,
              garron: d.garron || null,
              mediaResId: d.mediaResId || null,
              despachoId: d.despachoId || null,
              pesoKg: d.pesoKg ? Number(d.pesoKg) : null
            }))
          }
        },
        include: {
          cliente: true,
          detalles: {
            include: {
              tiposServicio: true
            }
          },
          operador: true
        }
      })
    })
    
    return NextResponse.json({
      success: true,
      data: factura
    })
  } catch (error) {
    console.error('Error creating factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear factura' },
      { status: 500 }
    )
  }
}

// Máquina de estados para transiciones válidas de factura
const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  'PENDIENTE': ['EMITIDA', 'ANULADA'],
  'EMITIDA': ['CANCELADA', 'PAGADA'],
  'CANCELADA': [],
  'ANULADA': [],
  'PAGADA': [],
}

function isValidStateTransition(currentState: string, newState: string): boolean {
  if (!currentState || !newState || currentState === newState) return false
  const allowed = VALID_STATE_TRANSITIONS[currentState]
  return allowed ? allowed.includes(newState) : false
}

// PUT - Update factura
export async function PUT(request: NextRequest) {
  try {
    const operadorId = request.headers.get('x-operador-id')
    if (!operadorId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Validate permissions
    const puedeFacturar = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeFacturar) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, estado, observaciones, remito, caeVencimiento } = body
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }
    
    // Si se quiere cambiar el estado, validar la transición
    if (estado) {
      const facturaExistente = await db.factura.findUnique({
        where: { id },
        select: { estado: true }
      })
      
      if (!facturaExistente) {
        return NextResponse.json(
          { success: false, error: 'Factura no encontrada' },
          { status: 404 }
        )
      }
      
      if (!isValidStateTransition(facturaExistente.estado, estado)) {
        return NextResponse.json(
          { success: false, error: `Transición de estado inválida: ${facturaExistente.estado} → ${estado}` },
          { status: 400 }
        )
      }
    }
    
    const factura = await db.factura.update({
      where: { id },
      data: {
        estado,
        observaciones,
        remito,
        caeVencimiento: caeVencimiento ? new Date(caeVencimiento) : undefined
      },
      include: {
        cliente: true,
        detalles: true
      }
    })
    
    return NextResponse.json({
      success: true,
      data: factura
    })
  } catch (error) {
    console.error('Error updating factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar factura' },
      { status: 500 }
    )
  }
}

// DELETE - Anular factura
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const operadorId = request.headers.get('x-operador-id')
    
    // Validate permissions
    const puedeFacturar = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeFacturar) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }
    
    // Verificar si tiene pagos
    const pagos = await db.pagoFactura.findMany({
      where: { facturaId: id }
    })
    
    if (pagos.length > 0) {
      // Si tiene pagos, no se puede anular directamente
      return NextResponse.json(
        { success: false, error: 'No se puede anular una factura con pagos registrados. Debe generar una nota de crédito.' },
        { status: 400 }
      )
    }
    
    // Anular la factura
    const factura = await db.factura.update({
      where: { id },
      data: {
        estado: 'ANULADA'
      }
    })
    
    return NextResponse.json({
      success: true,
      data: factura,
      message: 'Factura anulada correctamente'
    })
  } catch (error) {
    console.error('Error annulling factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al anular factura' },
      { status: 500 }
    )
  }
}
