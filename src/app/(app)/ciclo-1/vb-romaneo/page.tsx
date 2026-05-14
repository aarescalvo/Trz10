'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { VBRomaneoModule } from '@/components/vb-romaneo'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="vbRomaneo" operador={operador}>
      <VBRomaneoModule operador={operador} />
    </EditableScreenWrapper>
  )
}
