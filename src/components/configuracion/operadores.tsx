'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Edit, Trash2, Save, X, AlertTriangle, Shield, KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const ROLES = [
  { id: 'OPERADOR', label: 'Operador', color: 'bg-blue-100 text-blue-700' },
  { id: 'SUPERVISOR', label: 'Supervisor', color: 'bg-amber-100 text-amber-700' },
  { id: 'ADMINISTRADOR', label: 'Administrador', color: 'bg-purple-100 text-purple-700' },
]

const MODULOS = [
  { id: 'puedePesajeCamiones', label: 'Pesaje Camiones', icon: '🚛', grupo: 'CICLO I' },
  { id: 'puedePesajeIndividual', label: 'Pesaje Individual', icon: '⚖️', grupo: 'CICLO I' },
  { id: 'puedeMovimientoHacienda', label: 'Movimiento Hacienda', icon: '🐄', grupo: 'CICLO I' },
  { id: 'puedeListaFaena', label: 'Lista Faena', icon: '📋', grupo: 'CICLO I' },
  { id: 'puedeIngresoCajon', label: 'Ingreso Cajón', icon: '📦', grupo: 'CICLO I' },
  { id: 'puedeRomaneo', label: 'Romaneo', icon: '📊', grupo: 'CICLO I' },
  { id: 'puedeCuarteo', label: 'Cuarteo', icon: '✂️', grupo: 'CICLO II' },
  { id: 'puedeDesposte', label: 'Desposte', icon: '🥩', grupo: 'CICLO II' },
  { id: 'puedeEmpaque', label: 'Empaque', icon: '📦', grupo: 'CICLO II' },
  { id: 'puedeExpedicionC2', label: 'Expedición C2', icon: '🚚', grupo: 'CICLO II' },
  { id: 'puedeCalidad', label: 'Calidad', icon: '🔬', grupo: 'Calidad' },
  { id: 'puedeMenudencias', label: 'Menudencias', icon: '🫀', grupo: 'Subproductos' },
  { id: 'puedeStock', label: 'Stock Cámaras', icon: '🏭', grupo: 'Stock' },
  { id: 'puedeCCIR', label: 'CCIR', icon: '📄', grupo: 'Documentación' },
  { id: 'puedeFacturacion', label: 'Facturación', icon: '🧾', grupo: 'Administración' },
  { id: 'puedeReportes', label: 'Reportes', icon: '📈', grupo: 'Reportes' },
  { id: 'puedeConfiguracion', label: 'Configuración', icon: '⚙️', grupo: 'Sistema' },
  { id: 'puedeAutorizarReportes', label: 'Autorizar Reportes', icon: '✅', grupo: 'Sistema' },
]

