'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, RefreshCw, TrendingUp, TrendingDown, Clock, Loader2 } from 'lucide-react'

interface Moneda {
  id: string
  codigo: string
  nombre: string
  simbolo: string
  esDefault: boolean
}

interface Cotizacion {
  id: string
  monedaId: string
  moneda?: Moneda
  fecha: string
  compra: number
  venta: number
  fuente: string | null
}

interface CotizacionActual {
  moneda: Moneda
  cotizacion: Cotizacion | null
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function CotizacionesConfig({ operador }: { operador: Operador }) {
  const { toast } = useToast()
  const [cotizacionesActuales, setCotizacionesActuales] = useState<CotizacionActual[]>([])
  const [historial, setHistorial] = useState<Cotizacion[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBCRA, setLoadingBCRA] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    monedaId: '',
    compra: '',
    venta: '',
    fuente: 'MANUAL'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Cargar cotizaciones actuales
      const actualesResponse = await fetch('/api/cotizaciones/actual')
      if (actualesResponse.ok) {
        const data = await actualesResponse.json()
        setCotizacionesActuales(Array.isArray(data) ? data : [data])
        
        // Extraer monedas de las cotizaciones actuales
        const monedasData = (Array.isArray(data) ? data : [data])
          .filter((c: CotizacionActual) => c.moneda)
          .map((c: CotizacionActual) => c.moneda)
        setMonedas(monedasData)
      }

      // Cargar historial
      const historialResponse = await fetch('/api/cotizaciones?limite=20')
      if (historialResponse.ok) {
        const data = await historialResponse.json()
        setHistorial(data)
      }
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las cotizaciones',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = () => {
    setFormData({
      monedaId: monedas.find(m => m.codigo === 'USD')?.id || monedas[0]?.id || '',
      compra: '',
      venta: '',
      fuente: 'MANUAL'
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      if (!formData.monedaId || !formData.compra || !formData.venta) {
        toast({
          title: 'Error',
          description: 'Todos los campos son requeridos',
          variant: 'destructive'
        })
        return
      }

      const response = await fetch('/api/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monedaId: formData.monedaId,
          compra: parseFloat(formData.compra),
          venta: parseFloat(formData.venta),
          fuente: formData.fuente
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar cotización')
      }

      toast({
        title: 'Guardado',
        description: 'Cotización guardada correctamente'
      })

      setDialogOpen(false)
      loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleActualizarBCRA = async () => {
    try {
      setLoadingBCRA(true)
      
      const response = await fetch('/api/cotizaciones/actual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fuente: 'BCRA' })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al obtener cotización del BCRA')
      }

      toast({
        title: 'Actualizado',
        description: 'Cotización actualizada desde BCRA'
      })

      loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoadingBCRA(false)
    }
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto)
  }

  return (
    <div className="space-y-6">
      {/* Cotizaciones Actuales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Cotizaciones Actuales
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleActualizarBCRA}
                disabled={loadingBCRA}
              >
                {loadingBCRA ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Actualizar BCRA
              </Button>
              <Button onClick={handleOpenDialog} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Cotización
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-stone-500">Cargando...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cotizacionesActuales.map((item) => (
                <Card key={item.moneda?.id} className="border-2 border-stone-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-2xl font-bold">{item.moneda?.simbolo}</div>
                        <div className="text-sm text-stone-500">{item.moneda?.nombre}</div>
                      </div>
                      <Badge variant={item.moneda?.esDefault ? 'default' : 'outline'}>
                        {item.moneda?.codigo}
                      </Badge>
                    </div>
                    
                    {item.cotizacion ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-stone-500">Compra</span>
                          <span className="text-lg font-semibold text-green-600 flex items-center gap-1">
                            <TrendingDown className="w-4 h-4" />
                            ${formatearMonto(item.cotizacion.compra)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-stone-500">Venta</span>
                          <span className="text-lg font-semibold text-red-600 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            ${formatearMonto(item.cotizacion.venta)}
                          </span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-xs text-stone-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatearFecha(item.cotizacion.fecha)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {item.cotizacion.fuente || 'MANUAL'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-stone-400">
                        Sin cotización registrada
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de Cotizaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Historial de Cotizaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-stone-500">Cargando...</div>
          ) : historial.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              No hay cotizaciones registradas
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead className="text-right">Compra</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                    <TableHead>Fuente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((cot) => (
                    <TableRow key={cot.id}>
                      <TableCell className="text-sm">
                        {formatearFecha(cot.fecha)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cot.moneda?.simbolo}</span>
                          <span className="text-xs text-stone-500">{cot.moneda?.codigo}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ${formatearMonto(cot.compra)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        ${formatearMonto(cot.venta)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {cot.fuente || 'MANUAL'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de nueva cotización */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>Nueva Cotización</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="moneda">Moneda</Label>
              <Select
                value={formData.monedaId}
                onValueChange={(value) => setFormData({ ...formData, monedaId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar moneda" />
                </SelectTrigger>
                <SelectContent>
                  {monedas.filter(m => m.codigo !== 'ARS').map((moneda) => (
                    <SelectItem key={moneda.id} value={moneda.id}>
                      {moneda.simbolo} - {moneda.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="compra">Precio Compra</Label>
                <Input
                  id="compra"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.compra}
                  onChange={(e) => setFormData({ ...formData, compra: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venta">Precio Venta</Label>
                <Input
                  id="venta"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.venta}
                  onChange={(e) => setFormData({ ...formData, venta: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fuente">Fuente</Label>
              <Select
                value={formData.fuente}
                onValueChange={(value) => setFormData({ ...formData, fuente: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="BCRA">BCRA</SelectItem>
                  <SelectItem value="BANCO">Banco</SelectItem>
                  <SelectItem value="MAYORISTA">Mayorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CotizacionesConfig
