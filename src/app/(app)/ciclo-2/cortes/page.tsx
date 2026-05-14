'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { CortesDespostadaModule } from '@/components/cortes-despostada'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="cortesDespostada" operador={operador}>
      <CortesDespostadaModule operador={operador} />
    </EditableScreenWrapper>
  )
}
