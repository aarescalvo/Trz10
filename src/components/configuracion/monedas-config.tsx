'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Coins, Star } from 'lucide-react'

interface Moneda {
  id: string
  codigo: string
  nombre: string
  simbolo: string
  esDefault: boolean
  activa: boolean
  createdAt: string
  _count?: {
    cotizaciones: number
  }
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function MonedasConfig({ operador }: { operador: Operador }) {
  const { toast } = useToast()
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>(null)
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    simbolo: '',
    esDefault: false,
    activa: true
  })

  useEffect(() => {
    loadMonedas()
  }, [])

  const loadMonedas = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/monedas')
      if (!response.ok) throw new Error('Error al cargar monedas')
      const data = await response.json()
      setMonedas(data)
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las monedas',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (moneda?: Moneda) => {
    if (moneda) {
      setSelectedMoneda(moneda)
      setFormData({
        codigo: moneda.codigo,
        nombre: moneda.nombre,
        simbolo: moneda.simbolo,
        esDefault: moneda.esDefault,
        activa: moneda.activa
      })
    } else {
      setSelectedMoneda(null)
      setFormData({
        codigo: '',
        nombre: '',
        simbolo: '',
        esDefault: false,
        activa: true
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      const url = '/api/monedas'
      const method = selectedMoneda ? 'PUT' : 'POST'
      const body = selectedMoneda
        ? { ...formData, id: selectedMoneda.id }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar moneda')
      }

      toast({
        title: selectedMoneda ? 'Actualizado' : 'Creado',
        description: `Moneda ${selectedMoneda ? 'actualizada' : 'creada'} correctamente`
      })

      setDialogOpen(false)
      loadMonedas()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedMoneda) return

    try {
      const response = await fetch(`/api/monedas?id=${selectedMoneda.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar moneda')
      }

      toast({
        title: 'Eliminado',
        description: 'Moneda eliminada correctamente'
      })

      setDeleteDialogOpen(false)
      loadMonedas()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleSetDefault = async (moneda: Moneda) => {
    try {
      const response = await fetch('/api/monedas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: moneda.id,
          esDefault: true,
          nombre: moneda.nombre,
          simbolo: moneda.simbolo,
          activa: moneda.activa
        })
      })

      if (!response.ok) throw new Error('Error al establecer moneda por defecto')

      toast({
        title: 'Actualizado',
        description: `${moneda.codigo} establecida como moneda por defecto`
      })

      loadMonedas()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo establecer la moneda por defecto',
        variant: 'destructive'
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Monedas
          </CardTitle>
          <Button onClick={() => handleOpenDialog()} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Moneda
          </Button>
        </div>
        <p className="text-sm text-stone-500">
          Configure las monedas disponibles en el sistema (ARS, USD, EUR)
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-stone-500">Cargando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Símbolo</TableHead>
                <TableHead>Cotizaciones</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monedas.map((moneda) => (
                <TableRow key={moneda.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {moneda.codigo}
                      {moneda.esDefault && (
                        <Badge variant="default" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{moneda.nombre}</TableCell>
                  <TableCell className="text-lg">{moneda.simbolo}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {moneda._count?.cotizaciones || 0} registros
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={moneda.activa ? 'default' : 'secondary'}>
                      {moneda.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!moneda.esDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(moneda)}
                          title="Establecer como default"
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(moneda)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {!moneda.esDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMoneda(moneda)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Dialog de edición/creación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>
              {selectedMoneda ? 'Editar Moneda' : 'Nueva Moneda'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  placeholder="USD"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  disabled={!!selectedMoneda}
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="simbolo">Símbolo</Label>
                <Input
                  id="simbolo"
                  placeholder="US$"
                  value={formData.simbolo}
                  onChange={(e) => setFormData({ ...formData, simbolo: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                placeholder="Dólar Estadounidense"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="esDefault"
                  checked={formData.esDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, esDefault: checked })}
                />
                <Label htmlFor="esDefault">Moneda por defecto</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="activa"
                  checked={formData.activa}
                  onCheckedChange={(checked) => setFormData({ ...formData, activa: checked })}
                />
                <Label htmlFor="activa">Activa</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {selectedMoneda ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar moneda?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea eliminar la moneda {selectedMoneda?.codigo}?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export default MonedasConfig
