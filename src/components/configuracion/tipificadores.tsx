'use client'

import { useState, useEffect } from 'react'
import { UserCheck, Plus, Edit, Trash2, Save, X, AlertTriangle, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

interface Tipificador {
  id: string
  nombre: string
  apellido: string
  numero?: string
  matricula: string
  activo: boolean
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function Tipificadores({ operador }: { operador: Operador }) {
  const [tipificadores, setTipificadores] = useState<Tipificador[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tipificadorEditando, setTipificadorEditando] = useState<Tipificador | null>(null)
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    numero: '',
    matricula: ''
  })

  useEffect(() => {
    fetchTipificadores()
  }, [])

  const fetchTipificadores = async () => {
    try {
      const res = await fetch('/api/tipificadores')
      const data = await res.json()
      if (data.success) {
        setTipificadores(data.data)
      }
    } catch (error) {
      console.error('Error fetching tipificadores:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNuevo = () => {
    setTipificadorEditando(null)
    setFormData({ nombre: '', apellido: '', numero: '', matricula: '' })
    setDialogOpen(true)
  }

  const handleEditar = (tipificador: Tipificador) => {
    setTipificadorEditando(tipificador)
    setFormData({
      nombre: tipificador.nombre,
      apellido: tipificador.apellido,
      numero: tipificador.numero || '',
      matricula: tipificador.matricula
    })
    setDialogOpen(true)
  }

  const handleEliminar = (tipificador: Tipificador) => {
    setTipificadorEditando(tipificador)
    setDeleteOpen(true)
  }

  const handleGuardar = async () => {
    if (!formData.nombre || !formData.apellido || !formData.matricula) {
      toast.error('Complete nombre, apellido y matrícula')
      return
    }

    setSaving(true)
    try {
      const url = '/api/tipificadores'
      const method = tipificadorEditando ? 'PUT' : 'POST'
      const body = tipificadorEditando 
        ? { ...formData, id: tipificadorEditando.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        toast.success(tipificadorEditando ? 'Tipificador actualizado' : 'Tipificador creado')
        setDialogOpen(false)
        fetchTipificadores()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActivo = async (tipificador: Tipificador) => {
    try {
      const res = await fetch('/api/tipificadores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: tipificador.id, 
          activo: !tipificador.activo 
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(tipificador.activo ? 'Tipificador desactivado' : 'Tipificador activado')
        fetchTipificadores()
      }
    } catch (error) {
      toast.error('Error al actualizar')
    }
  }

  const handleConfirmarEliminar = async () => {
    if (!tipificadorEditando) return

    setSaving(true)
    try {
      const res = await fetch(`/api/tipificadores?id=${tipificadorEditando.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Tipificador eliminado')
        setDeleteOpen(false)
        fetchTipificadores()
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
                <UserCheck className="w-5 h-5 text-amber-600" />
                Gestión de Tipificadores
              </CardTitle>
              <CardDescription>
                Personal autorizado para tipificación de reses
              </CardDescription>
            </div>
            <Button onClick={handleNuevo} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Tipificador
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <UserCheck className="w-8 h-8 animate-pulse mx-auto text-amber-500" />
            </div>
          ) : tipificadores.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay tipificadores registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead>N° Interno</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipificadores.map((tipificador) => (
                  <TableRow key={tipificador.id} className={!tipificador.activo ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      {tipificador.nombre} {tipificador.apellido}
                    </TableCell>
                    <TableCell>{tipificador.numero || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span className="font-mono">{tipificador.matricula}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={tipificador.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {tipificador.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditar(tipificador)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <div
                          onClick={() => handleToggleActivo(tipificador)}
                          className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
                        >
                          <Switch checked={tipificador.activo} />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEliminar(tipificador)}
                          className="text-red-500 hover:text-red-700"
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
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>{tipificadorEditando ? 'Editar Tipificador' : 'Nuevo Tipificador'}</DialogTitle>
            <DialogDescription>
              {tipificadorEditando ? 'Modifique los datos del tipificador' : 'Complete los datos para registrar un nuevo tipificador'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido *</Label>
                <Input
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  placeholder="Apellido"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número Interno</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label>Matrícula *</Label>
                <Input
                  value={formData.matricula}
                  onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                  placeholder="N° de matrícula"
                />
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                La matrícula es el número que aparecerá en los rótulos de media res.
              </p>
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
              Eliminar Tipificador
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar al tipificador &quot;{tipificadorEditando?.nombre} {tipificadorEditando?.apellido}&quot;?
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

export default Tipificadores
