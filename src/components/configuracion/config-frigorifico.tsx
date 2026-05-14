'use client'

import { useState, useEffect } from 'react'
import { Building2, Save, MapPin, Hash, CreditCard, Award, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface Configuracion {
  id: string
  nombre: string
  direccion?: string
  numeroEstablecimiento?: string
  cuit?: string
  numeroMatricula?: string
  logo?: string
  emailHost?: string
  emailPuerto?: number
  emailUsuario?: string
  emailHabilitado: boolean
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function ConfigFrigorifico({ operador }: { operador: Operador }) {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/configuracion')
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Configuración guardada')
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Building2 className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Datos del Frigorífico */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-600" />
            Datos del Frigorífico
          </CardTitle>
          <CardDescription>
            Información que aparecerá en los rótulos y reportes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre / Razón Social</Label>
              <Input
                id="nombre"
                value={config?.nombre || ''}
                onChange={(e) => setConfig({ ...config!, nombre: e.target.value })}
                placeholder="Solemar Alimentaria"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cuit">CUIT</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  id="cuit"
                  value={config?.cuit || ''}
                  onChange={(e) => setConfig({ ...config!, cuit: e.target.value })}
                  placeholder="00-00000000-0"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
              <Textarea
                id="direccion"
                value={config?.direccion || ''}
                onChange={(e) => setConfig({ ...config!, direccion: e.target.value })}
                placeholder="Dirección completa del establecimiento"
                className="pl-10 min-h-[60px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numEstablecimiento">N° Establecimiento Oficial</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  id="numEstablecimiento"
                  value={config?.numeroEstablecimiento || ''}
                  onChange={(e) => setConfig({ ...config!, numeroEstablecimiento: e.target.value })}
                  placeholder="Número de establecimiento"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numMatricula">N° Matrícula</Label>
              <div className="relative">
                <Award className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  id="numMatricula"
                  value={config?.numeroMatricula || ''}
                  onChange={(e) => setConfig({ ...config!, numeroMatricula: e.target.value })}
                  placeholder="Número de matrícula"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de Email */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-600" />
            Configuración de Email
          </CardTitle>
          <CardDescription>
            Servidor SMTP para envío automático de romaneos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
            <div>
              <p className="font-medium">Habilitar envío de emails</p>
              <p className="text-sm text-stone-500">Envío automático de romaneos al usuario de faena</p>
            </div>
            <Switch
              checked={config?.emailHabilitado || false}
              onCheckedChange={(checked) => setConfig({ ...config!, emailHabilitado: checked })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Servidor SMTP</Label>
              <Input
                value={config?.emailHost || ''}
                onChange={(e) => setConfig({ ...config!, emailHost: e.target.value })}
                placeholder="smtp.office365.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Puerto</Label>
              <Input
                type="number"
                value={config?.emailPuerto || 587}
                onChange={(e) => setConfig({ ...config!, emailPuerto: parseInt(e.target.value) })}
                placeholder="587"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Usuario / Email</Label>
            <Input
              value={config?.emailUsuario || ''}
              onChange={(e) => setConfig({ ...config!, emailUsuario: e.target.value })}
              placeholder="usuario@solemar.com.ar"
            />
          </div>

          {config?.emailHabilitado && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                La contraseña del email debe configurarse por seguridad en el servidor.
                Contacte al administrador del sistema.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  )
}

export default ConfigFrigorifico
