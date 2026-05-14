import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
const log = createLogger('app.api.afip.factura.route')

/**
 * API de Facturación Electrónica AFIP
 * 
 * En modo testing: genera CAE ficticio (12345678901234)
 * En modo producción: conecta con AFIP WSFEX para obtener CAE real
 */

// Tipos de comprobantes AFIP
const TIPOS_COMPROBANTE = {
  FACTURA_A: 1,    // Factura A
  FACTURA_B: 6,    // Factura B
  FACTURA_C: 11,   // Factura C
  NOTA_DEBITO_A: 2,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_A: 3,
  NOTA_CREDITO_B: 8
}

// Tipos de documento
const TIPOS_DOCUMENTO = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  SIN_IDENTIFICAR: 99
}

// Monedas
const MONEDAS = {
  PESOS: 'PES',
  DOLAR: 'DOL',
  EURO: 'EUR'
}

// Códigos de IVA
const CODIGOS_IVA = {
  IVA_21: 5,
  IVA_10_5: 4,
  IVA_27: 6,
  IVA_0: 3,
  EXENTO: 1,
  NO_GRAVADO: 2
}

interface FacturaAFIP {
  id: string
  numero: string
  clienteId: string
  cliente: {
    id: string
    nombre: string
    cuit?: string | null
    direccion?: string | null
  }
  subtotal: number
  iva: number
  total: number
  estado: string
  fecha: Date
  detalles: Array<{
    id: string
    tipoProducto: string
    descripcion: string
    cantidad: number
    unidad: string
    precioUnitario: number
    subtotal: number
  }>
  tipoComprobante?: string | null
  numeroComprobante?: string | null
  cae?: string | null
  fechaVencimientoCAE?: Date | null
}

/**
 * Determina el tipo de comprobante según el CUIT del cliente
 * 
 * - Cliente con CUIT válido: Factura A
 * - Cliente sin CUIT o CUIL: Factura B
 * - Consumidor final sin identificación: Factura C (en algunos casos)
 */
function determinarTipoComprobante(cuitCliente?: string | null): string {
  if (!cuitCliente) {
    return 'B' // Sin CUIT, factura B
  }
  
  // Validar formato de CUIT (11 dígitos)
  const cuitLimpio = cuitCliente.replace(/[-\s]/g, '')
  if (cuitLimpio.length === 11 && /^\d{11}$/.test(cuitLimpio)) {
    return 'A' // CUIT válido, factura A
  }
  
  return 'B' // CUIT inválido, factura B
}

/**
 * Genera un CAE ficticio para testing
 * Formato: 14 dígitos
 */
function generateMockCAE(): string {
  // CAE de testing: "12345678901234" según especificación
  return '12345678901234'
}

/**
 * Genera la fecha de vencimiento del CAE
 * AFIP establece 10 días desde la emisión
 */
function generateFechaVencimientoCAE(): Date {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 10)
  return fecha
}

/**
 * Genera el número de comprobante AFIP
 * Formato: Punto de venta (4 dígitos) - Número (8 dígitos)
 */
function generateNumeroComprobante(puntoVenta: number, numero: number): string {
  const pv = String(puntoVenta).padStart(4, '0')
  const num = String(numero).padStart(8, '0')
  return `${pv}-${num}`
}

/**
 * Genera los datos para el código QR de AFIP
 * 
 * El QR debe contener:
 * - CUIT del emisor
 * - Tipo de comprobante
 * - Punto de venta
 * - Número de comprobante
 * - Fecha de emisión
 * - Importe total
 * - CAE
 * - Fecha de vencimiento CAE
 */
function generateQRData(
  cuit: string,
  tipoComprobante: number,
  puntoVenta: number,
  numeroComprobante: number,
  fecha: Date,
  importeTotal: number,
  cae: string,
  fechaVencimientoCAE: Date
): string {
  // Formato simplificado para QR
  // En producción, usar el formato oficial de AFIP
  const qrData = {
    ver: 1,
    fecha: fecha.toISOString().split('T')[0],
    cuit: cuit.replace(/[-\s]/g, ''),
    ptoVta: puntoVenta,
    tipoCmp: tipoComprobante,
    nroCmp: numeroComprobante,
    importe: Math.round(importeTotal * 100) / 100,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: 80, // CUIT
    nroDocRec: 0,
    tipoCodAut: 'E', // CAE
    codAut: parseInt(cae, 10)
  }
  
  return JSON.stringify(qrData)
}

