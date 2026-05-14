'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { ListaFaenaModule } from '@/components/lista-faena'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="listaFaena" operador={operador}>
      <ListaFaenaModule operador={operador} />
    </EditableScreenWrapper>
  )
}
