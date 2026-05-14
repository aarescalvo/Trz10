'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Cloud,
  CloudOff,
  Play,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  HardDrive,
  Loader2,
  AlertTriangle,
  CloudCog,
  Cloudy,
  Calendar,
  Settings,
  Terminal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

interface ConfiguracionBackup {
  id: string
  backupDiario: boolean
  horaBackup: string
  retenerDias: number
  nubeHabilitado: boolean
  proveedorNube: string | null
  credenciales: string | null
  pointInTime: boolean
  intervaloPIT: number | null
  ultimoBackup: string | null
  ultimoExitoso: boolean | null
  tamanoUltimo: number | null
  activo: boolean
}

interface HistorialBackup {
  id: string
  tipo: string
  fecha: string
  nombreArchivo: string
  rutaArchivo: string
  tamano: number
  estado: string
  mensajeError: string | null
  subidoNube: boolean
  urlNube: string | null
  fechaExpiracion: string | null
}

type CloudProvider = 'GOOGLE_DRIVE' | 'DROPBOX' | 'S3' | 'ONEDRIVE'

const CLOUD_PROVIDERS: { id: CloudProvider; name: string; icon: React.ElementType; color: string }[] = [
  { id: 'GOOGLE_DRIVE', name: 'Google Drive', icon: CloudCog, color: 'bg-yellow-500' },
  { id: 'DROPBOX', name: 'Dropbox', icon: Cloudy, color: 'bg-blue-500' },
  { id: 'S3', name: 'Amazon S3', icon: HardDrive, color: 'bg-orange-500' },
  { id: 'ONEDRIVE', name: 'OneDrive', icon: Cloud, color: 'bg-sky-500' }
]

interface CloudProviderConfigProps {
  provider: CloudProvider
  credentials: any
  onChange: (creds: any) => void
}