interface OperadorItem {
  id: string
  nombre: string
  usuario: string
  email?: string
  rol: string
  pin?: string
  activo: boolean
  puedePesajeCamiones: boolean
  puedePesajeIndividual: boolean
  puedeMovimientoHacienda: boolean
  puedeListaFaena: boolean
  puedeIngresoCajon: boolean
  puedeRomaneo: boolean
  puedeCuarteo: boolean
  puedeDesposte: boolean
  puedeEmpaque: boolean
  puedeExpedicionC2: boolean
  puedeMenudencias: boolean
  puedeStock: boolean
  puedeCCIR: boolean
  puedeFacturacion: boolean
  puedeReportes: boolean
  puedeConfiguracion: boolean
  puedeCalidad: boolean
  puedeAutorizarReportes: boolean
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function Operadores({ operador }: { operador: Operador }) {
  const [operadores, setOperadores] = useState<OperadorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [operadorEditando, setOperadorEditando] = useState<OperadorItem | null>(null)
  
  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '',
    password: '',
    email: '',
    pin: '',
    rol: 'OPERADOR',
    puedePesajeCamiones: true,
    puedePesajeIndividual: true,
    puedeMovimientoHacienda: true,
    puedeListaFaena: false,
    puedeIngresoCajon: false,
    puedeRomaneo: false,
    puedeCuarteo: false,
    puedeDesposte: false,
    puedeEmpaque: false,
    puedeExpedicionC2: false,
    puedeMenudencias: false,
    puedeStock: false,
    puedeCCIR: false,
    puedeFacturacion: false,
    puedeReportes: false,
    puedeConfiguracion: false,
    puedeCalidad: false,
    puedeAutorizarReportes: false
  })

  useEffect(() => {
    fetchOperadores()
  }, [])

  const fetchOperadores = async () => {
    try {
      const res = await fetch('/api/operadores')
      const data = await res.json()
      if (data.success) {
        setOperadores(data.data)
      }
    } catch (error) {
      console.error('Error fetching operadores:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNuevo = () => {
    setOperadorEditando(null)
    setFormData({
      nombre: '',
      usuario: '',
      password: '',
      email: '',
      pin: '',
      rol: 'OPERADOR',
      puedePesajeCamiones: true,
      puedePesajeIndividual: true,
      puedeMovimientoHacienda: true,
      puedeListaFaena: false,
      puedeIngresoCajon: false,
      puedeRomaneo: false,
      puedeCuarteo: false,
      puedeDesposte: false,
      puedeEmpaque: false,
      puedeExpedicionC2: false,
      puedeMenudencias: false,
      puedeStock: false,
      puedeCCIR: false,
      puedeFacturacion: false,
      puedeReportes: false,
      puedeConfiguracion: false,
      puedeCalidad: false,
      puedeAutorizarReportes: false
    })
    setDialogOpen(true)
  }

  const handleEditar = (op: OperadorItem) => {
    setOperadorEditando(op)
    setFormData({
      nombre: op.nombre,
      usuario: op.usuario,
      password: '',
      email: op.email || '',
      pin: op.pin || '',
      rol: op.rol,
      puedePesajeCamiones: op.puedePesajeCamiones,
      puedePesajeIndividual: op.puedePesajeIndividual,
      puedeMovimientoHacienda: op.puedeMovimientoHacienda,
      puedeListaFaena: op.puedeListaFaena,
      puedeIngresoCajon: op.puedeIngresoCajon,
      puedeRomaneo: op.puedeRomaneo,
      puedeCuarteo: op.puedeCuarteo,
      puedeDesposte: op.puedeDesposte,
      puedeEmpaque: op.puedeEmpaque,
      puedeExpedicionC2: op.puedeExpedicionC2,
      puedeMenudencias: op.puedeMenudencias,
      puedeStock: op.puedeStock,
      puedeCCIR: op.puedeCCIR,
      puedeFacturacion: op.puedeFacturacion,
      puedeReportes: op.puedeReportes,
      puedeConfiguracion: op.puedeConfiguracion,
      puedeCalidad: op.puedeCalidad,
      puedeAutorizarReportes: op.puedeAutorizarReportes
    })
    setDialogOpen(true)
  }

  const handleEliminar = (op: OperadorItem) => {
    setOperadorEditando(op)
    setDeleteOpen(true)
  }

  const handleGuardar = async () => {
    if (!formData.nombre || !formData.usuario) {
      toast.error('Complete nombre y usuario')
      return
    }

    if (!operadorEditando && !formData.password) {
      toast.error('Ingrese una contraseña para el nuevo operador')
      return
    }

    setSaving(true)
    try {
      const url = '/api/operadores'
      const method = operadorEditando ? 'PUT' : 'POST'
      const body = operadorEditando 
        ? { ...formData, id: operadorEditando.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        toast.success(operadorEditando ? 'Operador actualizado' : 'Operador creado')
        setDialogOpen(false)
        fetchOperadores()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActivo = async (op: OperadorItem) => {
    try {
      const res = await fetch('/api/operadores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: op.id, 
          activo: !op.activo 
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(op.activo ? 'Operador desactivado' : 'Operador activado')
        fetchOperadores()
      }
    } catch (error) {
      toast.error('Error al actualizar')
    }
  }

  const handleConfirmarEliminar = async () => {
    if (!operadorEditando) return

    setSaving(true)
    try {
      const res = await fetch(`/api/operadores?id=${operadorEditando.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Operador eliminado')
        setDeleteOpen(false)
        fetchOperadores()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleRolChange = (rol: string) => {
    let permisos = { ...formData }
    permisos.rol = rol
    
    if (rol === 'ADMINISTRADOR') {
      permisos = {
        ...permisos,
        puedePesajeCamiones: true,
        puedePesajeIndividual: true,
        puedeMovimientoHacienda: true,
        puedeListaFaena: true,
        puedeIngresoCajon: true,
        puedeRomaneo: true,
        puedeCuarteo: true,
        puedeDesposte: true,
        puedeEmpaque: true,
        puedeExpedicionC2: true,
        puedeMenudencias: true,
        puedeStock: true,
        puedeCCIR: true,
        puedeFacturacion: true,
        puedeReportes: true,
        puedeConfiguracion: true,
        puedeCalidad: true,
        puedeAutorizarReportes: true
      }
    } else if (rol === 'SUPERVISOR') {
      permisos = {
        ...permisos,
        puedePesajeCamiones: true,
        puedePesajeIndividual: true,
        puedeMovimientoHacienda: true,
        puedeListaFaena: true,
        puedeIngresoCajon: true,
        puedeRomaneo: true,
        puedeCuarteo: true,
        puedeDesposte: true,
        puedeEmpaque: true,
        puedeExpedicionC2: true,
        puedeMenudencias: true,
        puedeStock: true,
        puedeCCIR: true,
        puedeFacturacion: false,
        puedeReportes: true,
        puedeConfiguracion: false,
        puedeCalidad: true,
        puedeAutorizarReportes: true
      }
    }
    
    setFormData(permisos)
  }

  const getRolBadge = (rol: string) => {
    const role = ROLES.find(r => r.id === rol)
    return (
      <Badge className={role?.color || 'bg-gray-100'}>
        {role?.label || rol}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Gestión de Operadores
              </CardTitle>
              <CardDescription>
                Usuarios del sistema con permisos detallados
              </CardDescription>
            </div>
            <Button onClick={handleNuevo} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Operador
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Users className="w-8 h-8 animate-pulse mx-auto text-amber-500" />
            </div>
          ) : operadores.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay operadores registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operadores.map((op) => (
                  <TableRow key={op.id} className={!op.activo ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{op.nombre}</TableCell>
                    <TableCell className="font-mono">{op.usuario}</TableCell>
                    <TableCell>{op.email || '-'}</TableCell>
                    <TableCell>{getRolBadge(op.rol)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {MODULOS.filter(m => op[m.id as keyof OperadorItem] === true).slice(0, 3).map((m) => (
                          <Badge key={m.id} variant="outline" className="text-xs">
                            {m.icon} {m.label}
                          </Badge>
                        ))}
                        {MODULOS.filter(m => op[m.id as keyof OperadorItem] === true).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{MODULOS.filter(m => op[m.id as keyof OperadorItem] === true).length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={op.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {op.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditar(op)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <div
                          onClick={() => handleToggleActivo(op)}
                          className={`cursor-pointer flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent ${op.id === operador.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          role="switch"
                          aria-disabled={op.id === operador.id}
                        >
                          <Switch checked={op.activo} disabled={op.id === operador.id} />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEliminar(op)}
                          className="text-red-500 hover:text-red-700"
                          disabled={op.id === operador.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Nuevo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" maximizable>
          <DialogHeader>
            <DialogTitle>
              {operadorEditando ? 'Editar Operador' : 'Nuevo Operador'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos y permisos del operador
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Datos básicos */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Datos del Operador
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Completo *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Usuario *</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input
                      value={formData.usuario}
                      onChange={(e) => setFormData({ ...formData, usuario: e.target.value.toLowerCase() })}
                      placeholder="jperez"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contraseña {operadorEditando ? '(dejar vacío para no cambiar)' : '*'}</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PIN (opcional, 4-6 dígitos)</Label>
                  <Input
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="1234"
                    maxLength={6}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jperez@solemar.com.ar"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={formData.rol} onValueChange={handleRolChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Permisos */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Permisos por Módulo
              </h4>
              {/* Grupos de permisos */}
              {['CICLO I', 'CICLO II', 'Subproductos', 'Stock', 'Documentación', 'Calidad', 'Administración', 'Reportes', 'Sistema'].map(grupo => {
                const modulosGrupo = MODULOS.filter(m => m.grupo === grupo)
                if (modulosGrupo.length === 0) return null
                return (
                  <div key={grupo} className="space-y-2">
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {grupo}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {modulosGrupo.map((m) => (
                        <label 
                          key={m.id} 
                          className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            formData[m.id as keyof typeof formData] ? 'bg-amber-50 border-amber-300' : 'bg-white hover:bg-stone-50 border-stone-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData[m.id as keyof typeof formData] as boolean}
                            onChange={(e) => setFormData({ ...formData, [m.id]: e.target.checked })}
                            className="rounded border-stone-300"
                          />
                          <span className="text-sm">{m.icon} {m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Operador
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar al operador &quot;{operadorEditando?.nombre}&quot;?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarEliminar} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Operadores
