'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import C2TiposCuartoModule from '@/components/c2-tipos-cuarto'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configC2TiposCuarto" operador={operador}>
      <C2TiposCuartoModule operador={operador} />
    </EditableScreenWrapper>
  )
}
