'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { HistorialPreciosModule } from '@/modules-pending/historial-precios'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="historialPrecios" operador={operador}>
      <HistorialPreciosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
