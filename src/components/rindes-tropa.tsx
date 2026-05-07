'use client'

import { useState, useCallback } from 'react'
import { 
  TrendingUp, TrendingDown, BarChart3, Filter, RefreshCw, 
  Eye, X, ChevronDown, ChevronUp, AlertCircle, Target,
  Search, FileSpreadsheet, FileText, Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table'
import { toast } from 'sonner'
import { ExcelExporter } from '@/lib/export-excel'
import { PDFExporter } from '@/lib/export-pdf'

interface RindeTropa {
  tropaCodigo: string
  cantidadAnimales: number
  pesoVivoTotal: number
  pesoFaenaTotal: number
  rindePromedio: number
  rindeMinimo: number
  rindeMaximo: number
  productor: string | null
  usuario: string | null
}

interface EstadisticasGenerales {
  totalTropas: number
  totalAnimales: number
  totalPesoVivo: number
  totalPesoFaena: number
  rindeGeneral: number
}

interface RomaneoDetalle {
  id: string
  garron: number
  numeroAnimal: number | null
  tipoAnimal: string | null
  pesoVivo: number | null
  pesoMediaIzq: number | null
  pesoMediaDer: number | null
  pesoTotal: number | null
  rinde: number | null
  tipificador: { nombre: string } | null
}

interface TropaDetalle {
  id: string
  numero: number
  codigo: string
  cantidadCabezas: number
  productor: { nombre: string } | null
  usuarioFaena: { nombre: string } | null
}

interface Operador {
  id: string
  nombre: string
  usuario?: string
  rol?: string
}

function RindesTropaModule({ operador }: { operador: Operador }) {
  const [loading, setLoading] = useState(true)
  const [rindes, setRindes] = useState<RindeTropa[]>([])
  const [estadisticas, setEstadisticas] = useState<EstadisticasGenerales | null>(null)
  
  // Filtros
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [tropaDesde, setTropaDesde] = useState('')
  const [tropaHasta, setTropaHasta] = useState('')
  const [usuario, setUsuario] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  
  // Ordenamiento
  const [ordenCampo, setOrdenCampo] = useState<'rindePromedio' | 'cantidadAnimales' | 'tropaCodigo'>('rindePromedio')
  const [ordenAsc, setOrdenAsc] = useState(false)
  
  // Detalle
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [tropaDetalle, setTropaDetalle] = useState<{
    tropa: TropaDetalle | null
    romaneos: RomaneoDetalle[]
    estadisticas: {
      cantidadAnimales: number
      pesoVivoTotal: number
      pesoFaenaTotal: number
      rindePromedio: number
      rindeMinimo: number
      rindeMaximo: number
      pesoVivoPromedio: number
      pesoFaenaPromedio: number
      distribucionTipo: Record<string, number>
    }
  } | null>(null)

  // Carga inicial
  const fetchRindes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.append('fechaDesde', fechaDesde)
      if (fechaHasta) params.append('fechaHasta', fechaHasta)
      if (tropaDesde) params.append('tropaDesde', tropaDesde)
      if (tropaHasta) params.append('tropaHasta', tropaHasta)
      if (usuario) params.append('usuario', usuario)
      if (proveedor) params.append('proveedor', proveedor)

      const res = await fetch(`/api/rindes?${params.toString()}`)
      const data = await res.json()
      
      if (data.success) {
        setRindes(data.data.rindesPorTropa)
        setEstadisticas(data.data.estadisticasGenerales)
      } else {
        toast.error('Error al cargar rindes')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, tropaDesde, tropaHasta, usuario, proveedor])

  // Cargar al montar
  useState(() => {
    fetchRindes()
  })

  const handleBuscar = () => {
    fetchRindes()
  }

  const handleLimpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setTropaDesde('')
    setTropaHasta('')
    setUsuario('')
    setProveedor('')
    // Limpia y recarga sin filtros
    setTimeout(() => {
      fetchRindes()
    }, 0)
  }

  const fetchDetalleTropa = async (tropaCodigo: string) => {
    setDetalleLoading(true)
    setDialogOpen(true)
    
    try {
      const tropaRes = await fetch(`/api/tropas`)
      const tropaData = await tropaRes.json()
      const tropa = tropaData.data?.find((t: { codigo: string }) => t.codigo === tropaCodigo)
      
      if (!tropa) {
        toast.error('Tropa no encontrada')
        setDialogOpen(false)
        return
      }

      const res = await fetch(`/api/rindes?tropaId=${tropa.id}`)
      const data = await res.json()
      
      if (data.success) {
        setTropaDetalle(data.data)
      } else {
        toast.error('Error al cargar detalle')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDetalleLoading(false)
    }
  }

  const ordenarRindes = (rindesList: RindeTropa[]) => {
    return [...rindesList].sort((a, b) => {
      let comparacion = 0
      if (ordenCampo === 'tropaCodigo') {
        comparacion = a.tropaCodigo.localeCompare(b.tropaCodigo)
      } else {
        comparacion = a[ordenCampo] - b[ordenCampo]
      }
      return ordenAsc ? comparacion : -comparacion
    })
  }

  const toggleOrden = (campo: typeof ordenCampo) => {
    if (ordenCampo === campo) {
      setOrdenAsc(!ordenAsc)
    } else {
      setOrdenCampo(campo)
      setOrdenAsc(false)
    }
  }

  const getRindeColor = (rinde: number) => {
    if (rinde >= 55) return 'text-green-600'
    if (rinde >= 52) return 'text-amber-600'
    if (rinde >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getRindeBadge = (rinde: number) => {
    if (rinde >= 55) return 'bg-green-100 text-green-700'
    if (rinde >= 52) return 'bg-amber-100 text-amber-700'
    if (rinde >= 50) return 'bg-orange-100 text-orange-700'
    return 'bg-red-100 text-red-700'
  }

  const formatNumber = (num: number, decimals: number = 0) => {
    return num.toLocaleString('es-AR', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })
  }

  // ==================== EXPORTACIONES ====================

  const exportMainTableExcel = () => {
    const headers = ['Tropa', 'Productor', 'Usuario Faena', 'Animales', 'Peso Vivo (kg)', 'Peso Faena (kg)', 'Rinde %', 'Rinde Mín. %', 'Rinde Máx. %']
    const data = ordenarRindes(rindes).map(r => [
      r.tropaCodigo,
      r.productor || '-',
      r.usuario || '-',
      r.cantidadAnimales,
      Math.round(r.pesoVivoTotal),
      Math.round(r.pesoFaenaTotal),
      r.rindePromedio.toFixed(2),
      r.rindeMinimo > 0 ? r.rindeMinimo.toFixed(2) : '-',
      r.rindeMaximo > 0 ? r.rindeMaximo.toFixed(2) : '-',
    ])

    // Agregar fila de totales
    if (estadisticas) {
      data.push([
        '', 'TOTALES', '', estadisticas.totalAnimales,
        Math.round(estadisticas.totalPesoVivo),
        Math.round(estadisticas.totalPesoFaena),
        estadisticas.rindeGeneral.toFixed(2), '', '',
      ])
    }

    ExcelExporter.exportToExcel({
      filename: `rindes_por_tropa_${new Date().toISOString().split('T')[0]}`,
      sheets: [{ name: 'Rindes por Tropa', headers, data }],
      title: 'Reporte de Rindes por Tropa - Solemar Alimentaria',
    })

    toast.success('Exportación Excel iniciada')
  }

  const exportMainTablePDF = () => {
    const headers = ['Tropa', 'Productor', 'Usuario', 'Anim.', 'P. Vivo', 'P. Faena', 'Rinde %']
    const data = ordenarRindes(rindes).map(r => [
      r.tropaCodigo,
      (r.productor || '-').substring(0, 20),
      (r.usuario || '-').substring(0, 20),
      r.cantidadAnimales.toString(),
      formatNumber(Math.round(r.pesoVivoTotal)),
      formatNumber(Math.round(r.pesoFaenaTotal)),
      `${r.rindePromedio.toFixed(2)}%`,
    ])

    const doc = PDFExporter.generateReport({
      title: 'Reporte de Rindes por Tropa',
      subtitle: estadisticas 
        ? `${estadisticas.totalTropas} tropas | ${formatNumber(estadisticas.totalAnimales)} animales | Rinde general: ${estadisticas.rindeGeneral.toFixed(2)}%`
        : undefined,
      headers,
      data,
      orientation: 'landscape',
      fileName: `rindes_por_tropa_${new Date().toISOString().split('T')[0]}.pdf`,
    })

    PDFExporter.downloadPDF(doc, `rindes_por_tropa_${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('Exportación PDF iniciada')
  }

  const exportDetalleExcel = () => {
    if (!tropaDetalle) return

    const headers = ['Garrón', 'Animal', 'Tipo', 'Peso Vivo (kg)', 'Media Izq (kg)', 'Media Der (kg)', 'Total (kg)', 'Rinde %']
    const data = tropaDetalle.romaneos.map(r => [
      r.garron,
      r.numeroAnimal || '-',
      r.tipoAnimal || '-',
      r.pesoVivo ? Math.round(r.pesoVivo) : '-',
      r.pesoMediaIzq ? r.pesoMediaIzq.toFixed(1) : '-',
      r.pesoMediaDer ? r.pesoMediaDer.toFixed(1) : '-',
      r.pesoTotal ? r.pesoTotal.toFixed(1) : '-',
      r.rinde ? (r.rinde * 100).toFixed(2) : '-',
    ])

    // Agregar fila de totales
    const stats = tropaDetalle.estadisticas
    data.push([
      '', 'TOTALES', '', 
      Math.round(stats.pesoVivoTotal), '', '',
      Math.round(stats.pesoFaenaTotal),
      `${stats.rindePromedio.toFixed(2)}%`,
    ])

    ExcelExporter.exportToExcel({
      filename: `detalle_tropa_${tropaDetalle.tropa?.codigo || 'desconocida'}_${new Date().toISOString().split('T')[0]}`,
      sheets: [{ name: 'Detalle Animales', headers, data }],
      title: `Detalle de Tropa ${tropaDetalle.tropa?.codigo} - Productor: ${tropaDetalle.tropa?.productor?.nombre || '-'}`,
    })

    toast.success('Exportación Excel del detalle iniciada')
  }

  const exportDetallePDF = () => {
    if (!tropaDetalle) return

    const headers = ['Garrón', 'Animal', 'Tipo', 'P. Vivo', 'Med. Izq', 'Med. Der', 'Total', 'Rinde']
    const data = tropaDetalle.romaneos.map(r => [
      r.garron.toString(),
      (r.numeroAnimal || '-').toString(),
      r.tipoAnimal || '-',
      r.pesoVivo ? Math.round(r.pesoVivo).toString() : '-',
      r.pesoMediaIzq ? r.pesoMediaIzq.toFixed(1) : '-',
      r.pesoMediaDer ? r.pesoMediaDer.toFixed(1) : '-',
      r.pesoTotal ? r.pesoTotal.toFixed(1) : '-',
      r.rinde ? `${(r.rinde * 100).toFixed(2)}%` : '-',
    ])

    const stats = tropaDetalle.estadisticas
    const doc = PDFExporter.generateReport({
      title: `Detalle de Tropa ${tropaDetalle.tropa?.codigo || ''}`,
      subtitle: `Productor: ${tropaDetalle.tropa?.productor?.nombre || '-'} | Animales: ${stats.cantidadAnimales} | Rinde: ${stats.rindePromedio.toFixed(2)}%`,
      headers,
      data,
      orientation: 'landscape',
      fileName: `detalle_tropa_${tropaDetalle.tropa?.codigo || 'desconocida'}.pdf`,
    })

    PDFExporter.downloadPDF(doc, `detalle_tropa_${tropaDetalle.tropa?.codigo || 'desconocida'}.pdf`)
    toast.success('Exportación PDF del detalle iniciada')
  }

  const tieneFiltrosActivos = fechaDesde || fechaHasta || tropaDesde || tropaHasta || usuario || proveedor

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-stone-500">Análisis de rendimiento por tropa faenada</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
            {tieneFiltrosActivos && (
              <span className="ml-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </Button>
          {rindes.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={exportMainTableExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportMainTablePDF}>
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </>
          )}
          <Button 
            size="sm" 
            onClick={fetchRindes}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      {mostrarFiltros && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Fecha Desde</Label>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Hasta</Label>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tropa Desde</Label>
                <Input
                  type="number"
                  placeholder="Ej: 100"
                  value={tropaDesde}
                  onChange={(e) => setTropaDesde(e.target.value)}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Tropa Hasta</Label>
                <Input
                  type="number"
                  placeholder="Ej: 179"
                  value={tropaHasta}
                  onChange={(e) => setTropaHasta(e.target.value)}
                  min={1}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Usuario Faena</Label>
                <Input
                  type="text"
                  placeholder="Buscar por nombre de usuario..."
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Productor</Label>
                <Input
                  type="text"
                  placeholder="Buscar por nombre de productor..."
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button 
                variant="outline" 
                onClick={handleLimpiarFiltros}
              >
                <X className="w-4 h-4 mr-2" />
                Limpiar
              </Button>
              <Button 
                onClick={handleBuscar}
                disabled={loading}
              >
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estadísticas generales */}
      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Total Tropas</p>
                  <p className="text-xl font-bold text-stone-800">{formatNumber(estadisticas.totalTropas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Target className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Total Animales</p>
                  <p className="text-xl font-bold text-stone-800">{formatNumber(estadisticas.totalAnimales)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-stone-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-stone-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Peso Vivo Total</p>
                  <p className="text-xl font-bold text-stone-800">{formatNumber(estadisticas.totalPesoVivo)} kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Peso Faena Total</p>
                  <p className="text-xl font-bold text-stone-800">{formatNumber(estadisticas.totalPesoFaena)} kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${estadisticas.rindeGeneral >= 52 ? 'bg-green-100' : 'bg-red-100'}`}>
                  <BarChart3 className={`w-5 h-5 ${estadisticas.rindeGeneral >= 52 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Rinde General</p>
                  <p className={`text-xl font-bold ${getRindeColor(estadisticas.rindeGeneral)}`}>
                    {formatNumber(estadisticas.rindeGeneral, 2)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de rindes */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Rindes por Tropa</CardTitle>
          <CardDescription>
            {tieneFiltrosActivos 
              ? `Mostrando ${rindes.length} tropas con filtros aplicados`
              : 'Ordenado por rinde promedio (mayor a menor)'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : rindes.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-stone-300" />
              <p className="text-stone-500">No hay datos de rindes disponibles</p>
              <p className="text-sm text-stone-400 mt-2">
                {tieneFiltrosActivos 
                  ? 'Intenta cambiar los filtros de búsqueda'
                  : 'Los rindes se calculan a partir de los romaneos confirmados'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-stone-50"
                      onClick={() => toggleOrden('tropaCodigo')}
                    >
                      <div className="flex items-center gap-1">
                        Tropa
                        {ordenCampo === 'tropaCodigo' && (
                          ordenAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Productor</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-stone-50 text-center"
                      onClick={() => toggleOrden('cantidadAnimales')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Animales
                        {ordenCampo === 'cantidadAnimales' && (
                          ordenAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Peso Vivo (kg)</TableHead>
                    <TableHead className="text-right">Peso Faena (kg)</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-stone-50 text-right"
                      onClick={() => toggleOrden('rindePromedio')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Rinde %
                        {ordenCampo === 'rindePromedio' && (
                          ordenAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Rango</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenarRindes(rindes).map((rinde) => (
                    <TableRow key={rinde.tropaCodigo} className="hover:bg-stone-50">
                      <TableCell className="font-medium">
                        {rinde.tropaCodigo}
                      </TableCell>
                      <TableCell className="text-sm text-stone-600 max-w-[150px] truncate">
                        {rinde.productor || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-stone-600 max-w-[150px] truncate">
                        {rinde.usuario || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatNumber(rinde.cantidadAnimales)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(rinde.pesoVivoTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(rinde.pesoFaenaTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={getRindeBadge(rinde.rindePromedio)}>
                          {formatNumber(rinde.rindePromedio, 2)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs text-stone-500">
                        {rinde.rindeMinimo > 0 && rinde.rindeMaximo > 0 ? (
                          <span>
                            {formatNumber(rinde.rindeMinimo, 1)}% - {formatNumber(rinde.rindeMaximo, 1)}%
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => fetchDetalleTropa(rinde.tropaCodigo)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalle */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              Detalle de Tropa {tropaDetalle?.tropa?.codigo}
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-1">
                {tropaDetalle?.tropa?.productor?.nombre && (
                  <p>Productor: {tropaDetalle.tropa.productor.nombre}</p>
                )}
                {tropaDetalle?.tropa?.usuarioFaena?.nombre && (
                  <p>Usuario Faena: {tropaDetalle.tropa.usuarioFaena.nombre}</p>
                )}
              </div>
            </DialogDescription>
            {/* Botones de exportación en el detalle */}
            {tropaDetalle && !detalleLoading && (
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={exportDetalleExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportDetallePDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
            )}
          </DialogHeader>

          {detalleLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : tropaDetalle ? (
            <div className="space-y-6">
              {/* Estadísticas de la tropa */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-stone-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-stone-500">Animales</p>
                  <p className="text-lg font-bold">{formatNumber(tropaDetalle.estadisticas.cantidadAnimales)}</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-stone-500">Peso Vivo Prom.</p>
                  <p className="text-lg font-bold">{formatNumber(tropaDetalle.estadisticas.pesoVivoPromedio)} kg</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-stone-500">Peso Faena Prom.</p>
                  <p className="text-lg font-bold">{formatNumber(tropaDetalle.estadisticas.pesoFaenaPromedio)} kg</p>
                </div>
                <div className={`p-3 rounded-lg text-center ${tropaDetalle.estadisticas.rindePromedio >= 52 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-stone-500">Rinde Promedio</p>
                  <p className={`text-lg font-bold ${getRindeColor(tropaDetalle.estadisticas.rindePromedio)}`}>
                    {formatNumber(tropaDetalle.estadisticas.rindePromedio, 2)}%
                  </p>
                </div>
              </div>

              {/* Distribución por tipo */}
              {Object.keys(tropaDetalle.estadisticas.distribucionTipo).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(tropaDetalle.estadisticas.distribucionTipo).map(([tipo, cant]) => (
                    <Badge key={tipo} variant="outline">
                      {tipo}: {cant}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Tabla de animales */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Garrón</TableHead>
                      <TableHead>Animal</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Peso Vivo</TableHead>
                      <TableHead className="text-right">Media Izq</TableHead>
                      <TableHead className="text-right">Media Der</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Rinde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tropaDetalle.romaneos.map((romaneo) => (
                      <TableRow key={romaneo.id}>
                        <TableCell className="font-medium">{romaneo.garron}</TableCell>
                        <TableCell>{romaneo.numeroAnimal || '-'}</TableCell>
                        <TableCell>{romaneo.tipoAnimal || '-'}</TableCell>
                        <TableCell className="text-right">{romaneo.pesoVivo ? formatNumber(romaneo.pesoVivo) : '-'}</TableCell>
                        <TableCell className="text-right">{romaneo.pesoMediaIzq ? formatNumber(romaneo.pesoMediaIzq, 1) : '-'}</TableCell>
                        <TableCell className="text-right">{romaneo.pesoMediaDer ? formatNumber(romaneo.pesoMediaDer, 1) : '-'}</TableCell>
                        <TableCell className="text-right font-medium">{romaneo.pesoTotal ? formatNumber(romaneo.pesoTotal, 1) : '-'}</TableCell>
                        <TableCell className="text-right">
                          {romaneo.rinde ? (
                            <Badge className={getRindeBadge(romaneo.rinde * 100)}>
                              {formatNumber(romaneo.rinde * 100, 2)}%
                            </Badge>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RindesTropaModule
