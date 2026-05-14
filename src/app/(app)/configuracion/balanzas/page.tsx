'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ConfigBalanzasModule } from '@/components/config-balanzas'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configBalanzas" operador={operador}>
      <ConfigBalanzasModule operador={operador} />
    </EditableScreenWrapper>
  )
}
