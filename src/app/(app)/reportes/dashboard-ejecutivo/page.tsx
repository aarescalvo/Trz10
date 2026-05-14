'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { DashboardEjecutivoModule } from '@/modules-pending/dashboard-ejecutivo'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="dashboardEjecutivo" operador={operador}>
      <DashboardEjecutivoModule operador={operador} />
    </EditableScreenWrapper>
  )
}
