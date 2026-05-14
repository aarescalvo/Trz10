'use client'

import { useState, useEffect } from 'react'
import { 
  ClipboardList, Plus, Calendar, Trash2, 
  CheckCircle, Beef, AlertTriangle, Lock, RefreshCw, Unlock,
  AlertCircle, Printer, Minus, Dog
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { TextoEditable, EditableBlock, useEditor } from '@/components/ui/editable-screen'
import { createLogger } from '@/lib/logger'
const log = createLogger('components.lista-faena.index')

const ESTADOS_LISTA = [
  { id: 'ABIERTA', label: 'Abierta', color: 'bg-green-100 text-green-700' },
  { id: 'CERRADA', label: 'Cerrada', color: 'bg-gray-100 text-gray-700' },
  { id: 'ANULADA', label: 'Anulada', color: 'bg-red-100 text-red-700' },
]

interface StockPorCorral {
  tropaId: string
  tropaCodigo: string
  tropaEspecie: string
  usuarioFaena: { id: string; nombre: string } | null
  corralId: string | null
  corralNombre: string | null
  totalAnimales: number
  enListaAbierta: number
  faenados: number
  disponibles: number
  cantidadEnLista: number
}

interface TropaEnLista {
  id: string
  codigo: string
  especie: string
  usuarioFaena?: { nombre: string }
  corral?: { id: string; nombre: string }
}

interface ListaFaena {
  id: string
  numero: number
  fecha: string
  estado: string
  cantidadTotal: number
  supervisor?: { nombre: string }
  fechaCierre?: string
  observaciones?: string
  tropas?: { tropa: TropaEnLista; cantidad: number; corralId: string | null; corral?: { id: string; nombre: string } }[]
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
  rol?: string
  permisos?: Record<string, boolean>
}

export function ListaFaenaModule({ operador }: { operador: Operador }) {
  const { editMode, getTexto, setTexto, getBloque, updateBloque } = useEditor()
  const [listas, setListas] = useState<ListaFaena[]>([])
  const [stockPorCorral, setStockPorCorral] = useState<StockPorCorral[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [activeTab, setActiveTab] = useState('actual')
  const [listaActual, setListaActual] = useState<ListaFaena | null>(null)
  
  // Dialogs
  const [nuevaListaOpen, setNuevaListaOpen] = useState(false)
  const [cerrarListaOpen, setCerrarListaOpen] = useState(false)
  const [reabrirListaOpen, setReabrirListaOpen] = useState(false)
  const [claveSupervisor, setClaveSupervisor] = useState('')
  const [quitarTropaOpen, setQuitarTropaOpen] = useState(false)
  const [tropaAQuitar, setTropaAQuitar] = useState<{id: string; codigo: string; corralId: string | null; garrones?: number; cantidadActual?: number} | null>(null)
  const [restarCantidadOpen, setRestarCantidadOpen] = useState(false)
  const [tropaARestar, setTropaARestar] = useState<{id: string; codigo: string; cantidadActual: number} | null>(null)
  const [cantidadARestar, setCantidadARestar] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [listasRes, stockRes] = await Promise.all([
        fetch('/api/lista-faena'),
        fetch('/api/tropas/stock-corrales?estado=RECIBIDO,PESADO')
      ])
      
      const listasData = await listasRes.json()
      const stockData = await stockRes.json()
      
      if (listasData.success) {
        // Ordenar por fecha descendente (más reciente primero)
        const sortedListas = listasData.data.sort((a: ListaFaena, b: ListaFaena) => {
          // Primero por fecha (más reciente)
          const fechaA = new Date(a.fecha).getTime()
          const fechaB = new Date(b.fecha).getTime()
          if (fechaB !== fechaA) return fechaB - fechaA
          // Luego por número
          return b.numero - a.numero
        })
        setListas(sortedListas)
        
        // Buscar la lista del día (abierta o cerrada)
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const manana = new Date(hoy)
        manana.setDate(manana.getDate() + 1)
        
        // Priorizar lista ABIERTA del día
        const listaAbiertaHoy = sortedListas.find((l: ListaFaena) => 
          l.estado === 'ABIERTA' && new Date(l.fecha) >= hoy && new Date(l.fecha) < manana
        )
        
        // Si no hay abierta, buscar cerrada del día
        const listaCerradaHoy = sortedListas.find((l: ListaFaena) => 
          l.estado === 'CERRADA' && new Date(l.fecha) >= hoy && new Date(l.fecha) < manana
        )
        
        // Si no hay del día, tomar la más reciente (cualquier estado)
        const listaMasReciente = sortedListas[0]
        
        // Priorizar: ABIERTA hoy > CERRADA hoy > más reciente
        const listaSeleccionada = listaAbiertaHoy || listaCerradaHoy || listaMasReciente || null
        
        log.info(`'[ListaFaena] Listas encontradas:' sortedListas.length`)
        log.info(`'[ListaFaena] Lista seleccionada:' listaSeleccionada?.numero listaSeleccionada?.estado`)
        
        setListaActual(listaSeleccionada)
      }
      
      if (stockData.success) {
        setStockPorCorral(stockData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleCrearLista = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operadorId: operador.id })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Lista de faena N° ${String(data.data.numero).padStart(4, '0')} creada`)
        setNuevaListaOpen(false)
        fetchData()
      } else {
        toast.error(data.error || 'Error al crear lista')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleAgregarTropa = async (tropaId: string, corralId: string | null, cantidad: number, maxDisponible: number) => {
    if (!listaActual) return
    if (cantidad <= 0) {
      toast.error('Ingrese una cantidad válida')
      return
    }
    if (cantidad > maxDisponible) {
      toast.error(`La cantidad excede el stock disponible (${maxDisponible})`)
      return
    }

    try {
      const res = await fetch('/api/lista-faena/tropas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual.id,
          tropaId,
          corralId,
          cantidad
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Agregado a la lista')
        fetchData()
      } else {
        toast.error(data.error || 'Error al agregar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const handleQuitarTropa = async (forzar: boolean = false) => {
    if (!listaActual || !tropaAQuitar) return

    try {
      const res = await fetch(`/api/lista-faena/tropas?listaFaenaId=${listaActual.id}&tropaId=${tropaAQuitar.id}&corralId=${tropaAQuitar.corralId || ''}&forzar=${forzar}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      
      if (data.success) {
        if (data.garronesLiberados > 0) {
          toast.success(`Tropa quitada. ${data.garronesLiberados} garrón(es) liberado(s) para reasignación`)
        } else {
          toast.success('Tropa removida de la lista')
        }
        setQuitarTropaOpen(false)
        setTropaAQuitar(null)
        fetchData()
      } else if (data.requiresConfirmation) {
        setTropaAQuitar({
          ...tropaAQuitar,
          garrones: data.garronesAsignados
        })
        setQuitarTropaOpen(true)
        return
      } else {
        toast.error(data.error || 'Error al quitar tropa')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const handleRestarCantidad = async () => {
    if (!listaActual || !tropaARestar) return
    if (cantidadARestar <= 0 || cantidadARestar >= tropaARestar.cantidadActual) {
      toast.error('La cantidad a restar debe ser mayor a 0 y menor al total asignado')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena/tropas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual.id,
          tropaId: tropaARestar.id,
          cantidad: tropaARestar.cantidadActual - cantidadARestar
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Se restaron ${cantidadARestar} animales de la tropa`)
        setRestarCantidadOpen(false)
        setTropaARestar(null)
        setCantidadARestar(0)
        fetchData()
      } else {
        toast.error(data.error || 'Error al restar cantidad')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleImprimirLista = () => {
    if (!listaActual) return
    
    const numeroFormateado = String(listaActual.numero).padStart(4, '0')
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Faena N° ${numeroFormateado}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; margin-bottom: 5px; }
          .numero-lista { text-align: center; font-size: 14px; color: #666; margin-bottom: 10px; }
          h2 { text-align: center; color: #666; margin-top: 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
          th { background: #f0f0f0; }
          .text-center { text-align: center; }
          .total { font-weight: bold; font-size: 16px; margin-top: 15px; text-align: right; }
          .firmas { margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px; }
          .firma { text-align: center; width: 200px; }
          .firma-linea { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 12px; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>LISTA DE FAENA</h1>
        <div class="numero-lista">N° ${numeroFormateado}</div>
        <h2>Fecha: ${new Date(listaActual.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tropa</th>
              <th>Usuario Faena</th>
              <th class="text-center">Cantidad</th>
              <th>Corral</th>
            </tr>
          </thead>
          <tbody>
            ${listaActual.tropas?.map((t, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td><strong>${t.tropa.codigo}</strong></td>
                <td>${t.tropa.usuarioFaena?.nombre || '-'}</td>
                <td class="text-center">${t.cantidad}</td>
                <td>${t.corral?.nombre || '-'}</td>
              </tr>
            `).join('') || ''}
          </tbody>
        </table>
        <div class="total">Total: ${listaActual.cantidadTotal} animales</div>
        
        <div class="firmas">
          <div class="firma">
            <div class="firma-linea">Firma Solicitante</div>
          </div>
          <div class="firma">
            <div class="firma-linea">Autorización SENASA</div>
          </div>
        </div>
        
        <div class="footer">
          Lista N° ${numeroFormateado} - Generado el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}
        </div>
      </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleReabrirLista = async () => {
    if (!listaActual) return

    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual.id,
          accion: 'reabrir'
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Lista reabierta correctamente')
        setReabrirListaOpen(false)
        fetchData()
      } else {
        toast.error(data.error || 'Error al reabrir lista')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleCerrarLista = async () => {
    if (!claveSupervisor) {
      toast.error('Ingrese la clave de supervisor')
      return
    }

    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: claveSupervisor })
      })
      
      const authData = await authRes.json()
      
      if (!authData.success || (authData.data.rol !== 'SUPERVISOR' && authData.data.rol !== 'ADMINISTRADOR')) {
        toast.error('Clave de supervisor inválida')
        return
      }
    } catch {
      toast.error('Error al verificar clave')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual?.id,
          supervisorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Lista de faena cerrada')
        setCerrarListaOpen(false)
        setClaveSupervisor('')
        fetchData()
      } else {
        toast.error(data.error || 'Error al cerrar lista')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const est = ESTADOS_LISTA.find(e => e.id === estado)
    return (
      <Badge className={est?.color || 'bg-gray-100'}>
        {est?.label || estado}
      </Badge>
    )
  }

  const getEspecieBadge = (especie: string) => {
    const normalized = especie?.toUpperCase().trim()
    if (normalized === 'BOVINO') {
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Beef className="w-3.5 h-3.5 mr-1" />Bovino</Badge>
    }
    if (normalized === 'EQUINO') {
      return <Badge className="bg-stone-100 text-stone-600 border-stone-200"><Dog className="w-3.5 h-3.5 mr-1" />Equino</Badge>
    }
    return <Badge variant="outline">{especie || 'N/D'}</Badge>
  }

  const getStockBorderColor = (stock: StockPorCorral) => {
    if (stock.enListaAbierta > 0) return 'border-l-4 border-l-amber-500 bg-amber-50/50'
    if (stock.faenados > 0 && stock.disponibles === 0) return 'border-l-4 border-l-gray-400 bg-gray-50/50'
    if (stock.disponibles > 0) return 'border-l-4 border-l-green-500 bg-green-50/30'
    return 'border-l-4 border-l-stone-300'
  }

  const getEspecieIcon = (especie: string) => {
    const normalized = especie?.toUpperCase().trim()
    if (normalized === 'BOVINO') return <Beef className="w-5 h-5 text-amber-600" />
    if (normalized === 'EQUINO') return <Dog className="w-5 h-5 text-stone-600" />
    return <Beef className="w-5 h-5 text-stone-400" />
  }

  const getTropaStatusBadge = (enListaAbierta: number, disponibles: number, faenados: number) => {
    if (enListaAbierta > 0) return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">En Faena</Badge>
    if (faenados > 0 && disponibles === 0) return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Faenada</Badge>
    if (disponibles > 0) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">En Corral</Badge>
    return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Pendiente</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <ClipboardList className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <EditableBlock bloqueId="header" label="Encabezado">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-800">
                <TextoEditable id="lista-faena-titulo" original="Lista de Faena" tag="span" />
              </h1>
              <p className="text-stone-500">
                <TextoEditable id="lista-faena-subtitulo" original="Planificación diaria - Asigne tropas y cantidades a faenar" tag="span" />
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                <TextoEditable id="btn-actualizar" original="Actualizar" tag="span" />
              </Button>
              {operador.nivel !== 'OPERADOR' && (
                <Button onClick={() => setNuevaListaOpen(true)} className="bg-amber-500 hover:bg-amber-600">
                  <Plus className="w-4 h-4 mr-2" />
                  <TextoEditable id="btn-nueva-lista" original="Nueva Lista" tag="span" />
                </Button>
              )}
            </div>
          </div>
        </EditableBlock>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="actual">
              <TextoEditable id="tab-lista-actual" original="Lista Actual" tag="span" />
            </TabsTrigger>
            <TabsTrigger value="historial">
              <TextoEditable id="tab-historial" original="Historial" tag="span" />
            </TabsTrigger>
          </TabsList>

          {/* LISTA ACTUAL */}
          <TabsContent value="actual" className="space-y-6">
            {!listaActual ? (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-24 h-24 rounded-full bg-amber-50 flex items-center justify-center mb-6">
                  <ClipboardList className="w-12 h-12 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-stone-700 mb-2">
                  <TextoEditable id="msg-no-hay-lista-activa" original="No hay lista de faena activa" tag="span" />
                </h3>
                <p className="text-stone-400 mb-6 max-w-md text-center">
                  <TextoEditable id="msg-cree-lista-gestionar" original="Cree una nueva lista para comenzar a gestionar la faena del día" tag="span" />
                </p>
                {operador.nivel !== 'OPERADOR' && (
                  <Button onClick={() => setNuevaListaOpen(true)} className="bg-amber-500 hover:bg-amber-600">
                    <Plus className="w-4 h-4 mr-2" />
                    <TextoEditable id="btn-crear-lista" original="Crear Lista de Faena" tag="span" />
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Info de la lista */}
                <EditableBlock bloqueId="infoLista" label="Información de Lista">
                  <Card className="border-0 shadow-md">
                    <CardHeader className="bg-stone-50 rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-amber-600" />
                            <TextoEditable id="label-lista-n" original="Lista N°" tag="span" /> {String(listaActual.numero).padStart(4, '0')} - {new Date(listaActual.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </CardTitle>
                          <CardDescription>
                            <TextoEditable id="label-total-planificado" original="Total planificado" tag="span" />: {listaActual.cantidadTotal} <TextoEditable id="label-animales2" original="animales" tag="span" />
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getEstadoBadge(listaActual.estado)}
                          {listaActual.estado === 'ABIERTA' && operador.nivel !== 'OPERADOR' && (
                            <Button onClick={() => setCerrarListaOpen(true)} className="bg-green-600 hover:bg-green-700">
                              <Lock className="w-4 h-4 mr-2" />
                              <TextoEditable id="btn-cerrar" original="Cerrar" tag="span" />
                            </Button>
                          )}
                          {listaActual.estado === 'CERRADA' && (
                            <>
                              <Button onClick={handleImprimirLista} variant="outline" className="border-blue-300 text-blue-600">
                                <Printer className="w-4 h-4 mr-2" />
                                <TextoEditable id="btn-imprimir" original="Imprimir" tag="span" />
                              </Button>
                              {operador.nivel !== 'OPERADOR' && (
                                <Button onClick={() => setReabrirListaOpen(true)} variant="outline" className="border-amber-300 text-amber-600">
                                  <Unlock className="w-4 h-4 mr-2" />
                                  <TextoEditable id="btn-reabrir" original="Reabrir" tag="span" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {/* Tropas en la lista */}
                      <div className="mb-6">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Beef className="w-4 h-4 text-amber-600" />
                          <TextoEditable id="label-tropas-asignadas" original="Tropas Asignadas a Faena" tag="span" />
                        </h4>
                        {listaActual.tropas && listaActual.tropas.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12 text-center">#</TableHead>
                                <TableHead><TextoEditable id="th-tropa" original="Tropa" tag="span" /></TableHead>
                                <TableHead><TextoEditable id="th-usuario-faena" original="Usuario Faena" tag="span" /></TableHead>
                                <TableHead className="text-center"><TextoEditable id="th-cantidad" original="Cantidad" tag="span" /></TableHead>
                                <TableHead><TextoEditable id="th-corral" original="Corral" tag="span" /></TableHead>
                                <TableHead className="text-center"><TextoEditable id="th-estado-tropa" original="Estado" tag="span" /></TableHead>
                                {listaActual.estado === 'ABIERTA' && <TableHead className="text-center"><TextoEditable id="th-acciones" original="Acciones" tag="span" /></TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {listaActual.tropas.map((t, i) => {
                                const tropaEspecie = t.tropa.especie?.toUpperCase().trim()
                                const borderColor = tropaEspecie === 'EQUINO' ? 'border-l-4 border-l-stone-400' : 'border-l-4 border-l-amber-500'
                                return (
                                <TableRow key={`${t.tropa.id}-${t.corralId || 'sin-corral'}`} className={borderColor}>
                                  <TableCell className="text-center font-bold text-stone-500">
                                    {i + 1}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {getEspecieIcon(t.tropa.especie)}
                                      <span className="font-mono font-bold">{t.tropa.codigo}</span>
                                      {getEspecieBadge(t.tropa.especie)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{t.tropa.usuarioFaena?.nombre || '-'}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge className="bg-stone-800 text-white text-lg font-bold px-3 py-0.5">
                                      {t.cantidad}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {t.corral?.nombre || '-'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {listaActual.estado === 'ABIERTA' ? (
                                      <Badge className="bg-green-100 text-green-700 border-green-200">En Faena</Badge>
                                    ) : (
                                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">Faenada</Badge>
                                    )}
                                  </TableCell>
                                  {listaActual.estado === 'ABIERTA' && (
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={() => {
                                            setTropaARestar({ 
                                              id: t.tropa.id, 
                                              codigo: t.tropa.codigo, 
                                              cantidadActual: t.cantidad 
                                            })
                                            setRestarCantidadOpen(true)
                                          }}
                                          className="text-amber-600 hover:bg-amber-50"
                                          title="Restar cantidad"
                                        >
                                          <Minus className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={() => {
                                            setTropaAQuitar({ id: t.tropa.id, codigo: t.tropa.codigo, corralId: t.corralId })
                                            handleQuitarTropa(false)
                                          }}
                                          className="text-red-600 hover:bg-red-50"
                                          title="Quitar tropa completa"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 px-6">
                            <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center mb-4">
                              <ClipboardList className="w-10 h-10 text-stone-400" />
                            </div>
                            <p className="text-lg font-medium text-stone-500 mb-1">No hay tropas en la lista de faena</p>
                            <p className="text-sm text-stone-400 max-w-sm text-center">Agregue tropas desde Movimiento de Hacienda o Pesaje Camiones</p>
                          </div>
                        )}
                      </div>

                      {/* Agregar tropas - solo si está ABIERTA */}
                      {listaActual.estado === 'ABIERTA' && stockPorCorral.filter(s => s.disponibles > 0).length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-3">
                            <TextoEditable id="label-agregar-stock" original="Agregar Stock por Corral" tag="span" />
                          </h4>
                          <ScrollArea className="h-[280px]">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-4">
                              {stockPorCorral
                                .filter(s => s.disponibles > 0)
                                .map((stock) => {
                                  const enLista = listaActual.tropas?.find(lt => 
                                    lt.tropa.id === stock.tropaId && lt.corralId === stock.corralId
                                  )
                                  const inputId = `cant-${stock.tropaId}-${stock.corralId || 'sin-corral'}`
                                  return (
                                    <div key={inputId} className={`p-3 border rounded-lg bg-white ${getStockBorderColor(stock)} transition-all`}>
                                      <div className="flex items-center justify-between mb-2 gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {getEspecieIcon(stock.tropaEspecie)}
                                          <span className="font-mono font-bold truncate">{stock.tropaCodigo}</span>
                                        </div>
                                        {getTropaStatusBadge(stock.enListaAbierta, stock.disponibles, stock.faenados)}
                                      </div>
                                      <p className="text-sm font-medium text-stone-700 mb-1">
                                        {stock.usuarioFaena?.nombre || '-'}
                                      </p>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="text-xs">
                                          <TextoEditable id="label-corral2" original="Corral" tag="span" />: {stock.corralNombre || 'Sin asignar'}
                                        </Badge>
                                        <Badge className="bg-stone-800 text-white text-xs font-bold">
                                          {stock.disponibles} uds.
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs mb-2">
                                        <span className="text-green-600 font-medium">
                                          ✓ {stock.disponibles} <TextoEditable id="label-disponibles" original="disponibles" tag="span" />
                                        </span>
                                      </div>
                                      {enLista && (
                                        <Badge className="bg-blue-100 text-blue-700 mb-2">
                                          <TextoEditable id="label-ya-en-lista" original="Ya en lista" tag="span" />: {enLista.cantidad}
                                        </Badge>
                                      )}
                                      <div className="flex items-center gap-2 mt-2">
                                        <Input
                                          type="number"
                                          className="w-20"
                                          min="1"
                                          max={stock.disponibles}
                                          defaultValue={stock.disponibles}
                                          id={inputId}
                                        />
                                        <Button 
                                          size="sm"
                                          onClick={() => {
                                            const input = document.getElementById(inputId) as HTMLInputElement
                                            const cant = parseInt(input?.value) || 0
                                            handleAgregarTropa(stock.tropaId, stock.corralId, cant, stock.disponibles)
                                          }}
                                          className="bg-green-600 hover:bg-green-700"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </EditableBlock>
              </>
            )}
          </TabsContent>

          {/* HISTORIAL */}
          <TabsContent value="historial">
            <EditableBlock bloqueId="historialListas" label="Historial de Listas">
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-stone-50 rounded-t-lg">
                  <CardTitle className="text-lg">
                    <TextoEditable id="label-listas-anteriores" original="Listas de Faena Anteriores" tag="span" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {listas.length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                      <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p><TextoEditable id="msg-no-hay-listas" original="No hay listas" tag="span" /></p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead><TextoEditable id="th-fecha" original="Fecha" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-cantidad2" original="Cantidad" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-estado" original="Estado" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-accion" original="Acción" tag="span" /></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listas.map((lista) => (
                          <TableRow key={lista.id} className={lista.id === listaActual?.id ? 'bg-amber-50' : ''}>
                            <TableCell>
                              {new Date(lista.fecha).toLocaleDateString('es-AR')}
                            </TableCell>
                            <TableCell>{lista.cantidadTotal} <TextoEditable id="label-animales3" original="animales" tag="span" /></TableCell>
                            <TableCell>{getEstadoBadge(lista.estado)}</TableCell>
                            <TableCell>
                              {lista.estado === 'CERRADA' && operador.nivel !== 'OPERADOR' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setListaActual(lista)
                                    setReabrirListaOpen(true)
                                  }}
                                  className="text-amber-600"
                                >
                                  <Unlock className="w-4 h-4 mr-1" />
                                  <TextoEditable id="btn-reabrir2" original="Reabrir" tag="span" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </EditableBlock>
          </TabsContent>
        </Tabs>

        {/* Dialog Nueva Lista */}
        <Dialog open={nuevaListaOpen} onOpenChange={setNuevaListaOpen}>
          <DialogContent maximizable>
            <DialogHeader>
              <DialogTitle>
                <TextoEditable id="dialog-nueva-lista-titulo" original="Nueva Lista de Faena" tag="span" />
              </DialogTitle>
              <DialogDescription>
                <TextoEditable id="dialog-nueva-lista-desc" original="Se creará una nueva lista para el día de hoy" tag="span" />
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-stone-600">
                <TextoEditable id="dialog-nueva-lista-msg" original="Esta acción creará una lista de faena con fecha" tag="span" /> {new Date().toLocaleDateString('es-AR')}.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNuevaListaOpen(false)}>
                <TextoEditable id="btn-cancelar" original="Cancelar" tag="span" />
              </Button>
              <Button onClick={handleCrearLista} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                {saving ? <TextoEditable id="msg-creando" original="Creando..." tag="span" /> : <TextoEditable id="btn-crear-lista2" original="Crear Lista" tag="span" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Reabrir Lista */}
        <Dialog open={reabrirListaOpen} onOpenChange={setReabrirListaOpen}>
          <DialogContent maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <Unlock className="w-5 h-5" />
                <TextoEditable id="dialog-reabrir-titulo" original="Reabrir Lista de Faena" tag="span" />
              </DialogTitle>
              <DialogDescription>
                <TextoEditable id="dialog-reabrir-desc" original="La lista pasará a estado ABIERTA y podrá ser modificada" tag="span" />
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 mb-2" />
                <p className="text-sm text-amber-700 mb-2">
                  <TextoEditable id="dialog-reabrir-info" original="Al reabrir la lista" tag="span" />:
                </p>
                <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                  <li><TextoEditable id="dialog-reabrir-item1" original="Los garrones ya asignados se mantienen" tag="span" /></li>
                  <li><TextoEditable id="dialog-reabrir-item2" original="Los datos de romaneo se conservan" tag="span" /></li>
                  <li><TextoEditable id="dialog-reabrir-item3" original="Puede agregar más tropas o animales" tag="span" /></li>
                  <li><TextoEditable id="dialog-reabrir-item4" original="Puede quitar tropas (con advertencia si hay garrones)" tag="span" /></li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReabrirListaOpen(false)}>
                <TextoEditable id="btn-cancelar2" original="Cancelar" tag="span" />
              </Button>
              <Button onClick={handleReabrirLista} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                {saving ? <TextoEditable id="msg-reabriendo" original="Reabriendo..." tag="span" /> : <TextoEditable id="btn-reabrir-lista" original="Reabrir Lista" tag="span" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Quitar Tropa con Garrones */}
        <Dialog open={quitarTropaOpen} onOpenChange={setQuitarTropaOpen}>
          <DialogContent maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <TextoEditable id="dialog-quitar-titulo" original="Confirmar Eliminación de Tropa" tag="span" />
              </DialogTitle>
              <DialogDescription>
                <TextoEditable id="dialog-quitar-desc" original="Esta tropa tiene garrones ya asignados" tag="span" />
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
                <p className="text-sm text-red-700 mb-2">
                  <strong><TextoEditable id="dialog-quitar-warning" original="Advertencia" tag="span" />:</strong> <TextoEditable id="dialog-quitar-warning2" original="La tropa" tag="span" /> {tropaAQuitar?.codigo} <TextoEditable id="dialog-quitar-warning3" original="tiene" tag="span" />{' '}
                  <strong>{tropaAQuitar?.garrones || 0} <TextoEditable id="label-garrones" original="garrón(es)" tag="span" /></strong> <TextoEditable id="dialog-quitar-warning4" original="ya asignado(s)" tag="span" />.
                </p>
                <p className="text-sm text-red-700">
                  <TextoEditable id="dialog-quitar-info" original="Si continúa, los garrones quedarán liberados para reasignación. Deberá asignarlos nuevamente a los animales correctos desde Ingreso a Cajón." tag="span" />
                </p>
              </div>
              <div className="p-3 bg-stone-100 rounded-lg">
                <p className="text-sm text-stone-600">
                  <strong><TextoEditable id="label-procedimiento" original="Procedimiento correcto" tag="span" />:</strong>
                </p>
                <ol className="text-sm text-stone-600 list-decimal list-inside mt-1">
                  <li><TextoEditable id="proc-item1" original="Quitar esta tropa (los garrones quedan huérfanos)" tag="span" /></li>
                  <li><TextoEditable id="proc-item2" original="Agregar la tropa correcta" tag="span" /></li>
                  <li><TextoEditable id="proc-item3" original="En Ingreso a Cajón, reasignar los garrones a los animales correctos" tag="span" /></li>
                  <li><TextoEditable id="proc-item4" original="Los pesos de romaneo ya cargados se mantienen" tag="span" /></li>
                </ol>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setQuitarTropaOpen(false)
                setTropaAQuitar(null)
              }}>
                <TextoEditable id="btn-cancelar3" original="Cancelar" tag="span" />
              </Button>
              <Button 
                onClick={() => handleQuitarTropa(true)} 
                disabled={saving}
                variant="destructive"
              >
                {saving ? <TextoEditable id="msg-quitando" original="Quitando..." tag="span" /> : <TextoEditable id="btn-quitar-liberar" original="Quitar tropa y liberar garrones" tag="span" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Cerrar Lista */}
        <Dialog open={cerrarListaOpen} onOpenChange={setCerrarListaOpen}>
          <DialogContent maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Lock className="w-5 h-5" />
                <TextoEditable id="dialog-cerrar-titulo" original="Cerrar Lista de Faena" tag="span" />
              </DialogTitle>
              <DialogDescription>
                <TextoEditable id="dialog-cerrar-desc" original="Se requiere autorización de supervisor para cerrar la lista" tag="span" />
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-sm text-green-700">
                  <TextoEditable id="dialog-cerrar-info" original="Una vez cerrada, la lista estará lista para Ingreso a Cajón y Romaneo. Podrá reabrirla si necesita hacer correcciones." tag="span" />
                </p>
              </div>
              <div className="space-y-2">
                <Label><TextoEditable id="label-clave-supervisor" original="Clave de Supervisor" tag="span" /></Label>
                <Input
                  type="password"
                  value={claveSupervisor}
                  onChange={(e) => setClaveSupervisor(e.target.value)}
                  placeholder="••••••"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCerrarListaOpen(false)}>
                <TextoEditable id="btn-cancelar4" original="Cancelar" tag="span" />
              </Button>
              <Button onClick={handleCerrarLista} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? <TextoEditable id="msg-cerrando" original="Cerrando..." tag="span" /> : <TextoEditable id="btn-cerrar-lista" original="Cerrar Lista" tag="span" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Restar Cantidad */}
        <Dialog open={restarCantidadOpen} onOpenChange={setRestarCantidadOpen}>
          <DialogContent maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <Minus className="w-5 h-5" />
                <TextoEditable id="dialog-restar-titulo" original="Restar Animales de Tropa" tag="span" />
              </DialogTitle>
              <DialogDescription>
                <TextoEditable id="dialog-restar-desc" original="Reduzca la cantidad de animales de esta tropa en la lista" tag="span" />
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-stone-50 border rounded-lg">
                <p className="text-sm text-stone-600 mb-2">
                  <strong><TextoEditable id="label-tropa" original="Tropa" tag="span" />:</strong> {tropaARestar?.codigo}
                </p>
                <p className="text-sm text-stone-600">
                  <strong><TextoEditable id="label-cantidad-actual" original="Cantidad actual" tag="span" />:</strong> {tropaARestar?.cantidadActual} <TextoEditable id="label-animales4" original="animales" tag="span" />
                </p>
              </div>
              <div className="space-y-2">
                <Label><TextoEditable id="label-cantidad-restar" original="Cantidad a restar" tag="span" /></Label>
                <Input
                  type="number"
                  min="1"
                  max={tropaARestar ? tropaARestar.cantidadActual - 1 : 1}
                  value={cantidadARestar}
                  onChange={(e) => setCantidadARestar(parseInt(e.target.value) || 0)}
                  placeholder="Ingrese cantidad"
                />
                <p className="text-xs text-stone-400">
                  <TextoEditable id="label-cantidad-restante" original="La cantidad restante será de" tag="span" /> {tropaARestar ? tropaARestar.cantidadActual - cantidadARestar : 0} <TextoEditable id="label-animales5" original="animales" tag="span" />
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 inline mr-2" />
                <span className="text-sm text-amber-700">
                  <TextoEditable id="msg-animales-volveran" original="Los animales restados volverán a estar disponibles para agregar a esta u otra lista." tag="span" />
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setRestarCantidadOpen(false)
                setTropaARestar(null)
                setCantidadARestar(0)
              }}>
                <TextoEditable id="btn-cancelar5" original="Cancelar" tag="span" />
              </Button>
              <Button 
                onClick={handleRestarCantidad} 
                disabled={saving || cantidadARestar <= 0 || (tropaARestar ? cantidadARestar >= tropaARestar.cantidadActual : true)}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {saving ? <TextoEditable id="msg-guardando" original="Guardando..." tag="span" /> : <TextoEditable id="btn-restar-cantidad" original="Restar Cantidad" tag="span" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default ListaFaenaModule
