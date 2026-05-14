'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { StocksCorralesModule } from '@/components/stocks-corrales'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="stocksCorrales" operador={operador}>
      <StocksCorralesModule operador={operador} />
    </EditableScreenWrapper>
  )
}
