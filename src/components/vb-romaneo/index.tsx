'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { 
  FileText, Loader2, RefreshCw, CheckCircle, XCircle, Clock,
  ArrowRightLeft, Calendar, Search, AlertTriangle, Link2
} from 'lucide-react'

interface Operador {
  id: string
  nombre: string
  rol: string
  permisos?: Record<string, boolean>
}

interface GarronSinAsignar {
  id: string
  garron: number
  tropaCodigo: string | null
  kgMediaDer: number | null
  kgMediaIzq: number | null
  listaFaenaId: string
}

interface AnimalSinAsignar {
  id: string
  numero: number
  tropaId: string
  tropaCodigo: string
  kgIngreso: number | null
  tipoAnimal: string | null
}

interface FilaRevision {
  id: string
  garron: number
  numeroAnimal: number | null
  tropaCodigo: string | null
  denticion: string | null
  tipoAnimal: string | null
  kgIngreso: number | null
  kgMediaDer: number | null
  kgMediaIzq: number | null
  kgTotal: number
  rinde: number | null
  rindeAlto: boolean
  animalId: string | null
  listaFaenaId: string | null
}

interface FechaFaena {
  fecha: Date
  fechaStr: string
  totalAnimales: number
  vbRomaneo: boolean
  vbRomaneoFecha: Date | null
  vbRomaneoOperador: string | null
  listas: Array<{
    id: string
    numero: number
    cantidadTotal: number
    fecha: Date
    vbRomaneo: boolean
    tropas: Array<{ codigo: string; especie: string }>
  }>
  listaIds: string[]
}

interface Props {
  operador: Operador
}

