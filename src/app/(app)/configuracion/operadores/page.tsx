'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ConfigOperadoresModule } from '@/components/config-operadores'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configOperadores" operador={operador}>
      <ConfigOperadoresModule operador={operador} />
    </EditableScreenWrapper>
  )
}
