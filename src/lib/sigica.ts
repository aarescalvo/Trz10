// SIGICA - Sistema de Gestión de la Industria Cárnica Argentina
// Integración con el sistema oficial del SENASA para plantas faenadoras
// Referencia: https://www.argentina.gob.ar/senasa

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { decrypt } from '@/lib/crypto'

// ==================== TIPOS ====================

export interface SIGICAConfig {
  habilitado: boolean
  urlServicio: string | null
  usuario: string | null
  password: string | null
  certificado: string | null
  establecimiento: string | null
  ultimaSincronizacion: Date | null
}

export interface RomaneoSIGICA {
  garron: number
  tropaCodigo: string
  fecha: Date
  especie: 'BOVINO' | 'EQUINO'
  pesoVivo: number | null
  pesoTotal: number | null
  pesoMediaIzq: number | null
  pesoMediaDer: number | null
  denticion: string | null
  tipoAnimal: string | null
  raza: string | null
  tipificadorMatricula: string | null
}

export interface StockCamaraData {
  camaraId: string
  camaraNombre: string
  totalMedias: number
  totalKg: number
  bovinosMedias: number
  bovinosKg: number
  equinosMedias: number
  equinosKg: number
  remanenteKg: number
}

export interface ResultadoEnvio {
  exito: boolean
  codigoTransaccion?: string
  mensajeError?: string
  respuesta?: string
}

export interface EnvioRomaneosParams {
  romaneoIds: string[]
  operadorId?: string
}

export interface EnvioStockParams {
  camaraIds?: string[]
  operadorId?: string
}

// ==================== CONSTANTES ====================

// URLs de SIGICA según ambiente
const SIGICA_URLS = {
  homologacion: 'https://siga-homologacion.senasa.gob.ar/ws/sigica',
  produccion: 'https://siga.senasa.gob.ar/ws/sigica'
}

// Códigos de especie para SIGICA
const CODIGO_ESPECIE_SIGICA: Record<string, string> = {
  BOVINO: '1',
  EQUINO: '6'
}

// Máximo de reintentos
const MAX_REINTENTOS = 3
const INTERVALO_REINTENTO = 5000 // 5 segundos

// ==================== SERVICIO SIGICA ====================

export class SIGICAService {
  private config: SIGICAConfig | null = null

  constructor(config?: SIGICAConfig) {
    if (config) {
      this.config = config
    }
  }

  /**
   * Carga la configuración de SIGICA desde la base de datos
   */
  private async loadConfig(): Promise<SIGICAConfig | null> {
    if (this.config) return this.config

    const configDB = await db.configuracionSIGICA.findFirst()
    if (!configDB) return null

    this.config = {
      habilitado: configDB.habilitado,
      urlServicio: configDB.urlServicio,
      usuario: configDB.usuario,
      password: decrypt(configDB.password),
      certificado: configDB.certificado,
      establecimiento: configDB.establecimiento,
      ultimaSincronizacion: configDB.ultimaSincronizacion
    }

    return this.config
  }

  /**
   * Verifica si la integración está habilitada
   */
  async estaHabilitado(): Promise<boolean> {
    const config = await this.loadConfig()
    return config?.habilitado ?? false
  }

  /**
   * Obtiene la configuración actual
   */
  async obtenerConfiguracion(): Promise<SIGICAConfig | null> {
    return this.loadConfig()
  }

  /**
   * Guarda la configuración de SIGICA
   */
  async guardarConfiguracion(config: Partial<SIGICAConfig>): Promise<SIGICAConfig> {
    const existente = await db.configuracionSIGICA.findFirst()

    if (existente) {
      const actualizado = await db.configuracionSIGICA.update({
        where: { id: existente.id },
        data: {
          ...config,
          updatedAt: new Date()
        }
      })
      this.config = actualizado
      return actualizado
    } else {
      // La contraseña ya viene encriptada desde el route handler
      const nuevo = await db.configuracionSIGICA.create({
        data: {
          habilitado: config.habilitado ?? false,
          urlServicio: config.urlServicio,
          usuario: config.usuario,
          password: config.password,
          certificado: config.certificado,
          establecimiento: config.establecimiento
        }
      })
      this.config = nuevo
      return nuevo
    }
  }

