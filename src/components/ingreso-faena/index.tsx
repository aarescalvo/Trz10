'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  LogIn, RefreshCw, CheckCircle, AlertTriangle, Beef, 
  Barcode, Keyboard, XCircle, Clock, Hash, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ListaFaena {
  id: string
  fecha: string
  estado: string
  cantidadTotal: number
  tropas?: { tropa: Tropa; cantidad: number }[]
  asignaciones?: AsignacionGarron[]
}

interface Tropa {
  id: string
  codigo: string
  especie: string
  cantidadCabezas: number
}

interface AsignacionGarron {
  id: string
  garron: number
  animal: { codigo: string; numero: number; tipoAnimal: string; tropaId: string }
  horaIngreso: string
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function IngresoFaenaModule({ operador }: { operador: Operador }) {
  const [listaActual, setListaActual] = useState<ListaFaena | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [garronInput, setGarronInput] = useState('')
  const [animalInput, setAnimalInput] = useState('')
  const [ultimoGarron, setUltimoGarron] = useState(0)
  
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/lista-faena')
      const data = await res.json()
      
      if (data.success) {
        const abierta = data.data.find((l: ListaFaena) => l.estado === 'ABIERTA' || l.estado === 'EN_PROCESO')
        setListaActual(abierta || null)
        
        if (abierta?.asignaciones && abierta.asignaciones.length > 0) {
          const maxGarron = Math.max(...abierta.asignaciones.map(a => a.garron))
          setUltimoGarron(maxGarron)
          setGarronInput(String(maxGarron + 1))
        } else {
          setUltimoGarron(0)
          setGarronInput('1')
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-focus en el input de animal
  useEffect(() => {
    if (listaActual && inputRef.current) {
      inputRef.current.focus()
    }
  }, [listaActual, saving])

  const handleAsignar = async (dejarSinAsignar: boolean = false) => {
    if (!listaActual || !garronInput) return

    const garronNum = parseInt(garronInput)
    if (isNaN(garronNum) || garronNum < 1) {
      toast.error('Número de garrón inválido')
      return
    }

    // Verificar si el garrón ya existe
    if (listaActual.asignaciones?.some(a => a.garron === garronNum)) {
      toast.error(`El garrón ${garronNum} ya está asignado`)
      return
    }

    // Verificar que no exceda el total
    if (garronNum > listaActual.cantidadTotal) {
      toast.error(`El garrón ${garronNum} excede el total de animales (${listaActual.cantidadTotal})`)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual.id,
          garron: garronNum,
          animalCodigo: dejarSinAsignar ? null : (animalInput || null)
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Garrón ${garronNum} asignado correctamente`)
        setAnimalInput('')
        setUltimoGarron(garronNum)
        setGarronInput(String(garronNum + 1))
        fetchData()
      } else {
        toast.error(data.error || 'Error al asignar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAsignar(false)
    }
  }

  // Calcular progreso
  const progreso = listaActual 
    ? ((listaActual.asignaciones?.length || 0) / listaActual.cantidadTotal) * 100 
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <LogIn className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  if (!listaActual) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-md">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
              <h2 className="text-xl font-bold text-stone-800 mb-2">No hay lista de faena activa</h2>
              <p className="text-stone-500 mb-4">
                Cree una lista de faena desde el módulo correspondiente antes de realizar ingresos.
              </p>
              <Badge variant="outline" className="text-amber-600">
                Vaya a Lista de Faena para comenzar
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header con info */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  <LogIn className="w-8 h-8" />
                  Ingreso a Faena (Cajón)
                </h1>
                <p className="text-amber-100 mt-1">
                  Lista del {new Date(listaActual.fecha).toLocaleDateString('es-AR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{listaActual.asignaciones?.length || 0}</div>
                <div className="text-amber-100">de {listaActual.cantidadTotal} animales</div>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={progreso} className="h-3 bg-amber-300/30" />
            </div>
          </CardContent>
        </Card>

        {/* Panel principal de ingreso */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-stone-50 rounded-t-lg border-b">
            <CardTitle className="text-xl flex items-center gap-2">
              <Barcode className="w-5 h-5 text-amber-600" />
              Asignar Garrón
            </CardTitle>
            <CardDescription>
              Ingrese el número de garrón y escanee el código del animal o déjelo vacío
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Número de Garrón */}
              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  N° Garrón
                </Label>
                <Input
                  type="number"
                  value={garronInput}
                  onChange={(e) => setGarronInput(e.target.value)}
                  className="text-3xl font-bold text-center h-16 border-2 border-amber-300 focus:border-amber-500"
                  min="1"
                  max={listaActual.cantidadTotal}
                />
                <div className="flex justify-between text-sm text-stone-500">
                  <span>Último: {ultimoGarron}</span>
                  <span>Máx: {listaActual.cantidadTotal}</span>
                </div>
              </div>

              {/* Código de Animal */}
              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Barcode className="w-4 h-4" />
                  Código Animal (opcional)
                </Label>
                <Input
                  ref={inputRef}
                  value={animalInput}
                  onChange={(e) => setAnimalInput(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="Escanee o ingrese código..."
                  className="text-xl font-mono h-16"
                  disabled={saving}
                />
                <p className="text-sm text-stone-500">
                  Presione Enter para confirmar
                </p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button
                onClick={() => handleAsignar(false)}
                disabled={saving || !garronInput}
                className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-6 h-6 mr-2" />
                {saving ? 'Asignando...' : 'Asignar Garrón'}
              </Button>
              <Button
                onClick={() => handleAsignar(true)}
                disabled={saving || !garronInput}
                variant="outline"
                className="flex-1 h-14 text-lg border-amber-400 text-amber-600 hover:bg-amber-50"
              >
                <XCircle className="w-6 h-6 mr-2" />
                Sin Asignar (0)
              </Button>
              <Button
                onClick={fetchData}
                variant="ghost"
                className="h-14"
                disabled={saving}
              >
                <RefreshCw className={cn("w-5 h-5", saving && "animate-spin")} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de últimas asignaciones */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-stone-50 rounded-t-lg border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-stone-500" />
                Últimas Asignaciones
              </CardTitle>
              <Badge variant="outline">
                {listaActual.asignaciones?.length || 0} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              {listaActual.asignaciones && listaActual.asignaciones.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-stone-100 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Garrón</th>
                      <th className="text-left p-3 font-medium">Animal</th>
                      <th className="text-left p-3 font-medium">Tipo</th>
                      <th className="text-right p-3 font-medium">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...listaActual.asignaciones]
                      .sort((a, b) => b.garron - a.garron)
                      .slice(0, 10)
                      .map((a) => (
                        <tr key={a.id} className="border-t hover:bg-stone-50">
                          <td className="p-3">
                            <span className="text-xl font-bold text-amber-600">
                              {a.garron}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-sm">
                            {a.animal?.codigo || (
                              <span className="text-stone-400 italic">Sin asignar</span>
                            )}
                          </td>
                          <td className="p-3">
                            {a.animal?.tipoAnimal ? (
                              <Badge variant="outline">{a.animal.tipoAnimal}</Badge>
                            ) : '-'}
                          </td>
                          <td className="p-3 text-right text-stone-500 text-sm">
                            {new Date(a.horaIngreso).toLocaleTimeString('es-AR')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-stone-400">
                  <Beef className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay garrones asignados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info del operador */}
        <div className="text-center text-stone-500 text-sm">
          <User className="w-4 h-4 inline mr-1" />
          Operador: {operador.nombre}
        </div>
      </div>
    </div>
  )
}

export default IngresoFaenaModule
