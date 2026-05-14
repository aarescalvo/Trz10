'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import C2BOMModule from '@/components/c2-bom'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configC2BOM" operador={operador}>
      <C2BOMModule operador={operador} />
    </EditableScreenWrapper>
  )
}
