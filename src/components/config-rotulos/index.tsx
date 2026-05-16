'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { 
  Tag, Loader2, Power, Trash2, Upload, Eye, FileText, Printer, 
  Download, Copy, Info, Variable, FileCode, Check, ChevronDown, ChevronRight,
  Settings, Star, Play, X, Edit, Palette
} from 'lucide-react'
import { TipoRotulo } from '@prisma/client'
import { Textarea } from '@/components/ui/textarea'
import { LabelDesigner } from './LabelDesigner'
import { EditorRotulosFullScreen } from './EditorRotulosFullScreen'
import { RotuloElement } from './VisualEditor'

interface Operador { id: string; nombre: string; rol: string }
interface Props { 
  operador: Operador
  modoEditor?: boolean
  onVolverDeEditor?: () => void
}

// Categorías de uso para asignar rótulos
const CATEGORIAS_USO = [
  { value: 'MEDIA_RES', label: 'Media Res', descripcion: 'Rótulo para medias res en romaneo' },
  { value: 'PESAJE_INDIVIDUAL', label: 'Pesaje Individual', descripcion: 'Rótulo para pesaje de animales vivos' },
  { value: 'CUARTO', label: 'Cuarto', descripcion: 'Rótulo para cuartos' },
  { value: 'MENUDENCIA', label: 'Menudencia', descripcion: 'Rótulo para menudencias' },
  { value: 'PRODUCTO_GENERAL', label: 'Producto General', descripcion: 'Rótulo genérico para productos' },
  { value: 'PRODUCTO_ESPECIFICO', label: 'Producto Específico', descripcion: 'Rótulo para un producto en particular' },
]

const TIPOS_IMPRESORA = [
  { value: 'ZEBRA', label: 'Zebra (ZPL)', extensiones: ['.zpl', '.prn', '.nlbl'] },
  { value: 'DATAMAX', label: 'Datamax (DPL)', extensiones: ['.dpl'] },
  { value: 'NETTIRA', label: 'Nettira Label Designer', extensiones: ['.itf', '.nrx', '.prn'] },
]

const MODELOS_IMPRESORA = {
  ZEBRA: [
    { value: 'ZT410', label: 'Zebra ZT410 (300 DPI)', dpi: 300, descripcion: 'Industrial, alta resolución' },
    { value: 'ZT230', label: 'Zebra ZT230 (203 DPI)', dpi: 203, descripcion: 'Industrial, estándar' },
    { value: 'ZT411', label: 'Zebra ZT411 (300 DPI)', dpi: 300, descripcion: 'Industrial, conectividad avanzada' },
    { value: 'ZD420', label: 'Zebra ZD420 (203 DPI)', dpi: 203, descripcion: 'Desktop' },
    { value: 'OTRO_ZEBRA', label: 'Otra Zebra', dpi: 203, descripcion: 'Otro modelo Zebra' },
  ],
  DATAMAX: [
    { value: 'MARK_II', label: 'Datamax Mark II (203 DPI)', dpi: 203, descripcion: 'Industrial, robusta' },
    { value: 'I-4208', label: 'Datamax I-4208 (203 DPI)', dpi: 203, descripcion: 'Industrial' },
    { value: 'I-4210', label: 'Datamax I-4210 (203 DPI)', dpi: 203, descripcion: 'Industrial, alta velocidad' },
    { value: 'OTRO_DATAMAX', label: 'Otra Datamax', dpi: 203, descripcion: 'Otro modelo Datamax' },
  ],
  NETTIRA: [
    { value: 'NTE-200', label: 'Nettira NTE-200 (203 DPI)', dpi: 203, descripcion: 'Datamax con Nettira' },
    { value: 'NTE-300', label: 'Nettira NTE-300 (300 DPI)', dpi: 300, descripcion: 'Datamax con Nettira, alta resolución' },
    { value: 'NT-3300', label: 'Nettira NT-3300 (300 DPI)', dpi: 300, descripcion: 'Industrial, alta velocidad' },
    { value: 'OTRO_NETTIRA', label: 'Otra Nettira', dpi: 203, descripcion: 'Otro modelo con Nettira' },
  ]
}

interface VariableDetectada {
  variable: string
  campo: string
  descripcion: string
}

// Función para determinar si el contenido de un archivo es texto legible
function esContenidoTexto(texto: string): boolean {
  if (!texto || texto.length === 0) return false
  // Si el archivo empieza con comandos DPL, ZPL, o tiene texto ASCII legible
  const tieneComandosImpresora = /^\s*(<STX>|\\x02|<ESC>|\\x1b|ESC |\\^XA|\\^FO|\\^FW)/i.test(texto)
  // Verificar que la mayoría de los bytes son ASCII imprimible o comunes de DPL/ZPL
  let caracteresLegibles = 0
  const muestra = texto.substring(0, 500)
  for (let i = 0; i < muestra.length; i++) {
    const code = muestra.charCodeAt(i)
    // ASCII imprimible (32-126), tab (9), newline (10), carriage return (13)
    // Caracteres especiales DPL: STX(2), ESC(27), ETX(3), CAN(5), ETB(23), FS(28)
    if ((code >= 32 && code <= 126) || [2, 3, 5, 9, 10, 13, 23, 27, 28].includes(code)) {
      caracteresLegibles++
    }
  }
  const porcentajeLegible = caracteresLegibles / Math.max(muestra.length, 1)
  // Si más del 85% es legible O tiene comandos de impresora reconocidos
  return porcentajeLegible > 0.85 || tieneComandosImpresora
}

interface Rotulo {
  id: string
  nombre: string
  codigo: string
  tipo: TipoRotulo
  categoria?: string | null
  tipoImpresora: string
  modeloImpresora?: string | null
  ancho: number
  alto: number
  dpi: number
  contenido: string
  variables?: string | null
  nombreArchivo?: string | null
  diasConsumo?: number | null
  temperaturaMax?: number | null
  activo: boolean
  esDefault: boolean
  esBinario?: boolean  // Para archivos .lbl/.nlbl
  elementos?: any[]
}

