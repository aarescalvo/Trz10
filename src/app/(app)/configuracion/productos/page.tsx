'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ConfigProductosModule } from '@/components/config-productos'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configProductos" operador={operador}>
      <ConfigProductosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
