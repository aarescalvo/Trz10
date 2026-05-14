'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import StockUnificada from '@/components/stock-unificada'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="stockUnificada" operador={operador}>
      <StockUnificada operador={operador} />
    </EditableScreenWrapper>
  )
}
