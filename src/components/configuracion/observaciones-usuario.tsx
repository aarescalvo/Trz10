'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  MessageSquareWarning,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface Cliente {
  id: string
  nombre: string
  cuit: string | null
}

interface Observacion {
  id: string
  clienteId: string
  cliente: Cliente
  fecha: string
  tipo: 'NOTA' | 'RECLAMO' | 'RECORDATORIO' | 'INCIDENTE'
  observacion: string
  fechaSeguimiento: string | null
  resuelto: boolean
  fechaResolucion: string | null
  resolucion: string | null
  createdAt: string
  updatedAt: string
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

const TIPOS_OBSERVACION = [
  { value: 'NOTA', label: 'Nota', color: 'bg-blue-500', icon: FileText },
  { value: 'RECLAMO', label: 'Reclamo', color: 'bg-red-500', icon: MessageSquareWarning },
  { value: 'RECORDATORIO', label: 'Recordatorio', color: 'bg-amber-500', icon: Bell },
  { value: 'INCIDENTE', label: 'Incidente', color: 'bg-purple-500', icon: AlertCircle },
]

export function ObservacionesUsuario({ operador }: { operador: Operador }) {
  const [observaciones, setObservaciones] = useState<Observacion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [filtroCliente, setFiltroCliente] = useState<string>('all')
  const [filtroTipo, setFiltroTipo] = useState<string>('all')
  const [filtroResuelto, setFiltroResuelto] = useState<string>('all')
  const [busqueda, setBusqueda] = useState('')
  
  // Diálogos
  const [dialogNuevoOpen, setDialogNuevoOpen] = useState(false)
  const [dialogResolverOpen, setDialogResolverOpen] = useState(false)
  const [dialogVerOpen, setDialogVerOpen] = useState(false)
  
  // Formulario nuevo
  const [nuevoClienteId, setNuevoClienteId] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('NOTA')
  const [nuevaObservacion, setNuevaObservacion] = useState('')
  const [nuevaFechaSeguimiento, setNuevaFechaSeguimiento] = useState('')
  
  // Resolución
  const [observacionSeleccionada, setObservacionSeleccionada] = useState<Observacion | null>(null)
  const [resolucion, setResolucion] = useState('')
  
  // Guardando
  const [guardando, setGuardando] = useState(false)

  // Cargar datos
  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Cargar clientes
      const resClientes = await fetch('/api/clientes')
      const dataClientes = await resClientes.json()
      if (dataClientes.success) {
        setClientes(dataClientes.data)
      }
      
      // Construir query params
      const params = new URLSearchParams()
      if (filtroCliente && filtroCliente !== 'all') params.append('clienteId', filtroCliente)
      if (filtroTipo && filtroTipo !== 'all') params.append('tipo', filtroTipo)
      if (filtroResuelto && filtroResuelto !== 'all') params.append('resuelto', filtroResuelto)
      
      // Cargar observaciones
      const resObs = await fetch(`/api/observaciones-usuario?${params.toString()}`)
      const dataObs = await resObs.json()
      if (dataObs.success) {
        setObservaciones(dataObs.data)
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filtroCliente, filtroTipo, filtroResuelto])

