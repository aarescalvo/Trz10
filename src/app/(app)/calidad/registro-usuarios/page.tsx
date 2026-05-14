'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { EditableScreenWrapper } from '@/components/ui/editable-screen'
import { CalidadRegistroUsuariosModule } from '@/components/calidad-registro-usuarios'

export default function Page() {
  const operador = useOperador()
  return (
    <EditableScreenWrapper moduloId="calidadRegistroUsuarios" operador={operador}>
      <CalidadRegistroUsuariosModule operador={operador} />
    </EditableScreenWrapper>
  )
}
