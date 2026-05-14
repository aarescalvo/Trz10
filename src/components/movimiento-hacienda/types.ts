// Tipos para el módulo de Movimiento de Hacienda

export interface Tropa {
  id: string
  numero: number
  codigo: string
  productor?: { id: string; nombre: string }
  usuarioFaena: { id: string; nombre: string }
  especie: string
  cantidadCabezas: number
  corral?: { id: string; nombre: string } | string
  corralId?: string
  estado: string
  fechaRecepcion: string
  pesoBruto?: number
  pesoTara?: number
  pesoNeto?: number
  pesoTotalIndividual?: number
  dte?: string
  guia?: string
  observaciones?: string
  tiposAnimales?: { tipoAnimal: string; cantidad: number }[]
  animales?: Animal[]
}

export interface Animal {
  id: string
  numero: number
  codigo: string
  tipoAnimal: string
  caravana?: string
  raza?: string
  pesoVivo?: number
  estado: string
  corral?: string
  fechaBaja?: string
  motivoBaja?: string
}

export interface CorralStock {
  corral: string
  totalCabezas: number
  tropas: { codigo: string; cantidad: number }[]
}

export interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export type EstadoTropa = 
  | 'RECIBIDO' 
  | 'EN_CORRAL' 
  | 'EN_PESAJE' 
  | 'PESADO' 
  | 'LISTO_FAENA' 
  | 'EN_FAENA' 
  | 'FAENADO' 
  | 'DESPACHADO'
