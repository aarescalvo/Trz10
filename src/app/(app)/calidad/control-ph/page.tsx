'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import CalidadPHModule from '@/components/calidad-ph'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="calidadPh" operador={operador}>
      <CalidadPHModule operador={operador} />
    </EditableScreenWrapper>
  )
}
