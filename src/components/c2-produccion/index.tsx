'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useBalanza } from '@/hooks/useBalanza'
import { useImpresora } from '@/hooks/useImpresora'
import { Scissors, Package, Loader2, RefreshCw, Search, ArrowRight, AlertTriangle, CheckCircle2, BarChart3, TrendingDown, Scale, Printer } from 'lucide-react'

interface Operador { id: string; nombre: string; rol: string }

interface C2ProductoDesposte {
  id: string
  nombre: string
  codigo: string
  gtin?: string | null
  diasVencimiento?: number | null
  pesoTaraCaja?: number | null
  tipoCuartoOrigen?: string | null
  rubro: { id: string; nombre: string }
  activo: boolean
}

interface CuartoEnDesposte {
  id: string
  tipo: string
  peso: number
  codigo: string
  estado: string
  tipoCuarto?: { id: string; nombre: string; codigo: string } | null
  camara?: { id: string; nombre: string } | null
  mediaRes?: { id: string; codigo: string; peso: number; romaneo?: { tropaCodigo: string } | null } | null
}

interface CajaProduccion {
  id: string
  numero: string
  pesoNeto: number
  pesoBruto: number
  tara: number
  piezas: number
  tropaCodigo?: string | null
  estado: string
  barcodeGs1_128?: string | null
  productoDesposte?: { id: string; nombre: string; codigo: string; rubro?: { nombre: string } | null } | null
  cuarto?: { codigo: string; tipo: string; tipoCuarto?: { nombre: string } | null } | null
  createdAt: string
}

