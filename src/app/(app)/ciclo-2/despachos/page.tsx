'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { DespachosModule } from '@/components/despachos'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="despachos" operador={operador}>
      <DespachosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
