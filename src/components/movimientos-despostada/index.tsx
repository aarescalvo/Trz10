'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { 
  RefreshCw, Scissors, Loader2, Plus, Package, Trash2,
  Bone, Droplets, Scale
} from 'lucide-react'
import { TextoEditable, EditableBlock, useEditor } from '@/components/ui/editable-screen'

interface Operador {
  id: string
  nombre: string
  rol: string
}

interface Movimiento {
  id: string
  loteId: string
  lote?: { numero: number }
  productoId?: string
  producto?: { codigo: string; nombre: string }
  productoNombre?: string
  pesoBruto: number
  pesoOriginal?: number
  pesoNeto?: number
  pesoDesperdicio?: number
  destino?: 'PRODUCCION' | 'RECORTE' | 'DESECHO'
  tipo: 'CORTE' | 'HUESO' | 'GRASA' | 'MERMA' | 'DESECHO'
  causa?: string
  operador?: { nombre: string }
  observaciones?: string
  createdAt: string
}

interface Lote {
  id: string
  numero: number
  estado: string
  totalKg?: number
  fecha?: string
}

interface Props {
  operador: Operador
}

const TIPOS_MOVIMIENTO = [
  { id: 'CORTE', label: 'Corte', icon: Scissors, color: 'bg-blue-100 text-blue-700' },
  { id: 'HUESO', label: 'Hueso', icon: Bone, color: 'bg-stone-100 text-stone-700' },
  { id: 'GRASA', label: 'Grasa', icon: Droplets, color: 'bg-yellow-100 text-yellow-700' },
  { id: 'MERMA', label: 'Merma', icon: Trash2, color: 'bg-red-100 text-red-700' },
  { id: 'DESECHO', label: 'Desecho', icon: Trash2, color: 'bg-gray-100 text-gray-700' },
]

const DESTINOS = [
  { id: 'PRODUCCION', label: 'Continúa Producción', color: 'bg-green-100 text-green-700' },
  { id: 'RECORTE', label: 'Va a Recorte', color: 'bg-amber-100 text-amber-700' },
  { id: 'DESECHO', label: 'Se Desecha', color: 'bg-red-100 text-red-700' },
]

