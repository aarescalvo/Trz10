'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import C2RubrosModule from '@/components/c2-rubros'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configC2Rubros" operador={operador}>
      <C2RubrosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
