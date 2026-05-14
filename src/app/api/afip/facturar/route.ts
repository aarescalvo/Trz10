import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TipoComprobante } from '@prisma/client'
import { 
  FECAESolicitar, 
  FECompUltimoAutorizado,
  formatearFechaAFIP,
  calcularIVA,
  TIPO_COMPROBANTE,
  TIPO_DOCUMENTO,
  MONEDA,
  ALICUOTA_IVA,
  CONCEPTO
} from '@/lib/afip-wsfe'
import { getConfiguracionAFIP } from '@/lib/afip-wsaa'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Emitir factura electrónica
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const data = await request.json()
    const { facturaId, simular = false } = data

    // Validar que existe la factura
    if (!facturaId) {
      return NextResponse.json(
        { success: false, error: 'ID de factura requerido' },
        { status: 400 }
      )
    }

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

    if (factura.cae) {
      return NextResponse.json(
        { success: false, error: 'La factura ya tiene CAE asignado' },
        { status: 400 }
      )
    }

    // Obtener configuración AFIP
    const config = await getConfiguracionAFIP()
    
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Configuración AFIP incompleta. Configure los certificados primero.' },
        { status: 400 }
      )
    }

    // Si es modo simulación, generar CAE simulado
    if (simular) {
      const caeSimulado = generarCAESimulado()
      const vencimientoCAE = calcularVencimientoCAE()

      // Actualizar factura con CAE simulado
      const facturaActualizada = await db.factura.update({
        where: { id: facturaId },
        data: {
          cae: caeSimulado,
          caeVencimiento: vencimientoCAE,
          estado: 'EMITIDA',
          fechaEmision: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        simulated: true,
        data: {
          cae: caeSimulado,
          vencimiento: vencimientoCAE.toISOString().split('T')[0],
          factura: facturaActualizada
        }
      })
    }

    // Modo real: conectar con AFIP
    // Determinar tipo de comprobante según el cliente
    const tipoComprobante: TipoComprobante = factura.tipoComprobante || 
      determinarTipoComprobante(factura.cliente.cuit, true) as unknown as TipoComprobante

    // Obtener último número de comprobante
    const ultimoNumero = await FECompUltimoAutorizado(
      Number(tipoComprobante),
      config.puntoVenta,
      config
    )
    const proximoNumero = ultimoNumero + 1

    // Calcular importes
    const subtotal = factura.subtotal || factura.detalles.reduce((sum, d) => sum + (d.subtotal || 0), 0)
    const importeGravado = subtotal // Simplificado: asumimos que todo está gravado
    const importeIVA = factura.iva || calcularIVA(importeGravado, ALICUOTA_IVA.VEINTIUNO)
    const importeTotal = factura.total || (subtotal + importeIVA)

    // Preparar request para AFIP
    const fechaFormateada = formatearFechaAFIP(factura.fecha)

    // Determinar tipo de documento del cliente
    let tipoDocumento: number = TIPO_DOCUMENTO.CUIT
    let numeroDocumento = factura.cliente.cuit?.replace(/-/g, '') || '0'
    
    // Si no tiene CUIT, usar consumidor final
    if (!factura.cliente.cuit || factura.cliente.cuit.length < 11) {
      tipoDocumento = TIPO_DOCUMENTO.SIN_IDENTIFICAR
      numeroDocumento = '0'
    }

    // Construir array de IVA
    const ivas: { id: number; baseImp: number; importe: number }[] = []
    if (importeIVA > 0) {
      ivas.push({
        id: ALICUOTA_IVA.VEINTIUNO,
        baseImp: importeGravado,
        importe: importeIVA
      })
    }

    const feRequest = {
      tipoComprobante: Number(tipoComprobante),
      puntoVenta: config.puntoVenta,
      fecha: fechaFormateada,
      concepto: CONCEPTO.PRODUCTO,
      tipoDocumento,
      numeroDocumento,
      importeTotal,
      importeGravado,
      importeNoGravado: 0,
      importeExento: 0,
      importeIVA,
      importeTributos: 0,
      codigoMoneda: MONEDA.PESOS,
      cotizacionMoneda: 1,
      ivas
    }

    // Solicitar CAE a AFIP
     
    const resultado = await FECAESolicitar(feRequest, config)

    if (!resultado.success) {
      return NextResponse.json({
        success: false,
        error: 'Error al obtener CAE de AFIP',
        errores: resultado.errores,
        observaciones: resultado.observaciones
      }, { status: 400 })
    }

    // Actualizar factura con CAE real
    const facturaActualizada = await db.factura.update({
      where: { id: facturaId },
      data: {
        cae: resultado.cae,
        caeVencimiento: resultado.caeVencimiento,
        tipoComprobante,
        puntoVenta: config.puntoVenta,
        numeroAfip: String(resultado.numeroComprobante),
        numero: `${String(config.puntoVenta).padStart(4, '0')}-${String(resultado.numeroComprobante).padStart(8, '0')}`,
        estado: 'EMITIDA',
        fechaEmision: new Date()
      }
    })

    // Registrar en auditoría
    await db.auditoria.create({
      data: {
        modulo: 'AFIP',
        accion: 'CREATE',
        entidad: 'Factura',
        entidadId: facturaId,
        descripcion: `Factura ${facturaActualizada.numero} emitida con CAE ${resultado.cae}`,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        cae: resultado.cae,
        vencimiento: resultado.caeVencimiento.toISOString().split('T')[0],
        numeroComprobante: resultado.numeroComprobante,
        tipoComprobante,
        observaciones: resultado.observaciones,
        factura: facturaActualizada
      }
    })
  } catch (error) {
    console.error('Error al emitir factura AFIP:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error al emitir factura electrónica' 
      },
      { status: 500 }
    )
  }
}

