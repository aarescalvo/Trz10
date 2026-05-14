'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { Planilla01Module } from '@/components/planilla-01'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="planilla01" operador={operador}>
      <Planilla01Module operador={operador} />
    </EditableScreenWrapper>
  )
}
