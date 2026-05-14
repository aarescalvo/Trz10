'use client'

import { useState, useEffect } from 'react'
import { Warehouse, Plus, Edit, Trash2, Save, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const TIPOS_CAMARA = [
  { id: 'FAENA', label: 'Faena', unidad: 'ganchos' },
  { id: 'CUARTEO', label: 'Cuarteo', unidad: 'kg' },
  { id: 'DEPOSITO', label: 'Depósito', unidad: 'kg' },
]

interface Camara {
  id: string
  nombre: string
  tipo: string
  capacidad: number
  observaciones?: string
  activo: boolean
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function Camaras({ operador }: { operador: Operador }) {
  const [camaras, setCamaras] = useState<Camara[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [camaraEditando, setCamaraEditando] = useState<Camara | null>(null)
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'FAENA',
    capacidad: 100,
    observaciones: ''
  })

  useEffect(() => {
    fetchCamaras()
  }, [])

  const fetchCamaras = async () => {
    try {
      const res = await fetch('/api/camaras')
      const data = await res.json()
      if (data.success) {
        setCamaras(data.data)
      }
    } catch (error) {
      console.error('Error fetching cámaras:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNuevo = () => {
    setCamaraEditando(null)
    setFormData({ nombre: '', tipo: 'FAENA', capacidad: 100, observaciones: '' })
    setDialogOpen(true)
  }

  const handleEditar = (camara: Camara) => {
    setCamaraEditando(camara)
    setFormData({
      nombre: camara.nombre,
      tipo: camara.tipo,
      capacidad: camara.capacidad,
      observaciones: camara.observaciones || ''
    })
    setDialogOpen(true)
  }

  const handleEliminar = (camara: Camara) => {
    setCamaraEditando(camara)
    setDeleteOpen(true)
  }

  const handleGuardar = async () => {
    if (!formData.nombre) {
      toast.error('Ingrese el nombre de la cámara')
      return
    }

    setSaving(true)
    try {
      const url = '/api/camaras'
      const method = camaraEditando ? 'PUT' : 'POST'
      const body = camaraEditando 
        ? { ...formData, id: camaraEditando.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        toast.success(camaraEditando ? 'Cámara actualizada' : 'Cámara creada')
        setDialogOpen(false)
        fetchCamaras()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmarEliminar = async () => {
    if (!camaraEditando) return

    setSaving(true)
    try {
      const res = await fetch(`/api/camaras?id=${camaraEditando.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Cámara eliminada')
        setDeleteOpen(false)
        fetchCamaras()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const getTipoInfo = (tipo: string) => TIPOS_CAMARA.find(t => t.id === tipo) || TIPOS_CAMARA[0]

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-amber-600" />
                Gestión de Cámaras
              </CardTitle>
              <CardDescription>
                Configure las cámaras frigoríficas por tipo
              </CardDescription>
            </div>
            <Button onClick={handleNuevo} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Cámara
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Warehouse className="w-8 h-8 animate-pulse mx-auto text-amber-500" />
            </div>
          ) : camaras.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay cámaras configuradas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {camaras.map((camara) => {
                  const tipoInfo = getTipoInfo(camara.tipo)
                  return (
                    <TableRow key={camara.id}>
                      <TableCell className="font-medium">{camara.nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          camara.tipo === 'FAENA' ? 'border-green-300 text-green-700' :
                          camara.tipo === 'CUARTEO' ? 'border-blue-300 text-blue-700' :
                          'border-purple-300 text-purple-700'
                        }>
                          {tipoInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{camara.capacidad.toLocaleString()} {tipoInfo.unidad}</TableCell>
                      <TableCell>
                        <Badge className={camara.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {camara.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditar(camara)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEliminar(camara)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Nuevo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>{camaraEditando ? 'Editar Cámara' : 'Nueva Cámara'}</DialogTitle>
            <DialogDescription>
              {camaraEditando ? 'Modifique los datos de la cámara' : 'Complete los datos para crear una nueva cámara'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Cámara Faena 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CAMARA.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacidad ({getTipoInfo(formData.tipo).unidad})</Label>
              <Input
                type="number"
                value={formData.capacidad}
                onChange={(e) => setFormData({ ...formData, capacidad: parseInt(e.target.value) || 0 })}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales..."
              />
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
              Eliminar Cámara
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar la cámara &quot;{camaraEditando?.nombre}&quot;?
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

export default Camaras
