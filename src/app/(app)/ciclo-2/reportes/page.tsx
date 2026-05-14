'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import C2ReportesModule from '@/components/c2-reportes'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="c2Reportes" operador={operador}>
      <C2ReportesModule operador={operador} />
    </EditableScreenWrapper>
  )
}
