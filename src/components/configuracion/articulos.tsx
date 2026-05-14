'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, RefreshCw, Package, Upload } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface Articulo {
  id: string
  codigo: string
  nombre: string
  categoria?: string | null
  especie?: string | null
  observaciones?: string | null
  activo: boolean
  createdAt: string
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

const CATEGORIAS = [
  { value: 'CORTE', label: 'Corte' },
  { value: 'MENUDENCIA', label: 'Menudencia' },
  { value: 'PRODUCTO_PET', label: 'Producto PET' },
  { value: 'MEDIA_RES', label: 'Media Res' },
]

const ESPECIES = [
  { value: 'BOVINO', label: 'Bovino' },
  { value: 'EQUINO', label: 'Equino' },
]

export function Articulos({ operador }: { operador: Operador }) {
  const { toast } = useToast()
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<string>('todos')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingArticulo, setEditingArticulo] = useState<Articulo | null>(null)
  const [deletingArticulo, setDeletingArticulo] = useState<Articulo | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    categoria: '',
    especie: '',
    observaciones: ''
  })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  const fetchArticulos = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filtroActivo === 'activos') {
        params.append('activo', 'true')
      }
      
      const response = await fetch(`/api/articulos?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setArticulos(data.data)
      }
    } catch (error) {
      console.error('Error fetching articulos:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los articulos',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticulos()
  }, [filtroActivo])

  const handleOpenCreate = () => {
    setEditingArticulo(null)
    setFormData({ codigo: '', nombre: '', categoria: '', especie: '', observaciones: '' })
    setDialogOpen(true)
  }

  const handleOpenEdit = (articulo: Articulo) => {
    setEditingArticulo(articulo)
    setFormData({
      codigo: articulo.codigo,
      nombre: articulo.nombre,
      categoria: articulo.categoria || '',
      especie: articulo.especie || '',
      observaciones: articulo.observaciones || ''
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.codigo) {
      toast({
        title: 'Error',
        description: 'El código es obligatorio',
        variant: 'destructive'
      })
      return
    }
    
    if (!formData.nombre) {
      toast({
        title: 'Error',
        description: 'El nombre es obligatorio',
        variant: 'destructive'
      })
      return
    }

    try {
      setSaving(true)
      const url = '/api/articulos'
      const method = editingArticulo ? 'PUT' : 'POST'
      const body = editingArticulo
        ? { 
            id: editingArticulo.id, 
            codigo: formData.codigo,
            nombre: formData.nombre,
            categoria: formData.categoria || null,
            especie: formData.especie || null,
            observaciones: formData.observaciones || null
          }
        : { 
            codigo: formData.codigo,
            nombre: formData.nombre,
            categoria: formData.categoria || null,
            especie: formData.especie || null,
            observaciones: formData.observaciones || null
          }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: editingArticulo ? 'Actualizado' : 'Creado',
          description: `Articulo ${editingArticulo ? 'actualizado' : 'creado'} correctamente`
        })
        setDialogOpen(false)
        fetchArticulos()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al guardar',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error saving articulo:', error)
      toast({
        title: 'Error',
        description: 'Error al guardar el articulo',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingArticulo) return

    try {
      const response = await fetch(`/api/articulos?id=${deletingArticulo.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Eliminado',
          description: 'Articulo desactivado correctamente'
        })
        setDeleteDialogOpen(false)
        setDeletingArticulo(null)
        fetchArticulos()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al eliminar',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error deleting articulo:', error)
      toast({
        title: 'Error',
        description: 'Error al eliminar el articulo',
        variant: 'destructive'
      })
    }
  }

  const handleCargarBase = async () => {
    try {
      setImporting(true)
      
      const response = await fetch('/api/articulos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: 'Importación completada',
          description: `Importados: ${data.data.importados}, Actualizados: ${data.data.actualizados}, Errores: ${data.data.errores}`
        })
        fetchArticulos()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al importar',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error importing articulos:', error)
      toast({
        title: 'Error',
        description: 'Error al importar articulos',
        variant: 'destructive'
      })
    } finally {
      setImporting(false)
    }
  }

  const filteredArticulos = articulos.filter(a =>
    a.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Articulos
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
            <Select value={filtroActivo} onValueChange={setFiltroActivo}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activos">Activos</SelectItem>
                <SelectItem value="inactivos">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchArticulos}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCargarBase}
              disabled={importing}
            >
              <Upload className="w-4 h-4 mr-1" />
              {importing ? 'Importando...' : 'Cargar Base'}
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
            Cargando articulos...
          </div>
        ) : filteredArticulos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay articulos. Use "Cargar Base" para importar desde el archivo CODIGO.xlsx.
          </div>
        ) : (
          <div className="rounded-md border max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-28">Categoria</TableHead>
                  <TableHead className="w-24">Especie</TableHead>
                  <TableHead className="w-24">Estado</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticulos.map((articulo) => (
                  <TableRow key={articulo.id}>
                    <TableCell className="font-mono">{articulo.codigo}</TableCell>
                    <TableCell>{articulo.nombre}</TableCell>
                    <TableCell>
                      {articulo.categoria && (
                        <Badge variant="outline">{articulo.categoria}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {articulo.especie && (
                        <Badge variant="secondary">{articulo.especie}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={articulo.activo ? 'default' : 'secondary'}>
                        {articulo.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(articulo)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingArticulo(articulo)
                            setDeleteDialogOpen(true)
                          }}
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
              {editingArticulo ? 'Editar Articulo' : 'Nuevo Articulo'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del articulo. El codigo debe tener 3 digitos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Codigo *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder=".001, .002, etc."
              />
              <p className="text-xs text-muted-foreground">
                Formato: 3 digitos con punto (ej: .001, .002)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre del articulo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select 
                value={formData.categoria} 
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="especie">Especie</Label>
              <Select 
                value={formData.especie} 
                onValueChange={(value) => setFormData({ ...formData, especie: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar especie" />
                </SelectTrigger>
                <SelectContent>
                  {ESPECIES.map((esp) => (
                    <SelectItem key={esp.value} value={esp.value}>
                      {esp.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Input
                id="observaciones"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales"
              />
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
            <AlertDialogTitle>¿Desactivar articulo?</AlertDialogTitle>
            <AlertDialogDescription>
              El articulo "{deletingArticulo?.nombre}" sera marcado como inactivo.
              Esta accion se puede revertir editando el articulo.
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
