'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ConfigSubproductosModule } from '@/components/config-subproductos'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configSubproductos" operador={operador}>
      <ConfigSubproductosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
