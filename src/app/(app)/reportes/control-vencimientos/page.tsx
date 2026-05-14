'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ControlVencimientosModule } from '@/modules-pending/control-vencimientos'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="controlVencimientos" operador={operador}>
      <ControlVencimientosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
