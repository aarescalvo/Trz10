'use client'

import { useRouter } from 'next/navigation'
import { useOperador } from '@/components/providers/auth-provider'
import { ConfigRotulosModule } from '@/components/config-rotulos'

export default function Page() {
  const router = useRouter()
  const operador = useOperador()
  return (
    <ConfigRotulosModule
      operador={operador}
      modoEditor={true}
      onVolverDeEditor={() => router.push('/configuracion/rotulos')}
    />
  )
}
