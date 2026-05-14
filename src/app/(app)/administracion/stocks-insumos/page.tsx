'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { StocksInsumosModule } from '@/components/stocks-insumos'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="stocksInsumos" operador={operador}>
      <StocksInsumosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
