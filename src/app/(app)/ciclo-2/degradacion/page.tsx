'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import C2DegradacionModule from '@/components/c2-degradacion'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="c2Degradacion" operador={operador}>
      <C2DegradacionModule operador={operador} />
    </EditableScreenWrapper>
  )
}
