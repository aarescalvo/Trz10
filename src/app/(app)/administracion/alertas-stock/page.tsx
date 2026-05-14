'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { AlertasStockModule } from '@/modules-pending/alertas-stock'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="alertasStock" operador={operador}>
      <AlertasStockModule operador={operador} />
    </EditableScreenWrapper>
  )
}
