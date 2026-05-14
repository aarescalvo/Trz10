'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { PreciosPage } from '@/modules/facturacion/components/PreciosPage'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="precios" operador={operador}>
      <PreciosPage operador={operador} />
    </EditableScreenWrapper>
  )
}
