'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { RenderingModule } from '@/components/rendering'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="grasa" operador={operador}>
      <RenderingModule operador={operador} tipoInicial="GRASA" />
    </EditableScreenWrapper>
  )
}