export function VBRomaneoModule({ operador }: Props) {
  const [activeTab, setActiveTab] = useState('asignacion')
  
  // Pestaña 1: Asignación
  const [garronesSinAsignar, setGarronesSinAsignar] = useState<GarronSinAsignar[]>([])
  const [animalesSinAsignar, setAnimalesSinAsignar] = useState<AnimalSinAsignar[]>([])
  const [selectedGarron, setSelectedGarron] = useState<GarronSinAsignar | null>(null)
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalSinAsignar | null>(null)
  const [loadingAsignacion, setLoadingAsignacion] = useState(true)
  const [asignando, setAsignando] = useState(false)
  
  // Pestaña 2: Revisión
  const [filasRevision, setFilasRevision] = useState<FilaRevision[]>([])
  const [selectedFilas, setSelectedFilas] = useState<FilaRevision[]>([])
  const [loadingRevision, setLoadingRevision] = useState(true)
  const [intercambiando, setIntercambiando] = useState(false)
  
  // Pestaña 3: VB
  const [fechasFaena, setFechasFaena] = useState<FechaFaena[]>([])
  const [loadingFechas, setLoadingFechas] = useState(true)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [dandoVb, setDandoVb] = useState(false)
  
  // Cargar datos según pestaña activa
  useEffect(() => {
    if (activeTab === 'asignacion') {
      fetchPendientes()
    } else if (activeTab === 'revision') {
      fetchRevision()
    } else if (activeTab === 'vb') {
      fetchFechas()
    }
  }, [activeTab])

  const fetchPendientes = async () => {
    setLoadingAsignacion(true)
    try {
      const res = await fetch('/api/vb-romaneo?tipo=pendientes')
      const data = await res.json()
      if (data.success) {
        setGarronesSinAsignar(data.data.garronesSinAsignar)
        setAnimalesSinAsignar(data.data.animalesSinAsignar)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar pendientes')
    } finally {
      setLoadingAsignacion(false)
    }
  }

  const fetchRevision = async () => {
    setLoadingRevision(true)
    try {
      const res = await fetch('/api/vb-romaneo?tipo=revision')
      const data = await res.json()
      if (data.success) {
        setFilasRevision(data.data)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar revisión')
    } finally {
      setLoadingRevision(false)
    }
  }

  const fetchFechas = async () => {
    setLoadingFechas(true)
    try {
      let url = '/api/vb-romaneo?tipo=fechas'
      if (fechaDesde) url += `&fechaDesde=${fechaDesde}`
      if (fechaHasta) url += `&fechaHasta=${fechaHasta}`
      
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setFechasFaena(data.data)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar fechas')
    } finally {
      setLoadingFechas(false)
    }
  }

  // Asignar garrón a animal
  const handleAsignar = async () => {
    if (!selectedGarron || !selectedAnimal) {
      toast.error('Seleccione un garrón y un animal')
      return
    }

    // Verificar que no crucen tropas (si el garrón tiene tropa asignada)
    if (selectedGarron.tropaCodigo && selectedGarron.tropaCodigo !== selectedAnimal.tropaCodigo) {
      toast.error('No se puede asignar un animal de otra tropa')
      return
    }

    setAsignando(true)
    try {
      const res = await fetch('/api/vb-romaneo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'asignar',
          garronId: selectedGarron.id,
          animalId: selectedAnimal.id,
          operadorId: operador.id
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Garrón asignado correctamente')
        setSelectedGarron(null)
        setSelectedAnimal(null)
        fetchPendientes()
      } else {
        toast.error(data.error || 'Error al asignar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setAsignando(false)
    }
  }

  // Intercambiar garrones
  const handleIntercambiar = async () => {
    if (selectedFilas.length !== 2) {
      toast.error('Seleccione exactamente 2 filas para intercambiar')
      return
    }

    // Verificar misma tropa
    const tropa1 = selectedFilas[0].tropaCodigo
    const tropa2 = selectedFilas[1].tropaCodigo
    if (tropa1 !== tropa2) {
      toast.error('Solo se pueden intercambiar garrones de la misma tropa')
      return
    }

    setIntercambiando(true)
    try {
      const res = await fetch('/api/vb-romaneo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'intercambiar',
          garron1: selectedFilas[0].garron,
          garron2: selectedFilas[1].garron
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Garrones intercambiados correctamente')
        setSelectedFilas([])
        fetchRevision()
      } else {
        toast.error(data.error || 'Error al intercambiar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setIntercambiando(false)
    }
  }

  // Dar visto bueno
  const handleDarVb = async (fecha: FechaFaena) => {
    setDandoVb(true)
    try {
      const res = await fetch('/api/vb-romaneo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'vb',
          listaIds: fecha.listaIds,
          operadorId: operador.id
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Visto bueno otorgado correctamente')
        fetchFechas()
      } else {
        toast.error(data.error || 'Error al dar VB')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setDandoVb(false)
    }
  }

  // Quitar visto bueno (editar)
  const handleQuitarVb = async (fecha: FechaFaena) => {
    try {
      const res = await fetch('/api/vb-romaneo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'quitarVb',
          listaIds: fecha.listaIds
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Visto bueno removido, puede editar')
        fetchFechas()
      } else {
        toast.error(data.error || 'Error al quitar VB')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    }
  }

  // Toggle selección de fila
  const toggleFilaSeleccion = (fila: FilaRevision) => {
    setSelectedFilas(prev => {
      const exists = prev.find(f => f.id === fila.id)
      if (exists) {
        return prev.filter(f => f.id !== fila.id)
      } else {
        if (prev.length >= 2) {
          return [prev[1], fila]
        }
        return [...prev, fila]
      }
    })
  }

  // Filtrar animales por tropa del garrón seleccionado
  const animalesFiltrados = selectedGarron?.tropaCodigo
    ? animalesSinAsignar.filter(a => a.tropaCodigo === selectedGarron.tropaCodigo)
    : animalesSinAsignar

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
              <FileText className="w-8 h-8 text-amber-500" />
              VB Romaneo
            </h1>
            <p className="text-stone-500 mt-1">
              Verificación de Romaneos - {operador.nombre}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="asignacion" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Asignación Pendiente</span>
              <span className="sm:hidden">Asignación</span>
            </TabsTrigger>
            <TabsTrigger value="revision" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Revisión y Corrección</span>
              <span className="sm:hidden">Revisión</span>
            </TabsTrigger>
            <TabsTrigger value="vb" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Visto Bueno</span>
              <span className="sm:hidden">VB</span>
            </TabsTrigger>
          </TabsList>

          {/* Pestaña 1: Asignación Pendiente */}
          <TabsContent value="asignacion" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  <Clock className="w-3 h-3 mr-1" />
                  {garronesSinAsignar.length} garrones sin asignar
                </Badge>
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  {animalesSinAsignar.length} animales sin asignar
                </Badge>
              </div>
              <Button onClick={fetchPendientes} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>

            {loadingAsignacion ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : garronesSinAsignar.length === 0 && animalesSinAsignar.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
                  <p className="text-lg text-stone-600">No hay pendientes de asignación</p>
                  <p className="text-sm text-stone-400 mt-1">Todos los garrones tienen animal asignado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Columna Garrones */}
                <Card className="border-0 shadow-md">
                  <CardHeader className="bg-amber-50 rounded-t-lg py-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      GARRONES SIN ASIGNAR
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Garrón</TableHead>
                          <TableHead>Tropa</TableHead>
                          <TableHead className="text-right">Kg Der</TableHead>
                          <TableHead className="text-right">Kg Izq</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {garronesSinAsignar.map((g) => (
                          <TableRow 
                            key={g.id}
                            className={`cursor-pointer hover:bg-amber-50 ${selectedGarron?.id === g.id ? 'bg-amber-100' : ''}`}
                            onClick={() => setSelectedGarron(g)}
                          >
                            <TableCell className="font-mono font-bold">{g.garron}</TableCell>
                            <TableCell>{g.tropaCodigo || '-'}</TableCell>
                            <TableCell className="text-right">{g.kgMediaDer?.toFixed(1) || '-'}</TableCell>
                            <TableCell className="text-right">{g.kgMediaIzq?.toFixed(1) || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Columna Animales */}
                <Card className="border-0 shadow-md">
                  <CardHeader className="bg-blue-50 rounded-t-lg py-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      ANIMALES SIN ASIGNAR
                      {selectedGarron?.tropaCodigo && (
                        <Badge className="ml-2 bg-blue-200 text-blue-700">
                          Tropa: {selectedGarron.tropaCodigo}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">N°</TableHead>
                          <TableHead>Tropa</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Kg Ingreso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {animalesFiltrados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-stone-400 py-8">
                              {selectedGarron?.tropaCodigo 
                                ? 'No hay animales disponibles de esta tropa'
                                : 'No hay animales sin asignar'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          animalesFiltrados.map((a) => (
                            <TableRow 
                              key={a.id}
                              className={`cursor-pointer hover:bg-blue-50 ${selectedAnimal?.id === a.id ? 'bg-blue-100' : ''}`}
                              onClick={() => setSelectedAnimal(a)}
                            >
                              <TableCell className="font-mono font-bold">{a.numero}</TableCell>
                              <TableCell>{a.tropaCodigo}</TableCell>
                              <TableCell>{a.tipoAnimal || '-'}</TableCell>
                              <TableCell className="text-right">{a.kgIngreso?.toFixed(1) || '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Botón asignar */}
            {garronesSinAsignar.length > 0 && (
              <div className="flex justify-center">
                <Button
                  onClick={handleAsignar}
                  disabled={!selectedGarron || !selectedAnimal || asignando}
                  className="bg-emerald-500 hover:bg-emerald-600 px-8"
                >
                  {asignando ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  ASIGNAR
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Pestaña 2: Revisión y Corrección */}
          <TabsContent value="revision" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {filasRevision.length} registros
                </Badge>
                <Badge variant="outline" className="text-red-600 border-red-300">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {filasRevision.filter(f => f.rindeAlto).length} con rinde alto (&gt;70%)
                </Badge>
              </div>
              <div className="flex gap-2">
                {selectedFilas.length === 2 && (
                  <Button
                    onClick={handleIntercambiar}
                    disabled={intercambiando}
                    variant="outline"
                    className="border-amber-300 text-amber-600"
                  >
                    {intercambiando ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                    )}
                    Intercambiar ({selectedFilas[0].garron} ↔ {selectedFilas[1].garron})
                  </Button>
                )}
                <Button onClick={fetchRevision} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </div>

            {loadingRevision ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : filasRevision.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p className="text-lg text-stone-600">No hay datos de romaneo para revisar</p>
                  <p className="text-sm text-stone-400 mt-1">Los romaneos aparecerán aquí una vez procesados</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-md">
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="w-16">Garrón</TableHead>
                        <TableHead className="w-16">N° Animal</TableHead>
                        <TableHead>Tropa</TableHead>
                        <TableHead>Dent.</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Kg Ingreso</TableHead>
                        <TableHead className="text-right">Kg Der</TableHead>
                        <TableHead className="text-right">Kg Izq</TableHead>
                        <TableHead className="text-right">Kg Total</TableHead>
                        <TableHead className="text-right">% Rinde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filasRevision.map((fila) => (
                        <TableRow 
                          key={fila.id}
                          className={`cursor-pointer hover:bg-stone-50 ${selectedFilas.find(f => f.id === fila.id) ? 'bg-amber-50' : ''} ${fila.rindeAlto ? 'bg-red-50' : ''}`}
                          onClick={() => toggleFilaSeleccion(fila)}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={!!selectedFilas.find(f => f.id === fila.id)}
                              onCheckedChange={() => toggleFilaSeleccion(fila)}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-bold">{fila.garron}</TableCell>
                          <TableCell className="font-mono">{fila.numeroAnimal || '-'}</TableCell>
                          <TableCell>{fila.tropaCodigo || '-'}</TableCell>
                          <TableCell>{fila.denticion || '-'}</TableCell>
                          <TableCell>{fila.tipoAnimal || '-'}</TableCell>
                          <TableCell className="text-right">{fila.kgIngreso?.toFixed(1) || '-'}</TableCell>
                          <TableCell className="text-right">{fila.kgMediaDer?.toFixed(1) || '-'}</TableCell>
                          <TableCell className="text-right">{fila.kgMediaIzq?.toFixed(1) || '-'}</TableCell>
                          <TableCell className="text-right font-medium">{fila.kgTotal.toFixed(1)}</TableCell>
                          <TableCell className={`text-right font-bold ${fila.rindeAlto ? 'text-red-600' : fila.rinde && fila.rinde > 50 ? 'text-emerald-600' : ''}`}>
                            {fila.rinde !== null ? `${fila.rinde.toFixed(1)}%` : '-'}
                            {fila.rindeAlto && <AlertTriangle className="w-4 h-4 inline ml-1" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {selectedFilas.length > 0 && selectedFilas.length !== 2 && (
              <p className="text-sm text-stone-500 text-center">
                Seleccione exactamente 2 filas para intercambiar (deben ser de la misma tropa)
              </p>
            )}
          </TabsContent>

          {/* Pestaña 3: Visto Bueno */}
          <TabsContent value="vb" className="space-y-4">
            {/* Filtros */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[150px]">
                    <Label>Fecha desde</Label>
                    <Input 
                      type="date" 
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <Label>Fecha hasta</Label>
                    <Input 
                      type="date" 
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                    />
                  </div>
                  <Button onClick={fetchFechas} variant="outline">
                    <Search className="w-4 h-4 mr-2" />
                    Buscar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loadingFechas ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : fechasFaena.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p className="text-lg text-stone-600">No hay faenas registradas</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {fechasFaena.map((fecha, idx) => (
                  <Card key={idx} className={`border-0 shadow-md ${fecha.vbRomaneo ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-amber-500'}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <Calendar className="w-8 h-8 text-stone-400" />
                          <div>
                            <p className="font-bold text-lg">{fecha.fechaStr}</p>
                            <p className="text-sm text-stone-500">
                              {fecha.totalAnimales} animales • {fecha.listas.map((l) => `N°${String(l.numero).padStart(4, '0')}`).join(', ')}
                            </p>
                            <p className="text-xs text-stone-400">
                              {fecha.listas.map((l) => new Date(l.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })).join(' | ')}
                            </p>
                            <div className="flex gap-2 mt-1">
                              {fecha.listas[0]?.tropas.map((t, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {t.codigo}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {fecha.vbRomaneo ? (
                            <>
                              <div className="text-right">
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  VB Otorgado
                                </Badge>
                                {fecha.vbRomaneoOperador && (
                                  <p className="text-xs text-stone-500 mt-1">
                                    por {fecha.vbRomaneoOperador}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuitarVb(fecha)}
                              >
                                Editar
                              </Button>
                            </>
                          ) : (
                            <Button
                              className="bg-emerald-500 hover:bg-emerald-600"
                              onClick={() => handleDarVb(fecha)}
                              disabled={dandoVb}
                            >
                              {dandoVb ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-2" />
                              )}
                              Dar VB
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default VBRomaneoModule
