// NOTA: Componente disponible para uso futuro - verificar antes de eliminar
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardCheck, RefreshCw, AlertTriangle, Link2, Barcode, 
  CheckCircle, Clock, Beef, User, Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AsignacionPendiente {
  id: string
  garron: number
  horaIngreso: string
  listaFaena: {
    id: string
    fecha: string
    cantidadTotal: number
  }
}

interface ListaFaena {
  id: string
  fecha: string
  estado: string
  cantidadTotal: number
  asignaciones?: AsignacionPendiente[]
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function CierreFaenaModule({ operador }: { operador: Operador }) {
  const [listaActual, setListaActual] = useState<ListaFaena | null>(null)
  const [pendientes, setPendientes] = useState<AsignacionPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Asignación actual
  const [pendienteSeleccionado, setPendienteSeleccionado] = useState<AsignacionPendiente | null>(null)
  const [animalInput, setAnimalInput] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/lista-faena')
      const data = await res.json()
      
      if (data.success) {
        // Buscar lista abierta o en proceso
        const abierta = data.data.find((l: ListaFaena) => 
          l.estado === 'ABIERTA' || l.estado === 'EN_PROCESO'
        )
        setListaActual(abierta || null)
        
        // Filtrar pendientes (garrones sin animal asignado)
        if (abierta?.asignaciones) {
          const pend = abierta.asignaciones.filter(
            (a: any) => !a.animalId && !a.animal
          )
          setPendientes(pend)
        } else {
          setPendientes([])
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

  const handleAsignar = async () => {
    if (!pendienteSeleccionado || !animalInput) {
      toast.error('Ingrese el código del animal')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena/asignar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asignacionId: pendienteSeleccionado.id,
          animalCodigo: animalInput
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Garrón ${pendienteSeleccionado.garron} asignado correctamente`)
        setPendienteSeleccionado(null)
        setAnimalInput('')
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
      handleAsignar()
    }
  }

  // Calcular progreso
  const totalGarrones = listaActual?.asignaciones?.length || 0
  const asignados = totalGarrones - pendientes.length
  const progreso = totalGarrones > 0 ? (asignados / totalGarrones) * 100 : 0

  // Filtrar pendientes
  const pendientesFiltrados = pendientes.filter(p => 
    p.garron.toString().includes(searchTerm)
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <ClipboardCheck className="w-8 h-8 animate-pulse text-amber-500" />
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
                No hay una lista de faena abierta para cerrar.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-stone-700 to-stone-800 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  <ClipboardCheck className="w-8 h-8" />
                  Cierre de Faena
                </h1>
                <p className="text-stone-300 mt-1">
                  Asignar animales a garrones pendientes
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{asignados}/{totalGarrones}</div>
                <div className="text-stone-300">garrones asignados</div>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={progreso} className="h-3 bg-stone-600" />
            </div>
          </CardContent>
        </Card>

        {/* Si no hay pendientes */}
        {pendientes.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-bold text-stone-800 mb-2">¡Todos los garrones asignados!</h2>
              <p className="text-stone-500">
                No hay garrones pendientes de asignación.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Panel de asignación */}
            <Card className="border-0 shadow-lg border-2 border-amber-200">
              <CardHeader className="bg-amber-50 rounded-t-lg">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-amber-600" />
                  Asignar Animal a Garrón
                </CardTitle>
                <CardDescription>
                  Seleccione un garrón pendiente y escanee el código del animal
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Garrón seleccionado */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Garrón Seleccionado</Label>
                    {pendienteSeleccionado ? (
                      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                        <div className="text-4xl font-bold text-amber-600 text-center">
                          #{pendienteSeleccionado.garron}
                        </div>
                        <div className="text-sm text-stone-500 text-center mt-2">
                          Ingresado: {new Date(pendienteSeleccionado.horaIngreso).toLocaleTimeString('es-AR')}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => setPendienteSeleccionado(null)}
                        >
                          Cambiar garrón
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 bg-stone-50 border rounded-lg text-center text-stone-400">
                        Seleccione un garrón de la lista
                      </div>
                    )}
                  </div>

                  {/* Código de animal */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium flex items-center gap-2">
                      <Barcode className="w-4 h-4" />
                      Código del Animal
                    </Label>
                    <Input
                      value={animalInput}
                      onChange={(e) => setAnimalInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Escanee o ingrese código..."
                      className="text-xl font-mono h-14"
                      disabled={!pendienteSeleccionado || saving}
                    />
                    <Button
                      onClick={handleAsignar}
                      disabled={saving || !pendienteSeleccionado || !animalInput}
                      className="w-full h-12 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      {saving ? 'Asignando...' : 'Asignar Animal'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de pendientes */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Garrones Pendientes
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar garrón..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-32"
                      />
                    </div>
                    <Badge variant="outline" className="text-amber-600">
                      {pendientes.length} pendientes
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto">
                  {pendientesFiltrados.length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                      No se encontraron garrones
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-4">
                      {pendientesFiltrados.map((p) => (
                        <Button
                          key={p.id}
                          variant={pendienteSeleccionado?.id === p.id ? 'default' : 'outline'}
                          className={cn(
                            "h-14 text-lg font-bold",
                            pendienteSeleccionado?.id === p.id 
                              ? "bg-amber-500 hover:bg-amber-600" 
                              : "hover:bg-amber-50"
                          )}
                          onClick={() => setPendienteSeleccionado(p)}
                        >
                          {p.garron}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Botón actualizar */}
        <div className="flex justify-center">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {/* Info del operador */}
        <div className="text-center text-stone-500 text-sm">
          <User className="w-4 h-4 inline mr-1" />
          Operador: {operador.nombre}
        </div>
      </div>
    </div>
  )
}

export default CierreFaenaModule