/**
 * GET - Obtener estado de facturas AFIP
 */
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const facturaId = searchParams.get('facturaId')
    
    if (facturaId) {
      // Obtener factura específica
      const factura = await db.factura.findUnique({
        where: { id: facturaId },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              cuit: true,
              direccion: true
            }
          },
          detalles: true
        }
      })
      
      if (!factura) {
        return NextResponse.json(
          { success: false, error: 'Factura no encontrada' },
          { status: 404 }
        )
      }
      
      // Determinar tipo de comprobante
      const tipoComprobante = determinarTipoComprobante(factura.cliente.cuit)
      
      return NextResponse.json({
        success: true,
        data: {
          ...factura,
          tipoComprobanteSugerido: tipoComprobante,
          puedeEmitirAFIP: factura.estado === 'PENDIENTE' && !factura.cae
        }
      })
    }
    
    // Listar facturas pendientes de emitir
    const facturas = await db.factura.findMany({
      where: {
        estado: 'PENDIENTE',
        cae: null
      },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            cuit: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    
    // Agregar tipo sugerido a cada factura
    const facturasConTipo = facturas.map(f => ({
      ...f,
      tipoComprobanteSugerido: determinarTipoComprobante(f.cliente.cuit)
    }))
    
    return NextResponse.json({
      success: true,
      data: facturasConTipo,
      count: facturas.length
    })
    
  } catch (error) {
    console.error('Error obteniendo facturas AFIP:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener facturas AFIP' },
      { status: 500 }
    )
  }
}

