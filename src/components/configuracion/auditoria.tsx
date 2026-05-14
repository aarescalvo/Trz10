'use client'

import { AuditoriaViewer } from '@/components/auditoria'

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function AuditoriaConfig({ operador }: { operador: Operador }) {
  // El visor de auditoría no necesita el operador actual ya que muestra todos los registros
  // pero lo recibimos para consistencia con otros componentes de configuración
  return <AuditoriaViewer />
}
