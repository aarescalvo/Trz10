'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Scale, Printer, RefreshCw, User, Warehouse, ChevronUp, ChevronDown,
  CheckCircle, AlertTriangle, RotateCcw, Trash2, AlertOctagon, Lock, Edit,
  Maximize2, Minimize2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BalanzaConfigButton } from '@/components/balanza-config-button'

const DIENTES = ['0', '2', '4', '6', '8']
const SIGLAS = ['A', 'T', 'D']

interface Tipificador {
  id: string
  nombre: string
  apellido: string
  matricula: string
}

interface Camara {
  id: string
  nombre: string
  tipo: string
  capacidad: number
}

interface MediaPesada {
  id: string
  garron: number
  lado: string
  peso: number
  siglas: string[]
  fecha: Date
  tropaCodigo: string | null
  tipoAnimal: string | null
  decomisada?: boolean
  kgDecomiso?: number
  kgRestantes?: number
}

interface AsignacionGarron {
  garron: number
  animalId: string | null
  animalCodigo: string | null
  tropaCodigo: string | null
  tipoAnimal: string | null
  pesoVivo: number | null
  tieneMediaDer: boolean
  tieneMediaIzq: boolean
  productorNombre?: string
  productorCuit?: string
  productorMatricula?: string
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
  rol?: string
  permisos?: Record<string, boolean>
}

