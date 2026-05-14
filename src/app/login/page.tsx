'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Lock, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [loginTab, setLoginTab] = useState<'usuario' | 'pin'>('usuario')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoggingIn(true)

    const body = loginTab === 'usuario'
      ? { usuario, password }
      : { pin }

    const result = await login(body)

    if (result.success) {
      router.push('/dashboard')
    } else {
      setLoginError(result.error || 'Error de autenticación')
    }

    setLoggingIn(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-800 to-stone-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="relative w-64 h-64 mx-auto mb-4">
            <Image
              src="/logo.png"
              alt="Solemar Alimentaria"
              fill
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl">Solemar Alimentaria</CardTitle>
          <CardDescription>Sistema de Gestión Frigorífica</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={loginTab} onValueChange={(v) => setLoginTab(v as 'usuario' | 'pin')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="usuario">Usuario</TabsTrigger>
              <TabsTrigger value="pin">PIN</TabsTrigger>
            </TabsList>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginTab === 'usuario' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="usuario">Usuario</Label>
                    <Input
                      id="usuario"
                      type="text"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      placeholder="Ingrese su usuario"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN</Label>
                  <Input
                    id="pin"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="text-center text-2xl tracking-widest h-14"
                    maxLength={6}
                    autoFocus
                  />
                </div>
              )}

              {loginError && (
                <p className="text-red-500 text-sm text-center">{loginError}</p>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-amber-500 hover:bg-amber-600"
                disabled={(loginTab === 'usuario' && (!usuario || !password)) || (loginTab === 'pin' && pin.length < 4) || loggingIn}
              >
                {loggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Ingresar
                  </>
                )}
              </Button>
            </form>
          </Tabs>

          <div className="mt-6 pt-4 border-t text-center text-xs text-stone-400">
            {process.env.NODE_ENV === 'development' && (
              <>
                <p>Credenciales de prueba:</p>
                <p>Usuario: <span className="font-mono">admin</span> / Password: <span className="font-mono">admin123</span></p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
