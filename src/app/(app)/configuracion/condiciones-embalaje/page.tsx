'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ConfigCondicionesEmbalajeModule } from '@/components/config-condiciones-embalaje'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="configCondicionesEmbalaje" operador={operador}>
      <ConfigCondicionesEmbalajeModule operador={operador} />
    </EditableScreenWrapper>
  )
}
