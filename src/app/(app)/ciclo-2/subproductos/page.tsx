'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import C2SubproductosModule from '@/components/c2-subproductos'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="c2Subproductos" operador={operador}>
      <C2SubproductosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
