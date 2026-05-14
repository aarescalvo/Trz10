'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { MovimientoHaciendaModule } from '@/components/movimiento-hacienda-module'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="movimientoHacienda" operador={operador}>
      <MovimientoHaciendaModule operador={operador} />
    </EditableScreenWrapper>
  )
}
