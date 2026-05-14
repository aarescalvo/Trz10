'use client'

import { useState, useEffect } from 'react'
import { 
  Warehouse, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, 
  Package, Search, ArrowRightLeft, Download, Plus, X, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { TextoEditable, EditableBlock, useEditor } from '@/components/ui/editable-screen'

interface Camara {
  id: string
  nombre: string
  tipo: string
  capacidad: number
  totalMedias: number
  pesoTotal: number
  ocupacion: number
  alertaStockBajo: boolean
  stockPorEspecie: Record<string, { cantidad: number; peso: number }>
  movimientosRecientes: number
}

interface Movimiento {
  id: string
  fecha: string
  camaraOrigen: string | null
  camaraDestino: string | null
  producto: string | null
  cantidad: number | null
  peso: number | null
  tropaCodigo: string | null
  observaciones: string | null
  operador: string | null
}

interface MediaEnStock {
  id: string
  codigo: string
  lado: string
  peso: number
  sigla: string
  camara: string | null
  tropaCodigo: string | null
  garron: number | null
  fechaIngreso: string
}

interface Stats {
  totalCamaras: number
  totalMedias: number
  pesoTotal: number
  movimientosHoy: number
  alertas: number
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function StockCamarasModule({ operador }: { operador: Operador }) {
  const { editMode, getTexto } = useEditor()
  const [loading, setLoading] = useState(true)
  const [camaras, setCamaras] = useState<Camara[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [mediasEnStock, setMediasEnStock] = useState<MediaEnStock[]>([])
  const [stats, setStats] = useState<Stats>({
    totalCamaras: 0,
    totalMedias: 0,
    pesoTotal: 0,
    movimientosHoy: 0,
    alertas: 0
  })

  // Filtros
  const [filtroCamara, setFiltroCamara] = useState<string>('TODOS')
  const [filtroTropa, setFiltroTropa] = useState<string>('TODOS')
  const [busqueda, setBusqueda] = useState('')

  // Modal de movimiento
  const [showMovimientoModal, setShowMovimientoModal] = useState(false)
  const [movimientoTipo, setMovimientoTipo] = useState<'INGRESO' | 'EGRESO' | 'TRANSFERENCIA'>('INGRESO')
  const [movimientoCamaraOrigen, setMovimientoCamaraOrigen] = useState('')
  const [movimientoCamaraDestino, setMovimientoCamaraDestino] = useState('')
  const [movimientoProducto, setMovimientoProducto] = useState('')
  const [movimientoCantidad, setMovimientoCantidad] = useState('')
  const [movimientoPeso, setMovimientoPeso] = useState('')
  const [movimientoTropa, setMovimientoTropa] = useState('')
  const [movimientoObservaciones, setMovimientoObservaciones] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Restore filters from sessionStorage
    try {
      const saved = sessionStorage.getItem('stock-camaras-filters')
      if (saved) {
        const filters = JSON.parse(saved)
        if (filters.filtroCamara) setFiltroCamara(filters.filtroCamara)
        if (filters.filtroTropa) setFiltroTropa(filters.filtroTropa)
        if (filters.busqueda !== undefined) setBusqueda(filters.busqueda)
      }
    } catch { /* ignore */ }
    fetchData()
  }, [])

  // Save filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('stock-camaras-filters', JSON.stringify({ filtroCamara, filtroTropa, busqueda }))
  }, [filtroCamara, filtroTropa, busqueda])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stock-camaras')
      const data = await res.json()
      
      if (data.success) {
        setCamaras(data.data.resumenCamaras)
        setMovimientos(data.data.movimientos)
        setMediasEnStock(data.data.mediasEnStock)
        setStats(data.data.stats)
      } else {
        toast.error('Error al cargar stock')
      }
    } catch (error) {
      console.error('Error fetching stock:', error)
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleCrearMovimiento = async () => {
    if (!movimientoProducto) {
      toast.error('Complete el producto')
      return
    }

    if (movimientoTipo === 'TRANSFERENCIA' && (!movimientoCamaraOrigen || !movimientoCamaraDestino)) {
      toast.error('Seleccione cámaras de origen y destino')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/stock-camaras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: movimientoTipo,
          camaraOrigenId: movimientoCamaraOrigen || null,
          camaraDestinoId: movimientoCamaraDestino || null,
          producto: movimientoProducto,
          cantidad: parseInt(movimientoCantidad) || null,
          peso: parseFloat(movimientoPeso) || null,
          tropaCodigo: movimientoTropa || null,
          observaciones: movimientoObservaciones || null,
          operadorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Movimiento registrado')
        setShowMovimientoModal(false)
        resetMovimientoForm()
        fetchData()
      } else {
        toast.error(data.error || 'Error al registrar movimiento')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const resetMovimientoForm = () => {
    setMovimientoTipo('INGRESO')
    setMovimientoCamaraOrigen('')
    setMovimientoCamaraDestino('')
    setMovimientoProducto('')
    setMovimientoCantidad('')
    setMovimientoPeso('')
    setMovimientoTropa('')
    setMovimientoObservaciones('')
  }

  // Filtrar medias
  const mediasFiltradas = mediasEnStock.filter(m => {
    if (filtroCamara !== 'TODOS' && m.camara !== filtroCamara) return false
    if (filtroTropa !== 'TODOS' && m.tropaCodigo !== filtroTropa) return false
    if (busqueda && !m.codigo.toLowerCase().includes(busqueda.toLowerCase()) &&
        !m.tropaCodigo?.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  // Filtrar movimientos
  const movimientosFiltrados = movimientos.filter(m => {
    if (busqueda && !m.producto?.toLowerCase().includes(busqueda.toLowerCase()) &&
        !m.tropaCodigo?.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  // Exportar a CSV
  const exportarCSV = () => {
    const headers = ['Código', 'Lado', 'Peso', 'Sigla', 'Cámara', 'Tropa', 'Garrón', 'Fecha Ingreso']
    const rows = mediasFiltradas.map(m => [
      m.codigo,
      m.lado,
      m.peso?.toString() || '0',
      m.sigla,
      m.camara || '',
      m.tropaCodigo || '',
      m.garron?.toString() || '',
      new Date(m.fechaIngreso).toLocaleDateString('es-AR')
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `stock_camaras_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('CSV descargado')
  }

  // Obtener tropas únicas
  const tropasUnicas = [...new Set(mediasEnStock.map(m => m.tropaCodigo).filter(Boolean))] as string[]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <Warehouse className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <EditableBlock bloqueId="header" label="Encabezado">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
                <Warehouse className="w-8 h-8 text-amber-500" />
                <TextoEditable id="titulo-stock-camaras" original="Stock de Cámaras" tag="span" />
              </h1>
              <p className="text-stone-500">
                <TextoEditable id="subtitulo-stock-camaras" original="Control de inventario y movimientos" tag="span" />
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                <TextoEditable id="btn-actualizar-stock-camaras" original="Actualizar" tag="span" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportarCSV}>
                <Download className="w-4 h-4 mr-2" />
                <TextoEditable id="btn-exportar-csv-camaras" original="Exportar CSV" tag="span" />
              </Button>
              <Button 
                size="sm" 
                className="bg-amber-500 hover:bg-amber-600"
                onClick={() => setShowMovimientoModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                <TextoEditable id="btn-movimiento-camara" original="Movimiento" tag="span" />
              </Button>
            </div>
          </div>
        </EditableBlock>

        {/* Stats Cards */}
        <EditableBlock bloqueId="stats" label="Tarjetas de Estadísticas">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <Warehouse className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500"><TextoEditable id="label-camaras-activas" original="Cámaras Activas" tag="span" /></p>
                    <p className="text-xl font-bold">{stats.totalCamaras}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500"><TextoEditable id="label-total-medias" original="Total Medias" tag="span" /></p>
                    <p className="text-xl font-bold">{stats.totalMedias}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500"><TextoEditable id="label-peso-total-kg" original="Peso Total (kg)" tag="span" /></p>
                    <p className="text-xl font-bold">{stats.pesoTotal.toLocaleString('es-AR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-lg">
                    <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500"><TextoEditable id="label-movimientos-hoy" original="Movimientos Hoy" tag="span" /></p>
                    <p className="text-xl font-bold">{stats.movimientosHoy}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </EditableBlock>

        {/* Tabs */}
        <Tabs defaultValue="camaras" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="camaras"><TextoEditable id="tab-por-camara" original="Por Cámara" tag="span" /></TabsTrigger>
            <TabsTrigger value="stock"><TextoEditable id="tab-stock-detalle" original="Stock Detalle" tag="span" /></TabsTrigger>
            <TabsTrigger value="movimientos"><TextoEditable id="tab-movimientos" original="Movimientos" tag="span" /></TabsTrigger>
          </TabsList>

          {/* Tab: Por Cámara */}
          <TabsContent value="camaras" className="space-y-4">
            <EditableBlock bloqueId="camaras-grid" label="Grid de Cámaras">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {camaras.map(camara => (
                  <Card key={camara.id} className={`border-0 shadow-md ${camara.alertaStockBajo ? 'ring-2 ring-red-400' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{camara.nombre}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {camara.tipo}
                        </Badge>
                      </div>
                      <CardDescription>
                        <TextoEditable id="label-capacidad-ganchos" original="Capacidad:" tag="span" /> {camara.capacidad} <TextoEditable id="label-ganchos" original="ganchos" tag="span" />
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span><TextoEditable id="label-ocupacion-camara" original="Ocupación" tag="span" /></span>
                          <span className={camara.ocupacion >= 90 ? 'text-red-500 font-bold' : ''}>
                            {camara.ocupacion}%
                          </span>
                        </div>
                        <Progress 
                          value={camara.ocupacion} 
                          className={camara.ocupacion >= 90 ? 'bg-red-100' : camara.ocupacion >= 70 ? 'bg-amber-100' : ''}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-stone-50 p-2 rounded">
                          <p className="text-stone-500 text-xs"><TextoEditable id="label-medias-camara" original="Medias" tag="span" /></p>
                          <p className="font-bold">{camara.totalMedias}</p>
                        </div>
                        <div className="bg-stone-50 p-2 rounded">
                          <p className="text-stone-500 text-xs"><TextoEditable id="label-peso-kg-camara" original="Peso (kg)" tag="span" /></p>
                          <p className="font-bold">{camara.pesoTotal.toLocaleString('es-AR')}</p>
                        </div>
                      </div>

                      {camara.alertaStockBajo && (
                        <div className="flex items-center gap-2 text-red-500 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          <span><TextoEditable id="alerta-stock-bajo-minimo" original="Stock bajo mínimo" tag="span" /></span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </EditableBlock>
          </TabsContent>

          {/* Tab: Stock Detalle */}
          <TabsContent value="stock" className="space-y-4">
            {/* Filtros */}
            <EditableBlock bloqueId="filtros-stock" label="Filtros de Stock">
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <Label className="text-xs"><TextoEditable id="label-buscar-stock" original="Buscar" tag="span" /></Label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <Input
                          className="pl-9"
                          placeholder="Código o tropa..."
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="w-full md:w-48">
                      <Label className="text-xs"><TextoEditable id="label-filtrar-camara" original="Cámara" tag="span" /></Label>
                      <Select value={filtroCamara} onValueChange={setFiltroCamara}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TODOS"><TextoEditable id="filtro-todas-camaras" original="Todas" tag="span" /></SelectItem>
                          {camaras.map(c => (
                            <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full md:w-48">
                      <Label className="text-xs"><TextoEditable id="label-filtrar-tropa" original="Tropa" tag="span" /></Label>
                      <Select value={filtroTropa} onValueChange={setFiltroTropa}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TODOS"><TextoEditable id="filtro-todas-tropas" original="Todas" tag="span" /></SelectItem>
                          {tropasUnicas.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </EditableBlock>

            {/* Tabla de stock */}
            <EditableBlock bloqueId="tabla-stock" label="Tabla de Stock">
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-stone-50 rounded-t-lg">
                  <CardTitle className="text-lg">
                    <TextoEditable id="titulo-medias-stock" original="Medias en Stock" tag="span" /> ({mediasFiltradas.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {mediasFiltradas.length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p><TextoEditable id="msg-sin-medias-filtro" original="No hay medias con esos filtros" tag="span" /></p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead><TextoEditable id="th-codigo-media" original="Código" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-camara-media" original="Cámara" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-tropa-media" original="Tropa" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-lado-media" original="Lado" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-sigla-media" original="Sigla" tag="span" /></TableHead>
                            <TableHead className="text-right"><TextoEditable id="th-peso-media" original="Peso (kg)" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-fecha-media" original="Fecha" tag="span" /></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mediasFiltradas.slice(0, 100).map(m => {
                            const diasEnCamara = Math.floor((Date.now() - new Date(m.fechaIngreso).getTime()) / (1000 * 60 * 60 * 24))
                            const isExpired = diasEnCamara >= 30
                            const isNearExpiry = diasEnCamara >= 23 && diasEnCamara < 30
                            return (
                            <TableRow key={m.id} className={isExpired ? 'bg-red-50/60' : isNearExpiry ? 'bg-amber-50/40' : ''}>
                              <TableCell className="font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  {m.codigo}
                                  {(() => {
                                    const diasEnCamara = Math.floor((Date.now() - new Date(m.fechaIngreso).getTime()) / (1000 * 60 * 60 * 24))
                                    const vencido = diasEnCamara >= 30
                                    const venceEn7Dias = diasEnCamara >= 21 && diasEnCamara < 30
                                    if (vencido) {
                                      return (
                                        <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0 shrink-0 animate-pulse">
                                          Vencido
                                        </Badge>
                                      )
                                    }
                                    if (venceEn7Dias) {
                                      return (
                                        <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 shrink-0">
                                          Vence en {30 - diasEnCamara} días
                                        </Badge>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell>{m.camara || '-'}</TableCell>
                              <TableCell className="font-mono">{m.tropaCodigo || '-'}</TableCell>
                              <TableCell>{m.lado === 'IZQUIERDA' ? <TextoEditable id="lado-izq" original="Izq" tag="span" /> : <TextoEditable id="lado-der" original="Der" tag="span" />}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{m.sigla}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold">{m.peso?.toLocaleString('es-AR') || '0'}</TableCell>
                              <TableCell className="text-xs text-stone-500">
                                {new Date(m.fechaIngreso).toLocaleDateString('es-AR')}
                              </TableCell>
                            </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </EditableBlock>
          </TabsContent>

          {/* Tab: Movimientos */}
          <TabsContent value="movimientos" className="space-y-4">
            <EditableBlock bloqueId="tabla-movimientos" label="Tabla de Movimientos">
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-stone-50 rounded-t-lg">
                  <CardTitle className="text-lg"><TextoEditable id="titulo-ultimos-movimientos" original="Últimos Movimientos" tag="span" /></CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {movimientosFiltrados.length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                      <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p><TextoEditable id="msg-sin-movimientos-camara" original="No hay movimientos registrados" tag="span" /></p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead><TextoEditable id="th-fecha-mov-cam" original="Fecha" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-origen-mov-cam" original="Origen" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-destino-mov-cam" original="Destino" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-producto-mov-cam" original="Producto" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-cantidad-mov-cam" original="Cant." tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-peso-mov-cam" original="Peso" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-tropa-mov-cam" original="Tropa" tag="span" /></TableHead>
                            <TableHead><TextoEditable id="th-operador-mov-cam" original="Operador" tag="span" /></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movimientosFiltrados.map(m => (
                            <TableRow key={m.id}>
                              <TableCell className="text-xs">
                                {new Date(m.fecha).toLocaleString('es-AR', { 
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                                })}
                              </TableCell>
                              <TableCell>
                                {m.camaraOrigen ? (
                                  <span className="text-red-600">{m.camaraOrigen}</span>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {m.camaraDestino ? (
                                  <span className="text-green-600">{m.camaraDestino}</span>
                                ) : '-'}
                              </TableCell>
                              <TableCell>{m.producto || '-'}</TableCell>
                              <TableCell>{m.cantidad || '-'}</TableCell>
                              <TableCell className="font-bold">
                                {m.peso ? m.peso.toLocaleString('es-AR') + ' kg' : '-'}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{m.tropaCodigo || '-'}</TableCell>
                              <TableCell className="text-xs">{m.operador || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </EditableBlock>
          </TabsContent>
        </Tabs>

        {/* Modal de Movimiento */}
        <Dialog open={showMovimientoModal} onOpenChange={setShowMovimientoModal}>
          <DialogContent maximizable>
            <DialogHeader>
              <DialogTitle><TextoEditable id="titulo-modal-movimiento" original="Registrar Movimiento" tag="span" /></DialogTitle>
              <DialogDescription>
                <TextoEditable id="desc-modal-movimiento" original="Registre un ingreso, egreso o transferencia de stock" tag="span" />
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label><TextoEditable id="label-tipo-movimiento" original="Tipo de Movimiento" tag="span" /></Label>
                <Select value={movimientoTipo} onValueChange={(v) => setMovimientoTipo(v as typeof movimientoTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INGRESO"><TextoEditable id="opt-ingreso" original="Ingreso" tag="span" /></SelectItem>
                    <SelectItem value="EGRESO"><TextoEditable id="opt-egreso" original="Egreso" tag="span" /></SelectItem>
                    <SelectItem value="TRANSFERENCIA"><TextoEditable id="opt-transferencia" original="Transferencia" tag="span" /></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {movimientoTipo === 'TRANSFERENCIA' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label><TextoEditable id="label-camara-origen" original="Cámara Origen" tag="span" /></Label>
                    <Select value={movimientoCamaraOrigen} onValueChange={setMovimientoCamaraOrigen}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {camaras.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label><TextoEditable id="label-camara-destino" original="Cámara Destino" tag="span" /></Label>
                    <Select value={movimientoCamaraDestino} onValueChange={setMovimientoCamaraDestino}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {camaras.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {movimientoTipo === 'INGRESO' && (
                <div className="space-y-2">
                  <Label><TextoEditable id="label-camara-destino-ingreso" original="Cámara Destino" tag="span" /></Label>
                  <Select value={movimientoCamaraDestino} onValueChange={setMovimientoCamaraDestino}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {camaras.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {movimientoTipo === 'EGRESO' && (
                <div className="space-y-2">
                  <Label><TextoEditable id="label-camara-origen-egreso" original="Cámara Origen" tag="span" /></Label>
                  <Select value={movimientoCamaraOrigen} onValueChange={setMovimientoCamaraOrigen}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {camaras.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label><TextoEditable id="label-producto-mov" original="Producto *" tag="span" /></Label>
                <Input
                  value={movimientoProducto}
                  onChange={(e) => setMovimientoProducto(e.target.value)}
                  placeholder="Ej: Media Res, Cuarto, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label><TextoEditable id="label-cantidad-mov" original="Cantidad" tag="span" /></Label>
                  <Input
                    type="number"
                    value={movimientoCantidad}
                    onChange={(e) => setMovimientoCantidad(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label><TextoEditable id="label-peso-kg-mov" original="Peso (kg)" tag="span" /></Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={movimientoPeso}
                    onChange={(e) => setMovimientoPeso(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label><TextoEditable id="label-codigo-tropa-mov" original="Código de Tropa" tag="span" /></Label>
                <Input
                  value={movimientoTropa}
                  onChange={(e) => setMovimientoTropa(e.target.value)}
                  placeholder="Ej: B20260001"
                />
              </div>

              <div className="space-y-2">
                <Label><TextoEditable id="label-observaciones-mov" original="Observaciones" tag="span" /></Label>
                <Input
                  value={movimientoObservaciones}
                  onChange={(e) => setMovimientoObservaciones(e.target.value)}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMovimientoModal(false)}>
                <TextoEditable id="btn-cancelar-mov" original="Cancelar" tag="span" />
              </Button>
              <Button 
                onClick={handleCrearMovimiento}
                disabled={saving || !movimientoProducto}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {saving ? <TextoEditable id="btn-guardando-mov" original="Guardando..." tag="span" /> : <TextoEditable id="btn-registrar-mov" original="Registrar" tag="span" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default StockCamarasModule
