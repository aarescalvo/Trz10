'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import RindesTropaModule from '@/components/rindes-tropa'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="rindesTropa" operador={operador}>
      <RindesTropaModule operador={operador} />
    </EditableScreenWrapper>
  )
}
