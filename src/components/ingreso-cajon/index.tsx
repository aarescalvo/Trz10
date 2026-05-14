'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  BoxSelect, RefreshCw, Link2, Hash, CheckCircle, AlertTriangle,
  Delete, Check, Edit3, Save, X,
  Eye, Settings2, Type, Palette
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ==================== TIPOS ====================
interface AnimalLista {
  id: string
  codigo: string
  tropaCodigo: string
  tipoAnimal: string
  pesoVivo: number | null
  numero: number
  garronAsignado: number | null
}

interface GarronAsignado {
  garron: number
  animalId: string | null
  animalCodigo: string | null
  tropaCodigo: string | null
  tipoAnimal: string | null
  pesoVivo: number | null
  completado: boolean
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
  rol?: string
  permisos?: Record<string, boolean>
}

// ==================== SISTEMA DE LAYOUT COMPLETO ====================
interface BloqueLayout {
  id: string
  label: string
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  minWidth: number
  minHeight: number
  // Textos personalizables
  titulo?: string
  subtitulo?: string
  placeholder?: string
}

interface BotonConfig {
  id: string
  texto: string
  visible: boolean
  color: string
}

interface TextosConfig {
  tituloModulo: string
  subtituloModulo: string
  labelProximoGarron: string
  labelLista: string
  labelAsignados: string
  labelPendientes: string
  labelSinIdentificar: string
  labelAnimalEncontrado: string
  labelNoEncontrado: string
  labelSinGarrones: string
  textoDisplayVacio: string
}

// Valores por defecto - Layout más compacto
const LAYOUT_DEFAULT: BloqueLayout[] = [
  { id: 'header', label: 'Encabezado', visible: true, x: 20, y: 20, width: 900, height: 50, minWidth: 300, minHeight: 40, titulo: 'Ingreso a Cajón', subtitulo: 'Asignación de garrones' },
  { id: 'resumen', label: 'Resumen', visible: true, x: 20, y: 80, width: 900, height: 40, minWidth: 200, minHeight: 30 },
  { id: 'teclado', label: 'Teclado Numérico', visible: true, x: 20, y: 130, width: 450, height: 450, minWidth: 320, minHeight: 350, titulo: 'Ingreso de Número', placeholder: 'Número de Animal' },
  { id: 'listaGarrones', label: 'Lista de Garrones', visible: true, x: 490, y: 130, width: 430, height: 450, minWidth: 250, minHeight: 250, titulo: 'Garrones Asignados', subtitulo: 'Últimas asignaciones' }
]

const BOTONES_DEFAULT: BotonConfig[] = [
  { id: 'asignar', texto: 'ASIGNAR GARRÓN', visible: true, color: 'green' },
  { id: 'sinIdentificar', texto: 'ASIGNAR SIN IDENTIFICAR', visible: true, color: 'orange' }
]

const TEXTOS_DEFAULT: TextosConfig = {
  tituloModulo: 'Ingreso a Cajón',
  subtituloModulo: 'Asignación de garrones',
  labelProximoGarron: 'Próximo',
  labelLista: 'Lista',
  labelAsignados: 'Asignados',
  labelPendientes: 'Pendientes',
  labelSinIdentificar: 'Sin identificar',
  labelAnimalEncontrado: 'Animal encontrado',
  labelNoEncontrado: 'No se encontró animal',
  labelSinGarrones: 'No hay garrones asignados',
  textoDisplayVacio: '_ _ _'
}



// ==================== TIPOS PARA CUPOS ====================
interface CupoTropa {
  tropaId: string
  tropaCodigo: string
  tropaNumero: number
  usuarioFaena: string
  cantidadAsignada: number
  cantidadAsignadaGarron: number
  cantidadPendiente: number
  animalesDisponibles: number
}

interface GarronItem {
  garron: number
  tropaId: string
  tropaCodigo: string
  usuarioFaena: string
  animalNumero: number | null
  animalId: string | null
  tipoAnimal: string | null
  pesoVivo: number | null
  completado: boolean
  asignado: boolean
  sinIdentificar: boolean
}