// Función auxiliar para generar CAE simulado
function generarCAESimulado(): string {
  // CAE tiene 14 dígitos
  const timestamp = Date.now().toString().slice(-10)
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return timestamp + random
}

// Función auxiliar para calcular vencimiento de CAE (10 días hábiles)
function calcularVencimientoCAE(): Date {
  const fecha = new Date()
  let diasAgregados = 0
  while (diasAgregados < 10) {
    fecha.setDate(fecha.getDate() + 1)
    // Contar solo días hábiles (lunes a viernes)
    if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
      diasAgregados++
    }
  }
  return fecha
}

// Función auxiliar para determinar tipo de comprobante
function determinarTipoComprobante(
  cuitCliente: string | null,
  esResponsableInscripto: boolean = true
): number {
  // Si no tiene CUIT o es consumidor final
  if (!cuitCliente || cuitCliente.length < 11) {
    return TIPO_COMPROBANTE.FACTURA_B // Factura B para consumidor final
  }

  // Si el cliente tiene CUIT, depende de la responsabilidad
  if (esResponsableInscripto) {
    return TIPO_COMPROBANTE.FACTURA_A // Factura A para RI
  }

  return TIPO_COMPROBANTE.FACTURA_B // Factura B para monotributista/exento
}

// GET - Consultar estado de una factura
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const searchParams = request.nextUrl.searchParams
    const facturaId = searchParams.get('facturaId')

    if (!facturaId) {
      return NextResponse.json(
        { success: false, error: 'ID de factura requerido' },
        { status: 400 }
      )
    }

    const factura = await db.factura.findUnique({
      where: { id: facturaId },
      select: {
        id: true,
        numero: true,
        estado: true,
        cae: true,
        caeVencimiento: true,
        tipoComprobante: true,
        puntoVenta: true,
        numeroAfip: true,
        total: true,
        fecha: true,
        cliente: {
          select: {
            nombre: true,
            cuit: true
          }
        }
      }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: factura
    })
  } catch (error) {
    console.error('Error al consultar factura:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error al consultar factura' 
      },
      { status: 500 }
    )
  }
}
