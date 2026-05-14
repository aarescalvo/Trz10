'use client'

import { useAuth } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { AlertasStockModule } from '@/modules-pending/alertas-stock'

export default function Page() {
  const { operador } = useAuth()
  if (!operador) return null
  return (
    <EditableScreenWrapper moduloId="alertasStock" operador={operador}>
      <AlertasStockModule operador={operador} />
    </EditableScreenWrapper>
  )
}
