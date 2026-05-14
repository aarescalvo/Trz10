'use client'

import { useState, useEffect } from 'react'
import { Truck, Plus, Edit, Trash2, Save, X, AlertTriangle, Phone, MapPin, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

interface TransportistaItem {
  id: string
  nombre: string
  cuit?: string
  direccion?: string
  telefono?: string
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function Transportistas({ operador }: { operador: Operador }) {
  const [transportistas, setTransportistas] = useState<TransportistaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editando, setEditando] = useState<TransportistaItem | null>(null)
  
  const [formData, setFormData] = useState({
    nombre: '',
    cuit: '',
    direccion: '',
    telefono: ''
  })

  useEffect(() => {
    fetchTransportistas()
  }, [])

  const fetchTransportistas = async () => {
    try {
      const res = await fetch('/api/transportistas')
      const data = await res.json()
      if (data.success) {
        setTransportistas(data.data)
      }
    } catch (error) {
      console.error('Error fetching transportistas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNuevo = () => {
    setEditando(null)
    setFormData({ nombre: '', cuit: '', direccion: '', telefono: '' })
    setDialogOpen(true)
  }

  const handleEditar = (t: TransportistaItem) => {
    setEditando(t)
    setFormData({
      nombre: t.nombre,
      cuit: t.cuit || '',
      direccion: t.direccion || '',
      telefono: t.telefono || ''
    })
    setDialogOpen(true)
  }

  const handleEliminar = (t: TransportistaItem) => {
    setEditando(t)
    setDeleteOpen(true)
  }

  const handleGuardar = async () => {
    if (!formData.nombre) {
      toast.error('Ingrese el nombre del transportista')
      return
    }

    setSaving(true)
    try {
      const url = '/api/transportistas'
      const method = editando ? 'PUT' : 'POST'
      const body = editando ? { ...formData, id: editando.id } : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        toast.success(editando ? 'Transportista actualizado' : 'Transportista creado')
        setDialogOpen(false)
        fetchTransportistas()
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
    if (!editando) return

    setSaving(true)
    try {
      const res = await fetch(`/api/transportistas?id=${editando.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Transportista eliminado')
        setDeleteOpen(false)
        fetchTransportistas()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                Gestión de Transportistas
              </CardTitle>
              <CardDescription>
                Empresas de transporte para pesaje de camiones
              </CardDescription>
            </div>
            <Button onClick={handleNuevo} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Transportista
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Truck className="w-8 h-8 animate-pulse mx-auto text-amber-500" />
            </div>
          ) : transportistas.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay transportistas registrados</p>
              <Button onClick={handleNuevo} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Transportista
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transportistas.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nombre}</TableCell>
                    <TableCell className="font-mono">{t.cuit || '-'}</TableCell>
                    <TableCell>{t.direccion || '-'}</TableCell>
                    <TableCell>{t.telefono || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditar(t)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEliminar(t)} className="text-red-500 hover:text-red-700">
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
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Transportista' : 'Nuevo Transportista'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del transportista
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre / Razón Social *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Transporte Ejemplo SRL"
              />
            </div>
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                placeholder="20-12345678-9"
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Dirección del transportista"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="011-1234-5678"
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
              Eliminar Transportista
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar a &quot;{editando?.nombre}&quot;?
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

export default Transportistas
