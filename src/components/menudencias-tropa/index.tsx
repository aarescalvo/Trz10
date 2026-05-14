'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Package, Plus, Save, Trash2, RefreshCw, Beef, 
  Calendar, Scale, Search, ChevronDown, ChevronUp,
  ClipboardList, Weight, FileText, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'

// Artículos predefinidos de menudencias
const ARTICULOS_PREDEFINIDOS = [
  'CHINCHULIN',
  'CORAZON',
  'HIGADO',
  'LENGUA',
  'MOLLEJAS',
  'RIÑON',
  'TENDON',
  'TRIPA GORDA',
  'CENTRO DE ENTRAÑA',
  'QUIJADA',
  'RABO',
  'SESOS',
  'CARNE DE CABEZA'
]

interface Tropa {
  id: string
  codigo: string
  cantidadCabezas: number
  usuarioFaena?: { nombre: string }
  productor?: { nombre: string }
  especie: string
}

interface RegistroMenudencia {
  id: string
  tropaCodigo: string
  fecha: string
  articulo: string
  kgCamara: number
  kgElaborado: number
  cantidadBolsas: number
  observaciones?: string
}

interface PesajeInterno {
  id: string
  tropaCodigo: string
  fecha: string
  grasa: number
  lavadito: number
  bolsaAzul: number
  hueso: number
  grasaBascula: number
  despojo: number
  observaciones?: string
}

