'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ConfigCodigobarrasModule } from '@/components/config-codigobarras'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configCodigobarras" operador={operador}>
      <ConfigCodigobarrasModule operador={operador} />
    </EditableScreenWrapper>
  )
}
