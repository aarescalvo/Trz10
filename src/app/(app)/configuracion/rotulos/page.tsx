'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ConfigRotulosModule } from '@/components/config-rotulos'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configRotulos" operador={operador}>
      <ConfigRotulosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
