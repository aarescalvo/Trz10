'use client'

import { useState, useEffect } from 'react'
import { Package, Plus, Edit, Trash2, Save, X, AlertTriangle, Beef } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const TIPOS_ROTULO = [
  { id: 'MEDIA_RES', label: 'Media Res' },
  { id: 'CUARTO', label: 'Cuarto' },
  { id: 'MENUDENCIA', label: 'Menudencia' },
  { id: 'PRODUCTO_TERMINADO_ENVASE_PRIMARIO', label: 'Envase Primario' },
  { id: 'PRODUCTO_TERMINADO_ENVASE_SECUNDARIO', label: 'Envase Secundario' },
  { id: 'PRODUCTO_TERMINADO_UN_ENVASE', label: 'Un Solo Envase' },
]

interface Producto {
  id: string
  codigo: string
  nombre: string
  nombreReportes?: string
  especie: string
  codigoTipificacion?: string
  codigoTipoTrabajo?: string
  codigoTransporte?: string
  codigoDestino?: string
  tara?: number
  diasConservacion?: number
  requiereTipificacion: boolean
  tipoRotulo?: string
  precio?: number
  temperaturaConservacion?: string
  apareceRendimiento: boolean
  apareceStock: boolean
  activo: boolean
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function Productos({ operador }: { operador: Operador }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null)
  const [especieActiva, setEspecieActiva] = useState<'BOVINO' | 'EQUINO'>('BOVINO')
  
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    nombreReportes: '',
    codigoTipificacion: '',
    codigoTipoTrabajo: '',
    codigoTransporte: '',
    codigoDestino: '',
    tara: 0,
    diasConservacion: 30,
    requiereTipificacion: false,
    tipoRotulo: 'MEDIA_RES',
    precio: 0,
    temperaturaConservacion: '-18°C a -20°C',
    apareceRendimiento: false,
    apareceStock: true
  })

  useEffect(() => {
    fetchProductos()
  }, [])

  const fetchProductos = async () => {
    try {
      const res = await fetch('/api/productos')
      const data = await res.json()
      if (data.success) {
        setProductos(data.data)
      }
    } catch (error) {
      console.error('Error fetching productos:', error)
    } finally {
      setLoading(false)
    }
  }

  const productosFiltrados = productos.filter(p => p.especie === especieActiva)

  const handleNuevo = () => {
    setProductoEditando(null)
    setFormData({
      codigo: '',
      nombre: '',
      nombreReportes: '',
      codigoTipificacion: '',
      codigoTipoTrabajo: '',
      codigoTransporte: '',
      codigoDestino: '',
      tara: 0,
      diasConservacion: 30,
      requiereTipificacion: false,
      tipoRotulo: 'MEDIA_RES',
      precio: 0,
      temperaturaConservacion: '-18°C a -20°C',
      apareceRendimiento: false,
      apareceStock: true
    })
    setDialogOpen(true)
  }

  const handleEditar = (producto: Producto) => {
    setProductoEditando(producto)
    setFormData({
      codigo: producto.codigo,
      nombre: producto.nombre,
      nombreReportes: producto.nombreReportes || '',
      codigoTipificacion: producto.codigoTipificacion || '',
      codigoTipoTrabajo: producto.codigoTipoTrabajo || '',
      codigoTransporte: producto.codigoTransporte || '',
      codigoDestino: producto.codigoDestino || '',
      tara: producto.tara || 0,
      diasConservacion: producto.diasConservacion || 30,
      requiereTipificacion: producto.requiereTipificacion,
      tipoRotulo: producto.tipoRotulo || 'MEDIA_RES',
      precio: producto.precio || 0,
      temperaturaConservacion: producto.temperaturaConservacion || '-18°C a -20°C',
      apareceRendimiento: producto.apareceRendimiento,
      apareceStock: producto.apareceStock
    })
    setDialogOpen(true)
  }

  const handleEliminar = (producto: Producto) => {
    setProductoEditando(producto)
    setDeleteOpen(true)
  }

  const handleGuardar = async () => {
    if (!formData.codigo || !formData.nombre) {
      toast.error('Complete código y nombre del producto')
      return
    }

    setSaving(true)
    try {
      const url = '/api/productos'
      const method = productoEditando ? 'PUT' : 'POST'
      const body = productoEditando 
        ? { ...formData, id: productoEditando.id }
        : { ...formData, especie: especieActiva }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        toast.success(productoEditando ? 'Producto actualizado' : 'Producto creado')
        setDialogOpen(false)
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActivo = async (producto: Producto) => {
    try {
      const res = await fetch('/api/productos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: producto.id, 
          activo: !producto.activo 
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(producto.activo ? 'Producto desactivado' : 'Producto activado')
        fetchProductos()
      }
    } catch (error) {
      toast.error('Error al actualizar')
    }
  }

  const handleConfirmarEliminar = async () => {
    if (!productoEditando) return

    setSaving(true)
    try {
      const res = await fetch(`/api/productos?id=${productoEditando.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Producto eliminado')
        setDeleteOpen(false)
        fetchProductos()
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
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            Gestión de Productos
          </CardTitle>
          <CardDescription>
            Productos separados por especie - IMPORTANTE: No mezclar especies
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={especieActiva} onValueChange={(v) => setEspecieActiva(v as 'BOVINO' | 'EQUINO')}>
            <div className="border-b px-4 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="BOVINO" className="flex items-center gap-2">
                  <Beef className="w-4 h-4" />
                  Bovinos
                </TabsTrigger>
                <TabsTrigger value="EQUINO" className="flex items-center gap-2">
                  <Beef className="w-4 h-4" />
                  Equinos
                </TabsTrigger>
              </TabsList>
            </div>

            {['BOVINO', 'EQUINO'].map((especie) => (
              <TabsContent key={especie} value={especie} className="mt-0">
                <div className="p-4 border-b flex items-center justify-between bg-stone-50">
                  <div>
                    <p className="font-medium">Productos {especie === 'BOVINO' ? 'Bovinos' : 'Equinos'}</p>
                    <p className="text-sm text-stone-500">
                      {productosFiltrados.filter(p => p.activo).length} productos activos
                    </p>
                  </div>
                  <Button onClick={handleNuevo} className="bg-amber-500 hover:bg-amber-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Producto
                  </Button>
                </div>

                {loading ? (
                  <div className="p-8 text-center">
                    <Package className="w-8 h-8 animate-pulse mx-auto text-amber-500" />
                  </div>
                ) : productosFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-stone-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay productos {especie.toLowerCase()}s configurados</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Rotulo</TableHead>
                        <TableHead>Conservación</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productosFiltrados.map((producto) => (
                        <TableRow key={producto.id} className={!producto.activo ? 'opacity-50' : ''}>
                          <TableCell className="font-mono">{producto.codigo}</TableCell>
                          <TableCell className="font-medium">{producto.nombre}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {TIPOS_ROTULO.find(t => t.id === producto.tipoRotulo)?.label || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{producto.diasConservacion} días</div>
                              <div className="text-stone-500">{producto.temperaturaConservacion}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={producto.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {producto.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEditar(producto)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <div
                                onClick={() => handleToggleActivo(producto)}
                                className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
                              >
                                <Switch checked={producto.activo} />
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEliminar(producto)}
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
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Warning Banner */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <p className="font-medium text-red-700">Importante: Separación por Especie</p>
            <p className="text-sm text-red-600">
              Las tablas de productos están separadas por especie. Un corte puede tener el mismo nombre 
              en ambas especies, pero son productos DIFERENTES. Esto es básico para la trazabilidad.
            </p>
          </div>
        </div>
      </div>

      {/* Dialog Nuevo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" maximizable>
          <DialogHeader>
            <DialogTitle>
              {productoEditando ? 'Editar Producto' : `Nuevo Producto ${especieActiva === 'BOVINO' ? 'Bovino' : 'Equino'}`}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del producto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código (3 dígitos) *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.slice(0, 3) })}
                  placeholder="001"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Media Res"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nombre para Reportes</Label>
              <Input
                value={formData.nombreReportes}
                onChange={(e) => setFormData({ ...formData, nombreReportes: e.target.value })}
                placeholder="Nombre abreviado para reportes"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tipificación</Label>
                <Input
                  value={formData.codigoTipificacion}
                  onChange={(e) => setFormData({ ...formData, codigoTipificacion: e.target.value })}
                  placeholder=".00"
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo Trabajo</Label>
                <Input
                  value={formData.codigoTipoTrabajo}
                  onChange={(e) => setFormData({ ...formData, codigoTipoTrabajo: e.target.value })}
                  placeholder="0"
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Transporte</Label>
                <Input
                  value={formData.codigoTransporte}
                  onChange={(e) => setFormData({ ...formData, codigoTransporte: e.target.value })}
                  placeholder="0"
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Destino</Label>
                <Input
                  value={formData.codigoDestino}
                  onChange={(e) => setFormData({ ...formData, codigoDestino: e.target.value })}
                  placeholder=".00"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tara (kg)</Label>
                <Input
                  type="number"
                  value={formData.tara}
                  onChange={(e) => setFormData({ ...formData, tara: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Días Conservación</Label>
                <Input
                  type="number"
                  value={formData.diasConservacion}
                  onChange={(e) => setFormData({ ...formData, diasConservacion: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input
                  type="number"
                  value={formData.precio}
                  onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Rótulo</Label>
                <Select value={formData.tipoRotulo} onValueChange={(v) => setFormData({ ...formData, tipoRotulo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ROTULO.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperatura</Label>
                <Input
                  value={formData.temperaturaConservacion}
                  onChange={(e) => setFormData({ ...formData, temperaturaConservacion: e.target.value })}
                  placeholder="-18°C a -20°C"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requiereTipificacion}
                  onChange={(e) => setFormData({ ...formData, requiereTipificacion: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Requiere Tipificación</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.apareceRendimiento}
                  onChange={(e) => setFormData({ ...formData, apareceRendimiento: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Aparece en Rendimiento</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.apareceStock}
                  onChange={(e) => setFormData({ ...formData, apareceStock: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Aparece en Stock</span>
              </label>
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
              Eliminar Producto
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar el producto &quot;{productoEditando?.nombre}&quot;?
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

export default Productos
