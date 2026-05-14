'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import C2ProductosDesposteModule from '@/components/c2-productos-desposte'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configC2ProductosDesposte" operador={operador}>
      <C2ProductosDesposteModule operador={operador} />
    </EditableScreenWrapper>
  )
}
