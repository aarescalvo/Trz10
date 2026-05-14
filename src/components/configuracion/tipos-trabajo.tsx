'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, RefreshCw, Briefcase, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'

interface TipoTrabajo {
  id: string
  codigo: string
  nombre: string
  descripcion?: string | null
  esDefault: boolean
  activo: boolean
  createdAt: string
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function TiposTrabajo({ operador }: { operador: Operador }) {
  const { toast } = useToast()
  const [tiposTrabajo, setTiposTrabajo] = useState<TipoTrabajo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingTipo, setEditingTipo] = useState<TipoTrabajo | null>(null)
  const [deletingTipo, setDeletingTipo] = useState<TipoTrabajo | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    esDefault: false
  })
  const [saving, setSaving] = useState(false)

  // Tipos de trabajo base predefinidos (T/MR es el default)
  const tiposTrabajoBase = [
    { codigo: 'T/LAMA', nombre: 'Tropa/Lama', descripcion: 'Corte tipo Lama', esDefault: false },
    { codigo: 'T/MR', nombre: 'Tropa/Media Res', descripcion: 'Corte tipo Media Res', esDefault: true },
    { codigo: 'T/JASLO', nombre: 'Tropa/Jaslo', descripcion: 'Corte tipo Jaslo', esDefault: false },
    { codigo: 'T/SQUARE', nombre: 'Tropa/Square', descripcion: 'Corte tipo Square', esDefault: false },
    { codigo: 'T/CHECO', nombre: 'Tropa/Checo', descripcion: 'Corte tipo Checo', esDefault: false },
  ]

  const fetchTiposTrabajo = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tipos-trabajo')
      const data = await response.json()
      if (data.success) {
        setTiposTrabajo(data.data)
      }
    } catch (error) {
      console.error('Error fetching tipos de trabajo:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los tipos de trabajo',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTiposTrabajo()
  }, [])

  const handleOpenCreate = () => {
    setEditingTipo(null)
    setFormData({ codigo: '', nombre: '', descripcion: '', esDefault: false })
    setDialogOpen(true)
  }

  const handleOpenEdit = (tipo: TipoTrabajo) => {
    setEditingTipo(tipo)
    setFormData({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      esDefault: tipo.esDefault
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.codigo || !formData.nombre) {
      toast({
        title: 'Error',
        description: 'Código y nombre son obligatorios',
        variant: 'destructive'
      })
      return
    }

    try {
      setSaving(true)
      const url = '/api/tipos-trabajo'
      const method = editingTipo ? 'PUT' : 'POST'
      const body = editingTipo
        ? { id: editingTipo.id, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: editingTipo ? 'Actualizado' : 'Creado',
          description: `Tipo de trabajo ${editingTipo ? 'actualizado' : 'creado'} correctamente`
        })
        setDialogOpen(false)
        fetchTiposTrabajo()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al guardar',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error saving tipo de trabajo:', error)
      toast({
        title: 'Error',
        description: 'Error al guardar el tipo de trabajo',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTipo) return

    try {
      const response = await fetch(`/api/tipos-trabajo?id=${deletingTipo.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Eliminado',
          description: 'Tipo de trabajo desactivado correctamente'
        })
        setDeleteDialogOpen(false)
        setDeletingTipo(null)
        fetchTiposTrabajo()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al eliminar',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error deleting tipo de trabajo:', error)
      toast({
        title: 'Error',
        description: 'Error al eliminar el tipo de trabajo',
        variant: 'destructive'
      })
    }
  }

  const handleCargarBase = async () => {
    try {
      let creados = 0
      for (const tipo of tiposTrabajoBase) {
        const exists = tiposTrabajo.find(t => t.codigo === tipo.codigo)
        if (!exists) {
          const response = await fetch('/api/tipos-trabajo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tipo)
          })
          const data = await response.json()
          if (data.success) creados++
        }
      }
      
      if (creados > 0) {
        toast({
          title: 'Tipos de trabajo cargados',
          description: `Se crearon ${creados} tipos de trabajo base`
        })
        fetchTiposTrabajo()
      } else {
        toast({
          title: 'Sin cambios',
          description: 'Todos los tipos de trabajo base ya existen'
        })
      }
    } catch (error) {
      console.error('Error loading base tipos de trabajo:', error)
      toast({
        title: 'Error',
        description: 'Error al cargar tipos de trabajo base',
        variant: 'destructive'
      })
    }
  }

  const filteredTipos = tiposTrabajo.filter(t =>
    t.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Tipos de Trabajo
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full sm:w-48"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchTiposTrabajo}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleCargarBase}>
              Cargar Base
            </Button>
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Nuevo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando tipos de trabajo...
          </div>
        ) : filteredTipos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay tipos de trabajo. Use "Cargar Base" para agregar los tipos predefinidos.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTipos.map((tipo) => (
                  <TableRow key={tipo.id}>
                    <TableCell className="font-mono">{tipo.codigo}</TableCell>
                    <TableCell className="font-medium">{tipo.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {tipo.descripcion || '-'}
                    </TableCell>
                    <TableCell>
                      {tipo.esDefault && (
                        <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tipo.activo ? 'default' : 'secondary'}>
                        {tipo.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(tipo)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingTipo(tipo)
                            setDeleteDialogOpen(true)
                          }}
                          disabled={tipo.esDefault}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>
              {editingTipo ? 'Editar Tipo de Trabajo' : 'Nuevo Tipo de Trabajo'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del tipo de trabajo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                placeholder="Ej: T/LAMA, T/MR"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre completo del tipo de trabajo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="esDefault"
                checked={formData.esDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, esDefault: checked as boolean })}
              />
              <Label htmlFor="esDefault" className="text-sm font-normal cursor-pointer">
                Establecer como tipo por defecto (solo puede haber uno)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar tipo de trabajo?</AlertDialogTitle>
            <AlertDialogDescription>
              El tipo de trabajo "{deletingTipo?.nombre}" será marcado como inactivo.
              Esta acción se puede revertir editando el tipo de trabajo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
