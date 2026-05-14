'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { BusquedaFiltroModule } from '@/components/busqueda-filtro'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="busquedaFiltro" operador={operador}>
      <BusquedaFiltroModule operador={operador} />
    </EditableScreenWrapper>
  )
}