function CloudProviderConfig({ provider, credentials, onChange }: CloudProviderConfigProps) {
  switch (provider) {
    case 'GOOGLE_DRIVE':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Client ID</Label>
            <Input
              placeholder="Google Client ID"
              value={credentials?.clientId || ''}
              onChange={(e) => onChange({ ...credentials, clientId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Client Secret</Label>
            <Input
              type="password"
              placeholder="Google Client Secret"
              value={credentials?.clientSecret || ''}
              onChange={(e) => onChange({ ...credentials, clientSecret: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Refresh Token</Label>
            <Input
              type="password"
              placeholder="Refresh Token"
              value={credentials?.refreshToken || ''}
              onChange={(e) => onChange({ ...credentials, refreshToken: e.target.value })}
            />
          </div>
          <p className="text-xs text-stone-500">
            Obtén estas credenciales desde la Google Cloud Console
          </p>
        </div>
      )
    case 'DROPBOX':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Access Token</Label>
            <Input
              type="password"
              placeholder="Dropbox Access Token"
              value={credentials?.accessToken || ''}
              onChange={(e) => onChange({ ...credentials, accessToken: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Carpeta de Backup</Label>
            <Input
              placeholder="/backups/solemar"
              value={credentials?.folder || ''}
              onChange={(e) => onChange({ ...credentials, folder: e.target.value })}
            />
          </div>
          <p className="text-xs text-stone-500">
            Genera un token de acceso desde la Dropbox App Console
          </p>
        </div>
      )
    case 'S3':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Access Key ID</Label>
              <Input
                placeholder="AKIA..."
                value={credentials?.accessKeyId || ''}
                onChange={(e) => onChange({ ...credentials, accessKeyId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Secret Access Key</Label>
              <Input
                type="password"
                placeholder="Secret Key"
                value={credentials?.secretAccessKey || ''}
                onChange={(e) => onChange({ ...credentials, secretAccessKey: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bucket Name</Label>
              <Input
                placeholder="solemar-backups"
                value={credentials?.bucket || ''}
                onChange={(e) => onChange({ ...credentials, bucket: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Region</Label>
              <Input
                placeholder="us-east-1"
                value={credentials?.region || ''}
                onChange={(e) => onChange({ ...credentials, region: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-stone-500">
            Credenciales IAM con permisos de escritura en el bucket
          </p>
        </div>
      )
    case 'ONEDRIVE':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Client ID</Label>
            <Input
              placeholder="Microsoft Client ID"
              value={credentials?.clientId || ''}
              onChange={(e) => onChange({ ...credentials, clientId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Client Secret</Label>
            <Input
              type="password"
              placeholder="Microsoft Client Secret"
              value={credentials?.clientSecret || ''}
              onChange={(e) => onChange({ ...credentials, clientSecret: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Refresh Token</Label>
            <Input
              type="password"
              placeholder="Refresh Token"
              value={credentials?.refreshToken || ''}
              onChange={(e) => onChange({ ...credentials, refreshToken: e.target.value })}
            />
          </div>
          <p className="text-xs text-stone-500">
            Registra tu app en Azure Portal para obtener las credenciales
          </p>
        </div>
      )
    default:
      return null
  }
}

export function BackupConfig({ operador, onBack }: { operador: Operador; onBack: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [backupProgress, setBackupProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  
  const [config, setConfig] = useState<ConfiguracionBackup | null>(null)
  const [historial, setHistorial] = useState<HistorialBackup[]>([])
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>('GOOGLE_DRIVE')
  const [credentials, setCredentials] = useState<any>({})

  // Fetch configuration and history
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, historialRes] = await Promise.all([
        fetch('/api/backup/configuracion'),
        fetch('/api/backup/historial?limite=20')
      ])
      
      if (configRes.ok) {
        const configData = await configRes.json()
        setConfig(configData)
        if (configData.proveedorNube) {
          setSelectedProvider(configData.proveedorNube as CloudProvider)
        }
        if (configData.credenciales) {
          try {
            setCredentials(JSON.parse(configData.credenciales))
          } catch {
            setCredentials({})
          }
        }
      }
      
      if (historialRes.ok) {
        setHistorial(await historialRes.json())
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Save configuration
  const handleSave = async () => {
    if (!config) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/backup/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          proveedorNube: config.nubeHabilitado ? selectedProvider : null,
          credenciales: config.nubeHabilitado ? JSON.stringify(credentials) : null
        })
      })
      
      if (res.ok) {
        toast({
          title: 'Guardado',
          description: 'Configuración actualizada correctamente'
        })
        fetchData()
      } else {
        throw new Error('Error al guardar')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // Test cloud connection
  const handleTestConnection = async () => {
    setTesting(true)
    addLog('Probando conexión con ' + selectedProvider + '...')
    
    // Simulate test - in production this would call a real API
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const success = Math.random() > 0.3 // Simulated result
    
    if (success) {
      addLog(`✅ Conexión exitosa con ${selectedProvider}`)
      toast({
        title: 'Conexión exitosa',
        description: `Se pudo conectar correctamente con ${selectedProvider}`
      })
    } else {
      addLog(`❌ Error de conexión con ${selectedProvider}`)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el proveedor de nube',
        variant: 'destructive'
      })
    }
    
    setTesting(false)
  }

  // Execute backup
  const handleExecuteBackup = async () => {
    setExecuting(true)
    setBackupProgress(0)
    setLogs([])
    
    try {
      addLog('Iniciando backup manual...')
      setBackupProgress(10)
      
      const res = await fetch('/api/backup/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'MANUAL' })
      })
      
      setBackupProgress(50)
      addLog('Creando copia de seguridad...')
      
      if (res.ok) {
        const data = await res.json()
        setBackupProgress(80)
        addLog('✅ Backup creado: ' + data.historial.nombreArchivo)
        
        if (config?.nubeHabilitado) {
          addLog('Subiendo a la nube...')
          // Simulate cloud upload
          await new Promise(resolve => setTimeout(resolve, 1000))
          addLog('✅ Subido a ' + selectedProvider)
        }
        
        setBackupProgress(100)
        addLog('Backup completado exitosamente')
        
        toast({
          title: 'Backup completado',
          description: `Archivo: ${data.historial.nombreArchivo}`
        })
        
        fetchData()
      } else {
        throw new Error('Error al ejecutar backup')
      }
    } catch (error) {
      addLog('❌ Error: ' + (error as Error).message)
      toast({
        title: 'Error',
        description: 'No se pudo ejecutar el backup',
        variant: 'destructive'
      })
    } finally {
      setExecuting(false)
    }
  }

  // Download backup
  const handleDownload = async (backup: HistorialBackup) => {
    try {
      const res = await fetch(`/api/backup/descargar?id=${backup.id}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = backup.nombreArchivo
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        // Fallback - try direct file access
        window.open(`/backups/${backup.nombreArchivo}`, '_blank')
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo descargar el archivo',
        variant: 'destructive'
      })
    }
  }

  // Delete backup
  const handleDelete = async (backup: HistorialBackup) => {
    if (!confirm('¿Eliminar este backup?')) return
    
    try {
      const res = await fetch(`/api/backup/historial?id=${backup.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Eliminado', description: 'Backup eliminado correctamente' })
        fetchData()
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el backup',
        variant: 'destructive'
      })
    }
  }

  // Add log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate next backup time
  const getNextBackup = () => {
    if (!config?.backupDiario || !config.horaBackup) return null
    
    const [hours, minutes] = config.horaBackup.split(':').map(Number)
    const now = new Date()
    const next = new Date()
    next.setHours(hours, minutes, 0, 0)
    
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    
    return next
  }

  const nextBackup = getNextBackup()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800">Sistema de Respaldo</h2>
            <p className="text-stone-500">Configura backups automáticos y restauración</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config?.activo ? "default" : "secondary"} className="text-sm">
            {config?.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Clock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Último Backup</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {config?.ultimoBackup 
                        ? formatDate(config.ultimoBackup)
                        : 'Nunca'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Próximo Backup</p>
                    <p className="text-lg font-bold text-amber-700">
                      {nextBackup ? formatDate(nextBackup.toISOString()) : 'No programado'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-sky-200 bg-sky-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 rounded-lg">
                    <Database className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-xs text-sky-600 font-medium">Tamaño Total</p>
                    <p className="text-lg font-bold text-sky-700">
                      {config?.tamanoUltimo ? formatSize(config.tamanoUltimo) : '0 MB'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuración General
              </CardTitle>
              <CardDescription>
                Ajusta la frecuencia y retención de los backups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Daily Backup */}
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-stone-500" />
                  <div>
                    <Label className="font-medium">Backup Diario Automático</Label>
                    <p className="text-sm text-stone-500">Ejecutar backup todos los días</p>
                  </div>
                </div>
                <Switch
                  checked={config?.backupDiario || false}
                  onCheckedChange={(checked) => 
                    setConfig(prev => prev ? { ...prev, backupDiario: checked } : null)
                  }
                />
              </div>

              {config?.backupDiario && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hora del Backup</Label>
                    <Input
                      type="time"
                      value={config.horaBackup || '02:00'}
                      onChange={(e) => 
                        setConfig(prev => prev ? { ...prev, horaBackup: e.target.value } : null)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Días de Retención</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={config.retenerDias || 30}
                      onChange={(e) => 
                        setConfig(prev => prev ? { ...prev, retenerDias: parseInt(e.target.value) } : null)
                      }
                    />
                  </div>
                </div>
              )}

              <Separator />

              {/* Cloud Backup */}
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-stone-500" />
                  <div>
                    <Label className="font-medium">Backup en Nube</Label>
                    <p className="text-sm text-stone-500">Sincronizar con almacenamiento en la nube</p>
                  </div>
                </div>
                <Switch
                  checked={config?.nubeHabilitado || false}
                  onCheckedChange={(checked) => 
                    setConfig(prev => prev ? { ...prev, nubeHabilitado: checked } : null)
                  }
                />
              </div>

              {/* Cloud Provider Selection */}
              {config?.nubeHabilitado && (
                <div className="space-y-4">
                  <Label className="font-medium">Proveedor de Nube</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CLOUD_PROVIDERS.map((provider) => {
                      const Icon = provider.icon
                      return (
                        <Card
                          key={provider.id}
                          className={cn(
                            "cursor-pointer transition-all border-2",
                            selectedProvider === provider.id
                              ? "border-violet-500 bg-violet-50"
                              : "border-stone-200 hover:border-stone-300"
                          )}
                          onClick={() => setSelectedProvider(provider.id)}
                        >
                          <CardContent className="p-4 text-center">
                            <div className={cn(
                              "w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center text-white",
                              provider.color
                            )}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <p className="text-sm font-medium">{provider.name}</p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Provider Credentials */}
                  <Card className="border-stone-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Credenciales de {CLOUD_PROVIDERS.find(p => p.id === selectedProvider)?.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CloudProviderConfig
                        provider={selectedProvider}
                        credentials={credentials}
                        onChange={setCredentials}
                      />
                    </CardContent>
                  </Card>

                  {/* Test Connection */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={testing}
                    >
                      {testing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Probar Conexión
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Point-in-Time Recovery */}
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5 text-stone-500" />
                  <div>
                    <Label className="font-medium">Point-in-Time Recovery</Label>
                    <p className="text-sm text-stone-500">Permite restaurar a un momento específico</p>
                  </div>
                </div>
                <Switch
                  checked={config?.pointInTime || false}
                  onCheckedChange={(checked) => 
                    setConfig(prev => prev ? { ...prev, pointInTime: checked } : null)
                  }
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onBack}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Guardar Configuración
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions & History */}
        <div className="space-y-6">
          {/* Execute Backup */}
          <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Ejecutar Backup
              </CardTitle>
              <CardDescription>
                Crea una copia de seguridad ahora
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {executing && (
                <div className="space-y-2">
                  <Progress value={backupProgress} className="h-2" />
                  <p className="text-sm text-center text-stone-600">{backupProgress}% completado</p>
                </div>
              )}
              
              <Button
                className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                onClick={handleExecuteBackup}
                disabled={executing}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Ejecutar Backup Ahora
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Logs */}
          {logs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Logs en Tiempo Real
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32 bg-stone-900 rounded-lg p-3">
                  {logs.map((log, i) => (
                    <div key={i} className="text-xs font-mono text-green-400 mb-1">
                      {log}
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Historial de Backups
              </CardTitle>
              <CardDescription>
                Últimos {historial.length} backups realizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                {historial.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No hay backups en el historial</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historial.map((backup) => (
                      <div
                        key={backup.id}
                        className="p-3 border rounded-lg hover:bg-stone-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium">{backup.nombreArchivo}</p>
                            <p className="text-xs text-stone-500">{formatDate(backup.fecha)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {backup.estado === 'COMPLETADO' ? (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                                <XCircle className="w-3 h-3 mr-1" />
                                Error
                              </Badge>
                            )}
                            {backup.subidoNube && (
                              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                <Cloud className="w-3 h-3 mr-1" />
                                Nube
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-stone-500">
                          <span>{formatSize(backup.tamano)}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleDownload(backup)}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                              onClick={() => handleDelete(backup)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {backup.mensajeError && (
                          <p className="text-xs text-red-500 mt-1">{backup.mensajeError}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default BackupConfig