export default function C2ProduccionModule({ operador }: { operador: Operador }) {
  const balanza = useBalanza()
  const impresora = useImpresora()
  const [productos, setProductos] = useState<C2ProductoDesposte[]>([])
  const [cuartos, setCuartos] = useState<CuartoEnDesposte[]>([])
  const [cajas, setCajas] = useState<CajaProduccion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state - selección de cuarto
  const [cuartoSeleccionado, setCuartoSeleccionado] = useState<CuartoEnDesposte | null>(null)
  const [busquedaCuarto, setBusquedaCuarto] = useState('')

  // Form state - pesaje de corte
  const [productoSeleccionado, setProductoSeleccionado] = useState('')
  const [pesoBruto, setPesoBruto] = useState('')
  const [pesoNeto, setPesoNeto] = useState('')
  const [tara, setTara] = useState('')
  const [piezas, setPiezas] = useState('1')
  const [propietarioId, setPropietarioId] = useState('')

  // Filtro de productos
  const [filtroRubro, setFiltroRubro] = useState<string>('TODOS')
  const [filtroCuartoOrigen, setFiltroCuartoOrigen] = useState<string>('TODOS')

  // Degradación dialog
  const [degradDialogOpen, setDegradDialogOpen] = useState(false)
  const [cajaADegradar, setCajaADegradar] = useState<CajaProduccion | null>(null)
  const [degradTipo, setDegradTipo] = useState('TRIMMING')
  const [degradPeso, setDegradPeso] = useState('')
  const [degradAprovechamiento, setDegradAprovechamiento] = useState('')
  const [degradNuevoProducto, setDegradNuevoProducto] = useState('')
  const [degradMotivo, setDegradMotivo] = useState('')

  // Control de masa
  const [pesoEntradaTotal, setPesoEntradaTotal] = useState(0)
  const [pesoSalidaTotal, setPesoSalidaTotal] = useState(0)

  useEffect(() => {
    fetchDatos()
  }, [])

  const fetchDatos = async () => {
    setLoading(true)
    try {
      const [resProductos, resCuartos, resCajas] = await Promise.all([
        fetch('/api/c2-productos-desposte'),
        fetch('/api/cuartos?estado=EN_DESPOSTADA'),
        fetch('/api/c2-produccion-cajas?limit=50')
      ])

      const dataProductos = await resProductos.json()
      const dataCuartos = await resCuartos.json()
      const dataCajas = await resCajas.json()

      if (dataProductos.success) setProductos((dataProductos.data || []).filter((p: C2ProductoDesposte) => p.activo))
      if (dataCuartos.success) setCuartos(dataCuartos.data || [])
      if (dataCajas.success) setCajas(dataCajas.data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // Calcular control de masa
  useEffect(() => {
    const entrada = cuartos.reduce((sum, c) => sum + (c.peso || 0), 0)
    const salida = cajas.reduce((sum, c) => sum + c.pesoNeto, 0)
    setPesoEntradaTotal(entrada)
    setPesoSalidaTotal(salida)
  }, [cuartos, cajas])

  // Filtrar productos por rubro y tipo de cuarto origen
  const rubrosUnicos = [...new Set(productos.map(p => p.rubro?.nombre).filter(Boolean))]

  const productosFiltrados = productos.filter(p => {
    if (filtroRubro !== 'TODOS' && p.rubro?.nombre !== filtroRubro) return false
    if (filtroCuartoOrigen !== 'TODOS') {
      // Si hay cuarto seleccionado, filtrar productos compatibles
      if (cuartoSeleccionado) {
        const tipoCuarto = cuartoSeleccionado.tipoCuarto?.codigo?.toUpperCase() || cuartoSeleccionado.tipo
        if (p.tipoCuartoOrigen && p.tipoCuartoOrigen.toUpperCase() !== tipoCuarto) return false
      }
    }
    return true
  })

  // Auto-set tara when product changes
  const handleProductoChange = (productoId: string) => {
    setProductoSeleccionado(productoId)
    const prod = productos.find(p => p.id === productoId)
    if (prod?.pesoTaraCaja) {
      setTara(prod.pesoTaraCaja.toString())
    }
  }

  // Calcular peso bruto automáticamente
  const pesoNetoNum = parseFloat(pesoNeto) || 0
  const taraNum = parseFloat(tara) || 0
  const pesoBrutoCalc = pesoNetoNum + taraNum

  // Seleccionar cuarto
  const handleSeleccionarCuarto = (cuarto: CuartoEnDesposte) => {
    setCuartoSeleccionado(cuarto)
    setBusquedaCuarto('')
  }

  // Registrar caja
  const handleRegistrarCaja = async () => {
    if (!productoSeleccionado) {
      toast.error('Seleccione un producto')
      return
    }
    if (pesoNetoNum <= 0) {
      toast.error('Ingrese un peso neto válido')
      return
    }

    // Control de masa: no permitir producir más de lo ingresado
    if (pesoSalidaTotal + pesoNetoNum > pesoEntradaTotal) {
      toast.error('Control de masa: peso de salida excedería el peso de entrada')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/c2-produccion-cajas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoDesposteId: productoSeleccionado,
          cuartoId: cuartoSeleccionado?.id || null,
          pesoBruto: pesoBruto || pesoBrutoCalc,
          pesoNeto: pesoNetoNum,
          tara: taraNum,
          piezas: parseInt(piezas) || 1,
          tropaCodigo: cuartoSeleccionado?.mediaRes?.romaneo?.tropaCodigo || cuartoSeleccionado?.tipoCuarto?.codigo || null,
          propietarioId: propietarioId || null,
          operadorId: operador.id
        })
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message || 'Caja registrada correctamente')
        // Auto-print caja label
        const prod = productos.find(p => p.id === productoSeleccionado)
        impresora.imprimirRotulo({
          producto: prod?.nombre || '',
          peso: pesoNetoNum.toFixed(2),
          unidades: piezas,
          codigo: data.data?.numero || '',
          lote: cuartoSeleccionado?.mediaRes?.romaneo?.tropaCodigo || '',
          fecha: new Date().toLocaleDateString('es-AR'),
        }, 'caja')
        // Reset form pero mantener cuarto seleccionado
        setProductoSeleccionado('')
        setPesoBruto('')
        setPesoNeto('')
        setTara('')
        setPiezas('1')
        fetchDatos()
      } else {
        toast.error(data.error || 'Error al registrar caja')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al registrar caja')
    } finally {
      setSaving(false)
    }
  }

  // Abrir dialog de degradación
  const handleDegradar = (caja: CajaProduccion) => {
    setCajaADegradar(caja)
    setDegradTipo('TRIMMING')
    setDegradPeso('')
    setDegradAprovechamiento('')
    setDegradNuevoProducto('')
    setDegradMotivo('')
    setDegradDialogOpen(true)
  }

  // Confirmar degradación
  const handleConfirmarDegradacion = async () => {
    if (!cajaADegradar) return
    if (!degradPeso || parseFloat(degradPeso) <= 0) {
      toast.error('Ingrese el peso degradado')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/c2-degradacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cajaIdOriginal: cajaADegradar.id,
          tipo: degradTipo,
          pesoDegradado: parseFloat(degradPeso),
          pesoAprovechamiento: degradAprovechamiento ? parseFloat(degradAprovechamiento) : null,
          pesoDescarte: degradAprovechamiento ? parseFloat(degradPeso) - parseFloat(degradAprovechamiento) : parseFloat(degradPeso),
          nuevoProductoId: degradNuevoProducto || null,
          motivo: degradMotivo || degradTipo,
          operadorId: operador.id
        })
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message || 'Degradación registrada')
        setDegradDialogOpen(false)
        setCajaADegradar(null)
        fetchDatos()
      } else {
        toast.error(data.error || 'Error al registrar degradación')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al registrar degradación')
    } finally {
      setSaving(false)
    }
  }

  // Control de masa
  const mermaKg = pesoEntradaTotal - pesoSalidaTotal
  const mermaPorcentaje = pesoEntradaTotal > 0 ? (mermaKg / pesoEntradaTotal * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
              <Scissors className="w-8 h-8 text-amber-500" />
              Producción / Desposte (C2)
            </h1>
            <p className="text-stone-500">Pesaje de cortes, empaque y control de masa</p>
          </div>
          <Button onClick={fetchDatos} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Control de Masa */}
        <Card className={`border-2 ${mermaPorcentaje < 0 ? 'border-red-300 bg-red-50' : mermaPorcentaje > 15 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <BarChart3 className={`w-6 h-6 ${mermaPorcentaje < 0 ? 'text-red-500' : 'text-green-500'}`} />
                <div>
                  <p className="font-semibold text-stone-800">Control de Masa</p>
                  <p className="text-sm text-stone-500">
                    Entrada: {pesoEntradaTotal.toFixed(1)} kg → Salida: {pesoSalidaTotal.toFixed(1)} kg
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-stone-500">Merma</p>
                  <p className={`text-xl font-bold ${mermaPorcentaje < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {mermaKg.toFixed(1)} kg
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-stone-500">% Merma</p>
                  <p className={`text-xl font-bold ${mermaPorcentaje < 0 ? 'text-red-600' : mermaPorcentaje > 15 ? 'text-amber-600' : 'text-green-600'}`}>
                    {mermaPorcentaje.toFixed(1)}%
                  </p>
                </div>
                {mermaPorcentaje < 0 && (
                  <Badge className="bg-red-500 text-white">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Exceso de salida
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Package className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Cuartos en Desposte</p>
                  <p className="text-xl font-bold text-amber-600">{cuartos.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Cajas Producidas</p>
                  <p className="text-xl font-bold text-green-600">{cajas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-teal-100 p-2 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Peso Entrada</p>
                  <p className="text-xl font-bold text-teal-600">{pesoEntradaTotal.toFixed(0)} kg</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Degradaciones</p>
                  <p className="text-xl font-bold text-blue-600">
                    {cajas.filter(c => c.estado === 'DEGRADADA').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selección de Cuarto + Pesaje */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel izquierdo: Selección de Cuarto */}
          <Card className="border-0 shadow-md lg:col-span-1">
            <CardHeader className="bg-stone-50 rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                Cuarto Activo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Cuarto seleccionado */}
              {cuartoSeleccionado ? (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className="bg-amber-500 text-white mb-1">
                          {cuartoSeleccionado.tipoCuarto?.nombre || cuartoSeleccionado.tipo}
                        </Badge>
                        <p className="font-medium text-stone-800">{cuartoSeleccionado.codigo}</p>
                        <p className="text-sm text-stone-500">{(cuartoSeleccionado.peso ?? 0).toFixed(1)} kg</p>
                        {cuartoSeleccionado.mediaRes?.romaneo?.tropaCodigo && (
                          <p className="text-xs text-stone-400">Tropa: {cuartoSeleccionado.mediaRes.romaneo.tropaCodigo}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCuartoSeleccionado(null)}>
                        Cambiar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm">Seleccionar Cuarto</Label>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {cuartos.length === 0 ? (
                      <p className="text-sm text-stone-400 text-center py-4">No hay cuartos en desposte</p>
                    ) : (
                      cuartos.map(c => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-stone-50 transition-colors"
                          onClick={() => handleSeleccionarCuarto(c)}
                        >
                          <div>
                            <Badge variant="outline" className="text-xs mb-1">
                              {c.tipoCuarto?.nombre || c.tipo}
                            </Badge>
                            <p className="text-sm font-medium">{c.codigo}</p>
                          </div>
                          <span className="font-semibold text-amber-600">{(c.peso ?? 0).toFixed(1)} kg</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Panel central: Pesaje de Corte */}
          <Card className="border-0 shadow-md lg:col-span-2">
            <CardHeader className="bg-stone-50 rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-500" />
                Pesaje de Corte
              </CardTitle>
              <CardDescription>Seleccione producto, pese y registre la caja</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Filtros de productos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Rubro</Label>
                  <Select value={filtroRubro} onValueChange={setFiltroRubro}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      {rubrosUnicos.map(r => (
                        <SelectItem key={r} value={r!}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Origen Cuarto</Label>
                  <Select value={filtroCuartoOrigen} onValueChange={setFiltroCuartoOrigen}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      <SelectItem value="DELANTERO">Delantero</SelectItem>
                      <SelectItem value="TRASERO">Trasero</SelectItem>
                      <SelectItem value="ASADO">Asado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Selección de producto - Botones grandes para pantalla táctil */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Producto</Label>
                <Select value={productoSeleccionado} onValueChange={handleProductoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productosFiltrados.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} ({p.codigo}) {p.rubro?.nombre ? `- ${p.rubro.nombre}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Quick-select buttons for touchscreen */}
                <div className="flex flex-wrap gap-2">
                  {productosFiltrados.slice(0, 12).map(p => (
                    <Button
                      key={p.id}
                      variant={productoSeleccionado === p.id ? 'default' : 'outline'}
                      size="sm"
                      className={productoSeleccionado === p.id ? 'bg-amber-500 hover:bg-amber-600' : ''}
                      onClick={() => handleProductoChange(p.id)}
                    >
                      {p.nombre}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Pesaje */}
              {/* Balanza Integration */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  type="button" 
                  variant={balanza.leyendo ? "destructive" : "outline"} 
                  size="sm"
                  onClick={() => balanza.leyendo ? balanza.detener() : balanza.iniciar()}
                >
                  <Scale className="w-4 h-4 mr-1" />
                  {balanza.leyendo ? 'Detener' : 'Balanza'}
                </Button>
                {balanza.leyendo && (
                  <>
                    <span className={`text-lg font-mono ${balanza.estable ? 'text-green-600' : 'text-amber-500'}`}>
                      {balanza.peso.toFixed(2)} kg
                    </span>
                    <Button 
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!balanza.estable || balanza.peso <= 0}
                      onClick={() => {
                        const captured = balanza.capturarPeso()
                        if (captured) {
                          setPesoNeto(captured.toFixed(2))
                          const t = parseFloat(tara) || 0
                          setPesoBruto((captured + t).toFixed(2))
                        }
                      }}
                    >
                      Capturar
                    </Button>
                  </>
                )}
                {balanza.error && <span className="text-xs text-red-500">{balanza.error}</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Peso Neto (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={pesoNeto}
                    onChange={(e) => {
                      setPesoNeto(e.target.value)
                      // Auto-calc bruto if tara set
                      const n = parseFloat(e.target.value) || 0
                      const t = parseFloat(tara) || 0
                      if (n > 0) setPesoBruto((n + t).toFixed(2))
                    }}
                    className="text-right text-lg font-bold h-12"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tara (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={tara}
                    onChange={(e) => {
                      setTara(e.target.value)
                      const n = parseFloat(pesoNeto) || 0
                      const t = parseFloat(e.target.value) || 0
                      if (n > 0) setPesoBruto((n + t).toFixed(2))
                    }}
                    className="text-right h-12"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso Bruto (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pesoBruto || (pesoNetoNum > 0 ? pesoBrutoCalc.toFixed(2) : '')}
                    onChange={(e) => setPesoBruto(e.target.value)}
                    className="text-right h-12 bg-stone-50"
                    readOnly
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Piezas</Label>
                  <Input
                    type="number"
                    value={piezas}
                    onChange={(e) => setPiezas(e.target.value)}
                    className="text-right h-12"
                    min="1"
                  />
                </div>
              </div>

              {/* Botón registrar */}
              <Button
                onClick={handleRegistrarCaja}
                disabled={saving || !productoSeleccionado || pesoNetoNum <= 0}
                className="w-full h-14 text-lg bg-amber-500 hover:bg-amber-600"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                {saving ? 'Registrando...' : 'Registrar Caja'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de Cajas Producidas */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-stone-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Cajas Producidas ({cajas.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
              </div>
            ) : cajas.length === 0 ? (
              <div className="p-8 text-center text-stone-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay cajas producidas</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50/50">
                      <TableHead>Número</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Peso Neto</TableHead>
                      <TableHead>Tara</TableHead>
                      <TableHead>Piezas</TableHead>
                      <TableHead>Tropa</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cajas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.numero}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{c.productoDesposte?.nombre || '-'}</p>
                            <p className="text-xs text-stone-400">{c.productoDesposte?.rubro?.nombre || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{c.pesoNeto.toFixed(2)} kg</TableCell>
                        <TableCell className="text-stone-500">{c.tara.toFixed(2)} kg</TableCell>
                        <TableCell>{c.piezas ?? 0}</TableCell>
                        <TableCell className="text-sm text-stone-500">{c.tropaCodigo || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            c.estado === 'ARMADA' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            c.estado === 'EN_PALLETS' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                            c.estado === 'DESPACHADA' ? 'bg-green-50 text-green-700 border-green-200' :
                            'bg-stone-50 text-stone-700'
                          }>
                            {c.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDegradar(c)}
                            >
                              <TrendingDown className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-stone-500"
                              disabled={impresora.imprimiendo}
                              onClick={() => {
                                impresora.imprimirRotulo({
                                  producto: c.productoDesposte?.nombre || '',
                                  peso: c.pesoNeto.toFixed(2),
                                  unidades: c.piezas.toString(),
                                  codigo: c.numero,
                                  lote: c.tropaCodigo || '',
                                  fecha: new Date(c.createdAt).toLocaleDateString('es-AR'),
                                }, 'caja')
                              }}
                            >
                              <Printer className="w-4 h-4" />
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
        </Card>

        {/* Dialog Degradación */}
        <Dialog open={degradDialogOpen} onOpenChange={setDegradDialogOpen}>
          <DialogContent className="max-w-md" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Degradación de Caja
              </DialogTitle>
              <DialogDescription>
                Caja: {cajaADegradar?.numero} — {cajaADegradar?.productoDesposte?.nombre} ({cajaADegradar?.pesoNeto?.toFixed(2)} kg)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Degradación</Label>
                <Select value={degradTipo} onValueChange={setDegradTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIMMING">Trimming (Recorte)</SelectItem>
                    <SelectItem value="GOLPEADO">Golpeado</SelectItem>
                    <SelectItem value="DECOMISO_PARCIAL">Decomiso Parcial</SelectItem>
                    <SelectItem value="APROVECHAMIENTO">Aprovechamiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Peso Degradado (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={degradPeso}
                  onChange={(e) => setDegradPeso(e.target.value)}
                  placeholder="0.00"
                  className="text-right"
                />
              </div>

              {(degradTipo === 'APROVECHAMIENTO' || degradTipo === 'TRIMMING') && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso Aprovechamiento (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={degradAprovechamiento}
                      onChange={(e) => setDegradAprovechamiento(e.target.value)}
                      placeholder="0.00"
                      className="text-right"
                    />
                  </div>

                  {degradAprovechamiento && parseFloat(degradAprovechamiento) > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Nuevo Producto (reasignación)</Label>
                      <Select value={degradNuevoProducto} onValueChange={setDegradNuevoProducto}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.filter(p => p.id !== cajaADegradar?.productoDesposte?.id).map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nombre} ({p.codigo})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Motivo</Label>
                <Input
                  value={degradMotivo}
                  onChange={(e) => setDegradMotivo(e.target.value)}
                  placeholder="Ej: Golpeado, Contaminación..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDegradDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleConfirmarDegradacion}
                disabled={saving || !degradPeso}
                className="bg-red-500 hover:bg-red-600"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingDown className="w-4 h-4 mr-2" />}
                Confirmar Degradación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
