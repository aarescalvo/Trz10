'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ConfigTiposProductoModule } from '@/components/config-tipos-producto'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configTiposProducto" operador={operador}>
      <ConfigTiposProductoModule operador={operador} />
    </EditableScreenWrapper>
  )
}
