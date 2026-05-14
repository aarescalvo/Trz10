'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import IngresoDesposteUnificado from '@/components/ingreso-desposte-unificado'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="ingresoDesposteUnificado" operador={operador}>
      <IngresoDesposteUnificado operador={operador} />
    </EditableScreenWrapper>
  )
}
