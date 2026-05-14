'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ReportesSenasaModule } from '@/components/reportes-senasa'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="reportesSenasa" operador={operador}>
      <ReportesSenasaModule operador={operador} />
    </EditableScreenWrapper>
  )
}
