'use client'

import { useState, useEffect } from 'react'
import { Warehouse, Plus, Edit, Trash2, Save, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

interface Corral {
  id: string
  nombre: string
  capacidad: number
  stockBovinos: number
  stockEquinos: number
  observaciones?: string
  activo: boolean
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function Corrales({ operador }: { operador: Operador }) {
  const [corrales, setCorrales] = useState<Corral[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [corralEditando, setCorralEditando] = useState<Corral | null>(null)
  
  const [formData, setFormData] = useState({
    nombre: '',
    capacidad: 50,
    observaciones: ''
  })

  useEffect(() => {
    fetchCorrales()
  }, [])

  const fetchCorrales = async () => {
    try {
      const res = await fetch('/api/corrales')
      const data = await res.json()
      if (data.success) {
        setCorrales(data.data)
      }
    } catch (error) {
      console.error('Error fetching corrales:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNuevo = () => {
    setCorralEditando(null)
    setFormData({ nombre: '', capacidad: 50, observaciones: '' })
    setDialogOpen(true)
  }

  const handleEditar = (corral: Corral) => {
    setCorralEditando(corral)
    setFormData({
      nombre: corral.nombre,
      capacidad: corral.capacidad,
      observaciones: corral.observaciones || ''
    })
    setDialogOpen(true)
  }

  const handleEliminar = (corral: Corral) => {
    setCorralEditando(corral)
    setDeleteOpen(true)
  }

  const handleGuardar = async () => {
    if (!formData.nombre) {
      toast.error('Ingrese el nombre del corral')
      return
    }

    setSaving(true)
    try {
      const url = '/api/corrales'
      const method = corralEditando ? 'PUT' : 'POST'
      const body = corralEditando 
        ? { ...formData, id: corralEditando.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        toast.success(corralEditando ? 'Corral actualizado' : 'Corral creado')
        setDialogOpen(false)
        fetchCorrales()
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
    if (!corralEditando) return

    setSaving(true)
    try {
      const res = await fetch(`/api/corrales?id=${corralEditando.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Corral eliminado')
        setDeleteOpen(false)
        fetchCorrales()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const getOcupacion = (corral: Corral) => {
    const total = corral.stockBovinos + corral.stockEquinos
    const porcentaje = corral.capacidad > 0 ? (total / corral.capacidad) * 100 : 0
    return { total, porcentaje }
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-amber-600" />
                Gestión de Corrales
              </CardTitle>
              <CardDescription>
                Configure los corrales para el manejo de hacienda
              </CardDescription>
            </div>
            <Button onClick={handleNuevo} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Corral
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Warehouse className="w-8 h-8 animate-pulse mx-auto text-amber-500" />
            </div>
          ) : corrales.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay corrales configurados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Ocupación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corrales.map((corral) => {
                  const { total, porcentaje } = getOcupacion(corral)
                  return (
                    <TableRow key={corral.id}>
                      <TableCell className="font-medium">{corral.nombre}</TableCell>
                      <TableCell>{corral.capacidad} animales</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  porcentaje > 90 ? 'bg-red-500' : 
                                  porcentaje > 70 ? 'bg-amber-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(porcentaje, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm text-stone-500">{total}/{corral.capacidad}</span>
                          </div>
                          {corral.stockBovinos > 0 && (
                            <span className="text-xs text-stone-500">Bovinos: {corral.stockBovinos}</span>
                          )}
                          {corral.stockEquinos > 0 && (
                            <span className="text-xs text-stone-500 ml-2">Equinos: {corral.stockEquinos}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={corral.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {corral.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditar(corral)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEliminar(corral)}
                            className="text-red-500 hover:text-red-700"
                            disabled={total > 0}
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
            <DialogTitle>{corralEditando ? 'Editar Corral' : 'Nuevo Corral'}</DialogTitle>
            <DialogDescription>
              {corralEditando ? 'Modifique los datos del corral' : 'Complete los datos para crear un nuevo corral'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Corral 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Capacidad (cabezas)</Label>
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
              Eliminar Corral
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar el corral &quot;{corralEditando?.nombre}&quot;?
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

export default Corrales