export function MovimientosDespostadaModule({ operador }: Props) {
  const { editMode, getTexto } = useEditor()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('registro')
  
  // Filtros
  const [filtroLote, setFiltroLote] = useState('TODOS')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  
  // Form state - Corte
  const [loteId, setLoteId] = useState('')
  const [nombreCorte, setNombreCorte] = useState('')
  const [pesoOriginal, setPesoOriginal] = useState('')
  const [pesoLimpio, setPesoLimpio] = useState('')
  const [destino, setDestino] = useState<'PRODUCCION' | 'RECORTE' | 'DESECHO' | ''>('')
  const [causa, setCausa] = useState('')
  const [observaciones, setObservaciones] = useState('')
  
  // Form state - Hueso/Grasa
  const [tipoHuesoGrasa, setTipoHuesoGrasa] = useState<'HUESO' | 'GRASA'>('HUESO')
  const [pesoHuesoGrasa, setPesoHuesoGrasa] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [movRes, lotesRes] = await Promise.all([
        fetch('/api/movimientos-despostada'),
        fetch('/api/lotes-despostada?estado=ABIERTO')
      ])
      
      const movData = await movRes.json()
      const lotesData = await lotesRes.json()
      
      if (movData.success) {
        setMovimientos(movData.data)
      }
      
      if (lotesData.success) {
        setLotes(lotesData.data)
        if (lotesData.data.length === 1) {
          setLoteId(lotesData.data[0].id)
        }
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrarCorte = async () => {
    if (!loteId || !pesoOriginal || parseFloat(pesoOriginal) <= 0) {
      toast.error('Complete los campos obligatorios')
      return
    }

    setSaving(true)
    try {
      const pesoOrig = parseFloat(pesoOriginal)
      const pesoLimp = pesoLimpio ? parseFloat(pesoLimpio) : null
      const desperdicio = pesoLimp ? pesoOrig - pesoLimp : null
      
      const res = await fetch('/api/movimientos-despostada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          productoNombre: nombreCorte || null,
          pesoBruto: pesoOrig,
          pesoNeto: pesoLimp || pesoOrig,
          pesoDesperdicio: desperdicio,
          destino: destino || null,
          tipo: 'CORTE',
          causa: causa || null,
          observaciones: observaciones || null,
          operadorId: operador.id
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success('Corte registrado correctamente')
        setNombreCorte('')
        setPesoOriginal('')
        setPesoLimpio('')
        setDestino('')
        setCausa('')
        setObservaciones('')
        fetchData()
      } else {
        toast.error(data.error || 'Error al registrar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al registrar corte')
    } finally {
      setSaving(false)
    }
  }

  const handleRegistrarHuesoGrasa = async () => {
    if (!loteId || !pesoHuesoGrasa || parseFloat(pesoHuesoGrasa) <= 0) {
      toast.error('Ingrese el peso')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/movimientos-despostada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          pesoBruto: parseFloat(pesoHuesoGrasa),
          tipo: tipoHuesoGrasa,
          destino: 'DESECHO',
          operadorId: operador.id
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success(`${tipoHuesoGrasa === 'HUESO' ? 'Hueso' : 'Grasa'} registrado: ${pesoHuesoGrasa} kg`)
        setPesoHuesoGrasa('')
        fetchData()
      } else {
        toast.error(data.error || 'Error al registrar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al registrar')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return
    
    try {
      const res = await fetch(`/api/movimientos-despostada?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (data.success) {
        toast.success('Registro eliminado')
        fetchData()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error al eliminar')
    }
  }

  const getTipoBadge = (tipo: string) => {
    const info = TIPOS_MOVIMIENTO.find(t => t.id === tipo)
    return (
      <Badge className={info?.color || 'bg-stone-100'}>
        {info?.label || tipo}
      </Badge>
    )
  }

  const getDestinoBadge = (dest: string | undefined) => {
    if (!dest) return <span className="text-stone-400">-</span>
    const info = DESTINOS.find(d => d.id === dest)
    return (
      <Badge className={info?.color || 'bg-stone-100'}>
        {info?.label || dest}
      </Badge>
    )
  }

  // Stats
  const totalCortes = movimientos.filter(m => m.tipo === 'CORTE')
  const totalHuesos = movimientos.filter(m => m.tipo === 'HUESO')
  const totalGrasas = movimientos.filter(m => m.tipo === 'GRASA')
  const kgCortes = totalCortes.reduce((a, m) => a + (m.pesoOriginal || 0), 0)
  const kgHuesos = totalHuesos.reduce((a, m) => a + (m.pesoOriginal || 0), 0)
  const kgGrasas = totalGrasas.reduce((a, m) => a + (m.pesoOriginal || 0), 0)

  // Filtrar movimientos
  const movimientosFiltrados = movimientos.filter(m => {
    if (filtroLote !== 'TODOS' && m.loteId !== filtroLote) return false
    if (filtroTipo !== 'TODOS' && m.tipo !== filtroTipo) return false
    return true
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
              <Scissors className="w-8 h-8 text-amber-500" />
              Movimientos de Despostada
            </h1>
            <p className="text-stone-500 mt-1">
              Registro de cortes, huesos, grasas y mermas
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Actualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 uppercase">Cortes</p>
              <p className="text-3xl font-bold text-blue-600">{totalCortes.length}</p>
              <p className="text-xs text-stone-400">{kgCortes.toLocaleString()} kg</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 uppercase">Huesos</p>
              <p className="text-3xl font-bold text-stone-600">{totalHuesos.length}</p>
              <p className="text-xs text-stone-400">{kgHuesos.toLocaleString()} kg</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 uppercase">Grasas</p>
              <p className="text-3xl font-bold text-yellow-600">{totalGrasas.length}</p>
              <p className="text-xs text-stone-400">{kgGrasas.toLocaleString()} kg</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 uppercase">Total Mermas</p>
              <p className="text-3xl font-bold text-red-600">{(kgHuesos + kgGrasas).toLocaleString()}</p>
              <p className="text-xs text-stone-400">kg</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 uppercase">Lotes Abiertos</p>
              <p className="text-3xl font-bold text-amber-600">{lotes.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="registro">Registro de Cortes</TabsTrigger>
            <TabsTrigger value="huesos-grasas">Huesos y Grasas</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          {/* Tab: Registro de Cortes */}
          <TabsContent value="registro" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-amber-500" />
                  Nuevo Corte
                </CardTitle>
                <CardDescription>
                  Registre el corte, peso original, limpieza y destino
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Lote */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Lote *</Label>
                    <Select value={loteId} onValueChange={setLoteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {lotes.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            Lote {l.numero} - {l.totalKg?.toLocaleString() || 0} kg
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del Corte</Label>
                    <Input
                      value={nombreCorte}
                      onChange={(e) => setNombreCorte(e.target.value)}
                      placeholder="ej: Nalga, Bola, Cuadril"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso Original (kg) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={pesoOriginal}
                      onChange={(e) => setPesoOriginal(e.target.value)}
                      placeholder="0.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso Limpio (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={pesoLimpio}
                      onChange={(e) => {
                        setPesoLimpio(e.target.value)
                        // Auto-calcular desperdicio
                        if (pesoOriginal && e.target.value) {
                          const des = parseFloat(pesoOriginal) - parseFloat(e.target.value)
                          if (des > 0) {
                            // Mostrar el desperdicio calculado
                          }
                        }
                      }}
                      placeholder="Peso después de limpieza"
                    />
                  </div>
                </div>

                {/* Destino y Causa */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Destino</Label>
                    <Select value={destino} onValueChange={(v: any) => setDestino(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {DESTINOS.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Causa (si es desperdicio)</Label>
                    <Input
                      value={causa}
                      onChange={(e) => setCausa(e.target.value)}
                      placeholder="Motivo del desperdicio"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Input
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Notas adicionales"
                    />
                  </div>
                </div>

                {/* Resumen del corte */}
                {pesoOriginal && pesoLimpio && (
                  <div className="p-4 bg-stone-50 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-stone-500">Original</p>
                        <p className="text-xl font-bold text-stone-700">{parseFloat(pesoOriginal).toFixed(1)} kg</p>
                      </div>
                      <div>
                        <p className="text-sm text-stone-500">Limpio</p>
                        <p className="text-xl font-bold text-green-600">{parseFloat(pesoLimpio).toFixed(1)} kg</p>
                      </div>
                      <div>
                        <p className="text-sm text-stone-500">Desperdicio</p>
                        <p className="text-xl font-bold text-red-600">
                          {(parseFloat(pesoOriginal) - parseFloat(pesoLimpio)).toFixed(1)} kg
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleRegistrarCorte}
                  className="w-full bg-amber-500 hover:bg-amber-600"
                  disabled={saving || !loteId || !pesoOriginal}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Registrar Corte
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Huesos y Grasas */}
          <TabsContent value="huesos-grasas" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Bone className="w-5 h-5 text-amber-500" />
                  Registro de Huesos y Grasas
                </CardTitle>
                <CardDescription>
                  Registre los huesos y grasas del lote
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Lote *</Label>
                    <Select value={loteId} onValueChange={setLoteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {lotes.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            Lote {l.numero}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={tipoHuesoGrasa === 'HUESO' ? 'default' : 'outline'}
                        className={tipoHuesoGrasa === 'HUESO' ? 'bg-stone-700' : ''}
                        onClick={() => setTipoHuesoGrasa('HUESO')}
                      >
                        <Bone className="w-4 h-4 mr-2" />
                        Hueso
                      </Button>
                      <Button
                        variant={tipoHuesoGrasa === 'GRASA' ? 'default' : 'outline'}
                        className={tipoHuesoGrasa === 'GRASA' ? 'bg-yellow-600' : ''}
                        onClick={() => setTipoHuesoGrasa('GRASA')}
                      >
                        <Droplets className="w-4 h-4 mr-2" />
                        Grasa
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Peso (kg) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={pesoHuesoGrasa}
                      onChange={(e) => setPesoHuesoGrasa(e.target.value)}
                      placeholder="0.0"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleRegistrarHuesoGrasa}
                      className="w-full bg-amber-500 hover:bg-amber-600"
                      disabled={saving || !loteId || !pesoHuesoGrasa}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Registrar
                    </Button>
                  </div>
                </div>

                {/* Resumen del lote seleccionado */}
                {loteId && (
                  <div className="p-4 bg-stone-50 rounded-lg">
                    {(() => {
                      const lote = lotes.find(l => l.id === loteId)
                      if (!lote) return null
                      const huesosLote = movimientos.filter(m => m.loteId === loteId && m.tipo === 'HUESO')
                      const grasasLote = movimientos.filter(m => m.loteId === loteId && m.tipo === 'GRASA')
                      return (
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-xs text-stone-500">Total</p>
                            <p className="font-bold">{lote.totalKg?.toLocaleString() || 0} kg</p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-500">Estado</p>
                            <p className="font-bold text-green-600">{lote.estado}</p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-500">Huesos</p>
                            <p className="font-bold text-stone-600">
                              {huesosLote.reduce((a, m) => a + (m.pesoOriginal || 0), 0).toLocaleString()} kg
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-500">Grasas</p>
                            <p className="font-bold text-yellow-600">
                              {grasasLote.reduce((a, m) => a + (m.pesoOriginal || 0), 0).toLocaleString()} kg
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Historial */}
          <TabsContent value="historial" className="space-y-4">
            {/* Filtros */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Filtrar por Lote</Label>
                    <Select value={filtroLote} onValueChange={setFiltroLote}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos los lotes</SelectItem>
                        {lotes.map(l => (
                          <SelectItem key={l.id} value={l.id}>Lote {l.numero}{l.fecha ? '/' + new Date(l.fecha).getFullYear() : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Filtrar por Tipo</Label>
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        {TIPOS_MOVIMIENTO.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabla */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg">
                <CardTitle className="text-lg font-semibold">
                  Historial de Movimientos ({movimientosFiltrados.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  </div>
                ) : movimientosFiltrados.length === 0 ? (
                  <div className="py-12 text-center text-stone-400">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay movimientos registrados</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Corte</TableHead>
                        <TableHead className="text-right">P. Original</TableHead>
                        <TableHead className="text-right">P. Limpio</TableHead>
                        <TableHead className="text-right">Desperdicio</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientosFiltrados.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell className="font-medium">
                            {new Date(mov.createdAt).toLocaleDateString('es-AR')}
                          </TableCell>
                          <TableCell>
                            {mov.lote ? `Lote ${mov.lote.numero}` : '-'}
                          </TableCell>
                          <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                          <TableCell>{mov.productoNombre || mov.producto?.nombre || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {(mov.pesoOriginal ?? 0).toLocaleString()} kg
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {mov.pesoNeto?.toLocaleString() || '-'}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {mov.pesoDesperdicio?.toFixed(1) || '-'}
                          </TableCell>
                          <TableCell>{getDestinoBadge(mov.destino)}</TableCell>
                          <TableCell>{mov.operador?.nombre || '-'}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEliminar(mov.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default MovimientosDespostadaModule
