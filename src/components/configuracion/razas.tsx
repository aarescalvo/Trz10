'use client'

import { useState, useEffect } from 'react'
import { PawPrint, Plus, Edit, Trash2, Save, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const ESPECIES = [
  { id: 'BOVINO', label: 'Bovino', color: 'bg-amber-100 text-amber-700' },
  { id: 'EQUINO', label: 'Equino', color: 'bg-blue-100 text-blue-700' },
]

interface Raza {
  id: string
  nombre: string
  especie: string
  observaciones?: string
  activo: boolean
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function Razas({ operador }: { operador: Operador }) {
  const [razas, setRazas] = useState<Raza[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [razaEditando, setRazaEditando] = useState<Raza | null>(null)
  const [filtroEspecie, setFiltroEspecie] = useState('todos')
  
  const [formData, setFormData] = useState({
    nombre: '',
    especie: 'BOVINO',
    observaciones: ''
  })

  useEffect(() => {
    fetchRazas()
  }, [filtroEspecie])

  const fetchRazas = async () => {
    setLoading(true)
    try {
      const url = filtroEspecie !== 'todos' 
        ? `/api/razas?especie=${filtroEspecie}`
        : '/api/razas'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setRazas(data.data)
      }
    } catch (error) {
      console.error('Error fetching razas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNuevo = () => {
    setRazaEditando(null)
    setFormData({ 
      nombre: '', 
      especie: filtroEspecie !== 'todos' ? filtroEspecie : 'BOVINO', 
      observaciones: '' 
    })
    setDialogOpen(true)
  }

  const handleEditar = (raza: Raza) => {
    setRazaEditando(raza)
    setFormData({
      nombre: raza.nombre,
      especie: raza.especie,
      observaciones: raza.observaciones || ''
    })
    setDialogOpen(true)
  }

  const handleEliminar = (raza: Raza) => {
    setRazaEditando(raza)
    setDeleteOpen(true)
  }

  const handleGuardar = async () => {
    if (!formData.nombre) {
      toast.error('Ingrese el nombre de la raza')
      return
    }

    setSaving(true)
    try {
      const url = '/api/razas'
      const method = razaEditando ? 'PUT' : 'POST'
      const body = razaEditando 
        ? { ...formData, id: razaEditando.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        toast.success(razaEditando ? 'Raza actualizada' : 'Raza creada')
        setDialogOpen(false)
        fetchRazas()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmarEliminar = async () => {
    if (!razaEditando) return

    setSaving(true)
    try {
      const res = await fetch(`/api/razas?id=${razaEditando.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Raza eliminada')
        setDeleteOpen(false)
        fetchRazas()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const getEspecieInfo = (especie: string) => ESPECIES.find(e => e.id === especie) || ESPECIES[0]

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <PawPrint className="w-5 h-5 text-amber-600" />
                Gestión de Razas
              </CardTitle>
              <CardDescription>
                Configure las razas de animales por especie
              </CardDescription>
            </div>
            <Button onClick={handleNuevo} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Raza
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filtro por especie */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Filtrar por especie:</Label>
              <Select value={filtroEspecie} onValueChange={setFiltroEspecie}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las especies</SelectItem>
                  {ESPECIES.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <PawPrint className="w-8 h-8 animate-pulse mx-auto text-amber-500" />
            </div>
          ) : razas.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <PawPrint className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay razas configuradas</p>
              <p className="text-sm mt-1">Agregue una nueva raza usando el botón superior</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Especie</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {razas.map((raza) => {
                  const especieInfo = getEspecieInfo(raza.especie)
                  return (
                    <TableRow key={raza.id}>
                      <TableCell className="font-medium">{raza.nombre}</TableCell>
                      <TableCell>
                        <Badge className={especieInfo.color}>
                          {especieInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-stone-500">
                        {raza.observaciones || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={raza.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {raza.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditar(raza)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEliminar(raza)}
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
            <DialogTitle>{razaEditando ? 'Editar Raza' : 'Nueva Raza'}</DialogTitle>
            <DialogDescription>
              {razaEditando ? 'Modifique los datos de la raza' : 'Complete los datos para crear una nueva raza'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Angus"
              />
            </div>
            <div className="space-y-2">
              <Label>Especie</Label>
              <Select value={formData.especie} onValueChange={(v) => setFormData({ ...formData, especie: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESPECIES.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
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
              Eliminar Raza
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar la raza &quot;{razaEditando?.nombre}&quot;?
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

export default Razas
