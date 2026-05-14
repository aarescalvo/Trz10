'use client'

import { useOperador } from '@/components/providers/auth-provider'
import { ConfiguracionModule } from '@/components/configuracion'

export default function Page() {
  const operador = useOperador()
  return <ConfiguracionModule operador={operador} />
}