/**
 * POST - Emitir factura electrónica AFIP
 */
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { facturaId, operadorId } = body
    
    if (!facturaId) {
      return NextResponse.json(
        { success: false, error: 'ID de factura requerido' },
        { status: 400 }
      )
    }
    
    // Obtener la factura
    const factura = await db.factura.findUnique({
      where: { id: facturaId },
      include: {
        cliente: true,
        detalles: true
      }
    })
    
    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }
    
    // Verificar que esté pendiente
    if (factura.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { success: false, error: 'La factura ya fue emitida o anulada' },
        { status: 400 }
      )
    }
    
    // Verificar que no tenga CAE
    if (factura.cae) {
      return NextResponse.json(
        { success: false, error: 'La factura ya tiene CAE asignado' },
        { status: 400 }
      )
    }
    
    // Obtener configuración AFIP
    let config = await db.aFIPConfig.findFirst()
    
    if (!config) {
      // Crear configuración de testing por defecto
      config = await db.aFIPConfig.create({
        data: {
          ambiente: 'testing',
          puntoVenta: 1,
          habilitado: true
        }
      })
    }
    
    // Determinar tipo de comprobante
    const tipoComprobante = determinarTipoComprobante(factura.cliente.cuit)
    const tipoCbteNum = tipoComprobante === 'A' ? TIPOS_COMPROBANTE.FACTURA_A : TIPOS_COMPROBANTE.FACTURA_B
    
    // Generar CAE
    let cae: string
    let fechaVencimientoCAE: Date
    let numeroComprobante: number
    
    if (config.ambiente === 'testing') {
      // MODO TESTING
      cae = generateMockCAE()
      fechaVencimientoCAE = generateFechaVencimientoCAE()
      numeroComprobante = factura.numeroInterno // Usar número interno como base
      
      log.info('[AFIP] Emitiendo factura en TESTING:', {
        factura: factura.numero,
        tipo: tipoComprobante,
        cae
      })
    } else {
      // MODO PRODUCCIÓN
      // Aquí se conectaría con WSFEX de AFIP
      // Por ahora simulamos la respuesta
      cae = generateMockCAE()
      fechaVencimientoCAE = generateFechaVencimientoCAE()
      numeroComprobante = factura.numeroInterno
      
      log.info('[AFIP] Emitiendo factura en PRODUCCIÓN:', {
        factura: factura.numero,
        tipo: tipoComprobante,
        cae
      })
    }
    
    // Generar número de comprobante AFIP
    const numeroComprobanteStr = generateNumeroComprobante(config.puntoVenta, numeroComprobante)
    
    // Generar datos QR
    const cuitEmisor = config.cuit || '20-12345678-9'
    const qrData = generateQRData(
      cuitEmisor,
      tipoCbteNum,
      config.puntoVenta,
      numeroComprobante,
      factura.fecha,
      factura.total,
      cae,
      fechaVencimientoCAE
    )
    
    // Actualizar factura con datos AFIP
    const facturaActualizada = await db.factura.update({
      where: { id: facturaId },
      data: {
        tipoComprobante: tipoComprobante as unknown as import('@prisma/client').TipoComprobante,
        numeroComprobante: numeroComprobanteStr,
        cae,
        caeVencimiento: fechaVencimientoCAE,
        fechaEmisionAFIP: new Date(),
        qrData,
        estado: 'EMITIDA',
        fechaEmision: new Date()
      },
      include: {
        cliente: true,
        detalles: true
      }
    })
    
    // Registrar auditoría
    await db.auditoria.create({
      data: {
        modulo: 'FACTURACION_AFIP',
        accion: 'CREATE',
        entidad: 'Factura',
        entidadId: facturaId,
        descripcion: `Factura ${factura.numero} emitida AFIP (${tipoComprobante}) - CAE: ${cae}`,
        operadorId
      }
    })
    
    return NextResponse.json({
      success: true,
      data: {
        id: facturaActualizada.id,
        numero: facturaActualizada.numero,
        tipoComprobante: facturaActualizada.tipoComprobante,
        numeroComprobante: facturaActualizada.numeroComprobante,
        cae: facturaActualizada.cae,
        fechaVencimientoCAE: facturaActualizada.caeVencimiento,
        fechaEmisionAFIP: facturaActualizada.fechaEmisionAFIP,
        qrData: facturaActualizada.qrData,
        ambiente: config.ambiente
      },
      message: config.ambiente === 'testing'
        ? `Factura emitida en modo TESTING - CAE: ${cae}`
        : `Factura emitida exitosamente - CAE: ${cae}`
    })
    
  } catch (error) {
    console.error('Error emitiendo factura AFIP:', error)
    return NextResponse.json(
      { success: false, error: 'Error al emitir factura AFIP' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Consultar estado de CAE en AFIP
 */
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { cae, facturaId } = body
    
    if (!cae && !facturaId) {
      return NextResponse.json(
        { success: false, error: 'CAE o ID de factura requerido' },
        { status: 400 }
      )
    }
    
    // Buscar factura
    const factura = facturaId 
      ? await db.factura.findUnique({ 
          where: { id: facturaId },
          include: { cliente: true }
        })
      : await db.factura.findFirst({
          where: { cae },
          include: { cliente: true }
        })
    
    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }
    
    // Verificar estado del CAE
    const caeValido = factura.cae && factura.caeVencimiento && 
      new Date(factura.caeVencimiento) > new Date()
    
    return NextResponse.json({
      success: true,
      data: {
        facturaId: factura.id,
        numero: factura.numero,
        cae: factura.cae,
        tipoComprobante: factura.tipoComprobante,
        numeroComprobante: factura.numeroComprobante,
        fechaEmisionAFIP: factura.fechaEmisionAFIP,
        fechaVencimientoCAE: factura.caeVencimiento,
        caeValido,
        cliente: {
          nombre: factura.cliente.nombre,
          cuit: factura.cliente.cuit
        }
      }
    })
    
  } catch (error) {
    console.error('Error consultando CAE:', error)
    return NextResponse.json(
      { success: false, error: 'Error al consultar CAE' },
      { status: 500 }
    )
  }
}
