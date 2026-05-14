'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { MovimientoCamarasModule } from '@/components/movimiento-camaras'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="movimientoCamaras" operador={operador}>
      <MovimientoCamarasModule operador={operador} />
    </EditableScreenWrapper>
  )
}