  // Crear nueva observación
  const handleCrear = async () => {
    if (!nuevoClienteId) {
      toast.error('Seleccione un cliente')
      return
    }
    if (!nuevaObservacion.trim()) {
      toast.error('Ingrese la observación')
      return
    }

    try {
      setGuardando(true)
      const res = await fetch('/api/observaciones-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: nuevoClienteId,
          tipo: nuevoTipo,
          observacion: nuevaObservacion,
          fechaSeguimiento: nuevaFechaSeguimiento || null,
          operadorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Observación creada correctamente')
        setDialogNuevoOpen(false)
        resetFormNuevo()
        fetchData()
      } else {
        toast.error(data.error || 'Error al crear observación')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al crear observación')
    } finally {
      setGuardando(false)
    }
  }

  // Resolver observación
  const handleResolver = async () => {
    if (!observacionSeleccionada) return
    if (!resolucion.trim()) {
      toast.error('Ingrese la resolución')
      return
    }

    try {
      setGuardando(true)
      const res = await fetch('/api/observaciones-usuario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: observacionSeleccionada.id,
          resuelto: true,
          resolucion: resolucion
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Observación resuelta correctamente')
        setDialogResolverOpen(false)
        setObservacionSeleccionada(null)
        setResolucion('')
        fetchData()
      } else {
        toast.error(data.error || 'Error al resolver observación')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al resolver observación')
    } finally {
      setGuardando(false)
    }
  }

  // Eliminar observación
  const handleEliminar = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta observación?')) return

    try {
      const res = await fetch(`/api/observaciones-usuario?id=${id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Observación eliminada')
        fetchData()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al eliminar observación')
    }
  }

  // Reabrir observación
  const handleReabrir = async (obs: Observacion) => {
    try {
      const res = await fetch('/api/observaciones-usuario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: obs.id,
          resuelto: false
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Observación reabierta')
        fetchData()
      } else {
        toast.error(data.error || 'Error al reabrir')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al reabrir observación')
    }
  }

  const resetFormNuevo = () => {
    setNuevoClienteId('')
    setNuevoTipo('NOTA')
    setNuevaObservacion('')
    setNuevaFechaSeguimiento('')
  }

  // Filtrar por búsqueda local
  const observacionesFiltradas = observaciones.filter(obs => {
    if (!busqueda) return true
    const busquedaLower = busqueda.toLowerCase()
    return (
      obs.cliente.nombre.toLowerCase().includes(busquedaLower) ||
      obs.observacion.toLowerCase().includes(busquedaLower) ||
      (obs.resolucion && obs.resolucion.toLowerCase().includes(busquedaLower))
    )
  })

  // Obtener badge de tipo
  const getBadgeTipo = (tipo: string) => {
    const tipoInfo = TIPOS_OBSERVACION.find(t => t.value === tipo) || TIPOS_OBSERVACION[0]
    const Icon = tipoInfo.icon
    return (
      <Badge className={`${tipoInfo.color} text-white gap-1`}>
        <Icon className="w-3 h-3" />
        {tipoInfo.label}
      </Badge>
    )
  }

  // Formatear fecha
  const formatFecha = (fecha: string | null) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5" />
            Observaciones de Usuarios
          </CardTitle>
          <Button onClick={() => setDialogNuevoOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Observación
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-lg">
          <div>
            <Label className="text-xs text-stone-500">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-stone-400" />
              <Input
                placeholder="Buscar..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs text-stone-500">Cliente</Label>
            <Select value={filtroCliente} onValueChange={setFiltroCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-stone-500">Tipo</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {TIPOS_OBSERVACION.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-stone-500">Estado</Label>
            <Select value={filtroResuelto} onValueChange={setFiltroResuelto}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="false">Pendientes</SelectItem>
                <SelectItem value="true">Resueltos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-8 text-stone-500">Cargando...</div>
        ) : observacionesFiltradas.length === 0 ? (
          <div className="text-center py-8 text-stone-500">
            No hay observaciones registradas
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead>Seguimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {observacionesFiltradas.map((obs) => (
                  <TableRow key={obs.id} className={obs.resuelto ? 'bg-green-50' : ''}>
                    <TableCell className="whitespace-nowrap">
                      {formatFecha(obs.fecha)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{obs.cliente.nombre}</div>
                        {obs.cliente.cuit && (
                          <div className="text-xs text-stone-500">CUIT: {obs.cliente.cuit}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getBadgeTipo(obs.tipo)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={obs.observacion}>
                        {obs.observacion}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {obs.fechaSeguimiento ? (
                        <div className="flex items-center gap-1 text-amber-600">
                          <Clock className="w-4 h-4" />
                          {formatFecha(obs.fechaSeguimiento)}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {obs.resuelto ? (
                        <Badge className="bg-green-500 text-white gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Resuelto
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setObservacionSeleccionada(obs)
                            setDialogVerOpen(true)
                          }}
                          title="Ver detalles"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        {!obs.resuelto ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setObservacionSeleccionada(obs)
                              setDialogResolverOpen(true)
                            }}
                            title="Resolver"
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReabrir(obs)}
                            title="Reabrir"
                            className="text-amber-600 hover:text-amber-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEliminar(obs.id)}
                          title="Eliminar"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Resumen */}
        <div className="flex gap-4 text-sm text-stone-500">
          <span>Total: {observacionesFiltradas.length}</span>
          <span>|</span>
          <span className="text-amber-600">
            Pendientes: {observacionesFiltradas.filter(o => !o.resuelto).length}
          </span>
          <span className="text-green-600">
            Resueltos: {observacionesFiltradas.filter(o => o.resuelto).length}
          </span>
        </div>
      </CardContent>

      {/* Diálogo Nueva Observación */}
      <Dialog open={dialogNuevoOpen} onOpenChange={setDialogNuevoOpen}>
        <DialogContent className="max-w-md" maximizable>
          <DialogHeader>
            <DialogTitle>Nueva Observación</DialogTitle>
            <DialogDescription>
              Registre una nueva observación para un cliente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={nuevoClienteId} onValueChange={setNuevoClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Tipo *</Label>
              <Select value={nuevoTipo} onValueChange={setNuevoTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_OBSERVACION.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className="w-4 h-4" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Observación *</Label>
              <Textarea
                value={nuevaObservacion}
                onChange={(e) => setNuevaObservacion(e.target.value)}
                placeholder="Describa la observación..."
                rows={3}
              />
            </div>
            
            <div>
              <Label>Fecha de Seguimiento (opcional)</Label>
              <Input
                type="date"
                value={nuevaFechaSeguimiento}
                onChange={(e) => setNuevaFechaSeguimiento(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNuevoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Resolver */}
      <Dialog open={dialogResolverOpen} onOpenChange={setDialogResolverOpen}>
        <DialogContent className="max-w-md" maximizable>
          <DialogHeader>
            <DialogTitle>Resolver Observación</DialogTitle>
            <DialogDescription>
              Marque esta observación como resuelta
            </DialogDescription>
          </DialogHeader>
          
          {observacionSeleccionada && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getBadgeTipo(observacionSeleccionada.tipo)}
                  <span className="font-medium">{observacionSeleccionada.cliente.nombre}</span>
                </div>
                <p className="text-sm text-stone-600">{observacionSeleccionada.observacion}</p>
              </div>
              
              <div>
                <Label>Resolución *</Label>
                <Textarea
                  value={resolucion}
                  onChange={(e) => setResolucion(e.target.value)}
                  placeholder="Describa cómo se resolvió..."
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogResolverOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResolver} disabled={guardando} className="bg-green-600 hover:bg-green-700">
              {guardando ? 'Guardando...' : 'Resolver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Ver Detalles */}
      <Dialog open={dialogVerOpen} onOpenChange={setDialogVerOpen}>
        <DialogContent className="max-w-lg" maximizable>
          <DialogHeader>
            <DialogTitle>Detalle de Observación</DialogTitle>
          </DialogHeader>
          
          {observacionSeleccionada && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-stone-500">Fecha</Label>
                  <p className="font-medium">{formatFecha(observacionSeleccionada.fecha)}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">Tipo</Label>
                  <div>{getBadgeTipo(observacionSeleccionada.tipo)}</div>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">Cliente</Label>
                  <p className="font-medium">{observacionSeleccionada.cliente.nombre}</p>
                </div>
                <div>
                  <Label className="text-xs text-stone-500">CUIT</Label>
                  <p>{observacionSeleccionada.cliente.cuit || '-'}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-xs text-stone-500">Observación</Label>
                <p className="p-3 bg-stone-50 rounded-lg mt-1">{observacionSeleccionada.observacion}</p>
              </div>
              
              {observacionSeleccionada.fechaSeguimiento && (
                <div>
                  <Label className="text-xs text-stone-500">Fecha de Seguimiento</Label>
                  <p className="flex items-center gap-1 text-amber-600">
                    <Clock className="w-4 h-4" />
                    {formatFecha(observacionSeleccionada.fechaSeguimiento)}
                  </p>
                </div>
              )}
              
              <div>
                <Label className="text-xs text-stone-500">Estado</Label>
                <div className="mt-1">
                  {observacionSeleccionada.resuelto ? (
                    <div className="space-y-2">
                      <Badge className="bg-green-500 text-white gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Resuelto
                      </Badge>
                      {observacionSeleccionada.fechaResolucion && (
                        <p className="text-xs text-stone-500">
                          Fecha: {formatFecha(observacionSeleccionada.fechaResolucion)}
                        </p>
                      )}
                      {observacionSeleccionada.resolucion && (
                        <div className="p-3 bg-green-50 rounded-lg mt-2">
                          <Label className="text-xs text-stone-500">Resolución</Label>
                          <p className="text-sm mt-1">{observacionSeleccionada.resolucion}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                      <Clock className="w-3 h-3" />
                      Pendiente
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogVerOpen(false)}>
              Cerrar
            </Button>
            {observacionSeleccionada && !observacionSeleccionada.resuelto && (
              <Button
                onClick={() => {
                  setDialogVerOpen(false)
                  setDialogResolverOpen(true)
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Resolver
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default ObservacionesUsuario