interface MenudenciaItem {
  articulo: string
  kgCamara: string
  kgElaborado: string
  bolsas: string
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function MenudenciasTropaModule({ operador }: { operador: Operador }) {
  // Estados generales
  const [tropas, setTropas] = useState<Tropa[]>([])
  const [registros, setRegistros] = useState<RegistroMenudencia[]>([])
  const [pesajes, setPesajes] = useState<PesajeInterno[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Estados de filtros
  const [filtroTropa, setFiltroTropa] = useState('all')
  const [filtroFecha, setFiltroFecha] = useState('')
  const [searchTropa, setSearchTropa] = useState('')
  
  // Sección 1: Registro de Menudencias por Tropa
  const [tropaSeleccionada, setTropaSeleccionada] = useState('')
  const [menudenciasItems, setMenudenciasItems] = useState<MenudenciaItem[]>([
    { articulo: '', kgCamara: '', kgElaborado: '', bolsas: '' }
  ])
  
  // Sección 2: Pesaje Interno
  const [tropaPesajeInterno, setTropaPesajeInterno] = useState('')
  const [grasa, setGrasa] = useState('')
  const [lavadito, setLavadito] = useState('')
  const [bolsaAzul, setBolsaAzul] = useState('')
  
  // Sección 3: Pesaje Báscula (Manitou)
  const [tropaPesajeBascula, setTropaPesajeBascula] = useState('')
  const [hueso, setHueso] = useState('')
  const [grasaBascula, setGrasaBascula] = useState('')
  const [despojo, setDespojo] = useState('')
  
  // Historial
  const [historialExpandido, setHistorialExpandido] = useState(true)

  // Cargar datos iniciales
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Cargar tropas (todas, para el selector)
      const tropasRes = await fetch('/api/tropas')
      const tropasData = await tropasRes.json()
      if (tropasData.success) {
        setTropas(tropasData.data)
      }
      
      // Cargar registros de menudencias
      const registrosRes = await fetch('/api/menudencias')
      const registrosData = await registrosRes.json()
      if (registrosData.success) {
        setRegistros(registrosData.data)
      }
      
      // Cargar pesajes internos
      const pesajesRes = await fetch('/api/pesaje-interno')
      const pesajesData = await pesajesRes.json()
      if (pesajesData.success) {
        setPesajes(pesajesData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar historial
  const historialFiltrado = useCallback(() => {
    let result = registros
    if (filtroTropa && filtroTropa !== 'all') {
      result = result.filter(r => r.tropaCodigo === filtroTropa)
    }
    if (filtroFecha) {
      const fechaFiltro = new Date(filtroFecha).toDateString()
      result = result.filter(r => new Date(r.fecha).toDateString() === fechaFiltro)
    }
    return result
  }, [registros, filtroTropa, filtroFecha])

  // Tropas filtradas para búsqueda
  const tropasFiltradas = tropas.filter(t => 
    t.codigo.toLowerCase().includes(searchTropa.toLowerCase()) ||
    t.usuarioFaena?.nombre?.toLowerCase().includes(searchTropa.toLowerCase())
  )

  // Agregar artículo a la lista de menudencias
  const handleAgregarArticulo = () => {
    setMenudenciasItems([
      ...menudenciasItems,
      { articulo: '', kgCamara: '', kgElaborado: '', bolsas: '' }
    ])
  }

  // Eliminar artículo de la lista
  const handleEliminarArticulo = (index: number) => {
    if (menudenciasItems.length > 1) {
      setMenudenciasItems(menudenciasItems.filter((_, i) => i !== index))
    }
  }

  // Actualizar artículo en la lista
  const handleActualizarItem = (index: number, field: keyof MenudenciaItem, value: string) => {
    const newItems = [...menudenciasItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setMenudenciasItems(newItems)
  }

  // Calcular totales de menudencias
  const totalesMenudencias = menudenciasItems.reduce(
    (acc, item) => ({
      kgCamara: acc.kgCamara + (parseFloat(item.kgCamara) || 0),
      kgElaborado: acc.kgElaborado + (parseFloat(item.kgElaborado) || 0),
      bolsas: acc.bolsas + (parseInt(item.bolsas) || 0)
    }),
    { kgCamara: 0, kgElaborado: 0, bolsas: 0 }
  )

  // Guardar menudencias
  const handleGuardarMenudencias = async () => {
    if (!tropaSeleccionada) {
      toast.error('Seleccione una tropa')
      return
    }

    const itemsValidos = menudenciasItems.filter(item => item.articulo)
    if (itemsValidos.length === 0) {
      toast.error('Agregue al menos un artículo')
      return
    }

    setSaving(true)
    try {
      // Crear registros para cada artículo
      for (const item of itemsValidos) {
        await fetch('/api/menudencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tropaCodigo: tropaSeleccionada,
            articulo: item.articulo,
            kgCamara: item.kgCamara || 0,
            kgElaborado: item.kgElaborado || 0,
            cantidadBolsas: item.bolsas || 0,
            operadorId: operador.id
          })
        })
      }

      toast.success('Menudencias guardadas correctamente')
      setMenudenciasItems([{ articulo: '', kgCamara: '', kgElaborado: '', bolsas: '' }])
      fetchData()
    } catch (error) {
      toast.error('Error al guardar menudencias')
    } finally {
      setSaving(false)
    }
  }

  // Guardar pesaje interno
  const handleGuardarPesajeInterno = async () => {
    if (!tropaPesajeInterno) {
      toast.error('Seleccione una tropa')
      return
    }

    if (!grasa && !lavadito && !bolsaAzul) {
      toast.error('Complete al menos un campo de peso')
      return
    }

    setSaving(true)
    try {
      // Verificar si ya existe
      const pesajeExistente = pesajes.find(p => p.tropaCodigo === tropaPesajeInterno)
      
      if (pesajeExistente) {
        // Actualizar
        await fetch('/api/pesaje-interno', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tropaCodigo: tropaPesajeInterno,
            grasa: grasa || 0,
            lavadito: lavadito || 0,
            bolsaAzul: bolsaAzul || 0,
            operadorId: operador.id
          })
        })
        toast.success('Pesaje interno actualizado')
      } else {
        // Crear
        await fetch('/api/pesaje-interno', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tropaCodigo: tropaPesajeInterno,
            grasa: grasa || 0,
            lavadito: lavadito || 0,
            bolsaAzul: bolsaAzul || 0,
            operadorId: operador.id
          })
        })
        toast.success('Pesaje interno guardado')
      }
      
      fetchData()
    } catch (error) {
      toast.error('Error al guardar pesaje interno')
    } finally {
      setSaving(false)
    }
  }

  // Guardar pesaje báscula
  const handleGuardarPesajeBascula = async () => {
    if (!tropaPesajeBascula) {
      toast.error('Seleccione una tropa')
      return
    }

    if (!hueso && !grasaBascula && !despojo) {
      toast.error('Complete al menos un campo de peso')
      return
    }

    setSaving(true)
    try {
      // Verificar si ya existe pesaje para esta tropa
      const pesajeExistente = pesajes.find(p => p.tropaCodigo === tropaPesajeBascula)
      
      if (pesajeExistente) {
        // Actualizar solo los campos de báscula
        await fetch('/api/pesaje-interno', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tropaCodigo: tropaPesajeBascula,
            hueso: hueso || 0,
            grasaBascula: grasaBascula || 0,
            despojo: despojo || 0,
            operadorId: operador.id
          })
        })
        toast.success('Pesaje báscula actualizado')
      } else {
        // Crear nuevo
        await fetch('/api/pesaje-interno', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tropaCodigo: tropaPesajeBascula,
            hueso: hueso || 0,
            grasaBascula: grasaBascula || 0,
            despojo: despojo || 0,
            operadorId: operador.id
          })
        })
        toast.success('Pesaje báscula guardado')
      }
      
      fetchData()
    } catch (error) {
      toast.error('Error al guardar pesaje báscula')
    } finally {
      setSaving(false)
    }
  }

  // Eliminar registro
  const handleEliminarRegistro = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return
    
    try {
      await fetch(`/api/menudencias?id=${id}`, { method: 'DELETE' })
      toast.success('Registro eliminado')
      fetchData()
    } catch (error) {
      toast.error('Error al eliminar registro')
    }
  }

  // Calcular totales de pesaje interno
  const totalPesajeInterno = (parseFloat(grasa) || 0) + (parseFloat(lavadito) || 0) + (parseFloat(bolsaAzul) || 0)
  
  // Calcular totales de pesaje báscula
  const totalPesajeBascula = (parseFloat(hueso) || 0) + (parseFloat(grasaBascula) || 0) + (parseFloat(despojo) || 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <Package className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800">Menudencias por Tropa</h1>
            <p className="text-stone-500">Registro y control de menudencias, pesaje interno y báscula</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Sección 1: Registro de Menudencias por Tropa */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-emerald-50 rounded-t-lg">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Registro de Menudencias por Tropa
            </CardTitle>
            <CardDescription>
              Registre los artículos de menudencias con sus pesos y bolsas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {/* Selector de tropa */}
            <div className="mb-4">
              <Label className="mb-2 block">Seleccionar Tropa</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Buscar tropa por código o usuario..."
                    value={searchTropa}
                    onChange={(e) => setSearchTropa(e.target.value)}
                    className="mb-2"
                  />
                  <Select value={tropaSeleccionada} onValueChange={setTropaSeleccionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una tropa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tropasFiltradas.slice(0, 20).map((t) => (
                        <SelectItem key={t.id} value={t.codigo}>
                          {t.codigo} - {t.usuarioFaena?.nombre || 'Sin usuario'} ({t.cantidadCabezas} cabezas)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Tabla de artículos */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="w-48">Artículo</TableHead>
                    <TableHead className="text-center">KG Cámara</TableHead>
                    <TableHead className="text-center">KG Elaborado</TableHead>
                    <TableHead className="text-center w-24">Bolsas</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menudenciasItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select 
                          value={item.articulo} 
                          onValueChange={(v) => handleActualizarItem(index, 'articulo', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ARTICULOS_PREDEFINIDOS.map((art) => (
                              <SelectItem key={art} value={art}>{art}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.kgCamara}
                          onChange={(e) => handleActualizarItem(index, 'kgCamara', e.target.value)}
                          placeholder="0.00"
                          className="text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.kgElaborado}
                          onChange={(e) => handleActualizarItem(index, 'kgElaborado', e.target.value)}
                          placeholder="0.00"
                          className="text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.bolsas}
                          onChange={(e) => handleActualizarItem(index, 'bolsas', e.target.value)}
                          placeholder="0"
                          className="text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEliminarArticulo(index)}
                          disabled={menudenciasItems.length === 1}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Fila de totales */}
                  <TableRow className="bg-emerald-50 font-bold">
                    <TableCell>TOTALES</TableCell>
                    <TableCell className="text-center">{totalesMenudencias.kgCamara.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{totalesMenudencias.kgElaborado.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{totalesMenudencias.bolsas}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={handleAgregarArticulo}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Artículo
              </Button>
              <Button 
                onClick={handleGuardarMenudencias} 
                disabled={saving || !tropaSeleccionada}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Menudencias'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Secciones 2 y 3 en grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sección 2: Pesaje Interno */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-amber-50 rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                Pesaje Interno
              </CardTitle>
              <CardDescription>
                Registro de grasa, lavadito y bolsa azul
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Tropa</Label>
                  <Select value={tropaPesajeInterno} onValueChange={setTropaPesajeInterno}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione tropa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tropas.slice(0, 20).map((t) => (
                        <SelectItem key={t.id} value={t.codigo}>
                          {t.codigo} - {t.usuarioFaena?.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Grasa (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={grasa}
                      onChange={(e) => setGrasa(e.target.value)}
                      placeholder="0.00"
                      className="text-center font-bold"
                    />
                  </div>
                  <div>
                    <Label>Lavadito (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={lavadito}
                      onChange={(e) => setLavadito(e.target.value)}
                      placeholder="0.00"
                      className="text-center font-bold"
                    />
                  </div>
                  <div>
                    <Label>Bolsa Azul (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bolsaAzul}
                      onChange={(e) => setBolsaAzul(e.target.value)}
                      placeholder="0.00"
                      className="text-center font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="text-sm">
                    <span className="text-stone-500">Total: </span>
                    <span className="font-bold text-amber-600">{totalPesajeInterno.toFixed(2)} kg</span>
                  </div>
                  <Button 
                    onClick={handleGuardarPesajeInterno}
                    disabled={saving || !tropaPesajeInterno}
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sección 3: Pesaje Báscula (Manitou) */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-blue-50 rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <Weight className="w-5 h-5 text-blue-600" />
                Pesaje Báscula (Manitou)
              </CardTitle>
              <CardDescription>
                Registro de hueso, grasa y despojo
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Tropa</Label>
                  <Select value={tropaPesajeBascula} onValueChange={setTropaPesajeBascula}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione tropa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tropas.slice(0, 20).map((t) => (
                        <SelectItem key={t.id} value={t.codigo}>
                          {t.codigo} - {t.usuarioFaena?.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Hueso (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={hueso}
                      onChange={(e) => setHueso(e.target.value)}
                      placeholder="0.00"
                      className="text-center font-bold"
                    />
                  </div>
                  <div>
                    <Label>Grasa (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={grasaBascula}
                      onChange={(e) => setGrasaBascula(e.target.value)}
                      placeholder="0.00"
                      className="text-center font-bold"
                    />
                  </div>
                  <div>
                    <Label>Despojo (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={despojo}
                      onChange={(e) => setDespojo(e.target.value)}
                      placeholder="0.00"
                      className="text-center font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="text-sm">
                    <span className="text-stone-500">Total: </span>
                    <span className="font-bold text-blue-600">{totalPesajeBascula.toFixed(2)} kg</span>
                  </div>
                  <Button 
                    onClick={handleGuardarPesajeBascula}
                    disabled={saving || !tropaPesajeBascula}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección 4: Historial */}
        <Card className="border-0 shadow-md">
          <CardHeader 
            className="bg-stone-50 rounded-t-lg cursor-pointer"
            onClick={() => setHistorialExpandido(!historialExpandido)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-stone-600" />
                  Historial de Registros
                </CardTitle>
                <CardDescription>
                  Todos los registros de menudencias y pesajes
                </CardDescription>
              </div>
              {historialExpandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </CardHeader>
          
          {historialExpandido && (
            <CardContent className="p-4">
              {/* Filtros */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Label className="mb-2 block">Filtrar por Tropa</Label>
                  <Select value={filtroTropa} onValueChange={setFiltroTropa}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las tropas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las tropas</SelectItem>
                      {tropas.map((t) => (
                        <SelectItem key={t.id} value={t.codigo}>{t.codigo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Label className="mb-2 block">Filtrar por Fecha</Label>
                  <Input
                    type="date"
                    value={filtroFecha}
                    onChange={(e) => setFiltroFecha(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setFiltroTropa('all'); setFiltroFecha(''); }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </div>

              {/* Tabla de historial */}
              <ScrollArea className="h-96">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tropa</TableHead>
                      <TableHead>Artículo</TableHead>
                      <TableHead className="text-center">KG Cámara</TableHead>
                      <TableHead className="text-center">KG Elaborado</TableHead>
                      <TableHead className="text-center">Bolsas</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historialFiltrado().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-stone-400">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No hay registros
                        </TableCell>
                      </TableRow>
                    ) : (
                      historialFiltrado().map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-sm">
                            {new Date(r.fecha).toLocaleDateString('es-AR')}
                          </TableCell>
                          <TableCell className="font-mono font-bold">{r.tropaCodigo}</TableCell>
                          <TableCell>{r.articulo}</TableCell>
                          <TableCell className="text-center">{r.kgCamara.toFixed(2)}</TableCell>
                          <TableCell className="text-center font-bold text-emerald-600">
                            {r.kgElaborado.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">{r.cantidadBolsas}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEliminarRegistro(r.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}

export default MenudenciasTropaModule
