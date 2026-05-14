'use client'

import { useState, useEffect } from 'react'
import { 
  Truck, Scale, Save, CheckCircle, Clock, Printer, FileText,
  ArrowDownToLine, ArrowUpFromLine, Weight, Trash2, Beef, AlertCircle,
  Edit, AlertTriangle, ClipboardCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { TextoEditable } from '@/components/ui/editable-screen'
import { BalanzaConfigButton } from '@/components/balanza-config-button'

// Importar componentes modularizados
import { TipoAnimalCounterGrid } from './pesaje-camiones/TipoAnimalCounterGrid'
import { QuickAddDialog, QuickAddButton } from './pesaje-camiones/QuickAddDialog'
import { imprimirTicket, imprimirReporte } from './pesaje-camiones/ticketPrint'
import { TIPOS_ANIMALES, ESPECIES, TIPOS_PESAJE } from './pesaje-camiones/constants'
import { createLogger } from '@/lib/logger'
const log = createLogger('components.pesaje-camiones-module')

// Tipos de animales organizados por especie (re-export para compatibilidad)
export { TIPOS_ANIMALES, ESPECIES, TIPOS_PESAJE }

interface Operador {
  id: string
  nombre: string
  nivel?: string
  permisos: Record<string, boolean>
}

interface Cliente {
  id: string
  nombre: string
  cuit?: string
  razonSocial?: string
}

interface ProductorConsignatario {
  id: string
  nombre: string
  cuit?: string
  tipo: string
  numeroRenspa?: string
  numeroEstablecimiento?: string
}

interface Transportista {
  id: string
  nombre: string
}

interface Corral {
  id: string
  nombre: string
  capacidad: number
  stockBovinos: number
  stockEquinos: number
}

interface TipoAnimalCounter {
  tipoAnimal: string
  cantidad: number
}

export function PesajeCamionesModule({ operador, onTropaCreada }: { operador: Operador; onTropaCreada?: () => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productores, setProductores] = useState<ProductorConsignatario[]>([])
  const [transportistas, setTransportistas] = useState<Transportista[]>([])
  const [corrales, setCorrales] = useState<Corral[]>([])
  const [nextTicket, setNextTicket] = useState(1)
  const [saving, setSaving] = useState(false)
  
  const [activeTab, setActiveTab] = useState('nuevo')
  const [tipoPesaje, setTipoPesaje] = useState('INGRESO_HACIENDA')
  
  // Form states - Ingreso Hacienda
  const [patenteChasis, setPatenteChasis] = useState('')
  const [patenteAcoplado, setPatenteAcoplado] = useState('')
  const [chofer, setChofer] = useState('')
  const [dniChofer, setDniChofer] = useState('')
  const [choferTelefono, setChoferTelefono] = useState('')
  const [habilitacion, setHabilitacion] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [transportistaId, setTransportistaId] = useState('')
  const [vehiculoEncontrado, setVehiculoEncontrado] = useState(false)
  const [buscandoVehiculo, setBuscandoVehiculo] = useState(false)
  const [dte, setDte] = useState('')
  const [guia, setGuia] = useState('')
  const [productorId, setProductorId] = useState('')
  const [usuarioFaenaId, setUsuarioFaenaId] = useState('')
  const [especie, setEspecie] = useState('BOVINO')
  const [corralId, setCorralId] = useState('')
  const [pesoBruto, setPesoBruto] = useState<number>(0)
  const [pesoTara, setPesoTara] = useState<number>(0)
  const [observaciones, setObservaciones] = useState('')
  
  // Next tropa code preview
  const [nextTropaCode, setNextTropaCode] = useState<{ codigo: string; numero: number } | null>(null)
  
  // Tipos de animales con la nueva interfaz
  const [tiposAnimales, setTiposAnimales] = useState<TipoAnimalCounter[]>([])
  
  // Form states - Salida Mercadería
  const [destino, setDestino] = useState('')
  const [remito, setRemito] = useState('')
  const [descripcion, setDescripcion] = useState('')
  
  // Quick add dialogs
  const [quickAddOpen, setQuickAddOpen] = useState<'transportista' | 'productor' | 'usuarioFaena' | null>(null)
  
  // Buscar vehículo al escribir patente (debounce)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patenteChasis.length >= 4) {
        setBuscandoVehiculo(true)
        try {
          const res = await fetch(`/api/vehiculos?patente=${encodeURIComponent(patenteChasis)}`)
          const data = await res.json()
          if (data.success && data.data) {
            const v = data.data
            if (v.choferNombre) setChofer(v.choferNombre)
            if (v.choferDni) setDniChofer(v.choferDni)
            if (v.choferTelefono) setChoferTelefono(v.choferTelefono)
            if (v.habilitacion) setHabilitacion(v.habilitacion)
            if (v.empresa) setEmpresa(v.empresa)
            if (v.transportistaId) setTransportistaId(v.transportistaId)
            setVehiculoEncontrado(true)
            toast.info(`Vehículo conocido - ${v.vecesVisita} visita${v.vecesVisita > 1 ? 's' : ''}`, { duration: 2000 })
          } else {
            setVehiculoEncontrado(false)
          }
        } catch {
          setVehiculoEncontrado(false)
        } finally {
          setBuscandoVehiculo(false)
        }
      } else {
        setVehiculoEncontrado(false)
      }
    }, 500) // 500ms debounce
    return () => clearTimeout(timer)
  }, [patenteChasis])

  // Pesajes
  const [pesajesAbiertos, setPesajesAbiertos] = useState<any[]>([])
  const [pesajesCerrados, setPesajesCerrados] = useState<any[]>([])
  
  // Dialogs
  const [cerrarOpen, setCerrarOpen] = useState(false)
  const [pesajeSeleccionado, setPesajeSeleccionado] = useState<any>(null)
  const [taraForm, setTaraForm] = useState(0)
  
  // History filters
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [pesajesFiltrados, setPesajesFiltrados] = useState<any[]>([])
  
  // Edit/Delete dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
  // Summary confirmation dialog
  const [showResumen, setShowResumen] = useState(false)

  const handleConfirmarGuardar = async () => {
    setShowResumen(false)
    await handleGuardar()
  }

  // Capacity warning
  const [capacidadWarningOpen, setCapacidadWarningOpen] = useState(false)
  const [capacidadWarningInfo, setCapacidadWarningInfo] = useState<any>(null)
  const [pendingPayload, setPendingPayload] = useState<any>(null)
  const [supervisorPin, setSupervisorPin] = useState('')
  const [supervisorVerificado, setSupervisorVerificado] = useState(false)
  const [pesajeAccion, setPesajeAccion] = useState<any>(null)
  
  // Computed
  const pesoNeto = pesoBruto > 0 && pesoTara > 0 ? pesoBruto - pesoTara : 0
  const usuariosFaena = clientes
  const totalCabezas = tiposAnimales.reduce((acc, t) => acc + t.cantidad, 0)

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [])

  // Filter history by date
  useEffect(() => {
    let filtered = pesajesCerrados
    if (fechaDesde) {
      const desde = new Date(fechaDesde)
      desde.setHours(0, 0, 0, 0)
      filtered = filtered.filter(p => new Date(p.fecha) >= desde)
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      filtered = filtered.filter(p => new Date(p.fecha) <= hasta)
    }
    setPesajesFiltrados(filtered)
  }, [pesajesCerrados, fechaDesde, fechaHasta])

  const fetchData = async () => {
    try {
      const [pesajesRes, transRes, clientesRes, corralesRes, productoresRes] = await Promise.all([
        fetch('/api/pesaje-camion'),
        fetch('/api/transportistas'),
        fetch('/api/clientes'),
        fetch('/api/corrales'),
        fetch('/api/productores')
      ])
      
      const pesajesData = await pesajesRes.json()
      const transData = await transRes.json()
      const clientesData = await clientesRes.json()
      const corralesData = await corralesRes.json()
      const productoresData = await productoresRes.json()
      
      if (pesajesData.success) {
        setPesajesAbiertos(pesajesData.data.filter((p: any) => p.estado === 'ABIERTO'))
        setPesajesCerrados(pesajesData.data.filter((p: any) => p.estado === 'CERRADO'))
        setNextTicket(pesajesData.nextTicketNumber)
      }
      
      if (transData.success) {
        setTransportistas(transData.data)
      }
      
      if (clientesData.success) {
        setClientes(clientesData.data)
      }
      
      if (corralesData.success) {
        setCorrales(corralesData.data)
      }
      
      if (productoresData.success) {
        setProductores(productoresData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  // Fetch next tropa code when especie changes
  useEffect(() => {
    if (tipoPesaje === 'INGRESO_HACIENDA') {
      fetchNextTropaCode()
    }
  }, [especie, tipoPesaje])

  const fetchNextTropaCode = async () => {
    try {
      const res = await fetch(`/api/pesaje-camion?action=nextTropaCode&especie=${especie}`)
      const data = await res.json()
      if (data.success) {
        setNextTropaCode(data.data)
      }
    } catch (error) {
      console.error('Error fetching next tropa code:', error)
    }
  }

  // Reset form
  const resetForm = () => {
    setPatenteChasis('')
    setPatenteAcoplado('')
    setChofer('')
    setDniChofer('')
    setChoferTelefono('')
    setHabilitacion('')
    setEmpresa('')
    setTransportistaId('')
    setVehiculoEncontrado(false)
    setDte('')
    setGuia('')
    setProductorId('')
    setUsuarioFaenaId('')
    setEspecie('BOVINO')
    setCorralId('')
    setPesoBruto(0)
    setPesoTara(0)
    setObservaciones('')
    setDestino('')
    setRemito('')
    setDescripcion('')
    setTiposAnimales([])
    fetchNextTropaCode()
  }

  // Handle quick add
  const handleQuickAdd = (tipo: string, data: any) => {
    if (tipo === 'transportista') {
      setTransportistas([...transportistas, data])
      setTransportistaId(data.id)
    } else if (tipo === 'productor') {
      setProductores([...productores, data])
      setProductorId(data.id)
    } else if (tipo === 'usuarioFaena') {
      setClientes([...clientes, data])
      setUsuarioFaenaId(data.id)
    }
  }

  // Guardar pesaje
  const handleGuardar = async () => {
    // Validaciones comunes
    if (!patenteChasis) {
      toast.error('Ingrese la patente del chasis')
      return
    }
    
    if (tipoPesaje === 'INGRESO_HACIENDA') {
      if (!usuarioFaenaId) {
        toast.error('Seleccione el usuario de faena')
        return
      }
      if (totalCabezas <= 0) {
        toast.error('Indique la cantidad de animales')
        return
      }
      if (!corralId) {
        toast.error('Seleccione el corral')
        return
      }
      if (pesoBruto <= 0) {
        toast.error('Ingrese el peso bruto')
        return
      }
    }
    
    if (tipoPesaje === 'SALIDA_MERCADERIA') {
      if (!destino) {
        toast.error('Ingrese el destino')
        return
      }
      if (pesoBruto <= 0) {
        toast.error('Ingrese el peso bruto')
        return
      }
    }
    
    if (tipoPesaje === 'PESAJE_PARTICULAR') {
      if (pesoBruto <= 0) {
        toast.error('Ingrese el peso')
        return
      }
    }

    setSaving(true)
    try {
      const payload: any = {
        tipo: tipoPesaje,
        patenteChasis: patenteChasis.toUpperCase(),
        patenteAcoplado: patenteAcoplado?.toUpperCase() || null,
        chofer: chofer || null,
        dniChofer: dniChofer || null,
        transportistaId: transportistaId || null,
        
        // Pesos
        pesoBruto: pesoBruto || null,
        pesoTara: tipoPesaje === 'INGRESO_HACIENDA' ? null : (pesoTara || null),
        pesoNeto: tipoPesaje === 'INGRESO_HACIENDA' ? null : (pesoNeto || null),
        observaciones: observaciones || null,
        
        // Salida
        destino: destino || null,
        remito: remito || null,
        
        // Particular
        descripcion: descripcion || null,
      }
      
      // Solo agregar operadorId si existe
      if (operador?.id) {
        payload.operadorId = operador.id
      }
      
      // Ingreso Hacienda - agregar campos específicos
      if (tipoPesaje === 'INGRESO_HACIENDA') {
        payload.dte = dte || ''
        payload.guia = guia || ''
        payload.productorId = productorId || null
        payload.usuarioFaenaId = usuarioFaenaId
        payload.especie = especie
        payload.tiposAnimales = tiposAnimales
        payload.cantidadCabezas = totalCabezas
        payload.corralId = corralId || null
      }
      
      log.info(`'[PesajeCamiones] Enviando payload:' payload`)
      
      const res = await fetch('/api/pesaje-camion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      
      // Handle capacity warning (409 Conflict)
      if (res.status === 409 && data.requiresConfirmation) {
        setCapacidadWarningInfo(data)
        setPendingPayload(payload)
        setCapacidadWarningOpen(true)
        setSaving(false)
        return
      }
      
      if (data.success) {
        if (data.advertencia) {
          toast.warning(data.advertencia, { duration: 6000 })
        }
        if (tipoPesaje === 'INGRESO_HACIENDA') {
          toast.success(`Ticket #${String(data.data.numeroTicket).padStart(6, '0')} creado - Tropa: ${data.data.tropa?.codigo}`, {
            duration: 5000
          })
          toast.info('El pesaje quedará abierto hasta registrar la tara')
        } else {
          toast.success(`Ticket #${String(data.data.numeroTicket).padStart(6, '0')} creado`)
        }
        
        // Guardar/actualizar vehículo para futuros pesajes
        try {
          await fetch('/api/vehiculos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patente: patenteChasis,
              choferNombre: chofer || null,
              choferDni: dniChofer || null,
              choferTelefono: choferTelefono || null,
              habilitacion: habilitacion || null,
              empresa: empresa || null,
              transportistaId: transportistaId || null
            })
          })
        } catch (vError) {
          console.error('Error al guardar vehículo:', vError)
          // No bloquear el flujo si falla el guardado del vehículo
        }

        // Reset form first
        setPatenteChasis('')
        setPatenteAcoplado('')
        setChofer('')
        setDniChofer('')
        setChoferTelefono('')
        setHabilitacion('')
        setEmpresa('')
        setTransportistaId('')
        setVehiculoEncontrado(false)
        setDte('')
        setGuia('')
        setProductorId('')
        setUsuarioFaenaId('')
        setEspecie('BOVINO')
        setCorralId('')
        setPesoBruto(0)
        setPesoTara(0)
        setObservaciones('')
        setDestino('')
        setRemito('')
        setDescripcion('')
        setTiposAnimales([])
        
        // Actualizar listas
        if (data.data.estado === 'ABIERTO') {
          setPesajesAbiertos([data.data, ...pesajesAbiertos])
        } else {
          setPesajesCerrados([data.data, ...pesajesCerrados])
          imprimirTicket(data.data, true)
        }
        
        setNextTicket(nextTicket + 1)
        onTropaCreada?.()
        
        // Fetch next tropa code after other updates
        fetchNextTropaCode()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error al guardar:', error)
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // Forzar capacidad de corral (re-enviar con forzarCapacidad: true)
  const handleForzarCapacidad = async () => {
    if (!pendingPayload) return
    setCapacidadWarningOpen(false)
    setSaving(true)
    try {
      const res = await fetch('/api/pesaje-camion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingPayload, forzarCapacidad: true })
      })
      const data = await res.json()
      if (data.success) {
        if (data.advertencia) {
          toast.warning(data.advertencia, { duration: 6000 })
        }
        if (tipoPesaje === 'INGRESO_HACIENDA') {
          toast.success(`Ticket #${String(data.data.numeroTicket).padStart(6, '0')} creado - Tropa: ${data.data.tropa?.codigo}`, {
            duration: 5000
          })
          toast.info('El pesaje quedará abierto hasta registrar la tara')
        } else {
          toast.success(`Ticket #${String(data.data.numeroTicket).padStart(6, '0')} creado`)
        }
        // Reset form
        resetForm()
        // Actualizar listas
        if (data.data.estado === 'ABIERTO') {
          setPesajesAbiertos([data.data, ...pesajesAbiertos])
        } else {
          setPesajesCerrados([data.data, ...pesajesCerrados])
          imprimirTicket(data.data, true)
        }
        setNextTicket(nextTicket + 1)
        onTropaCreada?.()
        fetchNextTropaCode()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
      setPendingPayload(null)
      setCapacidadWarningInfo(null)
    }
  }

  // Cerrar pesaje (agregar tara)
  const handleCerrarPesaje = async () => {
    if (!pesajeSeleccionado) return
    if (taraForm <= 0) {
      toast.error('Ingrese el peso tara')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/pesaje-camion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pesajeSeleccionado.id,
          pesoTara: taraForm,
          pesoNeto: pesajeSeleccionado.pesoBruto - taraForm
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        toast.success('Pesaje cerrado correctamente')
        setCerrarOpen(false)
        setPesajeSeleccionado(null)
        setTaraForm(0)
        
        // Print ticket after state updates
        setTimeout(() => {
          imprimirTicket(data.data, true)
        }, 100)
        
        // Refresh data
        await fetchData()
        onTropaCreada?.()
      } else {
        toast.error(data.error || 'Error al cerrar')
      }
    } catch (error) {
      console.error('Error al cerrar pesaje:', error)
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // Verificar supervisor
  const verificarSupervisor = async () => {
    if (!supervisorPin) {
      toast.error('Ingrese el PIN de supervisor')
      return false
    }
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: supervisorPin })
      })
      
      const data = await res.json()
      
      if (data.success && (data.data.rol === 'SUPERVISOR' || data.data.rol === 'ADMINISTRADOR')) {
        setSupervisorVerificado(true)
        return true
      } else {
        toast.error('PIN inválido o no tiene permisos de supervisor')
        return false
      }
    } catch {
      toast.error('Error al verificar PIN')
      return false
    }
  }

  // Abrir dialog de edición
  const handleOpenEdit = async (pesaje: any) => {
    setPesajeAccion(pesaje)
    if (!supervisorVerificado) {
      setEditDialogOpen(true)
    } else {
      // Ya verificado, abrir directamente
      toast.info('Función de edición en desarrollo')
    }
  }

  // Eliminar pesaje
  const handleDeletePesaje = async () => {
    if (!pesajeAccion) return
    
    try {
      const res = await fetch(`/api/pesaje-camion?id=${pesajeAccion.id}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        toast.success('Pesaje eliminado')
        setDeleteDialogOpen(false)
        setPesajeAccion(null)
        setSupervisorPin('')
        fetchData()
      } else {
        toast.error('Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  // Imprimir reporte por rango de fechas
  const handleImprimirReporte = () => {
    imprimirReporte(pesajesFiltrados, fechaDesde, fechaHasta)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">
              <TextoEditable id="pesajeCamiones-titulo" original="Pesaje de Camiones" tag="span" />
            </h2>
            <p className="text-stone-500">
              <TextoEditable id="pesajeCamiones-subtitulo" original="Balanza Portería" tag="span" />
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Clock className="h-4 w-4 mr-2 text-orange-500" />
              {pesajesAbiertos.length} abiertos
            </Badge>
            <Badge className="text-lg px-4 py-2 bg-amber-100 text-amber-700 border-amber-300">
              {`Ticket #${String(nextTicket).padStart(6, '0')}`}
            </Badge>
          </div>
        </div>

        <BalanzaConfigButton />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="nuevo">Nuevo Pesaje</TabsTrigger>
            <TabsTrigger value="abiertos">Pesajes Abiertos ({pesajesAbiertos.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          {/* NUEVO PESAJE */}
          <TabsContent value="nuevo" className="space-y-6">
            {/* Tipo de pesaje */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Tipo de Pesaje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {TIPOS_PESAJE.map((tipo) => (
                    <button
                      key={tipo.id}
                      type="button"
                      onClick={() => { setTipoPesaje(tipo.id); if (tipo.id === 'INGRESO_HACIENDA') fetchNextTropaCode(); }}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        tipoPesaje === tipo.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <tipo.icon className={`h-6 w-6 mb-2 ${tipo.color}`} />
                      <div className="font-medium">{tipo.label}</div>
                      <div className="text-xs text-stone-500">{tipo.desc}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* INGRESO DE HACIENDA */}
            {tipoPesaje === 'INGRESO_HACIENDA' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Datos del vehículo */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Datos del Vehículo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Patente Chasis *</Label>
                        <div className="relative">
                          <Input
                            value={patenteChasis}
                            onChange={(e) => setPatenteChasis(e.target.value.toUpperCase())}
                            placeholder="AB123CD"
                            className="font-mono"
                          />
                          {buscandoVehiculo && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">buscando...</div>
                          )}
                          {vehiculoEncontrado && !buscandoVehiculo && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">conocido</div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Patente Acoplado</Label>
                        <Input
                          value={patenteAcoplado}
                          onChange={(e) => setPatenteAcoplado(e.target.value.toUpperCase())}
                          placeholder="AB123CD"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Chofer</Label>
                        <Input
                          value={chofer}
                          onChange={(e) => setChofer(e.target.value)}
                          placeholder="Nombre del chofer"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>DNI Chofer</Label>
                        <Input
                          value={dniChofer}
                          onChange={(e) => setDniChofer(e.target.value)}
                          placeholder="12345678"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Teléfono Chofer</Label>
                        <Input
                          value={choferTelefono}
                          onChange={(e) => setChoferTelefono(e.target.value)}
                          placeholder="351-1234567"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Habilitación</Label>
                        <Input
                          value={habilitacion}
                          onChange={(e) => setHabilitacion(e.target.value)}
                          placeholder="HAB-4113"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Empresa</Label>
                      <Input
                        value={empresa}
                        onChange={(e) => setEmpresa(e.target.value)}
                        placeholder="Nombre de la empresa"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Transportista</Label>
                        <QuickAddButton tipo="transportista" onAdd={(data) => handleQuickAdd('transportista', data)} />
                      </div>
                      <Select value={transportistaId} onValueChange={setTransportistaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {transportistas.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>DTE</Label>
                        <Input
                          value={dte}
                          onChange={(e) => setDte(e.target.value)}
                          placeholder="Documento de tránsito"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Guía</Label>
                        <Input
                          value={guia}
                          onChange={(e) => setGuia(e.target.value)}
                          placeholder="Número de guía"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Datos de la tropa */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Datos de la Tropa</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Tropa asignada preview */}
                    {nextTropaCode && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <p className="text-sm text-green-600">Número de Tropa a Asignar</p>
                        <p className="text-3xl font-mono font-bold text-green-700">{nextTropaCode.codigo}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Productor</Label>
                          <QuickAddButton tipo="productor" onAdd={(data) => handleQuickAdd('productor', data)} />
                        </div>
                        <Select value={productorId} onValueChange={setProductorId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {productores.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Usuario Faena *</Label>
                          <QuickAddButton tipo="usuarioFaena" onAdd={(data) => handleQuickAdd('usuarioFaena', data)} />
                        </div>
                        <Select value={usuarioFaenaId} onValueChange={setUsuarioFaenaId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {usuariosFaena.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Especie</Label>
                        <Select value={especie} onValueChange={(v) => { setEspecie(v); setTiposAnimales([]); }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESPECIES.map((e) => (
                              <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Corral *</Label>
                        <Select value={corralId} onValueChange={setCorralId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {corrales.map((c) => {
                              const stockActual = especie === 'BOVINO' ? c.stockBovinos : c.stockEquinos
                              const disponible = c.capacidad - stockActual
                              return (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.nombre} ({disponible} disponibles)
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Observaciones</Label>
                      <Textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Notas adicionales..."
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Tipos de Animales - Componente modularizado */}
                <Card className="border-0 shadow-md lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Tipos de Animales</CardTitle>
                    <CardDescription>
                      Use los botones +/- o ingrese directamente la cantidad de cada tipo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TipoAnimalCounterGrid
                      especie={especie}
                      tiposAnimales={tiposAnimales}
                      onUpdate={setTiposAnimales}
                    />
                  </CardContent>
                </Card>

                {/* Pesos - Solo Bruto para Ingreso */}
                <Card className="border-0 shadow-md lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Peso Bruto</CardTitle>
                    <CardDescription>
                      El peso tara se registrará cuando el camión regrese vacío
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Peso Bruto (kg) *</Label>
                        <Input
                          type="number"
                          value={pesoBruto || ''}
                          onChange={(e) => setPesoBruto(parseFloat(e.target.value) || 0)}
                          className="text-2xl font-bold text-center h-16"
                          placeholder="0"
                        />
                        <p className="text-xs text-stone-500 text-center">Camión con carga</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-blue-700">Flujo de Pesaje</span>
                        </div>
                        <ol className="text-sm text-blue-600 space-y-1">
                          <li>1. Registre el peso bruto ahora</li>
                          <li>2. El ticket queda ABIERTO</li>
                          <li>3. Registre la tara cuando el camión descargue</li>
                          <li>4. Se imprime el ticket completo</li>
                        </ol>
                      </div>
                    </div>
                    
                    {/* PC1: Summary before saving */}
                    {pesoBruto > 0 && totalCabezas > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                        <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4" />
                          Resumen del Pesaje
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between bg-white rounded px-2 py-1">
                            <span className="text-stone-500">Tropa:</span>
                            <span className="font-mono font-bold">{nextTropaCode?.codigo || '-'}</span>
                          </div>
                          <div className="flex justify-between bg-white rounded px-2 py-1">
                            <span className="text-stone-500">Corral:</span>
                            <span className="font-medium">{corrales.find(c => c.id === corralId)?.nombre || '-'}</span>
                          </div>
                          <div className="flex justify-between bg-white rounded px-2 py-1">
                            <span className="text-stone-500">Total cabezas:</span>
                            <span className="font-bold">{totalCabezas}</span>
                          </div>
                          <div className="flex justify-between bg-white rounded px-2 py-1">
                            <span className="text-stone-500">Especie:</span>
                            <span className="font-medium">{especie}</span>
                          </div>
                          {(dte || guia) && (
                            <div className="flex justify-between bg-white rounded px-2 py-1 col-span-2">
                              <span className="text-stone-500">DTE/Guía:</span>
                              <span className="font-mono">{dte || '-'}{guia ? ` / ${guia}` : ''}</span>
                            </div>
                          )}
                          <div className="flex justify-between bg-white rounded px-2 py-1 col-span-2">
                            <span className="text-stone-500">Peso Bruto:</span>
                            <span className="font-bold text-lg text-amber-700">{pesoBruto.toLocaleString()} kg</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <Button
                      onClick={() => {
                        if (!patenteChasis) { toast.error('Ingrese la patente del chasis'); return }
                        if (tipoPesaje === 'INGRESO_HACIENDA' && !usuarioFaenaId) { toast.error('Seleccione el usuario de faena'); return }
                        if (tipoPesaje === 'INGRESO_HACIENDA' && totalCabezas <= 0) { toast.error('Indique la cantidad de animales'); return }
                        if (tipoPesaje === 'INGRESO_HACIENDA' && !corralId) { toast.error('Seleccione el corral'); return }
                        setShowResumen(true)
                      }}
                      disabled={saving}
                      className="w-full h-14 text-lg bg-amber-500 hover:bg-amber-600 mt-6"
                    >
                      {saving ? (
                        <>Guardando...</>
                      ) : (
                        <>
                          <Save className="h-5 w-5 mr-2" />
                          Registrar Peso Bruto
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* PESAJE PARTICULAR */}
            {tipoPesaje === 'PESAJE_PARTICULAR' && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Pesaje Particular</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Patente Chasis *</Label>
                      <Input
                        value={patenteChasis}
                        onChange={(e) => setPatenteChasis(e.target.value.toUpperCase())}
                        placeholder="AB123CD"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Patente Acoplado</Label>
                      <Input
                        value={patenteAcoplado}
                        onChange={(e) => setPatenteAcoplado(e.target.value.toUpperCase())}
                        placeholder="AB123CD"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Descripción del pesaje..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Peso Bruto (kg)</Label>
                      <Input
                        type="number"
                        value={pesoBruto || ''}
                        onChange={(e) => setPesoBruto(parseFloat(e.target.value) || 0)}
                        className="text-2xl font-bold text-center h-16"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Peso Tara (kg)</Label>
                      <Input
                        type="number"
                        value={pesoTara || ''}
                        onChange={(e) => setPesoTara(parseFloat(e.target.value) || 0)}
                        className="text-2xl font-bold text-center h-16"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {pesoNeto > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-600 text-sm text-center">Peso Neto</p>
                      <p className="text-3xl font-bold text-blue-700 text-center">{pesoNeto.toLocaleString()} kg</p>
                    </div>
                  )}
                  <Button
                    onClick={() => setShowResumen(true)}
                    disabled={saving}
                    className="w-full h-14 text-lg bg-amber-500 hover:bg-amber-600"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    Guardar
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* SALIDA MERCADERÍA */}
            {tipoPesaje === 'SALIDA_MERCADERIA' && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Salida de Mercadería</CardTitle>
                  <CardDescription>Tara → Carga → Peso Bruto</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Patente Chasis *</Label>
                      <div className="relative">
                        <Input
                          value={patenteChasis}
                          onChange={(e) => setPatenteChasis(e.target.value.toUpperCase())}
                          placeholder="AB123CD"
                          className="font-mono"
                        />
                        {vehiculoEncontrado && !buscandoVehiculo && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">conocido</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Patente Acoplado</Label>
                      <Input
                        value={patenteAcoplado}
                        onChange={(e) => setPatenteAcoplado(e.target.value.toUpperCase())}
                        placeholder="AB123CD"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Chofer</Label>
                      <Input
                        value={chofer}
                        onChange={(e) => setChofer(e.target.value)}
                        placeholder="Nombre del chofer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Transportista</Label>
                      <Select value={transportistaId} onValueChange={setTransportistaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {transportistas.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Teléfono Chofer</Label>
                      <Input
                        value={choferTelefono}
                        onChange={(e) => setChoferTelefono(e.target.value)}
                        placeholder="351-1234567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Habilitación</Label>
                      <Input
                        value={habilitacion}
                        onChange={(e) => setHabilitacion(e.target.value)}
                        placeholder="HAB-4113"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Destino *</Label>
                      <Input
                        value={destino}
                        onChange={(e) => setDestino(e.target.value)}
                        placeholder="Destino de la mercadería"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Remito</Label>
                      <Input
                        value={remito}
                        onChange={(e) => setRemito(e.target.value)}
                        placeholder="N° de remito"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observaciones / Tipo de Mercadería</Label>
                    <Textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Descripción del tipo de mercadería..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Peso Tara (kg) - Vacío</Label>
                      <Input
                        type="number"
                        value={pesoTara || ''}
                        onChange={(e) => setPesoTara(parseFloat(e.target.value) || 0)}
                        className="text-2xl font-bold text-center h-16"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Peso Bruto (kg) - Cargado *</Label>
                      <Input
                        type="number"
                        value={pesoBruto || ''}
                        onChange={(e) => setPesoBruto(parseFloat(e.target.value) || 0)}
                        className="text-2xl font-bold text-center h-16"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {pesoNeto > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-600 text-sm text-center">Peso Neto de Mercadería</p>
                      <p className="text-3xl font-bold text-green-700 text-center">{pesoNeto.toLocaleString()} kg</p>
                    </div>
                  )}
                  <Button
                    onClick={() => setShowResumen(true)}
                    disabled={saving}
                    className="w-full h-14 text-lg bg-amber-500 hover:bg-amber-600"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    Registrar Salida
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PESAJES ABIERTOS */}
          <TabsContent value="abiertos">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-orange-50 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Pesajes Abiertos - Pendientes de Tara
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {pesajesAbiertos.length === 0 ? (
                  <div className="p-8 text-center text-stone-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay pesajes abiertos</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Patente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Tropa</TableHead>
                        <TableHead>Peso Bruto</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pesajesAbiertos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono font-bold">#{String(p.numeroTicket).padStart(6, '0')}</TableCell>
                          <TableCell>{new Date(p.fecha).toLocaleDateString('es-AR')}</TableCell>
                          <TableCell className="font-mono">{p.patenteChasis}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{TIPOS_PESAJE.find(t => t.id === p.tipo)?.label || p.tipo}</Badge>
                          </TableCell>
                          <TableCell>
                            {p.tropa && (
                              <div>
                                <Badge className="bg-green-100 text-green-700">{p.tropa.codigo}</Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-bold">{p.pesoBruto?.toLocaleString()} kg</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => {
                                  setPesajeSeleccionado(p)
                                  setTaraForm(0)
                                  setCerrarOpen(true)
                                }}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Scale className="h-4 w-4 mr-1" />
                                Registrar Tara
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTORIAL */}
          <TabsContent value="historial">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-green-50 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Historial de Pesajes Cerrados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {/* Filtros de fecha */}
                <div className="flex flex-wrap items-end gap-4 mb-4 pb-4 border-b">
                  <div className="space-y-2">
                    <Label className="text-sm">Desde</Label>
                    <Input
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Hasta</Label>
                    <Input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                    className="mb-0.5"
                  >
                    Limpiar
                  </Button>
                  <Button 
                    onClick={handleImprimirReporte}
                    className="bg-amber-500 hover:bg-amber-600 mb-0.5"
                    disabled={pesajesFiltrados.length === 0}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Reporte
                  </Button>
                </div>
                
                {/* Resumen */}
                {pesajesFiltrados.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-stone-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-stone-500">Total Pesajes</p>
                      <p className="text-lg font-bold">{pesajesFiltrados.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-stone-500">Total Bruto</p>
                      <p className="text-lg font-bold">{pesajesFiltrados.reduce((acc, p) => acc + (p.pesoBruto || 0), 0).toLocaleString()} kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-stone-500">Total Tara</p>
                      <p className="text-lg font-bold">{pesajesFiltrados.reduce((acc, p) => acc + (p.pesoTara || 0), 0).toLocaleString()} kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-stone-500">Total Neto</p>
                      <p className="text-lg font-bold text-green-600">{pesajesFiltrados.reduce((acc, p) => acc + (p.pesoNeto || 0), 0).toLocaleString()} kg</p>
                    </div>
                  </div>
                )}
                
                {pesajesFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-stone-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay pesajes en el rango seleccionado</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Patente</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Tropa</TableHead>
                          <TableHead>Bruto</TableHead>
                          <TableHead>Tara</TableHead>
                          <TableHead>Neto</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pesajesFiltrados.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono font-bold">#{String(p.numeroTicket).padStart(6, '0')}</TableCell>
                            <TableCell>{new Date(p.fecha).toLocaleDateString('es-AR')}</TableCell>
                            <TableCell className="font-mono">{p.patenteChasis}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{TIPOS_PESAJE.find(t => t.id === p.tipo)?.label || p.tipo}</Badge>
                            </TableCell>
                            <TableCell>
                              {p.tropa && (
                                <Badge className="bg-green-100 text-green-700">{p.tropa.codigo}</Badge>
                              )}
                            </TableCell>
                            <TableCell>{p.pesoBruto?.toLocaleString()} kg</TableCell>
                            <TableCell>{p.pesoTara?.toLocaleString()} kg</TableCell>
                            <TableCell className="font-bold text-green-600">{p.pesoNeto?.toLocaleString()} kg</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => imprimirTicket(p, false)}
                                  title="Reimprimir"
                                >
                                  <Printer className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => { setPesajeAccion(p); setEditDialogOpen(true); }}
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => { setPesajeAccion(p); setDeleteDialogOpen(true); }}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Registrar Tara */}
      <Dialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>Registrar Peso Tara</DialogTitle>
            <DialogDescription>
              Ingrese el peso del camión vacío para cerrar el pesaje
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {pesajeSeleccionado && (
              <div className="bg-stone-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-600">Ticket:</span>
                  <span className="font-bold">#{String(pesajeSeleccionado.numeroTicket).padStart(6, '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Tropa:</span>
                  <span className="font-bold text-green-600">{pesajeSeleccionado.tropa?.codigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Peso Bruto:</span>
                  <span className="font-bold">{pesajeSeleccionado.pesoBruto?.toLocaleString()} kg</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Peso Tara (kg) *</Label>
              <Input
                type="number"
                value={taraForm || ''}
                onChange={(e) => setTaraForm(parseFloat(e.target.value) || 0)}
                className="text-2xl font-bold text-center h-16"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCerrarOpen(false)}>Cancelar</Button>
            <Button onClick={handleCerrarPesaje} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? 'Guardando...' : 'Cerrar Pesaje'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar (placeholder) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>Editar Pesaje</DialogTitle>
            <DialogDescription>Función en desarrollo</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center text-stone-400">
            <p>Esta función estará disponible próximamente</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>Eliminar Pesaje</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. Se requiere PIN de supervisor.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>PIN de Supervisor</Label>
              <Input
                type="password"
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="text-center text-2xl tracking-widest h-14"
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setSupervisorPin(''); }}>Cancelar</Button>
            <Button onClick={handleDeletePesaje} variant="destructive">Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Dialogs */}
      {quickAddOpen && (
        <QuickAddDialog
          tipo={quickAddOpen}
          onAdd={(data) => handleQuickAdd(quickAddOpen, data)}
          open={!!quickAddOpen}
          onOpenChange={(open) => setQuickAddOpen(open ? quickAddOpen : null)}
        />
      )}

      {/* Dialog Advertencia de Capacidad */}
      <Dialog open={capacidadWarningOpen} onOpenChange={setCapacidadWarningOpen}>
        <DialogContent className="max-w-md" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Advertencia de Capacidad
            </DialogTitle>
            <DialogDescription>
              {capacidadWarningInfo?.error}
            </DialogDescription>
          </DialogHeader>
          {capacidadWarningInfo?.capacidadInfo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-stone-500">Corral:</span> <strong>{capacidadWarningInfo.capacidadInfo.corral}</strong></div>
                <div><span className="text-stone-500">Capacidad:</span> <strong>{capacidadWarningInfo.capacidadInfo.capacidad}</strong></div>
                <div><span className="text-stone-500">Stock actual:</span> <strong>{capacidadWarningInfo.capacidadInfo.stockActual}</strong></div>
                <div><span className="text-stone-500">Disponible:</span> <strong className="text-amber-600">{capacidadWarningInfo.capacidadInfo.disponible}</strong></div>
                <div><span className="text-stone-500">A ingresar:</span> <strong className="text-red-600">{capacidadWarningInfo.capacidadInfo.cantidadIngresar}</strong></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapacidadWarningOpen(false)}>Cancelar</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleForzarCapacidad}>
              Continuar de todas formas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* PC1: Visual Summary Confirmation Dialog */}
        <Dialog open={showResumen} onOpenChange={setShowResumen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <ClipboardCheck className="w-6 h-6 text-amber-600" />
                Resumen del Pesaje
              </DialogTitle>
              <DialogDescription>Revise los datos antes de confirmar el registro.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Tipo de pesaje badge */}
              <div className="flex items-center gap-2">
                <Badge className="text-sm px-3 py-1" variant={
                  tipoPesaje === 'INGRESO_HACIENDA' ? 'default' :
                  tipoPesaje === 'SALIDA_MERCADERIA' ? 'secondary' : 'outline'
                }>
                  {tipoPesaje === 'INGRESO_HACIENDA' ? '📥 Ingreso de Hacienda' :
                   tipoPesaje === 'SALIDA_MERCADERIA' ? '📤 Salida de Mercadería' :
                   '⚖️ Pesaje Particular'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Ticket #{String(nextTicket).padStart(6, '0')}
                </Badge>
              </div>

              {/* Section: Vehículo y Transporte */}
              <div className="bg-stone-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-stone-500" />
                  Vehículo y Transporte
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Patente Chasis:</span>
                    <span className="font-mono font-bold text-stone-800">{patenteChasis.toUpperCase()}</span>
                  </div>
                  {patenteAcoplado && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Acoplado:</span>
                      <span className="font-mono font-bold text-stone-800">{patenteAcoplado.toUpperCase()}</span>
                    </div>
                  )}
                  {chofer && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Chofer:</span>
                      <span className="font-medium">{chofer}</span>
                    </div>
                  )}
                  {dniChofer && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">DNI Chofer:</span>
                      <span className="font-mono">{dniChofer}</span>
                    </div>
                  )}
                  {transportistaId && (
                    <div className="flex justify-between col-span-2">
                      <span className="text-stone-500">Transportista:</span>
                      <span className="font-medium">{transportistas.find(t => t.id === transportistaId)?.nombre || '-'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Datos de la Tropa (INGRESO_HACIENDA) */}
              {tipoPesaje === 'INGRESO_HACIENDA' && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <Beef className="w-4 h-4 text-green-600" />
                    Datos de la Tropa
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {nextTropaCode && (
                      <div className="col-span-2 bg-white rounded-md p-2 flex items-center justify-center gap-2">
                        <span className="text-green-600">Tropa:</span>
                        <span className="text-2xl font-mono font-bold text-green-700">{nextTropaCode.codigo}</span>
                      </div>
                    )}
                    {productorId && (
                      <div className="flex justify-between">
                        <span className="text-green-600">Productor:</span>
                        <span className="font-medium text-green-800">{productores.find(p => p.id === productorId)?.nombre || '-'}</span>
                      </div>
                    )}
                    {usuarioFaenaId && (
                      <div className="flex justify-between">
                        <span className="text-green-600">Usuario Faena:</span>
                        <span className="font-medium text-green-800">{usuariosFaena.find(u => u.id === usuarioFaenaId)?.nombre || '-'}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-green-600">Especie:</span>
                      <Badge variant="outline" className="border-green-300 text-green-700">{ESPECIES.find(e => e.id === especie)?.label || especie}</Badge>
                    </div>
                    {corralId && (
                      <div className="flex justify-between">
                        <span className="text-green-600">Corral:</span>
                        <span className="font-medium text-green-800">{corrales.find(c => c.id === corralId)?.nombre || '-'}</span>
                      </div>
                    )}
                    {(dte || guia) && (
                      <div className="flex justify-between col-span-2">
                        <span className="text-green-600">DTE / Guía:</span>
                        <span className="font-mono text-green-800">{dte || '-'}{guia ? ` / ${guia}` : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Heads by animal type */}
                  {tiposAnimales.length > 0 && (
                    <div className="mt-3">
                      <Separator className="bg-green-200 mb-3" />
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-green-700">Cabezas por tipo:</span>
                        <Badge className="bg-green-600 text-white text-xs">Total: {totalCabezas}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tiposAnimales.filter(t => t.cantidad > 0).map((ta) => {
                          const animalDef = TIPOS_ANIMALES[especie]?.find(a => a.codigo === ta.tipoAnimal)
                          return (
                            <Badge key={ta.tipoAnimal} variant="outline" className="border-green-300 text-green-800 bg-white">
                              {animalDef?.siglas || ta.tipoAnimal}: <span className="font-bold ml-1">{ta.cantidad}</span>
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Section: Destino/Remito (SALIDA_MERCADERIA) */}
              {tipoPesaje === 'SALIDA_MERCADERIA' && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-600" />
                    Datos de Salida
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-orange-600">Destino:</span>
                      <span className="font-medium text-orange-800">{destino || '-'}</span>
                    </div>
                    {remito && (
                      <div className="flex justify-between">
                        <span className="text-orange-600">Remito:</span>
                        <span className="font-mono text-orange-800">{remito}</span>
                      </div>
                    )}
                    {observaciones && (
                      <div className="flex justify-between col-span-2">
                        <span className="text-orange-600">Observaciones:</span>
                        <span className="font-medium text-orange-800">{observaciones}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section: Descripción (PESAJE_PARTICULAR) */}
              {tipoPesaje === 'PESAJE_PARTICULAR' && descripcion && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Descripción
                  </h4>
                  <p className="text-sm text-blue-700">{descripcion}</p>
                </div>
              )}

              {/* Section: Pesos */}
              <div className="bg-amber-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-600" />
                  Pesos
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-amber-600 mb-1">Peso Bruto</p>
                    <p className="text-xl font-bold text-amber-800">{pesoBruto.toLocaleString()}</p>
                    <p className="text-xs text-amber-500">kg</p>
                  </div>
                  {tipoPesaje !== 'INGRESO_HACIENDA' && (
                    <div className="text-center">
                      <p className="text-xs text-amber-600 mb-1">Peso Tara</p>
                      <p className="text-xl font-bold text-amber-800">{pesoTara.toLocaleString()}</p>
                      <p className="text-xs text-amber-500">kg</p>
                    </div>
                  )}
                  {tipoPesaje !== 'INGRESO_HACIENDA' && pesoNeto > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-green-600 mb-1">Peso Neto</p>
                      <p className="text-2xl font-bold text-green-700">{pesoNeto.toLocaleString()}</p>
                      <p className="text-xs text-green-500">kg</p>
                    </div>
                  )}
                  {tipoPesaje === 'INGRESO_HACIENDA' && (
                    <div className="text-center col-span-2">
                      <p className="text-xs text-stone-500 mb-1">Estado del pesaje</p>
                      <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs">
                        Quedará ABIERTO — tara pendiente
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-row gap-3 sm:justify-end mt-2">
              <Button variant="outline" onClick={() => setShowResumen(false)} disabled={saving}>
                Volver
              </Button>
              <Button onClick={handleConfirmarGuardar} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                {saving ? (
                  <><Scale className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" />Confirmar y Guardar</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  )
}

export default PesajeCamionesModule