export function ConfigRotulosModule({ operador, modoEditor: modoEditorProp, onVolverDeEditor }: Props) {
  const [rotulos, setRotulos] = useState<Rotulo[]>([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [modalImportar, setModalImportar] = useState(false)
  const [modalAsignar, setModalAsignar] = useState(false)
  const [modalPreview, setModalPreview] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalEditor, setModalEditor] = useState(false)
  const [rotuloSeleccionado, setRotuloSeleccionado] = useState<Rotulo | null>(null)
  const [previewProcesado, setPreviewProcesado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)
  
  // Estado interno para modo editor (cuando no se usa prop)
  const [modoEditorInterno, setModoEditorInterno] = useState(false)
  const [rotuloAEditar, setRotuloAEditar] = useState<Rotulo | null>(null)
  
  // Determinar si estamos en modo editor
  const enModoEditor = modoEditorProp ?? modoEditorInterno
  
  // Configuración de impresora para prueba
  const [impresoraIp, setImpresoraIp] = useState('')
  const [impresoraPuerto, setImpresoraPuerto] = useState('9100')
  
  // Formulario de edición
  const [editandoContenido, setEditandoContenido] = useState('')
  const [editandoNombre, setEditandoNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  
  // Formulario de importación
  const [archivo, setArchivo] = useState<File | null>(null)
  const [contenidoArchivo, setContenidoArchivo] = useState('')
  const [archivoBinario, setArchivoBinario] = useState<ArrayBuffer | null>(null)  // Para .lbl/.nlbl
  const [esBinario, setEsBinario] = useState(false)
  const [variablesDetectadas, setVariablesDetectadas] = useState<VariableDetectada[]>([])
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [categoriaUso, setCategoriaUso] = useState('MEDIA_RES')
  const [tipoImpresora, setTipoImpresora] = useState('ZEBRA')
  const [modeloImpresora, setModeloImpresora] = useState('ZT410')
  const [ancho, setAncho] = useState(80)
  const [alto, setAlto] = useState(50)
  const [dpi, setDpi] = useState(203)
  const [verContenido, setVerContenido] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Datos de prueba para previsualización (completos para Zebra y Datamax)
  const datosPrueba: Record<string, string> = {
    // --- Datos de Faena ---
    'FECHA': '17/03/2026',
    'FECHA_FAENA': '17/03/2026',
    'FECHA_VENC': '16/04/2026',
    'VENCIMIENTO': '16/04/2026',
    'TROPA': 'B 2026 0001',
    'GARRON': '0001',
    'NUMERO': '0015',
    'NUMERO_ANIMAL': '015',
    'TROPA_CODIGO': 'B20260001',
    'NUMERO_CARAVANA': '1234567890',
    'PESO': '125.5',
    'KG': '125.5',
    'LADO': 'IZQ',
    'SIGLA': 'A',
    'CLASIFICACION': 'A',
    'PRODUCTO': 'MEDIA RES',
    'TIPO': 'VA',
    'RAZA': 'ANGUS',
    'CODIGO': 'B20260001-015',
    'LOTE': 'L2026001',
    'CODIGO_BARRAS': 'B20260001-0001-IZQ-A',
    'CODIGO_ITF': 'B202600010151234567890',
    'CODIGO_EAN128': '(10)B20260001(21)0015(3100)00125',
    // --- Datos de Establecimiento ---
    'ESTABLECIMIENTO': 'FRIGORIFICO EJEMPLO',
    'NRO_ESTABLECIMIENTO': '3986',
    'CUIT': '20-12345678-9',
    'MATRICULA': 'MAT-001234',
    // --- Datos de Usuario Faena / Cliente ---
    'USUARIO_FAENA': 'JUAN PEREZ',
    'NOMBRE_CLIENTE': 'Ganadera El Trébol',
    'CUIT_CLIENTE': '20-87654321-0',
    'MATRICULA_CLIENTE': 'MAT-987654',
    // --- Datos de Productor ---
    'PRODUCTOR': 'Juan García',
    'CUIT_PRODUCTOR': '23-12345678-1',
    // --- Conservación ---
    'DIAS_CONSUMO': '30',
    'TEMP_MAX': '5°C',
    // --- SENASA ---
    'NRO_SENASA': '3986',
    // --- Logos (se reemplazan por imagen GRF al imprimir) ---
    'LOGO_SOLEMAR': '[IMG:LOGO_SOLEMAR]',
    'LOGO_SENASA': '[IMG:LOGO_SENASA]',
  }

  // Descripción legible de cada variable (para el cuadro de referencia)
  const descripcionVariable: Record<string, string> = {
    'FECHA': 'Fecha de faena',
    'FECHA_FAENA': 'Fecha de faena',
    'FECHA_VENC': 'Fecha vencimiento',
    'VENCIMIENTO': 'Fecha vencimiento',
    'TROPA': 'Código de tropa',
    'GARRON': 'Número de garrón',
    'NUMERO': 'Número de animal (interno)',
    'NUMERO_ANIMAL': 'N° animal dentro de la tropa',
    'TROPA_CODIGO': 'Código tropa (sin espacios)',
    'NUMERO_CARAVANA': 'N° caravana / arete del animal',
    'PESO': 'Peso (kg)',
    'KG': 'Peso (kg)',
    'LADO': 'Lado (IZQ/DER)',
    'SIGLA': 'Sigla del cuarto (A/T/D)',
    'CLASIFICACION': 'Clasificación del cuarto',
    'PRODUCTO': 'Nombre del producto',
    'TIPO': 'Tipo de animal (VA, NO, etc.)',
    'RAZA': 'Raza del animal',
    'CODIGO': 'Código completo',
    'LOTE': 'Número de lote',
    'CODIGO_BARRAS': 'Código de barras',
    'CODIGO_ITF': 'Código ITF (Tropa+N°Animal+Caravana)',
    'CODIGO_EAN128': 'Código EAN-128 (GS1)',
    'ESTABLECIMIENTO': 'Establecimiento',
    'NRO_ESTABLECIMIENTO': 'N° Establecimiento',
    'CUIT': 'CUIT establecimiento',
    'MATRICULA': 'Matrícula establecimiento',
    'USUARIO_FAENA': 'Usuario de faena',
    'NOMBRE_CLIENTE': 'Nombre del cliente',
    'CUIT_CLIENTE': 'CUIT del cliente',
    'MATRICULA_CLIENTE': 'Matrícula del cliente',
    'PRODUCTOR': 'Nombre del productor',
    'CUIT_PRODUCTOR': 'CUIT del productor',
    'DIAS_CONSUMO': 'Días de consumo',
    'TEMP_MAX': 'Temperatura máxima',
    'NRO_SENASA': 'N° SENASA',
    'LOGO_SOLEMAR': 'Logo Solemar (imagen)',
    'LOGO_SENASA': 'Logo SENASA (imagen)',
  }

  // Cargar rótulos
  const cargarRotulos = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/rotulos')
      if (response.ok) {
        const data = await response.json()
        // La API puede devolver {success, data} o directamente el array
        setRotulos(Array.isArray(data) ? data : (data.data || []))
      }
    } catch (error) {
      console.error('Error al cargar rótulos:', error)
      toast.error('Error al cargar rótulos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarRotulos()
  }, [])

  // Procesar ZPL/DPL con datos de prueba (soporta ambos formatos)
  const procesarZplConDatos = (contenido: string, datos: Record<string, string>, tipoImpresora?: string): string => {
    let resultado = contenido
    const isDatamax = tipoImpresora === 'DATAMAX' || tipoImpresora === 'NETTIRA'

    if (isDatamax) {
      // Datamax: reemplazar {VAR} (simple llave)
      Object.entries(datos).forEach(([key, value]) => {
        const regex = new RegExp(`(?<!\\{)\\{${key}\\}(?!\\})`, 'g')
        resultado = resultado.replace(regex, value)
      })
      // Limpiar variables no reemplazadas
      resultado = resultado.replace(/(?<!\{)\{[A-Z_0-9]+\}(?!\})/g, '---')
    } else {
      // Zebra: reemplazar {{VAR}}
      Object.entries(datos).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi')
        resultado = resultado.replace(regex, value)
      })
      // Limpiar variables no reemplazadas
      resultado = resultado.replace(/\\{\\{[A-Z_0-9]+\\}\\}/g, '---')
    }
    return resultado
  }

  // Ver preview del rótulo
  const handlePreview = (rotulo: Rotulo) => {
    setRotuloSeleccionado(rotulo)
    
    if (rotulo.esBinario) {
      // Para archivos .lbl/.nlbl, mostrar información del archivo
      setPreviewProcesado(`╔══════════════════════════════════════════════════════════════╗
║     ARCHIVO ZEBRA DESIGNER - BINARIO                         ║
╚══════════════════════════════════════════════════════════════╝

📁 Archivo: ${rotulo.nombreArchivo || 'N/A'}
📐 Tamaño: ${rotulo.ancho}x${rotulo.alto}mm
🖨️ DPI: ${rotulo.dpi}
📦 Tipo: ${rotulo.tipoImpresora} - ${rotulo.modeloImpresora || 'N/A'}

⚠️ FORMATO PROPIETARIO (BINARIO/ENCRIPTADO)
Este archivo se enviará DIRECTAMENTE a la impresora Zebra.

═══════════════════════════════════════════════════════════════
📋 PARA VER EL CÓDIGO ZPL:

OPCIÓN 1 - Print to File:
   1. Abra el diseño en Zebra Designer
   2. File → Print (o Ctrl+P)
   3. Marque "Print to file"
   4. Guarde como .prn

OPCIÓN 2 - Exportar ZPL:
   1. Tools → Export
   2. Seleccione formato ZPL

═══════════════════════════════════════════════════════════════
✅ Configure la IP de la impresora y use "Imprimir Prueba"
   para enviar el archivo directamente.`)
    } else {
      // Para archivos ZPL/DPL, procesar con datos de prueba
      const procesado = procesarZplConDatos(rotulo.contenido, datosPrueba, rotulo.tipoImpresora)
      setPreviewProcesado(procesado)
    }
    
    setModalPreview(true)
  }

  // Imprimir prueba
  const handleImprimirPrueba = async () => {
    if (!rotuloSeleccionado) return
    
    if (!impresoraIp) {
      toast.error('Ingrese la IP de la impresora para imprimir')
      return
    }
    
    setImprimiendo(true)
    try {
      const response = await fetch('/api/rotulos/imprimir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rotuloId: rotuloSeleccionado.id,
          datos: datosPrueba,
          cantidad: 1,
          impresoraIp: impresoraIp,
          impresoraPuerto: parseInt(impresoraPuerto) || 9100
        })
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        toast.success(`Impresión de prueba enviada a ${impresoraIp}:${impresoraPuerto}`)
      } else {
        toast.error(result.error || result.details || 'Error al imprimir')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al enviar a impresora')
    } finally {
      setImprimiendo(false)
    }
  }

  // Exportar a archivo (para ver lo que imprime)
  const handleExportarArchivo = () => {
    if (!rotuloSeleccionado) return
    
    if (rotuloSeleccionado.esBinario) {
      // Para archivos .lbl/.nlbl, decodificar base64 y exportar original
      try {
        const binaryString = atob(rotuloSeleccionado.contenido)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        // Usar el nombre original o generar uno
        const nombreOriginal = rotuloSeleccionado.nombreArchivo || `${rotuloSeleccionado.nombre}.nlbl`
        a.download = nombreOriginal
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Archivo ${nombreOriginal} descargado`)
      } catch (error) {
        console.error('Error al exportar archivo binario:', error)
        toast.error('Error al exportar archivo')
      }
    } else {
      // Para archivos ZPL/DPL, exportar el contenido procesado
      const ext = rotuloSeleccionado.tipoImpresora === 'DATAMAX' ? 'dpl' : 'zpl'
      const blob = new Blob([previewProcesado], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prueba_${rotuloSeleccionado.nombre.replace(/\s+/g, '_')}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Archivo .${ext} descargado`)
    }
  }

  // Seleccionar archivo
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    const extensionesValidas = ['zpl', 'prn', 'dpl', 'nlbl', 'lbl', 'nrx', 'itf', 'txt']
    
    if (!extensionesValidas.includes(extension || '')) {
      toast.error('El archivo debe ser .zpl, .prn, .nlbl, .lbl, .nrx, .itf, .dpl o .txt')
      return
    }

    // Detectar tipo de impresora por extensión
    if (extension === 'dpl') {
      setTipoImpresora('DATAMAX')
      setModeloImpresora('MARK_II')
      setDpi(203)
    } else if (extension === 'nrx' || extension === 'nlbl' || extension === 'lbl') {
      setTipoImpresora('NETTIRA')
      setModeloImpresora('NTE-200')
      setDpi(203)
    } else if (extension === 'itf') {
      setTipoImpresora('DATAMAX')
      setModeloImpresora('MARK_II')
      setDpi(203)
    } else {
      setTipoImpresora('ZEBRA')
      setModeloImpresora('ZT410')
      setDpi(300)
    }

    setArchivo(file)
    
    // Intentar leer como texto primero (para DPL, ZPL, ITF texto plano)
    const textoRaw = await file.text()
    const esTextoLegible = esContenidoTexto(textoRaw)
    
    // Para archivos .nlbl, .lbl, .nrx son SIEMPRE binarios propietarios
    // Para .itf y .prn: intentar como texto primero
    const siempreBinario = extension === 'nlbl' || extension === 'lbl' || extension === 'nrx'
    
    if (siempreBinario || !esTextoLegible) {
      // Leer como buffer binario para enviar directo a impresora
      const buffer = await file.arrayBuffer()
      setArchivoBinario(buffer)
      setEsBinario(true)
      
      // Intentar extraer algo de información del archivo
      const bytes = new Uint8Array(buffer)
      const sizeKB = (bytes.length / 1024).toFixed(2)
      
      // Buscar strings legibles en el binario (headers, etc.)
      let infoExtra = ''
      try {
        const decoder = new TextDecoder('utf-8', { fatal: false })
        const text = decoder.decode(bytes)
        
        // Buscar posibles campos de información
        const labelMatch = text.match(/LabelName[^\x00]+/g)
        const sizeMatch = text.match(/LabelSize[^\x00]+/g)
        const dpiMatch = text.match(/DPI[^\x00]+/g)
        
        if (labelMatch) infoExtra += `\n📝 Nombre: ${labelMatch[0].replace('LabelName', '').replace(/\x00/g, '').trim()}`
        if (sizeMatch) infoExtra += `\n📐 Tamaño: ${sizeMatch[0].replace('LabelSize', '').replace(/\x00/g, '').trim()}`
        if (dpiMatch) infoExtra += `\n🖨️ DPI: ${dpiMatch[0].replace('DPI', '').replace(/\x00/g, '').trim()}`
      } catch (e) {
        // Ignorar errores de decode
      }
      
      const esNettira = extension === 'nrx' || extension === 'nlbl' || extension === 'lbl'
      const formatoNombre = esNettira ? 'NETTIRA LABEL DESIGNER' : (extension === 'itf' ? 'DATAMAX ITF' : 'ZEBRA DESIGNER')
      const impresoraNombre = esNettira ? 'Datamax/Nettira' : (extension === 'itf' ? 'Datamax' : 'Zebra')

      setContenidoArchivo(`╔══════════════════════════════════════════════════════════════╗
║     ARCHIVO ${formatoNombre} - ${extension.toUpperCase().padEnd(12)}          ║
╚══════════════════════════════════════════════════════════════════════════╝

📁 Archivo: ${file.name}
📦 Tamaño: ${sizeKB} KB${infoExtra}

⚠️ FORMATO PROPIETARIO (BINARIO/ENCRIPTADO)
Este archivo no se puede previsualizar como texto.
Se enviará DIRECTAMENTE a la impresora ${impresoraNombre}.

═══════════════════════════════════════════════════════════════
${esNettira ? `📋 PARA OBTENER CÓDIGO LEGIBLE DESDE NETTIRA:

OPCIÓN 1 - Exportar como PRN:
   1. Abra el diseño en Nettira Label Designer
   2. File → Print (o Ctrl+P)
   3. Marque "Print to file"
   4. Guarde como .prn

OPCIÓN 2 - Exportar desde Nettira:
   1. File → Export
   2. Seleccione formato de impresora
   3. Guarde como archivo de texto` : `📋 PARA OBTENER EL CÓDIGO ZPL LEGIBLE:

OPCIÓN 1 - Print to File:
   1. Abra el diseño en Zebra Designer
   2. File → Print (o Ctrl+P)
   3. Marque "Print to file"
   4. Guarde como .prn

OPCIÓN 2 - Impresora Virtual:
   1. Instale "Zebra Printer Driver"
   2. Agregue una impresora Zebra virtual
   3. Imprima a archivo desde Zebra Designer

OPCIÓN 3 - Exportar desde Zebra Designer:
   1. Tools → Export
   2. Seleccione formato ZPL`}

═══════════════════════════════════════════════════════════════
✅ IMPRESIÓN DIRECTA: Configure la IP de la impresora y 
   use "Imprimir Prueba" para enviar el archivo directamente.`)
      setVariablesDetectadas([])
      const msgBinario = esNettira 
        ? 'Archivo Nettira Label Designer detectado. Se enviará directo a impresora.' 
        : extension === 'itf'
          ? 'Archivo ITF binario detectado. Se enviará directo a impresora Datamax.'
          : 'Archivo Zebra Designer detectado. Se enviará directo a impresora.'
      toast.info(msgBinario)
    } else {
      // Archivos de texto plano (zpl, prn, dpl, txt, itf texto)
      setContenidoArchivo(textoRaw)
      setEsBinario(false)
      setArchivoBinario(null)
      
      const tipoImpVar = (extension === 'dpl' || extension === 'itf') ? 'DATAMAX' : 'ZEBRA'
      const variables = detectarVariables(textoRaw, tipoImpVar)
      setVariablesDetectadas(variables)
    }
    
    const nombreBase = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
    setNombre(nombreBase)
    setCodigo(file.name.replace(/\.[^/.]+$/, '').toUpperCase().replace(/\s+/g, '_'))
  }

  // Detectar variables en el contenido
  const detectarVariables = (contenido: string, tipoImpresora: string): VariableDetectada[] => {
    const variables: VariableDetectada[] = []
    const encontradas = new Set<string>()
    
    const regex = tipoImpresora === 'DATAMAX' 
      ? /\{([A-Z_0-9]+)\}/g
      : /\{\{([A-Z_0-9]+)\}\}/g
    
    let match
    while ((match = regex.exec(contenido)) !== null) {
      encontradas.add(match[1])
    }

    const mapeoCampos: Record<string, { campo: string; descripcion: string }> = {
      // --- Datos de Faena ---
      'FECHA': { campo: 'fechaFaena', descripcion: 'Fecha de faena' },
      'FECHA_FAENA': { campo: 'fechaFaena', descripcion: 'Fecha de faena' },
      'FECHA_VENC': { campo: 'fechaVencimiento', descripcion: 'Fecha vencimiento' },
      'VENCIMIENTO': { campo: 'fechaVencimiento', descripcion: 'Fecha vencimiento' },
      'TROPA': { campo: 'tropa', descripcion: 'Código de tropa' },
      'TROPA_CODIGO': { campo: 'tropa_codigo', descripcion: 'Código tropa (sin espacios)' },
      'GARRON': { campo: 'garron', descripcion: 'Número de garrón' },
      'NUMERO': { campo: 'numeroAnimal', descripcion: 'Número de animal' },
      'NUMERO_ANIMAL': { campo: 'numero_animal', descripcion: 'N° animal dentro de la tropa' },
      'NUMERO_CARAVANA': { campo: 'numero_caravana', descripcion: 'N° caravana / arete' },
      'PESO': { campo: 'peso', descripcion: 'Peso (kg)' },
      'KG': { campo: 'peso', descripcion: 'Peso (kg)' },
      'LADO': { campo: 'ladoMedia', descripcion: 'Lado (IZQ/DER)' },
      'SIGLA': { campo: 'siglaMedia', descripcion: 'Sigla del cuarto (A/T/D)' },
      'CLASIFICACION': { campo: 'clasificacion', descripcion: 'Clasificación del cuarto' },
      'PRODUCTO': { campo: 'nombreProducto', descripcion: 'Nombre del producto' },
      'TIPO': { campo: 'tipoAnimal', descripcion: 'Tipo de animal (VA, NO, etc.)' },
      'RAZA': { campo: 'raza', descripcion: 'Raza del animal' },
      'CODIGO': { campo: 'codigo', descripcion: 'Código completo' },
      'LOTE': { campo: 'lote', descripcion: 'Número de lote' },
      'CODIGO_BARRAS': { campo: 'codigoBarras', descripcion: 'Código de barras' },
      'CODIGO_EAN128': { campo: 'codigoEAN128', descripcion: 'Código EAN-128 (GS1)' },
      'CODIGO_ITF': { campo: 'codigo_itf', descripcion: 'Código ITF (Tropa+N°Animal+Caravana)' },
      // --- Establecimiento ---
      'ESTABLECIMIENTO': { campo: 'establecimiento', descripcion: 'Establecimiento' },
      'NRO_ESTABLECIMIENTO': { campo: 'nroEstablecimiento', descripcion: 'N° Establecimiento' },
      'CUIT': { campo: 'cuit', descripcion: 'CUIT establecimiento' },
      'MATRICULA': { campo: 'matricula', descripcion: 'Matrícula establecimiento' },
      // --- Usuario Faena / Cliente ---
      'USUARIO_FAENA': { campo: 'nombreUsuarioFaena', descripcion: 'Usuario de faena' },
      'NOMBRE_CLIENTE': { campo: 'nombreCliente', descripcion: 'Nombre del cliente' },
      'CUIT_CLIENTE': { campo: 'cuitCliente', descripcion: 'CUIT del cliente' },
      'MATRICULA_CLIENTE': { campo: 'matriculaCliente', descripcion: 'Matrícula del cliente' },
      // --- Productor ---
      'PRODUCTOR': { campo: 'nombreProductor', descripcion: 'Nombre del productor' },
      'CUIT_PRODUCTOR': { campo: 'cuitProductor', descripcion: 'CUIT del productor' },
      // --- Conservación ---
      'DIAS_CONSUMO': { campo: 'diasConsumo', descripcion: 'Días de consumo' },
      'TEMP_MAX': { campo: 'temperaturaMax', descripcion: 'Temperatura máxima' },
      // --- SENASA ---
      'NRO_SENASA': { campo: 'nroSenasa', descripcion: 'N° SENASA' },
      // --- Logos ---
      'LOGO_SOLEMAR': { campo: 'logoSolemar', descripcion: 'Logo Solemar (imagen GRF)' },
      'LOGO_SENASA': { campo: 'logoSenasa', descripcion: 'Logo SENASA (imagen GRF)' },
    }

    encontradas.forEach(variable => {
      const mapeo = mapeoCampos[variable] || { campo: variable.toLowerCase(), descripcion: variable }
      const formatoVar = tipoImpresora === 'DATAMAX' ? `{${variable}}` : `{{${variable}}}`
      variables.push({
        variable: formatoVar,
        campo: mapeo.campo,
        descripcion: mapeo.descripcion
      })
    })

    return variables
  }

  // Subir plantilla
  const handleSubir = async () => {
    if (!archivo || !nombre || !codigo) {
      toast.error('Complete todos los campos requeridos')
      return
    }

    setSubiendo(true)
    try {
      const formData = new FormData()
      formData.append('file', archivo)
      formData.append('nombre', nombre)
      formData.append('codigo', codigo)
      formData.append('tipo', 'MEDIA_RES')
      formData.append('tipoImpresora', tipoImpresora)
      formData.append('ancho', String(ancho))
      formData.append('alto', String(alto))
      formData.append('dpi', String(dpi))
      formData.append('contenido', contenidoArchivo)
      formData.append('variables', JSON.stringify(variablesDetectadas))
      formData.append('categoria', categoriaUso)
      formData.append('esBinario', String(esBinario))
      
      // Si es binario, enviar el archivo original
      if (esBinario && archivoBinario) {
        const blob = new Blob([archivoBinario], { type: 'application/octet-stream' })
        formData.set('file', blob, archivo?.name || 'rotulo.lbl')
      }

      const response = await fetch('/api/rotulos/upload-plantilla', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast.success('Plantilla importada correctamente')
        setModalImportar(false)
        resetForm()
        cargarRotulos()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al subir plantilla')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al subir plantilla')
    } finally {
      setSubiendo(false)
    }
  }

  // Eliminar rótulo
  const handleEliminar = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este rótulo?')) return

    try {
      const response = await fetch(`/api/rotulos/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Rótulo eliminado')
        cargarRotulos()
      }
    } catch (error) {
      toast.error('Error al eliminar rótulo')
    }
  }

  // Toggle activo
  const handleToggleActivo = async (rotulo: Rotulo) => {
    try {
      const response = await fetch(`/api/rotulos/${rotulo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rotulo, activo: !rotulo.activo })
      })
      if (response.ok) {
        toast.success(rotulo.activo ? 'Rótulo desactivado' : 'Rótulo activado')
        cargarRotulos()
      }
    } catch (error) {
      toast.error('Error al cambiar estado')
    }
  }

  // Establecer como default para una categoría
  const handleSetDefault = async (rotulo: Rotulo) => {
    try {
      // Primero quitar default de otros de la misma categoría
      const rotulosMismaCategoria = rotulos.filter(
        r => r.categoria === rotulo.categoria && r.id !== rotulo.id && r.esDefault
      )
      
      for (const r of rotulosMismaCategoria) {
        await fetch(`/api/rotulos/${r.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...r, esDefault: false })
        })
      }
      
      // Luego establecer este como default
      const response = await fetch(`/api/rotulos/${rotulo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rotulo, esDefault: true })
      })
      
      if (response.ok) {
        toast.success('Rótulo establecido como predeterminado')
        cargarRotulos()
      }
    } catch (error) {
      toast.error('Error al establecer predeterminado')
    }
  }

  // Copiar contenido (safe para SSR)
  const handleCopiar = async (contenido: string) => {
    try {
      if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(contenido)
      } else {
        // Fallback para navegadores sin clipboard API
        const textarea = document.createElement('textarea')
        textarea.value = contenido
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      toast.success('Contenido copiado al portapapeles')
    } catch (error) {
      console.error('Error al copiar:', error)
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  // Descargar archivo
  const handleDescargar = (rotulo: Rotulo) => {
    const blob = new Blob([rotulo.contenido], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ext = rotulo.tipoImpresora === 'DATAMAX' ? 'dpl' : 'zpl'
    a.download = `${rotulo.nombre.replace(/\s+/g, '_')}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Abrir modal de edición
  const handleEditar = (rotulo: Rotulo) => {
    setRotuloSeleccionado(rotulo)
    setEditandoNombre(rotulo.nombre)
    setEditandoContenido(rotulo.contenido)
    setModalEditar(true)
  }

  // Guardar edición
  const handleGuardarEdicion = async () => {
    if (!rotuloSeleccionado) return
    
    setGuardando(true)
    try {
      const response = await fetch(`/api/rotulos/${rotuloSeleccionado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rotuloSeleccionado,
          nombre: editandoNombre,
          contenido: editandoContenido
        })
      })
      
      if (response.ok) {
        toast.success('Rótulo actualizado')
        setModalEditar(false)
        cargarRotulos()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error al guardar cambios')
    } finally {
      setGuardando(false)
    }
  }

  // Insertar variable en el cursor (usa formato correcto según tipo de impresora)
  const insertarVariable = (variable: string) => {
    const tipo = rotuloSeleccionado?.tipoImpresora || 'ZEBRA'
    const formato = tipo === 'DATAMAX' || tipo === 'NETTIRA'
      ? `{${variable}}`
      : `{{${variable}}}`
    setEditandoContenido(prev => prev + formato)
  }

  // Vista previa en tiempo real del contenido editado
  const previewEdicion = procesarZplConDatos(editandoContenido, datosPrueba, rotuloSeleccionado?.tipoImpresora)

  // Reset formulario
  const resetForm = () => {
    setArchivo(null)
    setContenidoArchivo('')
    setArchivoBinario(null)
    setEsBinario(false)
    setVariablesDetectadas([])
    setNombre('')
    setCodigo('')
    setCategoriaUso('MEDIA_RES')
    setTipoImpresora('ZEBRA')
    setAncho(80)
    setAlto(50)
    setDpi(203)
    setVerContenido(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Agrupar rótulos por categoría
  const rotulosPorCategoria = rotulos.reduce((acc, rotulo) => {
    const cat = rotulo.categoria || 'SIN_CATEGORIA'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(rotulo)
    return acc
  }, {} as Record<string, Rotulo[]>)

  // Función para guardar desde el editor a pantalla completa
  const handleGuardarDesdeEditor = async (rotulo: {
    id?: string
    nombre: string
    ancho: number
    alto: number
    tipoImpresora: string
    modeloImpresora: string
    dpi: number
    elementos: RotuloElement[]
    contenido: string
  }) => {
    try {
      const body = {
        ...rotulo,
        codigo: rotulo.nombre.toUpperCase().replace(/\s+/g, '_'),
        tipo: 'ETIQUETA',
        activo: true,
        esDefault: false,
      }
      
      const response = await fetch('/api/rotulos', {
        method: rotulo.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (response.ok) {
        cargarRotulos()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar')
      }
    } catch (error) {
      throw error
    }
  }

  // Si estamos en modo editor, mostrar el editor a pantalla completa
  if (enModoEditor) {
    return (
      <EditorRotulosFullScreen
        rotuloInicial={rotuloAEditar ? {
          id: rotuloAEditar.id,
          nombre: rotuloAEditar.nombre,
          ancho: rotuloAEditar.ancho,
          alto: rotuloAEditar.alto,
          tipoImpresora: rotuloAEditar.tipoImpresora,
          modeloImpresora: rotuloAEditar.modeloImpresora || 'ZT410',
          dpi: rotuloAEditar.dpi,
          elementos: rotuloAEditar.elementos as RotuloElement[],
        } : undefined}
        onGuardar={handleGuardarDesdeEditor}
        onVolver={() => {
          if (onVolverDeEditor) {
            onVolverDeEditor()
          } else {
            setModoEditorInterno(false)
            setRotuloAEditar(null)
          }
        }}
      />
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-500" />
            Configuración de Rótulos
          </h2>
          <p className="text-sm text-stone-500">Plantillas para impresoras Zebra y Datamax</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              setRotuloAEditar(null)
              setModoEditorInterno(true)
            }}
          >
            <Palette className="w-4 h-4 mr-2" />
            Editor Visual
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.open('/VARIABLES_SOPORTADAS.txt', '_blank')}
          >
            <Variable className="w-4 h-4 mr-2" />
            Ver Variables
          </Button>
          <Button 
            onClick={() => setModalImportar(true)} 
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar Plantilla
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 mb-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5" />
              <div className="text-xs text-blue-700">
                <strong>Flujo de trabajo:</strong> Diseñe en Zebra Designer → Use variables como {'{{FECHA}}'}, {'{{TROPA}}'} → 
                Importe la plantilla → Asigne a una categoría → Al imprimir se reemplazan las variables automáticamente.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de rótulos por categoría */}
      <div className="flex-1 px-4 overflow-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : rotulos.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FileCode className="w-12 h-12 mx-auto text-stone-300 mb-3" />
              <p className="text-stone-500">No hay plantillas configuradas</p>
              <p className="text-xs text-stone-400 mt-1">Importe una plantilla para empezar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(rotulosPorCategoria).map(([categoria, rotulosCat]) => (
              <Card key={categoria} className="border-0 shadow-md">
                <CardHeader className="py-3 px-4 bg-stone-50 border-b">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {CATEGORIAS_USO.find(c => c.value === categoria)?.label || categoria}
                      <Badge variant="outline" className="font-normal">{rotulosCat.length}</Badge>
                    </span>
                    <span className="text-xs text-stone-400 font-normal">
                      {CATEGORIAS_USO.find(c => c.value === categoria)?.descripcion}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {rotulosCat.map((rotulo) => (
                      <div key={rotulo.id} className="p-3 hover:bg-stone-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={
                              rotulo.tipoImpresora === 'DATAMAX' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }>
                              {rotulo.tipoImpresora === 'DATAMAX' ? 'DPL' : 'ZPL'}
                            </Badge>
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {rotulo.nombre}
                                {rotulo.esDefault && (
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                )}
                              </p>
                              <p className="text-xs text-stone-500">
                                {rotulo.codigo} • {rotulo.ancho}×{rotulo.alto}mm • {rotulo.dpi} DPI
                                {rotulo.nombreArchivo && ` • ${rotulo.nombreArchivo}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(rotulo)}
                              title="Vista previa con datos de prueba"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefault(rotulo)}
                              title="Establecer como predeterminado"
                              disabled={rotulo.esDefault}
                            >
                              <Star className={`w-4 h-4 ${rotulo.esDefault ? 'text-amber-500 fill-amber-500' : 'text-stone-300'}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopiar(rotulo.contenido)}
                              title="Copiar código"
                            >
                              <Copy className="w-4 h-4 text-stone-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditar(rotulo)}
                              title="Editar rótulo"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDescargar(rotulo)}
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4 text-stone-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActivo(rotulo)}
                              title={rotulo.activo ? 'Desactivar' : 'Activar'}
                            >
                              <Power className={`w-4 h-4 ${rotulo.activo ? 'text-green-500' : 'text-stone-300'}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEliminar(rotulo.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Variables detectadas */}
                        {rotulo.variables && JSON.parse(rotulo.variables).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {JSON.parse(rotulo.variables).slice(0, 8).map((v: VariableDetectada, i: number) => (
                              <code key={i} className="text-xs bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                                {v.variable}
                              </code>
                            ))}
                            {JSON.parse(rotulo.variables).length > 8 && (
                              <span className="text-xs text-stone-400">
                                +{JSON.parse(rotulo.variables).length - 8} más
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal Importar */}
      <Dialog open={modalImportar} onOpenChange={(open) => {
        setModalImportar(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-500" />
              Importar Plantilla
            </DialogTitle>
            <DialogDescription>
              Importe plantillas desde Zebra Designer o Datamax Designer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Archivo */}
            <div>
              <Label>Archivo de Plantilla</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".zpl,.prn,.nlbl,.lbl,.dpl,.nrx,.itf,.txt"
                onChange={handleFileSelect}
                className="mt-1"
              />
              <p className="text-xs text-stone-500 mt-1">
                Zebra: .zpl, .prn, .nlbl, .lbl | Datamax: .dpl, .itf | Nettira: .nrx
              </p>
            </div>

            {/* Nombre y código */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label>Código</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </div>
            </div>

            {/* Tipo y Modelo de Impresora */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de Impresora</Label>
                <Select value={tipoImpresora} onValueChange={(v) => {
                  setTipoImpresora(v)
                  // Cambiar al modelo default según tipo
                  if (v === 'DATAMAX') {
                    setModeloImpresora('MARK_II')
                    setDpi(203)
                  } else {
                    setModeloImpresora('ZT410')
                    setDpi(300)
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_IMPRESORA.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modelo</Label>
                <Select value={modeloImpresora} onValueChange={(v) => {
                  setModeloImpresora(v)
                  const modelo = MODELOS_IMPRESORA[tipoImpresora as keyof typeof MODELOS_IMPRESORA]?.find(m => m.value === v)
                  if (modelo) setDpi(modelo.dpi)
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELOS_IMPRESORA[tipoImpresora as keyof typeof MODELOS_IMPRESORA]?.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex flex-col">
                          <span>{m.label}</span>
                          <span className="text-xs text-stone-400">{m.descripcion}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Info del modelo seleccionado */}
            <div className="p-2 bg-stone-50 rounded-lg flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-stone-600">
                {MODELOS_IMPRESORA[tipoImpresora as keyof typeof MODELOS_IMPRESORA]?.find(m => m.value === modeloImpresora)?.label || 'Seleccionar modelo'}
                {' - '}
                DPI detectado: {dpi}
              </span>
            </div>

            {/* Categoría de uso */}
            <div>
              <Label>Categoría de Uso</Label>
              <Select value={categoriaUso} onValueChange={setCategoriaUso}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_USO.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div>
                        <span>{c.label}</span>
                        <span className="text-xs text-stone-400 ml-2">{c.descripcion}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dimensiones */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Ancho (mm)</Label>
                <Input type="number" value={ancho} onChange={(e) => setAncho(parseInt(e.target.value) || 80)} />
              </div>
              <div>
                <Label>Alto (mm)</Label>
                <Input type="number" value={alto} onChange={(e) => setAlto(parseInt(e.target.value) || 50)} />
              </div>
              <div>
                <Label>DPI</Label>
                <Select value={String(dpi)} onValueChange={(v) => setDpi(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="203">203 DPI</SelectItem>
                    <SelectItem value="300">300 DPI</SelectItem>
                    <SelectItem value="600">600 DPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Variables detectadas */}
            {variablesDetectadas.length > 0 && (
              <div>
                <Label className="flex items-center gap-2">
                  <Variable className="w-4 h-4" />
                  Variables Detectadas ({variablesDetectadas.length})
                </Label>
                <div className="mt-2 flex flex-wrap gap-1 p-2 bg-stone-50 rounded-md max-h-24 overflow-auto">
                  {variablesDetectadas.map((v, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border">
                      <code className="text-blue-600">{v.variable}</code>
                      <span className="text-stone-400">→</span>
                      <span className="text-stone-600">{v.descripcion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ver contenido (colapsable) */}
            {contenidoArchivo && (
              <Collapsible open={verContenido} onOpenChange={setVerContenido}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 w-full justify-start">
                  {verContenido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  Ver código de la plantilla
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-40 mt-2 border rounded-md bg-stone-900">
                    <pre className="p-3 text-xs text-green-400 font-mono whitespace-pre-wrap">
                      {contenidoArchivo}
                    </pre>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalImportar(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubir} 
              disabled={subiendo || !archivo}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {subiendo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Importar Plantilla
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview */}
      <Dialog open={modalPreview} onOpenChange={setModalPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-500" />
              Vista Previa: {rotuloSeleccionado?.nombre}
              {rotuloSeleccionado?.esBinario && (
                <Badge className="bg-purple-100 text-purple-700 ml-2">Binario Zebra</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {rotuloSeleccionado?.esBinario 
                ? `Archivo binario para impresión directa • ${rotuloSeleccionado?.ancho}×${rotuloSeleccionado?.alto}mm`
                : `Previsualización con datos de prueba • ${rotuloSeleccionado?.ancho}×{rotuloSeleccionado?.alto}mm`
              }
            </DialogDescription>
          </DialogHeader>

          {rotuloSeleccionado?.esBinario ? (
            /* Vista para archivo binario */
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <FileCode className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-purple-800">Archivo Zebra Designer (Binario)</span>
                </div>
                <div className="text-sm text-purple-700 space-y-1">
                  <p>📁 <strong>Archivo:</strong> {rotuloSeleccionado.nombreArchivo || rotuloSeleccionado.nombre}</p>
                  <p>📐 <strong>Tamaño:</strong> {rotuloSeleccionado.ancho}×{rotuloSeleccionado.alto}mm</p>
                  <p>🖨️ <strong>DPI:</strong> {rotuloSeleccionado.dpi}</p>
                </div>
                <div className="mt-3 p-2 bg-amber-100 rounded text-xs text-amber-800">
                  ⚠️ Este archivo está en formato propietario y no se puede previsualizar como texto.
                  Se enviará directamente a la impresora Zebra.
                </div>
              </div>

              {/* Configuración de impresora */}
              <div className="p-4 bg-stone-50 rounded-lg border">
                <p className="text-sm font-medium text-stone-600 mb-3">Configuración de Impresora Zebra</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">IP de Impresora</Label>
                    <Input
                      value={impresoraIp}
                      onChange={(e) => setImpresoraIp(e.target.value)}
                      placeholder="192.168.1.100"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Puerto</Label>
                    <Input
                      value={impresoraPuerto}
                      onChange={(e) => setImpresoraPuerto(e.target.value)}
                      placeholder="9100"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleExportarArchivo}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Archivo
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleImprimirPrueba}
                  disabled={imprimiendo || !impresoraIp}
                >
                  {imprimiendo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Imprimiendo...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Vista normal para archivos de texto */
            <div className="grid grid-cols-2 gap-4">
            {/* Panel izquierdo - Variables disponibles */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Variable className="w-4 h-4" />
                Variables Disponibles
                <Badge variant="outline" className="text-[10px] font-mono">
                  {rotuloSeleccionado?.tipoImpresora === 'DATAMAX' ? 'DPL {VAR}' : 'ZPL {{VAR}}'}
                </Badge>
              </Label>
              <ScrollArea className="h-[400px] border rounded-md p-3 bg-stone-50">
                <div className="space-y-1">
                  {Object.entries(datosPrueba).map(([key, value]) => {
                    const isDatamax = rotuloSeleccionado?.tipoImpresora === 'DATAMAX' || rotuloSeleccionado?.tipoImpresora === 'NETTIRA'
                    const formatoVar = isDatamax ? `{${key}}` : `{{${key}}}`
                    const desc = descripcionVariable[key] || ''
                    const isLogo = key.startsWith('LOGO_')
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <code className={`px-2 py-0.5 rounded text-xs font-mono min-w-[120px] ${isLogo ? 'bg-purple-100 text-purple-700' : isDatamax ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {formatoVar}
                        </code>
                        <span className="text-stone-400">→</span>
                        <div className="flex flex-col">
                          <span className="text-stone-700 font-medium text-xs">{desc}</span>
                          <span className="text-stone-400 text-[10px]">ej: {value}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
              
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700">
                  <strong>Zebra (ZPL):</strong> formato <code className="bg-white px-1 rounded">{'{{VARIABLE}}'}</code> con doble llave.<br/>
                  <strong>Datamax (DPL/ITF):</strong> formato <code className="bg-white px-1 rounded">{'{VARIABLE}'}</code> con llave simple.
                </p>
              </div>
            </div>

            {/* Panel derecho - ZPL Procesado */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  ZPL Procesado
                </Label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopiar(previewProcesado)}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[300px] border rounded-md bg-stone-900">
                <pre className="p-3 text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {previewProcesado}
                </pre>
              </ScrollArea>
              
              {/* Acciones */}
              <div className="space-y-3">
                {/* Configuración de impresora */}
                <div className="p-3 bg-stone-50 rounded-lg border">
                  <p className="text-xs font-medium text-stone-600 mb-2">Configuración de Impresora</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">IP de Impresora</Label>
                      <Input
                        value={impresoraIp}
                        onChange={(e) => setImpresoraIp(e.target.value)}
                        placeholder="192.168.1.100"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Puerto</Label>
                      <Input
                        value={impresoraPuerto}
                        onChange={(e) => setImpresoraPuerto(e.target.value)}
                        placeholder="9100"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Botones de acción */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleExportarArchivo}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Archivo
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleImprimirPrueba}
                    disabled={imprimiendo || !impresoraIp}
                  >
                    {imprimiendo ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Imprimiendo...
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir Prueba
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalPreview(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={modalEditar} onOpenChange={setModalEditar}>
        <DialogContent className="max-w-6xl max-h-[90vh]" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-500" />
              Editar Rótulo
            </DialogTitle>
            <DialogDescription>
              Modificá el contenido ZPL/DPL. Usá variables como {'{{TROPA}}'}, {'{{PESO}}'}, etc.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4">
            {/* Panel izquierdo - Variables disponibles */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Variable className="w-4 h-4" />
                Variables Disponibles
                <Badge variant="outline" className="text-[10px] font-mono">
                  {rotuloSeleccionado?.tipoImpresora === 'DATAMAX' ? 'DPL {VAR}' : 'ZPL {{VAR}}'}
                </Badge>
              </Label>
              <ScrollArea className="h-[400px] border rounded-md p-2 bg-stone-50">
                <div className="space-y-1">
                  {Object.entries(datosPrueba).map(([key, value]) => {
                    const isDatamax = rotuloSeleccionado?.tipoImpresora === 'DATAMAX' || rotuloSeleccionado?.tipoImpresora === 'NETTIRA'
                    const formatoVar = isDatamax ? `{${key}}` : `{{${key}}}`
                    const desc = descripcionVariable[key] || value
                    const isLogo = key.startsWith('LOGO_')
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => insertarVariable(key)}
                        className={`w-full text-left p-2 rounded transition-colors group ${isLogo ? 'hover:bg-purple-100' : 'hover:bg-amber-100'}`}
                      >
                        <code className={`text-xs px-1.5 py-0.5 rounded group-hover:opacity-80 ${isLogo ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                          {formatoVar}
                        </code>
                        <span className="text-xs text-stone-500 ml-2">{desc}</span>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
              <p className="text-xs text-stone-500">
                Click en una variable para insertarla en el editor
              </p>
            </div>

            {/* Panel central - Editor */}
            <div className="col-span-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nombre del Rótulo</Label>
                  <Input 
                    value={editandoNombre} 
                    onChange={(e) => setEditandoNombre(e.target.value)}
                    placeholder="Nombre descriptivo"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Input 
                    value={rotuloSeleccionado?.tipoImpresora === 'DATAMAX' ? 'DPL (Datamax)' : 'ZPL (Zebra)'}
                    disabled
                  />
                </div>
              </div>

              <div>
                <Label className="flex items-center justify-between">
                  <span>Contenido ZPL/DPL</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopiar(editandoContenido)}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar
                  </Button>
                </Label>
                <ScrollArea className="h-[250px] border rounded-md bg-stone-900">
                  <textarea
                    value={editandoContenido}
                    onChange={(e) => setEditandoContenido(e.target.value)}
                    className="w-full h-full p-3 text-xs text-green-400 font-mono whitespace-pre-wrap bg-transparent border-0 focus:outline-none focus:ring-0 resize-none"
                    placeholder="Código ZPL o DPL..."
                    spellCheck={false}
                  />
                </ScrollArea>
              </div>

              {/* Vista previa */}
              <div>
                <Label className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Vista Previa (con datos de prueba)
                </Label>
                <ScrollArea className="h-[150px] border rounded-md bg-stone-800">
                  <pre className="p-3 text-xs text-green-300 font-mono whitespace-pre-wrap">
                    {previewEdicion}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalEditar(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGuardarEdicion}
              disabled={guardando}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {guardando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
