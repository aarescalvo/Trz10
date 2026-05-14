'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { MenudenciasModule } from '@/components/menudencias'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="menudencias" operador={operador}>
      <MenudenciasModule operador={operador} />
    </EditableScreenWrapper>
  )
}