export function RomaneoModule({ operador }: { operador: Operador }) {
  // Configuración del turno
  const [tipificadorId, setTipificadorId] = useState('')
  const [camaraId, setCamaraId] = useState('')
  const [configOpen, setConfigOpen] = useState(false)
  
  // Estado del pesaje
  const [garronActual, setGarronActual] = useState(1)
  const [ladoActual, setLadoActual] = useState<'DERECHA' | 'IZQUIERDA'>('DERECHA')
  const [pesoBalanza, setPesoBalanza] = useState('')
  const [denticion, setDenticion] = useState('')
  const [asignacionActual, setAsignacionActual] = useState<AsignacionGarron | null>(null)
  
  // Historial
  const [mediasPesadas, setMediasPesadas] = useState<MediaPesada[]>([])
  
  // Ãšltimo rótulo para reimprimir
  const [ultimoRotulo, setUltimoRotulo] = useState<MediaPesada | null>(null)
  
  // Diálogo de decomiso
  const [decomisoOpen, setDecomisoOpen] = useState(false)
  const [kgDecomiso, setKgDecomiso] = useState('')
  
  // Diálogo de fin de faena
  const [finFaenaOpen, setFinFaenaOpen] = useState(false)
  
  // Diálogo de supervisor para editar
  const [supervisorOpen, setSupervisorOpen] = useState(false)
  const [claveSupervisor, setClaveSupervisor] = useState('')
  
  // Diálogo de reimpresión
  const [reimpresionOpen, setReimpresionOpen] = useState(false)
  const [fechaReimpresion, setFechaReimpresion] = useState(new Date().toISOString().split('T')[0])
  const [garronesReimpresion, setGarronesReimpresion] = useState<MediaPesada[]>([])
  const [garronSeleccionadoReimpresion, setGarronSeleccionadoReimpresion] = useState<MediaPesada | null>(null)
  const [loadingReimpresion, setLoadingReimpresion] = useState(false)
  
  // Estado de faena terminada
  const [faenaTerminada, setFaenaTerminada] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [fechaFaena, setFechaFaena] = useState(new Date().toLocaleDateString('es-AR'))
  const [listaFaenaNumero, setListaFaenaNumero] = useState<number | null>(null)
  const [listaFaenaFecha, setListaFaenaFecha] = useState<string | null>(null)
  const [listaFaenaId, setListaFaenaId] = useState<string | null>(null)
  const [listasDisponibles, setListasDisponibles] = useState<{id: string; numero: number; fecha: string; estado: string}[]>([])
  
  // Datos maestros
  const [tipificadores, setTipificadores] = useState<Tipificador[]>([])
  const [camaras, setCamaras] = useState<Camara[]>([])
  const [garronesAsignados, setGarronesAsignados] = useState<AsignacionGarron[]>([])
  
  // Configuración de impresora
  const [configImpresoraOpen, setConfigImpresoraOpen] = useState(false)
  const [impresoraIp, setImpresoraIp] = useState('')
  const [usarPredeterminada, setUsarPredeterminada] = useState(false)
  const [impresoraPuerto, setImpresoraPuerto] = useState(9100)
  const [impresoraVelocidad, setImpresoraVelocidad] = useState(4)   // 1-12 ips
  const [impresoraCalor, setImpresoraCalor] = useState(10)         // 0-30
  const [impresoraAncho, setImpresoraAncho] = useState(100)        // mm
  const [impresoraAlto, setImpresoraAlto] = useState(50)           // mm

  // Toggle production mode with sidebar event
  const toggleModoProduccion = useCallback((active: boolean) => {
    setModoProduccion(active)
    window.dispatchEvent(new CustomEvent('production-mode-change', { detail: { active } }))
  }, [])

  // Modo producción
  const [modoProduccion, setModoProduccion] = useState(false)
  const [pesoProduccion, setPesoProduccion] = useState<number | null>(null)
  const [flashExito, setFlashExito] = useState(false)

  // UI
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Ref para auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastGarronRef = useRef<number | null>(null)

  // Cargar configuración de impresora guardada
  useEffect(() => {
    const savedIp = localStorage.getItem('impresoraRomaneoIp') || ''
    const savedPredeterminada = localStorage.getItem('impresoraRomaneoPredeterminada') === 'true'
    const savedPuerto = parseInt(localStorage.getItem('impresoraRomaneoPuerto') || '9100')
    const savedVelocidad = parseInt(localStorage.getItem('impresoraRomaneoVelocidad') || '4')
    const savedCalor = parseInt(localStorage.getItem('impresoraRomaneoCalor') || '10')
    const savedAncho = parseInt(localStorage.getItem('impresoraRomaneoAncho') || '100')
    const savedAlto = parseInt(localStorage.getItem('impresoraRomaneoAlto') || '50')
    setImpresoraIp(savedIp)
    setUsarPredeterminada(savedPredeterminada)
    setImpresoraPuerto(savedPuerto)
    setImpresoraVelocidad(savedVelocidad)
    setImpresoraCalor(savedCalor)
    setImpresoraAncho(savedAncho)
    setImpresoraAlto(savedAlto)
  }, [])

  // Cargar datos iniciales
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async (listaIdOverride?: string | null) => {
    setLoading(true)
    try {
      const listaParam = listaIdOverride || listaFaenaId
      const garronesUrl = listaParam
        ? `/api/garrones-asignados?listaId=${listaParam}`
        : '/api/garrones-asignados'
      const [tipRes, camRes, garronesRes] = await Promise.all([
        fetch('/api/tipificadores'),
        fetch('/api/camaras'),
        fetch(garronesUrl)
      ])
      
      const tipData = await tipRes.json()
      const camData = await camRes.json()
      const garronesData = await garronesRes.json()
      
      if (tipData.success) {
        setTipificadores(tipData.data || [])
        if (tipData.data?.length > 0) {
          setTipificadorId(tipData.data[0].id)
        }
      }
      
      if (camData.success) {
        const camarasFaena = (camData.data || []).filter((c: Camara) => c.tipo === 'FAENA')
        setCamaras(camarasFaena)
        if (camarasFaena.length > 0) {
          setCamaraId(camarasFaena[0].id)
        }
      }
      
      if (garronesData.success) {
        setGarronesAsignados(garronesData.data || [])
        setFaenaTerminada(false)
        
        // Info de lista de faena
        if (garronesData.listaFaena) {
          setListaFaenaNumero(garronesData.listaFaena.numero)
          setListaFaenaFecha(garronesData.listaFaena.fecha)
          setListaFaenaId(garronesData.listaFaena.id)
        } else {
          setListaFaenaNumero(null)
          setListaFaenaFecha(null)
          setListaFaenaId(null)
        }
        
        // Listas disponibles para dropdown
        if (garronesData.listasDisponibles) {
          setListasDisponibles(garronesData.listasDisponibles.map((l: any) => ({
            id: l.id,
            numero: l.numero,
            fecha: l.fecha,
            estado: l.estado
          })))
        }
        
        const pendientes = (garronesData.data || []).filter((g: AsignacionGarron) => 
          !g.tieneMediaDer || !g.tieneMediaIzq
        )
        
        if (pendientes.length > 0) {
          const primero = pendientes[0]
          setGarronActual(primero.garron)
          setAsignacionActual(primero)
          setLadoActual(primero.tieneMediaDer ? 'IZQUIERDA' : 'DERECHA')
        } else if (garronesData.data?.length > 0) {
          // Todos los garrones están pesados
          setFaenaTerminada(true)
          setAsignacionActual(null)
        }
      }
      
      if (!tipificadorId || !camaraId) {
        setConfigOpen(true)
      }
      
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleCapturarPeso = useCallback(() => {
    const peso = pesoBalanza || (Math.random() * 50 + 100).toFixed(1)
    setPesoBalanza(peso)
  }, [pesoBalanza])

  const handleAceptarPeso = async (esDecomiso: boolean = false, kgDecomisoValor: number = 0) => {
    if (!pesoBalanza || parseFloat(pesoBalanza) <= 0) {
      toast.error('Ingrese un peso válido')
      return
    }
    
    if (!tipificadorId || !camaraId) {
      setConfigOpen(true)
      toast.error('Configure tipificador y cámara primero')
      return
    }
    
    // Verificar que no exceda el listado de faena
    if (!asignacionActual) {
      toast.error('No hay más garrones para pesar en esta lista de faena')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/romaneo/pesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garron: garronActual,
          lado: ladoActual,
          peso: parseFloat(pesoBalanza),
          siglas: SIGLAS,
          denticion: denticion,
          tipificadorId,
          camaraId,
          operadorId: operador.id,
          esDecomiso,
          kgDecomiso: kgDecomisoValor,
          kgRestantes: parseFloat(pesoBalanza),
          sobrescribir: modoEdicion // Permitir sobrescribir en modo edición
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        await handleImprimirRotulos(garronActual, ladoActual, parseFloat(pesoBalanza), esDecomiso)
        
        const nuevaMedia: MediaPesada = {
          id: data.data.id,
          garron: garronActual,
          lado: ladoActual,
          peso: parseFloat(pesoBalanza),
          siglas: SIGLAS,
          fecha: new Date(),
          tropaCodigo: asignacionActual?.tropaCodigo || null,
          tipoAnimal: asignacionActual?.tipoAnimal || null,
          decomisada: esDecomiso,
          kgDecomiso: esDecomiso ? kgDecomisoValor : undefined,
          kgRestantes: esDecomiso ? parseFloat(pesoBalanza) : undefined
        }
        setMediasPesadas(prev => [...prev, nuevaMedia])
        setUltimoRotulo(nuevaMedia)
        
        if (esDecomiso) {
          toast.success(`Media decomisada - Garrón #${garronActual}`, {
            description: `Decomiso: ${kgDecomisoValor} kg`
          })
        } else {
          toast.success(`Media ${ladoActual === 'DERECHA' ? 'derecha' : 'izquierda'} registrada`)
        }
        
        setPesoBalanza('')
        setKgDecomiso('')
        setDecomisoOpen(false)
        
        if (asignacionActual) {
          const actualizado = { ...asignacionActual }
          if (ladoActual === 'DERECHA') {
            actualizado.tieneMediaDer = true
          } else {
            actualizado.tieneMediaIzq = true
          }
          setAsignacionActual(actualizado)
        }
        
        // Avanzar al siguiente
        if (ladoActual === 'DERECHA') {
          setLadoActual('IZQUIERDA')
        } else {
          const nuevosGarrones = [...garronesAsignados]
          if (asignacionActual) {
            const idx = nuevosGarrones.findIndex(g => g.garron === garronActual)
            if (idx >= 0) {
              nuevosGarrones[idx] = {
                ...nuevosGarrones[idx],
                tieneMediaDer: true,
                tieneMediaIzq: true
              }
            }
          }
          
          const siguientePendiente = nuevosGarrones.find(g => 
            !g.tieneMediaDer || !g.tieneMediaIzq
          )
          
          if (siguientePendiente) {
            setGarronActual(siguientePendiente.garron)
            setAsignacionActual(siguientePendiente)
            setLadoActual(siguientePendiente.tieneMediaDer ? 'IZQUIERDA' : 'DERECHA')
          } else {
            // No hay más garrones - preguntar si termina faena
            setGarronesAsignados(nuevosGarrones)
            setDenticion('')
            setFinFaenaOpen(true)
            return
          }
          
          setDenticion('')
          setGarronesAsignados(nuevosGarrones)
        }
      } else {
        toast.error(data.error || 'Error al registrar peso')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleImprimirRotulos = async (garron: number, lado: 'DERECHA' | 'IZQUIERDA', peso: number, esDecomiso: boolean = false) => {
    try {
      // Buscar template MEDIA_RES en DB
      const rotulosRes = await fetch('/api/rotulos?tipo=MEDIA_RES&activo=true')
      const rotulosResponse = await rotulosRes.json()
      const rotulosData = rotulosResponse.data || []
      const rotulo = rotulosData.find((r: any) => r.esDefault) || rotulosData[0]
      
      const fecha = new Date()
      const fechaVenc = new Date(fecha.getTime() + (rotulo?.diasConsumo || 30) * 24 * 60 * 60 * 1000)
      const tipificador = tipificadores.find(t => t.id === tipificadorId)
      const camara = camaras.find(c => c.id === camaraId)
      
      const datosRotulo = {
        fecha: formatearFecha(fecha),
        fecha_faena: formatearFecha(fecha),
        fecha_venc: formatearFecha(fechaVenc),
        fecha_vencimiento: formatearFecha(fechaVenc),
        tropa: asignacionActual?.tropaCodigo || '-',
        tropa_codigo: asignacionActual?.tropaCodigo || '-',
        garron: String(garron).padStart(3, '0'),
        numero_garron: String(garron).padStart(3, '0'),
        correlativo: String(garron).padStart(4, '0'),
        peso: peso.toFixed(1),
        peso_kg: peso.toFixed(1) + ' KG',
        peso_vivo: asignacionActual?.pesoVivo?.toFixed(0) || '-',
        producto: 'MEDIA RES',
        nombre_producto: 'MEDIA RES',
        tipo_animal: asignacionActual?.tipoAnimal || '-',
        lado: lado === 'DERECHA' ? 'D' : 'I',
        lado_media: lado,
        denticion: denticion || '-',
        dientes: denticion || '-',
        establecimiento: 'SOLEMAR ALIMENTARIA',
        nombre_establecimiento: 'SOLEMAR ALIMENTARIA',
        tipificador: tipificador ? `${tipificador.nombre} ${tipificador.apellido}` : '-',
        matricula: tipificador?.matricula || '-',
        camara: camara?.nombre || '-',
        decomisado: esDecomiso ? 'SI' : 'NO',
        codigo_barras: `${fecha.getFullYear().toString().slice(-2)}${(fecha.getMonth() + 1).toString().padStart(2, '0')}${fecha.getDate().toString().padStart(2, '0')}-${garron.toString().padStart(4, '0')}-${lado.charAt(0)}`,
      }

      // Si hay template de DB, usarlo (TCP/IP o impresora predeterminada)
      if (rotulo) {
        // TCP/IP directo
        if (!usarPredeterminada && impresoraIp) {
          let exitos = 0
          for (const sigla of SIGLAS) {
            const datosConSigla = {
              ...datosRotulo,
              sigla: sigla,
              sigla_media: sigla,
              codigo_barras: `${fecha.getFullYear().toString().slice(-2)}${(fecha.getMonth() + 1).toString().padStart(2, '0')}${fecha.getDate().toString().padStart(2, '0')}-${garron.toString().padStart(4, '0')}-${lado.charAt(0)}-${sigla}`
            }
            
            try {
              const printRes = await fetch('/api/rotulos/imprimir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  rotuloId: rotulo.id,
                  datos: datosConSigla,
                  cantidad: 1,
                  impresoraIp: impresoraIp,
                  impresoraPuerto: impresoraPuerto
                })
              })
              
              const printData = await printRes.json()
              if (printData.success) exitos++
            } catch (printError) {
              console.error('Error al imprimir por TCP:', printError)
            }
          }
          
          if (exitos === 3) {
            toast.success(`3 rótulos enviados a ${impresoraIp}`, {
              description: `Plantilla: ${rotulo.nombre} | ${impresoraVelocidad}ips | Calor ${impresoraCalor}`
            })
            return
          } else if (exitos > 0) {
            toast.success(`${exitos}/3 rótulos enviados a impresora`, { description: `Plantilla: ${rotulo.nombre}` })
            return
          }
          // Si fallaron todas las TCP, caer al render HTML de la plantilla
        }

        // Impresora predeterminada o TCP falló: renderizar plantilla como HTML
        try {
          const { zplToHTML } = await import('@/lib/zpl-to-html')
          // Generar 3 rótulos (A, T, D) como HTML desde la plantilla
          for (const sigla of SIGLAS) {
            const datosConSigla = {
              ...datosRotulo,
              sigla: sigla,
              sigla_media: sigla,
              codigo_barras: `${fecha.getFullYear().toString().slice(-2)}${(fecha.getMonth() + 1).toString().padStart(2, '0')}${fecha.getDate().toString().padStart(2, '0')}-${garron.toString().padStart(4, '0')}-${lado.charAt(0)}-${sigla}`
            }
            
            // Pedir a la API que procese la plantilla con los datos (sin enviar a impresora)
            const processRes = await fetch('/api/rotulos/imprimir', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rotuloId: rotulo.id,
                datos: datosConSigla,
                cantidad: 1
                // sin impresoraIp => devuelve contenido procesado
              })
            })
            const processData = await processRes.json()
            
            if (processData.success && processData.contenido && processData.rotulo) {
              const html = zplToHTML(processData.contenido, datosConSigla, {
                anchoMm: processData.rotulo.ancho,
                altoMm: processData.rotulo.alto,
                dpi: processData.rotulo.dpi
              })
              const printWindow = window.open('', '_blank', 'width=500,height=400')
              if (printWindow) {
                printWindow.document.write(html)
                printWindow.document.close()
              }
            }
          }
          toast.success('Rótulos generados desde plantilla', { description: `Plantilla: ${rotulo.nombre}` })
          return
        } catch (htmlError) {
          console.error('Error al renderizar plantilla como HTML:', htmlError)
        }
      }

      // Si no hay plantilla en DB, usar HTML hardcodeado como último recurso
      imprimirRotuloHTML(garron, lado, peso, esDecomiso)
      
    } catch (error) {
      console.error('Error al imprimir:', error)
      imprimirRotuloHTML(garron, lado, peso, esDecomiso)
    }
  }

    const imprimirRotuloHTML = (garron: number, lado: 'DERECHA' | 'IZQUIERDA', peso: number, esDecomiso: boolean = false) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) {
      toast.error('No se pudo abrir ventana de impresión')
      return
    }

    const tipificador = tipificadores.find(t => t.id === tipificadorId)
    const fecha = new Date()
    const fechaVencimiento = new Date(fecha)
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 13)
    
    const titular = asignacionActual?.productorNombre || 'SOLEMAR ALIMENTARIA'
    const cuit = asignacionActual?.productorCuit || '20-12345678-9'
    const matricula = asignacionActual?.productorMatricula || '1234'
    const senasaHabilitacion = '4113'
    const senasaEstablecimiento = '4113'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Rótulos Media Res - Garrón ${garron}</title>
        <style>
          @page { size: 100mm 150mm; margin: 2mm; }
          body { font-family: Arial, sans-serif; padding: 0; margin: 0; }
          .rotulo { border: 2px solid black; padding: 3mm; margin-bottom: 2mm; page-break-after: always; width: 96mm; height: 146mm; box-sizing: border-box; ${esDecomiso ? 'background: #fee2e2;' : ''} display: flex; flex-direction: column; }
          .logos { display: flex; justify-content: space-between; align-items: center; padding: 2mm; border-bottom: 1px solid black; min-height: 20mm; }
          .logo { height: 18mm; max-width: 45mm; object-fit: contain; }
          .logo-placeholder { font-size: 14px; font-weight: bold; color: #333; padding: 2mm; }
          .datos-cliente { padding: 2mm; border-bottom: 1px solid black; }
          .datos-cliente .fila { display: flex; font-size: 11px; margin: 1mm 0; }
          .datos-cliente .label { font-weight: bold; width: 28mm; }
          .identificacion { display: flex; flex-wrap: wrap; padding: 2mm; border-bottom: 1px solid black; }
          .identificacion .campo { width: 50%; font-size: 11px; margin: 1mm 0; }
          .identificacion .valor { font-weight: bold; font-size: 13px; }
          .peso-fecha { display: flex; flex-wrap: wrap; padding: 2mm; border-bottom: 1px solid black; background: #f5f5f5; }
          .peso-fecha .campo { width: 50%; font-size: 11px; margin: 1mm 0; }
          .peso-fecha .valor { font-weight: bold; font-size: 13px; }
          .peso { background: #1a1a1a; color: white; padding: 3mm; text-align: center; }
          .peso .kg { font-size: 28px; font-weight: bold; }
          .sigla-container { display: flex; align-items: center; justify-content: center; padding: 2mm; border-bottom: 1px solid black; }
          .sigla-grande { font-size: 72px; font-weight: bold; text-align: center; width: 60mm; background: ${lado === 'DERECHA' ? '#e3f2fd' : '#fce4ec'}; border: 2px solid ${lado === 'DERECHA' ? '#1976d2' : '#c2185b'}; }
          .sigla-label { text-align: center; font-size: 14px; font-weight: bold; padding: 1mm; }
          .barcode-container { padding: 3mm; text-align: center; border-bottom: 1px solid black; background: white; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
          .barcode-text { font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; margin-top: 2mm; }
          .barcode-fallback { font-family: 'Courier New', monospace; font-size: 16px; letter-spacing: 3px; padding: 5mm; background: white; border: 1px solid #ccc; }
          .senasa { padding: 2mm; font-size: 10px; text-align: center; background: #f9f9f9; }
          .decomiso-banner { background: #dc2626; color: white; text-align: center; font-weight: bold; padding: 2mm; font-size: 16px; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        ${SIGLAS.map(sigla => {
          const codigoBarras = `${asignacionActual?.tropaCodigo || 'T000'}-${String(garron).padStart(3, '0')}-${lado.substring(0,3).toUpperCase()}-${sigla}`;
          const siglaNombre = sigla === 'A' ? 'ASADO' : sigla === 'T' ? 'TRASERO' : 'DELANTERO';
          return `
          <div class="rotulo">
            ${esDecomiso ? '<div class="decomiso-banner">?? DECOMISO ??</div>' : ''}
            <div class="logos">
              <img src="/logos/logo-solemar.jpg" class="logo" alt="SOLEMAR" onerror="this.outerHTML='<span class=\\'logo-placeholder\\'>SOLEMAR</span>'">
              <img src="/logos/logo-senasa.jpg" class="logo" alt="SENASA" onerror="this.outerHTML='<span class=\\'logo-placeholder\\'>SENASA</span>'">
            </div>
            <div class="datos-cliente">
              <div class="fila"><span class="label">TITULAR:</span><span>${titular}</span></div>
              <div class="fila"><span class="label">CUIT:</span><span>${cuit}</span></div>
              <div class="fila"><span class="label">MATRÍCULA:</span><span>${matricula}</span></div>
            </div>
            <div class="identificacion">
              <div class="campo">TROPA: <span class="valor">${asignacionActual?.tropaCodigo || '-'}</span></div>
              <div class="campo">GARRÓN: <span class="valor">${garron}</span></div>
              <div class="campo">LADO: <span class="valor">${lado === 'DERECHA' ? 'DERECHA' : 'IZQUIERDA'}</span></div>
              <div class="campo">CLASIF: <span class="valor">${siglaNombre}</span></div>
            </div>
            <div class="peso"><div class="kg">${peso.toFixed(1)} KG</div></div>
            <div class="peso-fecha">
              <div class="campo">FECHA: <span class="valor">${formatearFecha(fecha)}</span></div>
              <div class="campo">VTO: <span class="valor">${formatearFecha(fechaVencimiento)}</span></div>
            </div>
            <div class="sigla-container"><div class="sigla-grande">${sigla}</div></div>
            <div class="sigla-label">${siglaNombre}</div>
            <div class="barcode-container">
              <svg id="barcode-${sigla}"></svg>
              <div class="barcode-text">${codigoBarras}</div>
            </div>
            <div class="senasa">
              <div>SENASA Habilitación N°: ${senasaHabilitacion}</div>
              <div>Establecimiento: ${senasaEstablecimiento}</div>
              ${tipificador ? `<div>Tipificador: ${tipificador.nombre} ${tipificador.apellido}</div>` : ''}
            </div>
          </div>
        `}).join('')}
        <script>
          ${SIGLAS.map(sigla => {
            const codigoBarras = `${asignacionActual?.tropaCodigo || 'T000'}-${String(garron).padStart(3, '0')}-${lado.substring(0,3).toUpperCase()}-${sigla}`;
            return `try { JsBarcode("#barcode-${sigla}", "${codigoBarras}", { format: "CODE128", width: 2, height: 60, displayValue: false, margin: 2 }); } catch(e) { document.getElementById("barcode-${sigla}").outerHTML = '<div class="barcode-fallback">${codigoBarras}</div>'; }`;
          }).join('')}
          window.onload = function() { window.print(); window.onafterprint = function() { window.close(); } }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const formatearFecha = (fecha: Date): string => {
    const dia = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const anio = fecha.getFullYear()
    return `${dia}/${mes}/${anio}`
  }

  const handleReimprimirUltimo = () => {
    if (ultimoRotulo) {
      handleImprimirRotulos(ultimoRotulo.garron, ultimoRotulo.lado as 'DERECHA' | 'IZQUIERDA', ultimoRotulo.peso, ultimoRotulo.decomisada)
      toast.success('Reimprimiendo rótulos')
    } else {
      toast.error('No hay rótulos para reimprimir')
    }
  }

  const handleEliminarUltimo = async () => {
    if (mediasPesadas.length === 0) {
      toast.error('No hay medias para eliminar')
      return
    }
    
    const ultimo = mediasPesadas[mediasPesadas.length - 1]
    
    try {
      const res = await fetch('/api/romaneo/eliminar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          garron: ultimo.garron, 
          lado: ultimo.lado 
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        const nuevasMedias = mediasPesadas.slice(0, -1)
        setMediasPesadas(nuevasMedias)
        
        const nuevosGarrones = [...garronesAsignados]
        const idx = nuevosGarrones.findIndex(g => g.garron === ultimo.garron)
        if (idx >= 0) {
          if (ultimo.lado === 'DERECHA') {
            nuevosGarrones[idx] = { ...nuevosGarrones[idx], tieneMediaDer: false }
          } else {
            nuevosGarrones[idx] = { ...nuevosGarrones[idx], tieneMediaIzq: false }
          }
        }
        setGarronesAsignados(nuevosGarrones)
        
        setGarronActual(ultimo.garron)
        setLadoActual(ultimo.lado as 'DERECHA' | 'IZQUIERDA')
        const asignacion = nuevosGarrones.find(g => g.garron === ultimo.garron)
        setAsignacionActual(asignacion || null)
        
        setUltimoRotulo(nuevasMedias.length > 0 ? nuevasMedias[nuevasMedias.length - 1] : null)
        setFaenaTerminada(false)
        
        toast.success(`Media ${ultimo.lado === 'DERECHA' ? 'derecha' : 'izquierda'} del garrón #${ultimo.garron} eliminada`)
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    }
  }

  const handleSeleccionarGarron = (garron: number, lado: 'DERECHA' | 'IZQUIERDA') => {
    if (faenaTerminada) return
    
    setGarronActual(garron)
    setLadoActual(lado)
    const asignacion = garronesAsignados.find(g => g.garron === garron)
    setAsignacionActual(asignacion || null)
    
    if (lado === 'IZQUIERDA' && asignacion?.tieneMediaDer) {
      fetch(`/api/romaneo/denticion?garron=${garron}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.denticion) {
            setDenticion(data.denticion)
          }
        })
        .catch(e => console.error('Error cargando dentición:', e))
    } else {
      setDenticion('')
    }
    
    setPesoBalanza('')
  }

  const handleAbrirDecomiso = () => {
    if (!pesoBalanza || parseFloat(pesoBalanza) <= 0) {
      toast.error('Ingrese el peso de la media primero')
      return
    }
    setKgDecomiso('')
    setDecomisoOpen(true)
  }

  const handleConfirmarDecomiso = () => {
    const decomiso = parseFloat(kgDecomiso)
    
    if (isNaN(decomiso) || decomiso <= 0) {
      toast.error('Ingrese kg de decomiso válidos')
      return
    }
    
    setDecomisoOpen(false)
    handleAceptarPeso(true, decomiso)
  }

  const handleTerminarFaena = async (confirmar: boolean) => {
    setFinFaenaOpen(false)
    
    if (confirmar) {
      setFaenaTerminada(true)
      setAsignacionActual(null)
      toast.success('Faena terminada correctamente')
    }
  }

  const handleEditarFaena = () => {
    setSupervisorOpen(true)
    setClaveSupervisor('')
  }

  const handleValidarSupervisor = async () => {
    // Validar PIN contra la base de datos
    try {
      const res = await fetch('/api/auth/validar-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pin: claveSupervisor, 
          operadorId: operador.id 
        })
      })

      const data = await res.json()

      if (data.success && data.data.autorizado) {
        setSupervisorOpen(false)
        setFaenaTerminada(false)
        setModoEdicion(true) // Activar modo edición
        
        // En modo edición, permitir seleccionar cualquier garrón
        if (garronesAsignados.length > 0) {
          setGarronActual(garronesAsignados[0].garron)
          setAsignacionActual(garronesAsignados[0])
          setLadoActual('DERECHA')
        }
        
        toast.success('Modo edición activado - Puede modificar cualquier garrón')
      } else {
        toast.error(data.error || 'Clave de supervisor incorrecta')
      }
    } catch (error) {
      console.error('Error validando PIN:', error)
      toast.error('Error al validar clave de supervisor')
    }
  }

  // Cargar garrones por fecha para reimpresión
  const handleCargarGarronesPorFecha = async () => {
    setLoadingReimpresion(true)
    try {
      const res = await fetch(`/api/romaneo/por-fecha?fecha=${fechaReimpresion}`)
      const data = await res.json()
      
      if (data.success) {
        setGarronesReimpresion(data.data || [])
        setGarronSeleccionadoReimpresion(null)
      } else {
        toast.error(data.error || 'Error al cargar garrones')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setLoadingReimpresion(false)
    }
  }

  // Reimprimir rótulo de un garrón específico
  const handleReimprimirGarron = async (media: MediaPesada) => {
    try {
      // Buscar el rótulo configurado
      const rotulosRes = await fetch('/api/rotulos?tipo=MEDIA_RES&activo=true')
      const rotulosResponse = await rotulosRes.json()
      const rotulosData = rotulosResponse.data || []
      const rotulo = rotulosData.find((r: any) => r.esDefault) || rotulosData[0]
      
      if (!rotulo) {
        // Sin rótulo configurado, usar HTML hardcodeado
        imprimirRotuloHTML(media.garron, media.lado as 'DERECHA' | 'IZQUIERDA', media.peso, media.decomisada || false)
        return
      }

      // TCP/IP directo
      if (!usarPredeterminada && impresoraIp) {
        let exitos = 0
        for (const sigla of SIGLAS) {
          try {
            const printRes = await fetch('/api/rotulos/imprimir', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rotuloId: rotulo.id,
                datos: {
                  garron: String(media.garron).padStart(3, '0'),
                  lado: media.lado === 'DERECHA' ? 'D' : 'I',
                  peso: media.peso.toFixed(1),
                  tropa: media.tropaCodigo || '-',
                  sigla: sigla,
                  fecha: fechaReimpresion
                },
                cantidad: 1,
                impresoraIp: impresoraIp,
                impresoraPuerto: 9100
              })
            })
            
            const printData = await printRes.json()
            if (printData.success) exitos++
          } catch (printError) {
            console.error('Error al reimprimir por TCP:', printError)
          }
        }
        
        if (exitos === 3) {
          toast.success(`Rótulos enviados a impresora para garrón #${media.garron}`, {
            description: `Impresora TCP: ${impresoraIp}`
          })
          return
        }
      }

      // Impresora predeterminada o TCP falló: renderizar plantilla como HTML
      try {
        const { zplToHTML } = await import('@/lib/zpl-to-html')
        for (const sigla of SIGLAS) {
          const datos = {
            garron: String(media.garron).padStart(3, '0'),
            lado: media.lado === 'DERECHA' ? 'D' : 'I',
            peso: media.peso.toFixed(1),
            tropa: media.tropaCodigo || '-',
            sigla: sigla,
            fecha: fechaReimpresion
          }
          const processRes = await fetch('/api/rotulos/imprimir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rotuloId: rotulo.id, datos, cantidad: 1 })
          })
          const processData = await processRes.json()
          
          if (processData.success && processData.contenido && processData.rotulo) {
            const html = zplToHTML(processData.contenido, datos, {
              anchoMm: processData.rotulo.ancho,
              altoMm: processData.rotulo.alto,
              dpi: processData.rotulo.dpi
            })
            const printWindow = window.open('', '_blank', 'width=500,height=400')
            if (printWindow) {
              printWindow.document.write(html)
              printWindow.document.close()
            }
          }
        }
        toast.success('Rótulos generados desde plantilla', { description: `Plantilla: ${rotulo.nombre}` })
      } catch (htmlError) {
        console.error('Error al renderizar plantilla:', htmlError)
        imprimirRotuloHTML(media.garron, media.lado as 'DERECHA' | 'IZQUIERDA', media.peso, media.decomisada || false)
      }
    } catch (error) {
      console.error('Error al reimprimir:', error)
      toast.error('Error al reimprimir')
    }
  }

  // Agrupar medias por garrón
  const garronesAgrupados = useCallback(() => {
    const grupos: Record<number, { der: MediaPesada | null, izq: MediaPesada | null }> = {}
    
    garronesAsignados.forEach(g => {
      grupos[g.garron] = { der: null, izq: null }
    })
    
    mediasPesadas.forEach(m => {
      if (!grupos[m.garron]) {
        grupos[m.garron] = { der: null, izq: null }
      }
      if (m.lado === 'DERECHA') {
        grupos[m.garron].der = m
      } else {
        grupos[m.garron].izq = m
      }
    })
    
    return Object.entries(grupos)
      .map(([garron, medias]) => ({
        garron: parseInt(garron),
        der: medias.der,
        izq: medias.izq,
        completo: medias.der && medias.izq
      }))
      .sort((a, b) => a.garron - b.garron)
  }, [mediasPesadas, garronesAsignados])

  // Auto-refresh balanza reading in production mode
  useEffect(() => {
    if (!modoProduccion) return
    const fetchPeso = async () => {
      try {
        const res = await fetch('/api/balanza/lectura')
        const data = await res.json()
        if (data.success) {
          setPesoProduccion(data.data?.peso ?? data.data)
        }
      } catch { /* ignore */ }
    }
    fetchPeso()
    const interval = setInterval(fetchPeso, 2000)
    return () => clearInterval(interval)
  }, [modoProduccion])

  // Keyboard shortcuts: Enter = register weight, Escape = exit production mode / cancel dialogs
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modoProduccion) {
          toggleModoProduccion(false)
          return
        }
        if (configOpen) { setConfigOpen(false); return }
        if (decomisoOpen) { setDecomisoOpen(false); return }
        if (finFaenaOpen) { handleTerminarFaena(false); return }
        if (supervisorOpen) { setSupervisorOpen(false); return }
        if (reimpresionOpen) { setReimpresionOpen(false); return }
        if (configImpresoraOpen) { setConfigImpresoraOpen(false); return }
        return
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
        if (configOpen || decomisoOpen || finFaenaOpen || supervisorOpen || reimpresionOpen || configImpresoraOpen) return
        if (faenaTerminada && !modoEdicion) return

        if (modoProduccion) {
          if (pesoProduccion !== null && pesoProduccion > 0 && asignacionActual) {
            setPesoBalanza(pesoProduccion.toFixed(1))
            handleAceptarPeso(false)
            setFlashExito(true)
            setTimeout(() => setFlashExito(false), 600)
          }
        } else {
          if (pesoBalanza && parseFloat(pesoBalanza) > 0 && asignacionActual && !saving) {
            handleAceptarPeso(false)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [modoProduccion, pesoProduccion, pesoBalanza, asignacionActual, saving, faenaTerminada, modoEdicion, configOpen, decomisoOpen, finFaenaOpen, supervisorOpen, reimpresionOpen, configImpresoraOpen, toggleModoProduccion, handleAceptarPeso])

  // Auto-scroll cuando cambia el último garrón pesado
  useEffect(() => {
    const garronesLista = garronesAgrupados()
    const ultimoPesado = garronesLista.filter(g => g.der || g.izq).pop()
    
    if (ultimoPesado && ultimoPesado.garron !== lastGarronRef.current && scrollRef.current) {
      lastGarronRef.current = ultimoPesado.garron
      
      setTimeout(() => {
        const element = document.getElementById(`garron-${ultimoPesado.garron}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [mediasPesadas, garronesAgrupados])

  const getTotalKg = () => mediasPesadas.reduce((acc, m) => acc + m.peso, 0)

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <Scale className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  const garronesLista = garronesAgrupados()

  return (
    <div className="h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex flex-col overflow-hidden">
      <BalanzaConfigButton />
      {/* Header fijo */}
      <div className="flex-shrink-0 p-2 pb-0.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-800">Romaneo - Pesaje de Medias</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {listaFaenaNumero !== null && (
                <>
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    Lista N° <span className="font-bold">{String(listaFaenaNumero).padStart(4, '0')}</span>
                  </Badge>
                  <span className="text-stone-500 text-xs">
                    Faena: {listaFaenaFecha ? new Date(listaFaenaFecha).toLocaleDateString('es-AR') : fechaFaena}
                  </span>
                </>
              )}
              {listasDisponibles.length > 1 && (
                <Select value={listaFaenaId || ''} onValueChange={(id) => fetchData(id)}>
                  <SelectTrigger className="w-[160px] h-7 text-xs">
                    <SelectValue placeholder="Cambiar lista" />
                  </SelectTrigger>
                  <SelectContent>
                    {listasDisponibles.map((lista) => (
                      <SelectItem key={lista.id} value={lista.id} className="text-xs">
                        N° {String(lista.numero).padStart(4, '0')} — {new Date(lista.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ({lista.estado})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {faenaTerminada && !modoEdicion && (
              <Button variant="outline" size="sm" onClick={handleEditarFaena} className="border-amber-300 text-amber-700">
                <Lock className="w-4 h-4 mr-1" />
                Editar Faena
              </Button>
            )}
            {modoEdicion && (
              <Button variant="outline" size="sm" onClick={() => { setModoEdicion(false); setFaenaTerminada(true); }} className="border-green-300 text-green-700">
                <CheckCircle className="w-4 h-4 mr-1" />
                Terminar Edición
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setConfigImpresoraOpen(true)} 
              className={`shadow-sm ${(impresoraIp || usarPredeterminada) ? 'bg-green-50 border-green-300 text-green-600' : 'bg-red-50 border-red-300 text-red-600'}`}
              title={usarPredeterminada ? 'Impresora predeterminada de Windows' : impresoraIp ? `Impresora TCP: ${impresoraIp}:${impresoraPuerto} | ${impresoraVelocidad}ips | Calor ${impresoraCalor}` : 'Configurar impresora'}
            >
              <Printer className="w-4 h-4 mr-1" />
              {(impresoraIp || usarPredeterminada) ? 'Impresora' : 'Sin Impresora'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <User className="w-4 h-4 mr-1" />
              Configurar
            </Button>
            {!modoProduccion ? (
              <Button variant="outline" size="sm" onClick={() => toggleModoProduccion(true)} className="bg-stone-800 text-white border-stone-600 hover:bg-stone-700">
                <Maximize2 className="w-4 h-4 mr-1" />
                Modo Producción
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => toggleModoProduccion(false)} className="bg-green-600 text-white border-green-500 hover:bg-green-700">
                <Minimize2 className="w-4 h-4 mr-1" />
                Modo Producción
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => fetchData()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Configuración activa */}
      <div className="flex-shrink-0 px-2">
        <Card className="border-0 shadow-sm bg-amber-50">
          <CardContent className="p-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-0.5 text-xs">
                  <User className="w-3 h-3 text-amber-600" />
                  <strong>Tip.:</strong> {tipificadores.find(t => t.id === tipificadorId)?.nombre || '-'}
                </span>
                <div className="flex items-center gap-0.5">
                  <Warehouse className="w-3 h-3 text-amber-600" />
                  <strong className="text-xs">Cám.:</strong>
                  <Select value={camaraId} onValueChange={setCamaraId}>
                    <SelectTrigger className="h-5 w-28 bg-white border-amber-200 text-[10px]">
                      <SelectValue placeholder="Sel." />
                    </SelectTrigger>
                    <SelectContent>
                      {camaras.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={handleEliminarUltimo} disabled={mediasPesadas.length === 0} className="h-5 text-[10px] text-red-600 hover:bg-red-50 border-red-200 px-2">
                  <Trash2 className="w-3 h-3 mr-0.5" />
                  Eliminar
                </Button>
                <Button variant="outline" size="sm" onClick={handleReimprimirUltimo} disabled={!ultimoRotulo} className="h-5 text-[10px] px-2">
                  <RotateCcw className="w-3 h-3 mr-0.5" />
                  Reimprimir
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReimpresionOpen(true)} className="h-5 text-[10px] border-blue-300 text-blue-600 px-2">
                  <Printer className="w-3 h-3 mr-0.5" />
                  Reimprimir...
                </Button>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {mediasPesadas.length} medias - {getTotalKg().toFixed(1)} kg
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenido principal sin scroll */}
      <div className="flex-1 p-2 pt-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 h-full">
          
          {/* Panel principal de pesaje - FIJO SIN SCROLL */}
          <Card className="lg:col-span-2 border-0 shadow-md flex flex-col overflow-hidden">
            <CardHeader className="bg-stone-50 flex-shrink-0 py-1.5 px-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {faenaTerminada ? 'âœ“ Faena Terminada' : 'Pesaje Actual'}
                </CardTitle>
                {!faenaTerminada && (
                  <div className="flex items-center gap-0.5">
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => {
                      const idx = garronesLista.findIndex(g => g.garron === garronActual)
                      if (idx > 0) {
                        const prev = garronesLista[idx - 1]
                        if (!prev.der) handleSeleccionarGarron(prev.garron, 'DERECHA')
                        else if (!prev.izq) handleSeleccionarGarron(prev.garron, 'IZQUIERDA')
                      }
                    }}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <span className="text-lg font-bold text-amber-600 min-w-[40px] text-center">#{garronActual}</span>
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => {
                      const idx = garronesLista.findIndex(g => g.garron === garronActual)
                      if (idx < garronesLista.length - 1) {
                        const next = garronesLista[idx + 1]
                        if (!next.der) handleSeleccionarGarron(next.garron, 'DERECHA')
                        else if (!next.izq) handleSeleccionarGarron(next.garron, 'IZQUIERDA')
                      }
                    }}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            
            {faenaTerminada ? (
              <CardContent className="flex-1 flex items-center justify-center p-2">
                <div className="text-center">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
                  <h2 className="text-base font-bold text-stone-700 mb-1">Faena Completada</h2>
                  <p className="text-stone-500 text-xs">Total: {mediasPesadas.length} medias - {getTotalKg().toFixed(1)} kg</p>
                </div>
              </CardContent>
            ) : (
              <CardContent className="flex-1 flex flex-col p-1.5 overflow-hidden">
                {/* Datos del animal */}
                <div className="flex-shrink-0">
                  {asignacionActual ? (
                    <div className="grid grid-cols-4 gap-0.5 p-1 bg-stone-50 rounded text-[9px]">
                      <div><span className="text-stone-400">Tropa</span><br/><span className="font-medium">{asignacionActual.tropaCodigo || '-'}</span></div>
                      <div><span className="text-stone-400">Tipo</span><br/><span className="font-medium">{asignacionActual.tipoAnimal || '-'}</span></div>
                      <div><span className="text-stone-400">P.Vivo</span><br/><span className="font-medium">{asignacionActual.pesoVivo?.toFixed(0) || '-'}kg</span></div>
                      <div><span className="text-stone-400">Estado</span><br/><span className="font-medium">{asignacionActual.tieneMediaDer && asignacionActual.tieneMediaIzq ? 'âœ“' : asignacionActual.tieneMediaDer ? 'Falta Izq' : 'Falta Der'}</span></div>
                    </div>
                  ) : (
                    <div className="p-1.5 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-[10px]">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      No hay animal asignado al garrón {garronActual}
                    </div>
                  )}
                </div>

                <Separator className="my-1.5 flex-shrink-0" />

                {/* Indicador de modo edición */}
                {modoEdicion && (
                  <div className="bg-amber-100 border border-amber-300 rounded p-1 text-center text-xs text-amber-700 flex-shrink-0">
                    <Edit className="w-3 h-3 inline mr-1" />
                    MODO EDICIÃ“N
                  </div>
                )}

                {/* Lado actual */}
                <div className="flex items-center justify-center gap-1.5 flex-shrink-0 mt-0.5">
                  <Button 
                    variant={ladoActual === 'DERECHA' ? 'default' : 'outline'} 
                    size="sm"
                    className={`h-7 px-4 ${ladoActual === 'DERECHA' ? 'bg-blue-600 hover:bg-blue-700' : ''}`} 
                    onClick={() => setLadoActual('DERECHA')} 
                    disabled={!modoEdicion && asignacionActual?.tieneMediaDer}
                  >
                    DER {asignacionActual?.tieneMediaDer && <CheckCircle className="w-2.5 h-2.5 ml-0.5" />}
                  </Button>
                  <Button 
                    variant={ladoActual === 'IZQUIERDA' ? 'default' : 'outline'} 
                    size="sm"
                    className={`h-7 px-4 ${ladoActual === 'IZQUIERDA' ? 'bg-pink-600 hover:bg-pink-700' : ''}`} 
                    onClick={() => setLadoActual('IZQUIERDA')} 
                    disabled={!modoEdicion && (!asignacionActual?.tieneMediaDer || asignacionActual?.tieneMediaIzq)}
                  >
                    IZQ {asignacionActual?.tieneMediaIzq && <CheckCircle className="w-2.5 h-2.5 ml-0.5" />}
                  </Button>
                </div>

                {/* Peso */}
                <div className="text-center flex-shrink-0 my-0.5">
                  <Label className="text-[10px]">Peso (kg)</Label>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <Input type="number" value={pesoBalanza} onChange={(e) => setPesoBalanza(e.target.value)} className="text-xl font-bold text-center h-10 w-28" placeholder="0" step="0.1" />
                    <Button variant="outline" size="icon" onClick={handleCapturarPeso} className="h-9 w-9"><Scale className="w-4 h-4" /></Button>
                  </div>
                </div>

                {/* Dentición */}
                <div className="flex-shrink-0">
                  <Label className="text-[9px]">Dentición {asignacionActual?.tieneMediaDer && <span className="text-amber-600">(Fijado)</span>}</Label>
                  <div className="flex gap-0.5 mt-0.5">
                    {DIENTES.map((d) => (
                      <Button key={d} variant={denticion === d ? 'default' : 'outline'} size="sm" className={`flex-1 h-6 text-[10px] ${denticion === d ? 'bg-amber-500 hover:bg-amber-600' : ''}`} onClick={() => setDenticion(d)} disabled={asignacionActual?.tieneMediaDer && denticion !== '' && denticion !== d}>
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator className="my-1 flex-shrink-0" />

                {/* Botones de acción */}
                <div className="grid grid-cols-2 gap-1.5 flex-shrink-0 mt-auto">
                  <Button size="sm" onClick={() => handleAceptarPeso(false)} disabled={saving || !pesoBalanza || parseFloat(pesoBalanza) <= 0 || !asignacionActual} className="h-9 bg-green-600 hover:bg-green-700">
                    <Printer className="w-3.5 h-3.5 mr-0.5" />
                    {saving ? '...' : 'ACEPTAR'}
                  </Button>
                  <Button size="sm" onClick={handleAbrirDecomiso} disabled={saving || !pesoBalanza || parseFloat(pesoBalanza) <= 0 || !asignacionActual} variant="outline" className="h-9 border-red-300 text-red-600 hover:bg-red-50">
                    <AlertOctagon className="w-3.5 h-3.5 mr-0.5" />
                    DECOMISO
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Panel lateral - Listado de Garrones con scroll interno */}
          <Card className="border-0 shadow-md flex flex-col overflow-hidden">
            <CardHeader className="bg-stone-50 py-1.5 px-2 flex-shrink-0">
              <CardTitle className="text-xs">Garrones ({garronesLista.filter(g => g.completo).length}/{garronesLista.length})</CardTitle>
            </CardHeader>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {garronesLista.length === 0 ? (
                <div className="p-4 text-center text-stone-400">
                  <Scale className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No hay garrones</p>
                </div>
              ) : (
                <div className="divide-y">
                  {garronesLista.map((g) => {
                    const isPendienteDer = !g.der && garronesAsignados.find(ga => ga.garron === g.garron)
                    const isPendienteIzq = g.der && !g.izq && garronesAsignados.find(ga => ga.garron === g.garron && ga.tieneMediaDer && !ga.tieneMediaIzq)
                    
                    return (
                      <div key={g.garron} id={`garron-${g.garron}`} className={cn("p-1.5 cursor-pointer hover:bg-stone-50", g.garron === garronActual && "bg-amber-50 border-l-2 border-amber-500")}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-amber-600">#{g.garron}</span>
                          {g.completo && !modoEdicion && <CheckCircle className="w-3 h-3 text-green-500" />}
                          {g.completo && modoEdicion && <Edit className="w-3 h-3 text-amber-500" />}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn("h-6 py-0 px-1 justify-start text-xs", g.der?.decomisada ? "bg-red-50 border-red-200" : g.der ? "bg-blue-50 border-blue-200" : isPendienteDer ? "border-dashed" : "opacity-50")} 
                            onClick={() => handleSeleccionarGarron(g.garron, 'DERECHA')} 
                            disabled={!modoEdicion && !!g.der}
                          >
                            <span className="font-medium">DER</span>
                            {g.der ? <span className="ml-auto">{g.der.peso.toFixed(0)}kg</span> : isPendienteDer ? <span className="ml-auto text-stone-400">.</span> : null}
                            {g.der?.decomisada && <AlertOctagon className="w-2 h-2 ml-0.5 text-red-500" />}
                            {modoEdicion && g.der && <Edit className="w-2 h-2 ml-0.5 text-amber-500" />}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn("h-6 py-0 px-1 justify-start text-xs", g.izq?.decomisada ? "bg-red-50 border-red-200" : g.izq ? "bg-pink-50 border-pink-200" : isPendienteIzq ? "border-dashed" : "opacity-50")} 
                            onClick={() => handleSeleccionarGarron(g.garron, 'IZQUIERDA')} 
                            disabled={!modoEdicion && !!g.izq}
                          >
                            <span className="font-medium">IZQ</span>
                            {g.izq ? <span className="ml-auto">{g.izq.peso.toFixed(0)}kg</span> : isPendienteIzq ? <span className="ml-auto text-stone-400">.</span> : null}
                            {g.izq?.decomisada && <AlertOctagon className="w-2 h-2 ml-0.5 text-red-500" />}
                            {modoEdicion && g.izq && <Edit className="w-2 h-2 ml-0.5 text-amber-500" />}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="p-2 border-t bg-stone-50 flex-shrink-0">
              <div className="flex justify-between text-xs">
                <span>Total: {mediasPesadas.length} medias</span>
                <span className="font-bold">{getTotalKg().toFixed(1)} kg</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Diálogo de Configuración */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>Configuración de Romaneo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label className="text-sm">Tipificador</Label>
              <Select value={tipificadorId} onValueChange={setTipificadorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {tipificadores.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nombre} {t.apellido}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Cámara</Label>
              <Select value={camaraId} onValueChange={setCamaraId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {camaras.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setConfigOpen(false)} disabled={!tipificadorId || !camaraId}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Decomiso - Simplificado */}
      <Dialog open={decomisoOpen} onOpenChange={setDecomisoOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2"><AlertOctagon className="w-5 h-5" />Decomiso</DialogTitle>
            <DialogDescription>Garrón #{garronActual} - {ladoActual}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="p-2 bg-amber-50 rounded-lg text-center">
              <span className="text-xs text-amber-600">Peso de la media</span>
              <div className="text-xl font-bold text-amber-700">{pesoBalanza} kg</div>
            </div>
            <div className="space-y-1">
              <Label className="text-red-600 text-sm">Kg Decomisados</Label>
              <Input type="number" value={kgDecomiso} onChange={(e) => setKgDecomiso(e.target.value)} placeholder="0" step="0.1" autoFocus />
            </div>
            <p className="text-xs text-stone-500">Los kg restantes serán: {(parseFloat(pesoBalanza) - parseFloat(kgDecomiso || '0')).toFixed(1)} kg</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecomisoOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmarDecomiso}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Fin de Faena */}
      <Dialog open={finFaenaOpen} onOpenChange={setFinFaenaOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle>Â¿Terminar Faena?</DialogTitle>
            <DialogDescription>
              Se han pesado todos los garrones de la lista de faena.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p className="text-lg font-medium">Total: {mediasPesadas.length} medias</p>
              <p className="text-2xl font-bold text-amber-600">{getTotalKg().toFixed(1)} kg</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleTerminarFaena(false)}>No, continuar</Button>
            <Button onClick={() => handleTerminarFaena(true)} className="bg-green-600 hover:bg-green-700">Sí, terminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Supervisor */}
      <Dialog open={supervisorOpen} onOpenChange={setSupervisorOpen}>
        <DialogContent maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />Autorización de Supervisor</DialogTitle>
            <DialogDescription>Ingrese la clave de supervisor para editar la faena</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Input type="password" value={claveSupervisor} onChange={(e) => setClaveSupervisor(e.target.value)} placeholder="Clave de supervisor" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupervisorOpen(false)}>Cancelar</Button>
            <Button onClick={handleValidarSupervisor}>Autorizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Reimpresión por Fecha */}
      <Dialog open={reimpresionOpen} onOpenChange={setReimpresionOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Reimpresión de Rótulos
            </DialogTitle>
            <DialogDescription>
              Seleccione una fecha de faena y el garrón a reimprimir
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Fecha de Faena</Label>
                <Input 
                  type="date" 
                  value={fechaReimpresion} 
                  onChange={(e) => setFechaReimpresion(e.target.value)}
                />
              </div>
              <Button onClick={handleCargarGarronesPorFecha} disabled={loadingReimpresion}>
                {loadingReimpresion ? 'Cargando...' : 'Cargar'}
              </Button>
            </div>
            
            {garronesReimpresion.length > 0 && (
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Garrón</TableHead>
                      <TableHead>Lado</TableHead>
                      <TableHead>Tropa</TableHead>
                      <TableHead className="text-right">Peso</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {garronesReimpresion.map((g, idx) => (
                      <TableRow 
                        key={idx}
                        className={cn("cursor-pointer", garronSeleccionadoReimpresion === g && "bg-amber-100")}
                        onClick={() => setGarronSeleccionadoReimpresion(g)}
                      >
                        <TableCell className="font-bold">#{g.garron}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={g.lado === 'DERECHA' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}>
                            {g.lado === 'DERECHA' ? 'DER' : 'IZQ'}
                          </Badge>
                        </TableCell>
                        <TableCell>{g.tropaCodigo || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{g.peso.toFixed(1)} kg</TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReimprimirGarron(g)
                            }}
                          >
                            <Printer className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReimpresionOpen(false)}>Cerrar</Button>
            <Button 
              onClick={() => garronSeleccionadoReimpresion && handleReimprimirGarron(garronSeleccionadoReimpresion)}
              disabled={!garronSeleccionadoReimpresion}
            >
              <Printer className="w-4 h-4 mr-1" />
              Reimprimir Seleccionado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Production Mode Overlay */}
      {modoProduccion && (
        <div className="fixed inset-0 z-50 bg-stone-900 text-white flex flex-col items-center justify-center p-8">
          <button onClick={() => toggleModoProduccion(false)} className="absolute top-4 right-4 text-stone-400 hover:text-white p-2">
            <Minimize2 className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-stone-400 text-xs uppercase tracking-wider">Tropa</p>
              <p className="text-2xl font-bold text-amber-400">{asignacionActual?.tropaCodigo || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-stone-400 text-xs uppercase tracking-wider">Garrón / Lado</p>
              <p className="text-xl font-bold">#{garronActual} <span className={ladoActual === 'DERECHA' ? 'text-blue-400' : 'text-pink-400'}>{ladoActual === 'DERECHA' ? 'DER' : 'IZQ'}</span></p>
            </div>
            {asignacionActual?.tipoAnimal && (
              <div className="text-center">
                <p className="text-stone-400 text-xs uppercase tracking-wider">Tipo</p>
                <p className="text-lg font-medium text-stone-300">{asignacionActual.tipoAnimal}</p>
              </div>
            )}
          </div>

          <div className="text-center mb-2">
            <p className="text-stone-400 text-sm mb-2">Peso Balanza (kg)</p>
            <div className={`text-8xl font-mono font-bold tabular-nums transition-all duration-300 ${flashExito ? 'text-green-400 scale-110' : 'text-green-400'}`}>
              {pesoProduccion !== null ? pesoProduccion.toFixed(1) : '---.-'}
            </div>
          </div>

          {/* Last 3 registered media reses */}
          {mediasPesadas.length > 0 && (
            <div className="mb-6 w-full max-w-lg">
              <p className="text-stone-500 text-xs uppercase tracking-wider text-center mb-2">Últimas registradas</p>
              <div className="space-y-1">
                {mediasPesadas.slice(-3).reverse().map((m, idx) => (
                  <div key={m.id} className={`flex items-center justify-between bg-stone-800 rounded-lg px-4 py-2 ${idx === 0 && flashExito ? 'ring-1 ring-green-500' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-500 w-6">#{mediasPesadas.length - idx}</span>
                      <span className="font-mono font-medium">G{m.garron.toString().padStart(3, '0')}</span>
                      <span className={`text-xs ${m.lado === 'DERECHA' ? 'text-blue-400' : 'text-pink-400'}`}>{m.lado === 'DERECHA' ? 'DER' : 'IZQ'}</span>
                      {m.decomisada && <span className="text-xs text-red-400 font-medium">DECOMISO</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-stone-500 text-xs">{m.tropaCodigo}</span>
                      <span className="font-mono font-bold text-lg">{m.peso.toFixed(1)} <span className="text-sm font-normal text-stone-400">kg</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (pesoProduccion !== null && pesoProduccion > 0 && asignacionActual) {
                setPesoBalanza(pesoProduccion.toFixed(1))
                handleAceptarPeso(false)
                setFlashExito(true)
                setTimeout(() => setFlashExito(false), 600)
              }
            }}
            disabled={pesoProduccion === null || pesoProduccion <= 0 || saving || !asignacionActual}
            className="bg-green-500 hover:bg-green-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-2xl font-bold py-6 px-16 rounded-2xl shadow-lg transition-all active:scale-95"
          >
            {saving ? 'REGISTRANDO...' : 'REGISTRAR PESO'}
          </button>

          <div className="absolute bottom-4 text-stone-600 text-xs">
            Enter = Registrar | Escape = Salir
          </div>
        </div>
      )}

      <Dialog open={configImpresoraOpen} onOpenChange={setConfigImpresoraOpen}>
        <DialogContent className="max-w-md" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-amber-600" />
              Configurar Impresora de Rótulos (Romaneo)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Opción: Impresora predeterminada de Windows */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${usarPredeterminada ? 'border-green-500 bg-green-50' : 'border-stone-200 hover:border-stone-300'}`}
              onClick={() => { setUsarPredeterminada(true); setImpresoraIp('') }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${usarPredeterminada ? 'border-green-500 bg-green-500' : 'border-stone-300'}`}>
                  {usarPredeterminada && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <div>
                  <p className="font-medium text-sm">Impresora Predeterminada de Windows</p>
                  <p className="text-xs text-stone-500">Usa la impresora configurada en el sistema (muestra diálogo)</p>
                </div>
              </div>
            </div>

            {/* Opción: Impresora TCP/IP - Impresión Directa */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${!usarPredeterminada ? 'border-green-500 bg-green-50' : 'border-stone-200 hover:border-stone-300'}`}
              onClick={() => setUsarPredeterminada(false)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-4 h-4 rounded-full border-2 ${!usarPredeterminada ? 'border-green-500 bg-green-500' : 'border-stone-300'}`}>
                  {!usarPredeterminada && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <div>
                  <p className="font-medium text-sm">Impresora TCP/IP (Impresión Directa)</p>
                  <p className="text-xs text-stone-500">Conexión por red - Usa plantilla de Rótulos - Sin diálogo</p>
                </div>
              </div>
              {!usarPredeterminada && (
                <div className="ml-7 space-y-3">
                  {/* IP y Puerto */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">IP de la impresora</Label>
                      <Input 
                        value={impresoraIp} 
                        onChange={(e) => setImpresoraIp(e.target.value)} 
                        placeholder="192.168.1.100"
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Puerto</Label>
                      <Input 
                        type="number" 
                        value={impresoraPuerto} 
                        onChange={(e) => setImpresoraPuerto(parseInt(e.target.value) || 9100)} 
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  {/* Tamaño de etiqueta */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Ancho (mm)</Label>
                      <Input 
                        type="number" 
                        value={impresoraAncho} 
                        onChange={(e) => setImpresoraAncho(parseInt(e.target.value) || 100)} 
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alto (mm)</Label>
                      <Input 
                        type="number" 
                        value={impresoraAlto} 
                        onChange={(e) => setImpresoraAlto(parseInt(e.target.value) || 50)} 
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  {/* Velocidad y Calor */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Velocidad (ips)</Label>
                      <Select value={String(impresoraVelocidad)} onValueChange={(v) => setImpresoraVelocidad(parseInt(v))}>
                        <SelectTrigger className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 - Muy lenta</SelectItem>
                          <SelectItem value="3">3 - Lenta</SelectItem>
                          <SelectItem value="4">4 - Normal</SelectItem>
                          <SelectItem value="5">5 - Media</SelectItem>
                          <SelectItem value="6">6 - Media-alta</SelectItem>
                          <SelectItem value="8">8 - Rápida</SelectItem>
                          <SelectItem value="10">10 - Muy rápida</SelectItem>
                          <SelectItem value="12">12 - Máxima</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Calor / Densidad</Label>
                      <Select value={String(impresoraCalor)} onValueChange={(v) => setImpresoraCalor(parseInt(v))}>
                        <SelectTrigger className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 - Mínimo</SelectItem>
                          <SelectItem value="5">5 - Bajo</SelectItem>
                          <SelectItem value="8">8 - Medio-bajo</SelectItem>
                          <SelectItem value="10">10 - Normal</SelectItem>
                          <SelectItem value="12">12 - Medio-alto</SelectItem>
                          <SelectItem value="15">15 - Alto</SelectItem>
                          <SelectItem value="20">20 - Muy alto</SelectItem>
                          <SelectItem value="25">25 - Intenso</SelectItem>
                          <SelectItem value="30">30 - Máximo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-amber-50 p-3 rounded-lg text-xs text-amber-700">
              <p className="font-medium mb-1">Información:</p>
              <p>• <b>TCP/IP:</b> Usa tu plantilla de Rótulos (MEDIA_RES) y envía directo a impresora</p>
              <p>• <b>Windows:</b> Muestra diálogo de impresión (no usa plantilla ZPL)</p>
              <p>• <b>Se imprimen 3 rótulos por media</b> (siglas A, T, D)</p>
              <p>• <b>Velocidad:</b> Mayor = más rápido pero menos definición</p>
              <p>• <b>Calor:</b> Mayor = etiqueta más oscura, mejor para código de barras</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigImpresoraOpen(false)} size="sm">Cancelar</Button>
            <Button 
              onClick={() => {
                localStorage.setItem('impresoraRomaneoIp', impresoraIp)
                localStorage.setItem('impresoraRomaneoPredeterminada', String(usarPredeterminada))
                localStorage.setItem('impresoraRomaneoPuerto', String(impresoraPuerto))
                localStorage.setItem('impresoraRomaneoVelocidad', String(impresoraVelocidad))
                localStorage.setItem('impresoraRomaneoCalor', String(impresoraCalor))
                localStorage.setItem('impresoraRomaneoAncho', String(impresoraAncho))
                localStorage.setItem('impresoraRomaneoAlto', String(impresoraAlto))
                setConfigImpresoraOpen(false)
                if (usarPredeterminada) {
                  toast.success('Usando impresora predeterminada de Windows')
                } else {
                  toast.success(`Impresora: ${impresoraIp}:${impresoraPuerto} | ${impresoraVelocidad}ips | Calor ${impresoraCalor}`)
                }
              }} 
              size="sm"
              disabled={!usarPredeterminada && !impresoraIp}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RomaneoModule
