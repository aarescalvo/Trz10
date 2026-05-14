// Tipos para el módulo de Pesaje de Camiones

export interface Operador {
  id: string
  nombre: string
  nivel?: string
  permisos: Record<string, boolean>
}

export interface Cliente {
  id: string
  nombre: string
  cuit?: string
  razonSocial?: string
}

export interface ProductorConsignatario {
  id: string
  nombre: string
  cuit?: string
  tipo: string
  numeroRenspa?: string
  numeroEstablecimiento?: string
}

export interface Transportista {
  id: string
  nombre: string
}

export interface Corral {
  id: string
  nombre: string
  capacidad: number
  stockBovinos: number
  stockEquinos: number
}

export interface TipoAnimalCounter {
  tipoAnimal: string
  cantidad: number
}

export interface Pesaje {
  id: string
  tipo: string
  numeroTicket: number
  fecha: string
  patenteChasis: string
  patenteAcoplado?: string
  chofer?: string
  dniChofer?: string
  transportista?: Transportista
  destino?: string
  remito?: string
  pesoBruto?: number
  pesoTara?: number
  pesoNeto?: number
  descripcion?: string
  estado: string
  operador?: Operador
  tropa?: {
    id: string
    codigo: string
    productor?: { nombre: string }
    usuarioFaena?: { nombre: string }
    especie: string
    cantidadCabezas: number
    corral?: string
    dte?: string
    guia?: string
    tiposAnimales?: TipoAnimalCounter[]
    observaciones?: string
  }
}

export type TipoPesaje = 'INGRESO_HACIENDA' | 'PESAJE_PARTICULAR' | 'SALIDA_MERCADERIA'
export type EstadoPesaje = 'ABIERTO' | 'CERRADO'
