'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle, AlertTriangle, RefreshCw, Edit2, ArrowRightLeft,
  Hash, Beef, Scale, TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { TextoEditable, EditableBlock, useEditor } from '@/components/ui/editable-screen'

interface GarronAsignado {
  garron: number
  animalId: string | null
  animalCodigo: string | null
  tropaCodigo: string | null
  tipoAnimal: string | null
  pesoVivo: number | null
  tieneMediaDer: boolean
  tieneMediaIzq: boolean
  completado: boolean
}

interface RomaneoDetalle {
  id: string
  garron: number
  pesoMediaIzq: number | null
  pesoMediaDer: number | null
  pesoTotal: number | null
  pesoVivo: number | null
  rinde: number | null
  denticion: string | null
  estado: string
  tipoAnimal: string | null
  tropaCodigo: string | null
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function VBFaenaModule({ operador }: { operador: Operador }) {
  const { editMode, getTexto } = useEditor()
  // Datos
  const [garrones, setGarrones] = useState<GarronAsignado[]>([])
  const [romaneos, setRomaneos] = useState<Map<number, RomaneoDetalle>>(new Map())
  
  // Estado
  const [selectedGarron, setSelectedGarron] = useState<GarronAsignado | null>(null)
  const [animalIdNuevo, setAnimalIdNuevo] = useState('')
  const [garronIntercambiar, setGarronIntercambiar] = useState<number | null>(null)
  
  // UI
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [intercambiarDialogOpen, setIntercambiarDialogOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [garronesRes, romaneosRes] = await Promise.all([
        fetch('/api/garrones-asignados'),
        fetch('/api/romaneos-dia')
      ])
      
      const garronesData = await garronesRes.json()
      const romaneosData = await romaneosRes.json()
      
      if (garronesData.success) {
        setGarrones(garronesData.data || [])
      }
      
      if (romaneosData.success) {
        const mapa = new Map<number, RomaneoDetalle>()
        for (const r of romaneosData.data || []) {
          mapa.set(r.garron, r)
        }
        setRomaneos(mapa)
      }
      
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleCambiarAnimal = async () => {
    if (!selectedGarron || !animalIdNuevo.trim()) {
      toast.error('Ingrese el código del animal')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/garrones-asignados/cambiar-animal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garron: selectedGarron.garron,
          nuevoAnimalCodigo: animalIdNuevo.trim(),
          operadorId: operador.id
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success('Animal cambiado correctamente')
        setEditDialogOpen(false)
        setSelectedGarron(null)
        setAnimalIdNuevo('')
        fetchData()
      } else {
        toast.error(data.error || 'Error al cambiar animal')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDesasignarAnimal = async () => {
    if (!selectedGarron) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/garrones-asignados/desasignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garron: selectedGarron.garron,
          operadorId: operador.id
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success('Animal desasignado')
        setEditDialogOpen(false)
        setSelectedGarron(null)
        fetchData()
      } else {
        toast.error(data.error || 'Error al desasignar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleIntercambiarGarrones = async () => {
    if (!selectedGarron || !garronIntercambiar) {
      toast.error('Seleccione ambos garrones')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/garrones-asignados/intercambiar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garron1: selectedGarron.garron,
          garron2: garronIntercambiar,
          operadorId: operador.id
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success('Garrones intercambiados correctamente')
        setIntercambiarDialogOpen(false)
        setSelectedGarron(null)
        setGarronIntercambiar(null)
        fetchData()
      } else {
        toast.error(data.error || 'Error al intercambiar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleCorregirCorrelatividad = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/garrones-asignados/corregir-correlatividad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operadorId: operador.id })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success(`Correlatividad corregida: ${data.data?.corregidos || 0} garrones renumerados`)
        fetchData()
      } else {
        toast.error(data.error || 'Error al corregir')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const getStats = () => {
    const total = garrones.length
    const completados = garrones.filter(g => g.completado).length
    const sinAnimal = garrones.filter(g => !g.animalId).length
    const pendientes = total - completados
    
    return { total, completados, sinAnimal, pendientes }
  }

  const stats = getStats()
  const rindePromedio = Array.from(romaneos.values())
    .filter(r => r.rinde !== null)
    .reduce((acc, r, _, arr) => acc + (r.rinde || 0) / arr.length, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <Hash className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <EditableBlock bloqueId="header" label="Encabezado">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-800">
                <TextoEditable id="vbfaena-titulo" original="VB Faena - Verificación" tag="span" />
              </h1>
              <p className="text-stone-500">
                <TextoEditable id="vbfaena-subtitulo" original="Corrección de garrones y asignaciones post-romaneo" tag="span" />
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                <TextoEditable id="btn-actualizar" original="Actualizar" tag="span" />
              </Button>
            </div>
          </div>
        </EditableBlock>

        {/* Stats */}
        <EditableBlock bloqueId="stats" label="Estadísticas">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-stone-500">
                  <TextoEditable id="vbfaena-total-garrones" original="Total Garrones" tag="span" />
                </p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-green-50">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-green-600">
                  <TextoEditable id="vbfaena-completados" original="Completados" tag="span" />
                </p>
                <p className="text-2xl font-bold text-green-700">{stats.completados}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-orange-50">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-orange-600">
                  <TextoEditable id="vbfaena-sin-identificar" original="Sin Identificar" tag="span" />
                </p>
                <p className="text-2xl font-bold text-orange-700">{stats.sinAnimal}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-blue-50">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-blue-600">
                  <TextoEditable id="vbfaena-pendientes" original="Pendientes" tag="span" />
                </p>
                <p className="text-2xl font-bold text-blue-700">{stats.pendientes}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-stone-500">
                  <TextoEditable id="vbfaena-rinde-prom" original="Rinde Prom." tag="span" />
                </p>
                <p className="text-2xl font-bold text-amber-600">
                  {rindePromedio > 0 ? `${rindePromedio.toFixed(1)}%` : '-'}
                </p>
              </CardContent>
            </Card>
          </div>
        </EditableBlock>

        {/* Botones de acción */}
        <EditableBlock bloqueId="acciones" label="Acciones">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCorregirCorrelatividad} disabled={saving}>
                  <Hash className="w-4 h-4 mr-2" />
                  <TextoEditable id="btn-corregir-correlatividad" original="Corregir Correlatividad" tag="span" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => selectedGarron ? setIntercambiarDialogOpen(true) : toast.error('Seleccione un garrón primero')}
                  disabled={saving}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  <TextoEditable id="btn-intercambiar-garrones" original="Intercambiar Garrones" tag="span" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </EditableBlock>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista de garrones */}
          <EditableBlock bloqueId="lista-garrones" label="Lista de Garrones">
            <Card className="lg:col-span-1 border-0 shadow-md">
              <CardHeader className="bg-stone-50 py-3">
                <CardTitle className="text-base">
                  <TextoEditable id="vbfaena-garrones-dia" original="Garrones del Día" tag="span" />
                </CardTitle>
                <CardDescription>
                  <TextoEditable id="vbfaena-click-garron" original="Click en un garrón para ver detalle y editar" tag="span" />
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="divide-y">
                    {garrones.map((g) => {
                      const romaneo = romaneos.get(g.garron)
                      
                      return (
                        <button
                          key={g.garron}
                          onClick={() => setSelectedGarron(g)}
                          className={`w-full p-3 text-left hover:bg-stone-50 transition-colors ${
                            selectedGarron?.garron === g.garron ? 'bg-amber-50 border-l-4 border-amber-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-bold text-amber-600">#{g.garron}</span>
                              <div>
                                {g.animalId ? (
                                  <>
                                    <p className="font-medium">{g.animalCodigo}</p>
                                    <p className="text-xs text-stone-500">{g.tropaCodigo} • {g.tipoAnimal}</p>
                                  </>
                                ) : (
                                  <Badge variant="outline" className="text-orange-600">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    <TextoEditable id="vbfaena-sin-identificar-badge" original="Sin identificar" tag="span" />
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {g.completado ? (
                                <Badge className="bg-green-100 text-green-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  OK
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  {g.tieneMediaDer ? '✓' : '○'} Der | {g.tieneMediaIzq ? '✓' : '○'} Izq
                                </Badge>
                              )}
                              {romaneo && (
                                <p className="text-xs text-stone-500 mt-1">
                                  {romaneo.pesoTotal?.toFixed(0) || '-'} kg
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </EditableBlock>

          {/* Panel de detalle */}
          <EditableBlock bloqueId="detalle" label="Panel de Detalle">
            <Card className="lg:col-span-2 border-0 shadow-md">
              <CardHeader className="bg-stone-50 py-3">
                <CardTitle className="text-base">
                  {selectedGarron ? 
                    <><TextoEditable id="vbfaena-detalle-garron" original="Detalle Garrón" tag="span" /> #{selectedGarron.garron}</> : 
                    <TextoEditable id="vbfaena-seleccione-garron" original="Seleccione un garrón" tag="span" />
                  }
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!selectedGarron ? (
                  <div className="text-center py-12 text-stone-400">
                    <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>
                      <TextoEditable id="vbfaena-seleccione-lista" original="Seleccione un garrón de la lista para ver su detalle" tag="span" />
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Datos del animal */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-stone-50 rounded-lg">
                        <p className="text-xs text-stone-500">
                          <TextoEditable id="vbfaena-label-garron" original="Garrón" tag="span" />
                        </p>
                        <p className="text-2xl font-bold">#{selectedGarron.garron}</p>
                      </div>
                      <div className="p-3 bg-stone-50 rounded-lg">
                        <p className="text-xs text-stone-500">
                          <TextoEditable id="vbfaena-label-animal" original="Animal" tag="span" />
                        </p>
                        <p className="font-medium">{selectedGarron.animalCodigo || 'Sin asignar'}</p>
                      </div>
                      <div className="p-3 bg-stone-50 rounded-lg">
                        <p className="text-xs text-stone-500">
                          <TextoEditable id="vbfaena-label-tipo" original="Tipo" tag="span" />
                        </p>
                        <p className="font-medium">{selectedGarron.tipoAnimal || '-'}</p>
                      </div>
                      <div className="p-3 bg-stone-50 rounded-lg">
                        <p className="text-xs text-stone-500">
                          <TextoEditable id="vbfaena-label-pvivo" original="P. Vivo" tag="span" />
                        </p>
                        <p className="font-medium">{selectedGarron.pesoVivo?.toFixed(0) || '-'} kg</p>
                      </div>
                    </div>

                    {/* Datos del romaneo */}
                    {romaneos.has(selectedGarron.garron) && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {(() => {
                            const r = romaneos.get(selectedGarron.garron)!
                            return (
                              <>
                                <div className="p-3 bg-blue-50 rounded-lg text-center">
                                  <p className="text-xs text-blue-600">
                                    <TextoEditable id="vbfaena-media-der" original="Media Der" tag="span" />
                                  </p>
                                  <p className="text-xl font-bold text-blue-700">
                                    {r.pesoMediaDer?.toFixed(1) || '-'} kg
                                  </p>
                                </div>
                                <div className="p-3 bg-pink-50 rounded-lg text-center">
                                  <p className="text-xs text-pink-600">
                                    <TextoEditable id="vbfaena-media-izq" original="Media Izq" tag="span" />
                                  </p>
                                  <p className="text-xl font-bold text-pink-700">
                                    {r.pesoMediaIzq?.toFixed(1) || '-'} kg
                                  </p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-lg text-center">
                                  <p className="text-xs text-green-600">
                                    <TextoEditable id="vbfaena-total" original="Total" tag="span" />
                                  </p>
                                  <p className="text-xl font-bold text-green-700">
                                    {r.pesoTotal?.toFixed(1) || '-'} kg
                                  </p>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-lg text-center">
                                  <p className="text-xs text-amber-600">
                                    <TextoEditable id="vbfaena-rinde" original="Rinde" tag="span" />
                                  </p>
                                  <p className="text-xl font-bold text-amber-700">
                                    {r.rinde?.toFixed(1) || '-'}%
                                  </p>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      </>
                    )}

                    <Separator />

                    {/* Acciones */}
                    <div className="space-y-3">
                      <h4 className="font-medium">
                        <TextoEditable id="vbfaena-acciones-title" original="Acciones" tag="span" />
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setEditDialogOpen(true)}
                          className="h-12"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          <TextoEditable id="btn-cambiar-animal" original="Cambiar Animal" tag="span" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setIntercambiarDialogOpen(true)}
                          className="h-12"
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-2" />
                          <TextoEditable id="btn-intercambiar" original="Intercambiar" tag="span" />
                        </Button>
                      </div>
                    </div>

                    {/* Estado */}
                    <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg">
                      <span className="text-sm text-stone-500">
                        <TextoEditable id="vbfaena-estado-label" original="Estado:" tag="span" />
                      </span>
                      {selectedGarron.completado ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <TextoEditable id="vbfaena-completado" original="Completado" tag="span" />
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <TextoEditable id="vbfaena-pendiente" original="Pendiente" tag="span" />
                        </Badge>
                      )}
                      <span className="text-sm text-stone-500 ml-4">
                        Der: {selectedGarron.tieneMediaDer ? '✓' : '○'} | 
                        Izq: {selectedGarron.tieneMediaIzq ? '✓' : '○'}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </EditableBlock>
        </div>
      </div>

      {/* Dialog para cambiar animal */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md" maximizable>
          <DialogHeader>
            <DialogTitle>
              <TextoEditable id="vbfaena-dialog-cambiar-title" original="Cambiar Animal Asignado" tag="span" />
            </DialogTitle>
            <DialogDescription>
              <TextoEditable id="vbfaena-dialog-cambiar-desc" original="Ingrese el código del nuevo animal para el garrón" tag="span" /> #{selectedGarron?.garron}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                <TextoEditable id="vbfaena-label-codigo-animal" original="Código del Animal" tag="span" />
              </Label>
              <Input
                value={animalIdNuevo}
                onChange={(e) => setAnimalIdNuevo(e.target.value)}
                placeholder="Ej: B20260001-023"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleDesasignarAnimal} disabled={saving}>
              <TextoEditable id="btn-desasignar" original="Desasignar" tag="span" />
            </Button>
            <Button onClick={handleCambiarAnimal} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? 'Guardando...' : <TextoEditable id="btn-cambiar" original="Cambiar" tag="span" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para intercambiar garrones */}
      <Dialog open={intercambiarDialogOpen} onOpenChange={setIntercambiarDialogOpen}>
        <DialogContent className="sm:max-w-md" maximizable>
          <DialogHeader>
            <DialogTitle>
              <TextoEditable id="vbfaena-dialog-intercambiar-title" original="Intercambiar Garrones" tag="span" />
            </DialogTitle>
            <DialogDescription>
              <TextoEditable id="vbfaena-dialog-intercambiar-desc" original="Intercambiar el animal del garrón" tag="span" /> #{selectedGarron?.garron}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                <TextoEditable id="vbfaena-label-garron-intercambiar" original="Garrón a intercambiar" tag="span" />
              </Label>
              <Select 
                value={garronIntercambiar?.toString() || ''} 
                onValueChange={(v) => setGarronIntercambiar(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar garrón" />
                </SelectTrigger>
                <SelectContent>
                  {garrones
                    .filter(g => g.garron !== selectedGarron?.garron)
                    .map((g) => (
                      <SelectItem key={g.garron} value={g.garron.toString()}>
                        #{g.garron} - {g.animalCodigo || 'Sin identificar'}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            
            {garronIntercambiar && (
              <div className="p-3 bg-stone-50 rounded-lg">
                <p className="text-sm">
                  <TextoEditable id="vbfaena-intercambiar-label" original="Intercambiar:" tag="span" />
                </p>
                <p className="font-medium">
                  #{selectedGarron?.garron} ({selectedGarron?.animalCodigo || 'Sin asignar'})
                </p>
                <p className="text-center my-2">↔️</p>
                <p className="font-medium">
                  #{garronIntercambiar} ({garrones.find(g => g.garron === garronIntercambiar)?.animalCodigo || 'Sin asignar'})
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntercambiarDialogOpen(false)}>
              <TextoEditable id="btn-cancelar" original="Cancelar" tag="span" />
            </Button>
            <Button 
              onClick={handleIntercambiarGarrones} 
              disabled={saving || !garronIntercambiar}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? 'Intercambiando...' : <TextoEditable id="btn-intercambiar-dialog" original="Intercambiar" tag="span" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default VBFaenaModule
