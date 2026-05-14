'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { PesajeIndividualModule } from '@/components/pesaje-individual-module'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="pesajeIndividual" operador={operador}>
      <PesajeIndividualModule operador={operador} />
    </EditableScreenWrapper>
  )
}
