'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ReportesGerencialesModule } from '@/modules-pending/reportes-gerenciales'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="reportesGerenciales" operador={operador}>
      <ReportesGerencialesModule operador={operador} />
    </EditableScreenWrapper>
  )
}