  /**
   * Prueba la conexión con SIGICA
   */
  async probarConexion(): Promise<{ exito: boolean; mensaje: string }> {
    const config = await this.loadConfig()
    
    if (!config) {
      return { exito: false, mensaje: 'Configuración no encontrada' }
    }

    if (!config.habilitado) {
      return { exito: false, mensaje: 'Integración SIGICA no habilitada' }
    }

    if (!config.urlServicio || !config.usuario || !config.password) {
      return { exito: false, mensaje: 'Faltan datos de configuración (URL, usuario o contraseña)' }
    }

    try {
      // Intentar una petición de prueba al servicio
      const response = await this.enviarPeticionSOAP('<Echo/>')
      
      if (response.ok) {
        return { exito: true, mensaje: 'Conexión exitosa con SIGICA' }
      } else {
        return { exito: false, mensaje: `Error de conexión: ${response.statusText}` }
      }
    } catch (error) {
      return { exito: false, mensaje: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}` }
    }
  }

  /**
   * Genera el XML para envío de romaneo a SIGICA
   */
  generarXMLRomaneo(romaneo: RomaneoSIGICA, establecimiento: string): string {
    const fechaFormateada = this.formatearFecha(romaneo.fecha)
    const codigoEspecie = CODIGO_ESPECIE_SIGICA[romaneo.especie] || '1'

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:sig="http://senasa.gob.ar/sigica">
  <soap:Header>
    <sig:Autenticacion>
      <sig:Usuario>${this.config?.usuario || ''}</sig:Usuario>
      <sig:Password>${this.config?.password || ''}</sig:Password>
    </sig:Autenticacion>
  </soap:Header>
  <soap:Body>
    <sig:CargarRomaneo>
      <sig:Establecimiento>${establecimiento}</sig:Establecimiento>
      <sig:Romaneo>
        <sig:Garron>${romaneo.garron}</sig:Garron>
        <sig:Tropa>${romaneo.tropaCodigo}</sig:Tropa>
        <sig:Fecha>${fechaFormateada}</sig:Fecha>
        <sig:Especie>${codigoEspecie}</sig:Especie>
        <sig:PesoVivo>${romaneo.pesoVivo || 0}</sig:PesoVivo>
        <sig:PesoTotal>${romaneo.pesoTotal || 0}</sig:PesoTotal>
        <sig:PesoMediaIzquierda>${romaneo.pesoMediaIzq || 0}</sig:PesoMediaIzquierda>
        <sig:PesoMediaDerecha>${romaneo.pesoMediaDer || 0}</sig:PesoMediaDerecha>
        <sig:Denticion>${romaneo.denticion || ''}</sig:Denticion>
        <sig:TipoAnimal>${romaneo.tipoAnimal || ''}</sig:TipoAnimal>
        <sig:Raza>${romaneo.raza || ''}</sig:Raza>
        <sig:MatriculaTipificador>${romaneo.tipificadorMatricula || ''}</sig:MatriculaTipificador>
      </sig:Romaneo>
    </sig:CargarRomaneo>
  </soap:Body>
</soap:Envelope>`
  }

  /**
   * Genera el XML para actualización de stock de cámara
   */
  generarXMLStockCamara(stock: StockCamaraData, establecimiento: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:sig="http://senasa.gob.ar/sigica">
  <soap:Header>
    <sig:Autenticacion>
      <sig:Usuario>${this.config?.usuario || ''}</sig:Usuario>
      <sig:Password>${this.config?.password || ''}</sig:Password>
    </sig:Autenticacion>
  </soap:Header>
  <soap:Body>
    <sig:ActualizarStockCamara>
      <sig:Establecimiento>${establecimiento}</sig:Establecimiento>
      <sig:Camara>
        <sig:Id>${stock.camaraId}</sig:Id>
        <sig:Nombre>${stock.camaraNombre}</sig:Nombre>
        <sig:TotalMedias>${stock.totalMedias}</sig:TotalMedias>
        <sig:TotalKg>${stock.totalKg}</sig:TotalKg>
        <sig:BovinosMedias>${stock.bovinosMedias}</sig:BovinosMedias>
        <sig:BovinosKg>${stock.bovinosKg}</sig:BovinosKg>
        <sig:EquinosMedias>${stock.equinosMedias}</sig:EquinosMedias>
        <sig:EquinosKg>${stock.equinosKg}</sig:EquinosKg>
        <sig:RemanenteKg>${stock.remanenteKg}</sig:RemanenteKg>
      </sig:Camara>
    </sig:ActualizarStockCamara>
  </soap:Body>
</soap:Envelope>`
  }

  /**
   * Envía una petición SOAP a SIGICA
   */
  private async enviarPeticionSOAP(xmlBody: string): Promise<Response> {
    const config = await this.loadConfig()
    
    if (!config?.urlServicio) {
      throw new Error('URL del servicio SIGICA no configurada')
    }

    const response = await fetch(config.urlServicio, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      body: xmlBody
    })

    return response
  }

  /**
   * Parsea la respuesta XML de SIGICA
   */
  private parsearRespuesta(xmlResponse: string): ResultadoEnvio {
    try {
      // Buscar código de transacción
      const codigoMatch = xmlResponse.match(/<CodigoTransaccion>([^<]*)<\/CodigoTransaccion>/)
      const codigoTransaccion = codigoMatch ? codigoMatch[1] : undefined

      // Buscar error
      const errorMatch = xmlResponse.match(/<Error[^>]*>([^<]*)<\/Error>/)
      const mensajeError = errorMatch ? errorMatch[1] : undefined

      // Determinar si fue exitoso
      const exito = xmlResponse.includes('<Resultado>OK</Resultado>') || 
                    xmlResponse.includes('<Exito>true</Exito>') ||
                    (codigoTransaccion !== undefined && !mensajeError)

      return {
        exito,
        codigoTransaccion,
        mensajeError,
        respuesta: xmlResponse
      }
    } catch (error) {
      return {
        exito: false,
        mensajeError: `Error parseando respuesta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        respuesta: xmlResponse
      }
    }
  }

  /**
   * Envía romaneos a SIGICA
   */
  async enviarRomaneos(params: EnvioRomaneosParams): Promise<ResultadoEnvio> {
    const config = await this.loadConfig()
    
    if (!config?.habilitado) {
      return { exito: false, mensajeError: 'Integración SIGICA no habilitada' }
    }

    if (!config.establecimiento) {
      return { exito: false, mensajeError: 'Número de establecimiento no configurado' }
    }

    try {
      // Obtener datos de romaneos
      const romaneos = await db.romaneo.findMany({
        where: {
          id: { in: params.romaneoIds }
        },
        include: {
          tipificador: true,
        }
      })

      if (romaneos.length === 0) {
        return { exito: false, mensajeError: 'No se encontraron romaneos para enviar' }
      }

      // Obtener especie de las tropas
      const tropaCodigos = [...new Set(romaneos.map(r => r.tropaCodigo).filter((c): c is string => Boolean(c)))]
      const tropas = tropaCodigos.length > 0
        ? await db.tropa.findMany({
            where: { codigo: { in: tropaCodigos } },
            select: { codigo: true, especie: true }
          })
        : []
      const tropaMap = new Map(tropas.map(t => [t.codigo, t.especie]))

      // Preparar datos para SIGICA
      const romaneosSIGICA: RomaneoSIGICA[] = romaneos.map(r => ({
        garron: r.garron,
        tropaCodigo: r.tropaCodigo || '',
        fecha: r.fecha,
        especie: (tropaMap.get(r.tropaCodigo || '') as 'BOVINO' | 'EQUINO') || 'BOVINO',
        pesoVivo: r.pesoVivo,
        pesoTotal: r.pesoTotal,
        pesoMediaIzq: r.pesoMediaIzq,
        pesoMediaDer: r.pesoMediaDer,
        denticion: r.denticion,
        tipoAnimal: r.tipoAnimal as string | null,
        raza: r.raza,
        tipificadorMatricula: r.tipificador?.matricula || null
      }))

      // Generar XML combinado
      const xmlRomaneos = romaneosSIGICA.map(r => this.generarXMLRomaneo(r, config.establecimiento!)).join('\n')
      
      // Crear registro de envío
      const envio = await db.envioSIGICA.create({
        data: {
          tipo: 'ROMANEO',
          datosEnviados: JSON.stringify(romaneosSIGICA),
          cantidadRegistros: romaneos.length,
          estado: 'ENVIANDO',
          romaneoIds: JSON.stringify(params.romaneoIds),
          operadorId: params.operadorId
        }
      })

      try {
        // Enviar a SIGICA
        const response = await this.enviarPeticionSOAP(xmlRomaneos)
        const responseText = await response.text()
        const resultado = this.parsearRespuesta(responseText)

        // Actualizar registro de envío
        await db.envioSIGICA.update({
          where: { id: envio.id },
          data: {
            estado: resultado.exito ? 'EXITOSO' : 'ERROR',
            respuestaSIGICA: resultado.respuesta,
            codigoTransaccion: resultado.codigoTransaccion,
            mensajeError: resultado.mensajeError,
            ultimoIntento: new Date()
          }
        })

        // Si fue exitoso, actualizar última sincronización
        if (resultado.exito) {
          await db.configuracionSIGICA.updateMany({
            data: {
              ultimaSincronizacion: new Date()
            }
          })
        }

        return resultado
      } catch (error) {
        // Error en el envío
        await db.envioSIGICA.update({
          where: { id: envio.id },
          data: {
            estado: 'ERROR',
            mensajeError: error instanceof Error ? error.message : 'Error de conexión',
            ultimoIntento: new Date(),
            intentos: { increment: 1 }
          }
        })

        throw error
      }
    } catch (error) {
      return {
        exito: false,
        mensajeError: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  /**
   * Actualiza el stock de cámaras en SIGICA
   */
  async actualizarStockCamara(params: EnvioStockParams): Promise<ResultadoEnvio> {
    const config = await this.loadConfig()
    
    if (!config?.habilitado) {
      return { exito: false, mensajeError: 'Integración SIGICA no habilitada' }
    }

    if (!config.establecimiento) {
      return { exito: false, mensajeError: 'Número de establecimiento no configurado' }
    }

    try {
      // Obtener cámaras con su stock
      const camaras = await db.camara.findMany({
        where: params.camaraIds ? { id: { in: params.camaraIds } } : { activo: true },
        include: {
          stockMedias: true,
          stockCamaraSIGICA: true
        }
      })

      if (camaras.length === 0) {
        return { exito: false, mensajeError: 'No se encontraron cámaras para actualizar' }
      }

      // Calcular stock por cámara
      const stocks: StockCamaraData[] = camaras.map(camara => {
        const stock = camara.stockMedias
        let bovinosMedias = 0
        let bovinosKg = 0
        let equinosMedias = 0
        let equinosKg = 0

        stock.forEach(s => {
          if (s.especie === 'BOVINO') {
            bovinosMedias += s.cantidad
            bovinosKg += s.pesoTotal
          } else if (s.especie === 'EQUINO') {
            equinosMedias += s.cantidad
            equinosKg += s.pesoTotal
          }
        })

        return {
          camaraId: camara.id,
          camaraNombre: camara.nombre,
          totalMedias: bovinosMedias + equinosMedias,
          totalKg: bovinosKg + equinosKg,
          bovinosMedias,
          bovinosKg,
          equinosMedias,
          equinosKg,
          remanenteKg: camara.stockCamaraSIGICA?.[0]?.remanenteKg || 0
        }
      })

      // Generar XML combinado
      const xmlStock = stocks.map(s => this.generarXMLStockCamara(s, config.establecimiento!)).join('\n')

      // Crear registro de envío
      const envio = await db.envioSIGICA.create({
        data: {
          tipo: 'STOCK_CAMARA',
          datosEnviados: JSON.stringify(stocks),
          cantidadRegistros: stocks.length,
          estado: 'ENVIANDO',
          operadorId: params.operadorId
        }
      })

      try {
        // Enviar a SIGICA
        const response = await this.enviarPeticionSOAP(xmlStock)
        const responseText = await response.text()
        const resultado = this.parsearRespuesta(responseText)

        // Actualizar registro de envío
        await db.envioSIGICA.update({
          where: { id: envio.id },
          data: {
            estado: resultado.exito ? 'EXITOSO' : 'ERROR',
            respuestaSIGICA: resultado.respuesta,
            codigoTransaccion: resultado.codigoTransaccion,
            mensajeError: resultado.mensajeError,
            ultimoIntento: new Date()
          }
        })

        // Actualizar stocks locales si fue exitoso
        if (resultado.exito) {
          for (const stock of stocks) {
            await db.stockCamaraSIGICA.upsert({
              where: { camaraId: stock.camaraId },
              create: {
                camaraId: stock.camaraId,
                totalMedias: stock.totalMedias,
                totalKg: stock.totalKg,
                bovinosMedias: stock.bovinosMedias,
                bovinosKg: stock.bovinosKg,
                equinosMedias: stock.equinosMedias,
                equinosKg: stock.equinosKg,
                remanenteKg: stock.remanenteKg,
                sincronizado: true,
                ultimaActualizacion: new Date()
              },
              update: {
                totalMedias: stock.totalMedias,
                totalKg: stock.totalKg,
                bovinosMedias: stock.bovinosMedias,
                bovinosKg: stock.bovinosKg,
                equinosMedias: stock.equinosMedias,
                equinosKg: stock.equinosKg,
                sincronizado: true,
                ultimaActualizacion: new Date()
              }
            })
          }
        }

        return resultado
      } catch (error) {
        // Error en el envío
        await db.envioSIGICA.update({
          where: { id: envio.id },
          data: {
            estado: 'ERROR',
            mensajeError: error instanceof Error ? error.message : 'Error de conexión',
            ultimoIntento: new Date(),
            intentos: { increment: 1 }
          }
        })

        throw error
      }
    } catch (error) {
      return {
        exito: false,
        mensajeError: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  /**
   * Reintenta un envío fallido
   */
  async reintentarEnvio(envioId: string): Promise<ResultadoEnvio> {
    const envio = await db.envioSIGICA.findUnique({
      where: { id: envioId }
    })

    if (!envio) {
      return { exito: false, mensajeError: 'Envío no encontrado' }
    }

    if (envio.intentos >= MAX_REINTENTOS) {
      await db.envioSIGICA.update({
        where: { id: envioId },
        data: { estado: 'ERROR' }
      })
      return { exito: false, mensajeError: 'Se alcanzó el máximo de reintentos' }
    }

    // Incrementar intentos
    await db.envioSIGICA.update({
      where: { id: envioId },
      data: {
        estado: 'ENVIANDO',
        intentos: { increment: 1 },
        ultimoIntento: new Date()
      }
    })

    try {
      // Reenviar según el tipo
      if (envio.tipo === 'ROMANEO') {
        const romaneoIds: string[] = JSON.parse(envio.romaneoIds || '[]')
        return this.enviarRomaneos({ romaneoIds, operadorId: envio.operadorId || undefined })
      } else if (envio.tipo === 'STOCK_CAMARA') {
        return this.actualizarStockCamara({ operadorId: envio.operadorId || undefined })
      } else {
        return { exito: false, mensajeError: 'Tipo de envío no soportado para reintento' }
      }
    } catch (error) {
      return {
        exito: false,
        mensajeError: error instanceof Error ? error.message : 'Error en reintento'
      }
    }
  }

  /**
   * Obtiene el historial de envíos
   */
  async obtenerEnvios(filtros?: {
    tipo?: string
    estado?: string
    desde?: Date
    hasta?: Date
    limite?: number
  }): Promise<typeof db.envioSIGICA.findMany extends (...args: any[]) => Promise<infer R> ? R : never> {
    const where: Prisma.EnvioSIGICAWhereInput = {}
    
    if (filtros?.tipo) {
      where.tipo = filtros.tipo as 'ROMANEO' | 'STOCK_CAMARA'
    }
    if (filtros?.estado) {
      where.estado = filtros.estado as 'ENVIANDO' | 'EXITOSO' | 'ERROR' | 'PENDIENTE'
    }
    if (filtros?.desde || filtros?.hasta) {
      where.fechaEnvio = {}
      if (filtros.desde) {
        where.fechaEnvio.gte = filtros.desde
      }
      if (filtros.hasta) {
        where.fechaEnvio.lte = filtros.hasta
      }
    }

    return db.envioSIGICA.findMany({
      where,
      include: {
        operador: {
          select: {
            id: true,
            nombre: true,
            usuario: true
          }
        }
      },
      orderBy: { fechaEnvio: 'desc' },
      take: filtros?.limite || 50
    })
  }

  /**
   * Formatea una fecha para SIGICA (YYYY-MM-DD)
   */
  private formatearFecha(fecha: Date): string {
    return fecha.toISOString().split('T')[0]
  }
}

// ==================== INSTANCIA SINGLETON ====================

let sigicaServiceInstance: SIGICAService | null = null

export function getSIGICAService(): SIGICAService {
  if (!sigicaServiceInstance) {
    sigicaServiceInstance = new SIGICAService()
  }
  return sigicaServiceInstance
}

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Obtiene la configuración de SIGICA
 */
export async function obtenerConfiguracionSIGICA(): Promise<SIGICAConfig | null> {
  const service = getSIGICAService()
  return service.obtenerConfiguracion()
}

/**
 * Guarda la configuración de SIGICA
 */
export async function guardarConfiguracionSIGICA(config: Partial<SIGICAConfig>): Promise<SIGICAConfig> {
  const service = getSIGICAService()
  return service.guardarConfiguracion(config)
}

/**
 * Prueba la conexión con SIGICA
 */
export async function probarConexionSIGICA(): Promise<{ exito: boolean; mensaje: string }> {
  const service = getSIGICAService()
  return service.probarConexion()
}

/**
 * Envía romaneos a SIGICA
 */
export async function enviarRomaneosSIGICA(params: EnvioRomaneosParams): Promise<ResultadoEnvio> {
  const service = getSIGICAService()
  return service.enviarRomaneos(params)
}

/**
 * Actualiza el stock de cámaras en SIGICA
 */
export async function actualizarStockCamaraSIGICA(params: EnvioStockParams): Promise<ResultadoEnvio> {
  const service = getSIGICAService()
  return service.actualizarStockCamara(params)
}

/**
 * Reintenta un envío fallido
 */
export async function reintentarEnvioSIGICA(envioId: string): Promise<ResultadoEnvio> {
  const service = getSIGICAService()
  return service.reintentarEnvio(envioId)
}

/**
 * Obtiene el historial de envíos
 */
export async function obtenerEnviosSIGICA(filtros?: {
  tipo?: string
  estado?: string
  desde?: Date
  hasta?: Date
  limite?: number
}) {
  const service = getSIGICAService()
  return service.obtenerEnvios(filtros)
}