// ==================== COMPONENTE PRINCIPAL ====================
export function IngresoCajonModule({ operador }: { operador: Operador }) {
  // Datos - NUEVO SISTEMA DE GARRONES ORDENADOS
  const [garrones, setGarrones] = useState<GarronItem[]>([])
  const [totalAsignados, setTotalAsignados] = useState(0)
  const [totalPendientes, setTotalPendientes] = useState(0)
  const [listaFaenaId, setListaFaenaId] = useState<string | null>(null)
  const [listaFaenaNumero, setListaFaenaNumero] = useState<number | null>(null)
  const [listaFaenaFecha, setListaFaenaFecha] = useState<string | null>(null)
  const [listasDisponibles, setListasDisponibles] = useState<{id: string; numero: number; fecha: string; estado: string}[]>([])
  const [garronesAsignados, setGarronesAsignados] = useState<GarronAsignado[]>([])
  
  // Estado
  const [proximoGarron, setProximoGarron] = useState(1)
  const [garronActual, setGarronActual] = useState<GarronItem | null>(null)
  const [numeroAnimal, setNumeroAnimal] = useState('')
  const [animalEncontrado, setAnimalEncontrado] = useState<AnimalLista | null>(null)
  
  // UI
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Layout
  const [editMode, setEditMode] = useState(false)
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [bloques, setBloques] = useState<BloqueLayout[]>(LAYOUT_DEFAULT)
  const [botones, setBotones] = useState<BotonConfig[]>(BOTONES_DEFAULT)
  const [textos, setTextos] = useState<TextosConfig>(TEXTOS_DEFAULT)
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  
  const isAdmin = operador.rol === 'ADMINISTRADOR' || (operador.permisos?.puedeAdminSistema ?? false)

  useEffect(() => {
    fetchLayout()
    fetchData()
  }, [])

  const fetchLayout = async () => {
    try {
      const res = await fetch('/api/layout-modulo?modulo=ingresoCajon')
      const data = await res.json()
      
      if (data.success) {
        if (data.data?.layout?.items) setBloques(data.data.layout.items)
        if (data.data?.botones?.items) setBotones(data.data.botones.items)
        if (data.data?.textos) setTextos({ ...TEXTOS_DEFAULT, ...data.data.textos })
      }
    } catch (error) {
      console.error('Error loading layout:', error)
    } finally {
      setLayoutLoaded(true)
    }
  }

  // Obtener garrones ordenados con tropa asignada
  const fetchData = async (listaIdOverride?: string | null) => {
    setLoading(true)
    try {
      const listaQueryParam = listaIdOverride || listaFaenaId
      const garronesUrl = listaQueryParam 
        ? `/api/lista-faena/garrones?listaId=${listaQueryParam}` 
        : '/api/lista-faena/garrones'
      const [garronesRes, asignacionesRes, listasRes] = await Promise.all([
        fetch(garronesUrl),
        fetch('/api/garrones-asignados'),
        fetch('/api/lista-faena')
      ])
      
      const garronesData = await garronesRes.json()
      const asignacionesData = await asignacionesRes.json()
      const listasData = await listasRes.json()
      
      // Cargar listas disponibles para el dropdown
      if (listasData.success) {
        const listasActivas = listasData.data
          .filter((l: any) => ['ABIERTA', 'EN_PROCESO', 'CERRADA'].includes(l.estado))
          .map((l: any) => ({
            id: l.id,
            numero: l.numero,
            fecha: l.fecha,
            estado: l.estado
          }))
          .sort((a: any, b: any) => b.numero - a.numero)
        setListasDisponibles(listasActivas)
      }
      
      if (garronesData.success) {
        setGarrones(garronesData.data.garrones || [])
        setTotalAsignados(garronesData.data.totalAsignados || 0)
        setTotalPendientes(garronesData.data.totalPendientes || 0)
        setListaFaenaId(garronesData.data.listaId)
        setListaFaenaNumero(garronesData.data.listaNumero)
        setListaFaenaFecha(garronesData.data.listaFecha)
        setProximoGarron(garronesData.data.proximoGarron || 1)
        
        // Encontrar el garrón actual (próximo pendiente)
        const pendiente = garronesData.data.garrones?.find((g: GarronItem) => !g.asignado)
        setGarronActual(pendiente || null)
      }
      
      if (asignacionesData.success) {
        setGarronesAsignados(asignacionesData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (key: string) => {
    if (key === 'clear') { setNumeroAnimal(''); setAnimalEncontrado(null) }
    else if (key === 'backspace') { setNumeroAnimal(prev => prev.slice(0, -1)); setAnimalEncontrado(null) }
    else if (numeroAnimal.length < 4) {
      const newNumber = numeroAnimal + key
      setNumeroAnimal(newNumber)
      if (newNumber.length >= 1) buscarAnimal(newNumber)
    }
  }

  // Cambiar lista de faena seleccionada
  const handleCambiarLista = (nuevoListaId: string) => {
    fetchData(nuevoListaId)
  }

  // Formatear fecha
  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return ''
    const d = new Date(fecha)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Buscar animal por número en la tropa del garrón actual
  const buscarAnimal = async (numero: string) => {
    const numInt = parseInt(numero)
    if (isNaN(numInt)) {
      setAnimalEncontrado(null)
      return
    }

    if (!garronActual) {
      toast.warning('No hay garrones pendientes')
      setAnimalEncontrado(null)
      return
    }

    // Buscar animal en la tropa del garrón actual
    try {
      const res = await fetch(`/api/animales/buscar?numero=${numInt}&tropaId=${garronActual.tropaId}`)
      const data = await res.json()
      
      if (data.success && data.data) {
        setAnimalEncontrado({
          id: data.data.id,
          codigo: data.data.codigo,
          tropaCodigo: data.data.tropaCodigo,
          tipoAnimal: data.data.tipoAnimal,
          pesoVivo: data.data.pesoVivo,
          numero: data.data.numero,
          garronAsignado: null
        })
      } else {
        setAnimalEncontrado(null)
        if (data.error) {
          toast.error(data.error)
        }
      }
    } catch (error) {
      console.error('Error buscando animal:', error)
      setAnimalEncontrado(null)
    }
  }

  // Asignar garrón al animal encontrado
  const handleAsignarGarron = async (animalId: string | null) => {
    if (!garronActual) {
      toast.error('No hay garrón pendiente')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/garrones-asignados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          garron: garronActual.garron, 
          animalId: animalId || null, 
          tropaCodigo: garronActual.tropaCodigo,
          listaFaenaId: listaFaenaId,
          operadorId: operador.id 
        })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success(`Garrón #${garronActual.garron} asignado`, { 
          description: data.data.animalCodigo 
            ? `Animal: ${data.data.animalCodigo}` 
            : `Tropa: ${garronActual.tropaCodigo} (Sin identificar)`
        })
        setNumeroAnimal('')
        setAnimalEncontrado(null)
        fetchData()
      } else toast.error(data.error || 'Error al asignar')
    } catch { toast.error('Error de conexión') }
    finally { setSaving(false) }
  }

  // Asignar sin identificar (sin número de animal)
  const handleAsignarSinIdentificar = async () => {
    if (!garronActual) {
      toast.error('No hay garrón pendiente')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/garrones-asignados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          garron: garronActual.garron, 
          tropaCodigo: garronActual.tropaCodigo,
          listaFaenaId: listaFaenaId,
          sinIdentificar: true,
          operadorId: operador.id 
        })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success(`Garrón #${garronActual.garron} asignado sin identificar`, { 
          description: `Tropa: ${garronActual.tropaCodigo}` 
        })
        setNumeroAnimal('')
        setAnimalEncontrado(null)
        fetchData()
      } else toast.error(data.error || 'Error al asignar')
    } catch { toast.error('Error de conexión') }
    finally { setSaving(false) }
  }

  const getAnimalesPendientes = () => totalPendientes

  const updateBloque = useCallback((id: string, updates: Partial<BloqueLayout>) => {
    setBloques(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }, [])

  const updateBoton = (id: string, updates: Partial<BotonConfig>) => {
    setBotones(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const updateTexto = (key: keyof TextosConfig, value: string) => {
    setTextos(prev => ({ ...prev, [key]: value }))
  }



  const handleSaveLayout = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/layout-modulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modulo: 'ingresoCajon',
          layout: { items: bloques },
          botones: { items: botones },
          textos: textos
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Layout guardado correctamente')
        setEditMode(false)
        setShowConfigPanel(false)
      } else toast.error(data.error || 'Error al guardar')
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Error al guardar layout')
    } finally { setSaving(false) }
  }

  const resetLayout = () => {
    setBloques(LAYOUT_DEFAULT)
    setBotones(BOTONES_DEFAULT)
    setTextos(TEXTOS_DEFAULT)
    toast.info('Layout restablecido')
  }

  if (loading || !layoutLoaded) {
    return <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center"><BoxSelect className="w-8 h-8 animate-pulse text-amber-500" /></div>
  }

  const bloquesVisibles = bloques.filter(b => b.visible)
  const getBloque = (id: string) => bloques.find(b => b.id === id)
  const getBoton = (id: string) => botones.find(b => b.id === id)

  const headerVisible = bloquesVisibles.some(b => b.id === 'header')
  const resumenVisible = bloquesVisibles.some(b => b.id === 'resumen')
  const tecladoVisible = bloquesVisibles.some(b => b.id === 'teclado')
  const listaVisible = bloquesVisibles.some(b => b.id === 'listaGarrones')

  return (
    <div className="bg-gradient-to-br from-stone-50 to-stone-100 p-3 overflow-x-hidden">
      
      {/* Botón flotante de edición */}
      {isAdmin && (
        <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
          {!editMode ? (
            <Button variant="outline" size="icon" onClick={() => { setEditMode(true); setShowConfigPanel(true) }} className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 shadow-lg h-8 w-8" title="Editar Layout">
              <Edit3 className="w-4 h-4" />
            </Button>
          ) : (
            <>
              <Button variant="outline" size="icon" onClick={() => setShowConfigPanel(!showConfigPanel)} className="bg-white border-stone-300 shadow-lg h-8 w-8" title="Configuración"><Settings2 className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" onClick={resetLayout} className="bg-white border-stone-300 shadow-lg h-8 w-8" title="Resetear"><RefreshCw className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => { setEditMode(false); setShowConfigPanel(false) }} className="bg-white border-stone-300 shadow-lg h-8 w-8" title="Cancelar"><X className="w-4 h-4" /></Button>
              <Button size="icon" onClick={handleSaveLayout} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white shadow-lg h-8 w-8" title="Guardar"><Save className="w-4 h-4" /></Button>
            </>
          )}
        </div>
      )}

      {/* Panel de configuración lateral */}
      {editMode && showConfigPanel && (
        <div className="fixed top-28 right-4 z-50 w-72 bg-white rounded-lg shadow-2xl border-2 border-amber-200 max-h-[70vh] overflow-hidden">
          <div className="bg-amber-50 px-3 py-2 border-b border-amber-200">
            <h3 className="font-bold text-amber-800 flex items-center gap-2 text-sm"><Settings2 className="w-3 h-3" /> Personalización</h3>
          </div>
          
          <Tabs defaultValue="secciones" className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-stone-100 h-8">
              <TabsTrigger value="secciones" className="text-xs py-1">Secciones</TabsTrigger>
              <TabsTrigger value="textos" className="text-xs py-1">Textos</TabsTrigger>
              <TabsTrigger value="botones" className="text-xs py-1">Botones</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="h-[45vh]">
              <TabsContent value="secciones" className="p-3 space-y-1.5">
                <h4 className="font-medium text-xs text-stone-500 flex items-center gap-1"><Eye className="w-3 h-3" /> Visibilidad</h4>
                {bloques.map((bloque) => (
                  <div key={bloque.id} className="flex items-center gap-2 p-1.5 bg-stone-50 rounded">
                    <span className="flex-1 text-xs font-medium">{bloque.label}</span>
                    <Switch checked={bloque.visible} onCheckedChange={(v) => updateBloque(bloque.id, { visible: v })} />
                  </div>
                ))}
              </TabsContent>
              
              <TabsContent value="textos" className="p-3 space-y-2">
                <h4 className="font-medium text-xs text-stone-500 flex items-center gap-1"><Type className="w-3 h-3" /> Textos</h4>
                
                <div className="space-y-1">
                  <Label className="text-xs">Título</Label>
                  <Input value={textos.tituloModulo} onChange={(e) => updateTexto('tituloModulo', e.target.value)} className="h-7 text-xs" />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Subtítulo</Label>
                  <Input value={textos.subtituloModulo} onChange={(e) => updateTexto('subtituloModulo', e.target.value)} className="h-7 text-xs" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">"Próximo Garrón"</Label>
                  <Input value={textos.labelProximoGarron} onChange={(e) => updateTexto('labelProximoGarron', e.target.value)} className="h-7 text-xs" />
                </div>

                <Separator className="my-2" />
                
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <Label className="text-xs">Lista</Label>
                    <Input value={textos.labelLista} onChange={(e) => updateTexto('labelLista', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Asignados</Label>
                    <Input value={textos.labelAsignados} onChange={(e) => updateTexto('labelAsignados', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Pendientes</Label>
                    <Input value={textos.labelPendientes} onChange={(e) => updateTexto('labelPendientes', e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>

                <Separator className="my-2" />
                
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-xs">"Sin Identificar"</Label>
                    <Input value={textos.labelSinIdentificar} onChange={(e) => updateTexto('labelSinIdentificar', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">"Animal Encontrado"</Label>
                    <Input value={textos.labelAnimalEncontrado} onChange={(e) => updateTexto('labelAnimalEncontrado', e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-xs">"No hay garrones"</Label>
                    <Input value={textos.labelSinGarrones} onChange={(e) => updateTexto('labelSinGarrones', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Display vacío</Label>
                    <Input value={textos.textoDisplayVacio} onChange={(e) => updateTexto('textoDisplayVacio', e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="botones" className="p-3 space-y-2">
                <h4 className="font-medium text-xs text-stone-500 flex items-center gap-1"><Palette className="w-3 h-3" /> Botones</h4>
                {botones.map((btn) => (
                  <div key={btn.id} className="p-2 bg-stone-50 rounded space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">{btn.id}</Label>
                      <Switch checked={btn.visible} onCheckedChange={(v) => updateBoton(btn.id, { visible: v })} />
                    </div>
                    <Input value={btn.texto} onChange={(e) => updateBoton(btn.id, { texto: e.target.value })} className="h-7 text-xs" />
                  </div>
                ))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      )}

      {/* Contenedor principal compacto */}
      <div className="max-w-6xl mx-auto space-y-2">
        {/* BLOQUE: Header */}
        {headerVisible && (
          <div className="bg-gradient-to-r from-stone-800 to-stone-700 p-2.5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-white">{textos.tituloModulo}</h1>
              <p className="text-stone-300 text-xs">{textos.subtituloModulo}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {listaFaenaNumero !== null && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs px-2 py-1 bg-white/10 border-white/20 text-white">
                    Lista N° <span className="font-bold">{String(listaFaenaNumero).padStart(4, '0')}</span>
                    {listaFaenaFecha && <span className="ml-1 opacity-75">({formatearFecha(listaFaenaFecha)})</span>}
                  </Badge>
                  {listasDisponibles.length > 1 && (
                    <Select value={listaFaenaId || ''} onValueChange={handleCambiarLista}>
                      <SelectTrigger className="w-[180px] h-7 text-xs bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Cambiar lista" />
                      </SelectTrigger>
                      <SelectContent>
                        {listasDisponibles.map((lista) => (
                          <SelectItem key={lista.id} value={lista.id} className="text-xs">
                            N° {String(lista.numero).padStart(4, '0')} — {formatearFecha(lista.fecha)} ({lista.estado})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => fetchData()} className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-7 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" /> Actualizar
              </Button>
              <Badge variant="outline" className="text-sm px-2 py-1 bg-amber-500 border-amber-600 text-white">
                {textos.labelProximoGarron}: <span className="font-bold ml-1">#{proximoGarron}</span>
              </Badge>
            </div>
          </div>
        )}

        {/* BLOQUE: Resumen */}
        {resumenVisible && (
          <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs">
            <span className="flex items-center gap-1"><Hash className="w-3 h-3 text-blue-600" /><strong>{textos.labelLista}:</strong> {garrones.length}</span>
            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /><strong>{textos.labelAsignados}:</strong> {totalAsignados}</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-orange-500" /><strong>{textos.labelPendientes}:</strong> {totalPendientes}</span>
          </div>
        )}

        {/* Layout de dos columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* BLOQUE: Teclado */}
          {tecladoVisible && (
            <Card className="border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-amber-50 py-1.5 px-3">
                <CardTitle className="text-xs">{getBloque('teclado')?.titulo || 'Ingreso de Número'}</CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-2">
                {/* Mostrar garrón actual con tropa asignada */}
                {garronActual ? (
                  <div className="p-2 bg-amber-100 border border-amber-300 rounded text-center">
                    <div className="text-[10px] text-amber-600">GARRÓN ACTUAL</div>
                    <div className="text-2xl font-bold text-amber-700">#{garronActual.garron}</div>
                    <div className="text-xs text-amber-800">Tropa: <strong>{garronActual.tropaCodigo}</strong> | {garronActual.usuarioFaena}</div>
                  </div>
                ) : (
                  <div className="p-2 bg-green-100 border border-green-300 rounded text-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                    <div className="text-green-700 text-xs font-medium">Todos asignados</div>
                  </div>
                )}

                <div className="text-center p-1.5 bg-stone-900 rounded">
                  <p className="text-stone-400 text-[9px]">{getBloque('teclado')?.placeholder || 'Número de Animal'}</p>
                  <div className="text-xl font-mono font-bold text-amber-400">{numeroAnimal || textos.textoDisplayVacio}</div>
                </div>

                <div className="grid grid-cols-3 gap-0.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => (
                    <Button key={key} variant={key === 'clear' || key === 'backspace' ? 'destructive' : 'outline'} className="h-8 text-base font-bold" onClick={() => handleKeyPress(key)} disabled={!garronActual}>
                      {key === 'clear' ? <Delete className="w-3 h-3" /> : key === 'backspace' ? '←' : key}
                    </Button>
                  ))}
                </div>

                {animalEncontrado ? (
                  <div className="p-1.5 bg-green-50 border border-green-200 rounded text-xs">
                    <div className="flex items-center gap-1 mb-0.5"><CheckCircle className="w-3 h-3 text-green-600" /><span className="font-medium text-green-700">{textos.labelAnimalEncontrado}</span></div>
                    <div className="grid grid-cols-2 gap-0.5 text-[10px]">
                      <div><span className="text-stone-500">Código:</span> <b>{animalEncontrado.codigo}</b></div>
                      <div><span className="text-stone-500">Tropa:</span> {animalEncontrado.tropaCodigo}</div>
                      <div><span className="text-stone-500">Tipo:</span> {animalEncontrado.tipoAnimal}</div>
                      <div><span className="text-stone-500">Peso:</span> {animalEncontrado.pesoVivo?.toFixed(0) || '-'} kg</div>
                    </div>
                  </div>
                ) : numeroAnimal.length > 0 && (
                  <div className="p-1.5 bg-orange-50 border border-orange-200 rounded text-[10px] text-orange-700">{textos.labelNoEncontrado || 'No encontrado'}: {numeroAnimal}</div>
                )}

                <Separator className="my-1" />

                <div className="space-y-1">
                  {getBoton('asignar')?.visible && (
                    <Button onClick={() => handleAsignarGarron(animalEncontrado?.id || null)} disabled={saving || !garronActual || !animalEncontrado} className="w-full h-8 bg-green-600 hover:bg-green-700 text-xs">
                      <Link2 className="w-3 h-3 mr-1" />{getBoton('asignar')?.texto} #{garronActual?.garron || proximoGarron}
                    </Button>
                  )}
                  {getBoton('sinIdentificar')?.visible && (
                    <Button onClick={handleAsignarSinIdentificar} disabled={saving || !garronActual} variant="outline" className="w-full h-7 border-orange-300 text-orange-600 hover:bg-orange-50 text-[10px]">
                      {getBoton('sinIdentificar')?.texto}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* BLOQUE: Lista de Garrones */}
          {listaVisible && (
            <Card className="border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-stone-50 py-1.5 px-3">
                <CardTitle className="text-xs">{getBloque('listaGarrones')?.titulo || 'Garrones'} ({garrones.filter(g => g.asignado).length}/{garrones.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {garrones.length === 0 ? (
                  <div className="p-3 text-center text-stone-400">
                    <BoxSelect className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    <p className="text-[10px]">{textos.labelSinGarrones}</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-[280px] overflow-y-auto overflow-x-hidden">
                    {garrones.map((g) => (
                      <div key={g.garron} className={cn("px-2 py-1 flex items-center justify-between", !g.asignado && g.garron === garronActual?.garron && "bg-amber-100 border-l-4 border-amber-500", g.asignado && "bg-green-50")}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-bold text-amber-600 w-8">#{g.garron}</span>
                          {g.sinIdentificar ? (
                            <div>
                              <Badge variant="outline" className="text-orange-600 text-[9px]">{textos.labelSinIdentificar}</Badge>
                              <p className="text-[9px] text-stone-500">{g.tropaCodigo}</p>
                            </div>
                          ) : g.animalId ? (
                            <div><p className="font-medium text-[10px]">Animal #{g.animalNumero}</p><p className="text-[9px] text-stone-500">{g.tropaCodigo} • {g.tipoAnimal}</p></div>
                          ) : (
                            <span className="text-[9px] text-stone-400">Pendiente</span>
                          )}
                        </div>
                        <div className="text-right">
                          {g.completado ? (
                            <Badge className="bg-green-100 text-green-700 text-[9px]"><Check className="w-2 h-2 mr-0.5" />OK</Badge>
                          ) : (
                            <span className="text-[9px] text-stone-500">{g.pesoVivo?.toFixed(0) || '-'} kg</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default IngresoCajonModule
