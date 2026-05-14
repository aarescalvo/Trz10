'use client'

import { 
  Truck, Beef, Scale, ClipboardList, TrendingUp, Package, Tag, Scissors, 
  Warehouse, FileText, Settings, Search, RefreshCw, BoxSelect, Barcode,
  LayoutDashboard, Activity, DollarSign, AlertTriangle, FileSpreadsheet,
  Users, Printer
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

export type PageId = 
  | 'dashboard' | 'pesajeCamiones' | 'pesajeIndividual' | 'movimientoHacienda'
  | 'listaFaena' | 'ingresoCajon' | 'romaneo' | 'vbRomaneo'
  | 'movimientoCamaras' | 'expedicionUnificada' | 'despachos'
  | 'cuarteo' | 'ingresoDesposteUnificado' | 'movimientosDespostada'
  | 'cortesDespostada' | 'produccionUnificada' | 'menudencias' | 'cueros'
  | 'grasa' | 'desperdicios' | 'fondoDigestor'
  | 'stockUnificada' | 'stocksCorrales' | 'planilla01' | 'rindesTropa'
  | 'busquedaFiltro' | 'reportesSenasa' | 'facturacion' | 'precios'
  | 'insumos' | 'stocksInsumos' | 'configRotulos' | 'editorRotulos'
  | 'configInsumos' | 'configUsuarios' | 'configCodigobarras'
  | 'configBalanzas' | 'configOperadores' | 'configProductos'
  | 'configSubproductos' | 'configListadoInsumos'
  | 'configCondicionesEmbalaje' | 'configTiposProducto'
  | 'configC2Rubros' | 'configC2TiposCuarto' | 'configC2ProductosDesposte'
  | 'configC2BOM' | 'c2Subproductos' | 'c2Pallets' | 'c2Rendimiento'
  | 'c2Degradacion' | 'c2Reportes' | 'calidadRegistroUsuarios'
  | 'calidadPh' | 'reportes' | 'configuracion' | 'auditoriaOperador'
  | 'rotulosMejoras' | 'dashboardEjecutivo' | 'reportesGerenciales'
  | 'controlVencimientos' | 'alertasStock' | 'historialPrecios'
  | 'reportesSIGICA' | 'exportacionSIGICA' | 'printerBridgeGuide'

// ============================================================
// PAGE ID → ROUTE MAPPING
// ============================================================

export const PAGE_TO_ROUTE: Record<PageId, string> = {
  dashboard: '/dashboard',
  pesajeCamiones: '/pesaje-camiones',
  pesajeIndividual: '/ciclo-1/pesaje-individual',
  movimientoHacienda: '/ciclo-1/movimiento-hacienda',
  listaFaena: '/ciclo-1/lista-faena',
  ingresoCajon: '/ciclo-1/ingreso-cajon',
  romaneo: '/ciclo-1/romaneo',
  vbRomaneo: '/ciclo-1/vb-romaneo',
  movimientoCamaras: '/ciclo-1/movimiento-camaras',
  expedicionUnificada: '/ciclo-1/expedicion',
  cuarteo: '/ciclo-2/cuarteo',
  ingresoDesposteUnificado: '/ciclo-2/ingreso-desposte',
  produccionUnificada: '/ciclo-2/produccion',
  despachos: '/ciclo-2/despachos',
  c2Subproductos: '/ciclo-2/subproductos',
  c2Pallets: '/ciclo-2/pallets',
  c2Rendimiento: '/ciclo-2/rendimiento',
  c2Degradacion: '/ciclo-2/degradacion',
  c2Reportes: '/ciclo-2/reportes',
  movimientosDespostada: '/ciclo-2/movimientos',
  cortesDespostada: '/ciclo-2/cortes',
  configC2Rubros: '/ciclo-2/rubros',
  configC2TiposCuarto: '/ciclo-2/tipos-cuarto',
  configC2ProductosDesposte: '/ciclo-2/productos-desposte',
  configC2BOM: '/ciclo-2/bom',
  menudencias: '/subproductos/menudencias',
  cueros: '/subproductos/cueros',
  grasa: '/subproductos/grasa',
  desperdicios: '/subproductos/desperdicios',
  fondoDigestor: '/subproductos/fondo-digestor',
  stocksCorrales: '/reportes/stocks-corrales',
  stockUnificada: '/reportes/stock-camaras',
  planilla01: '/reportes/planilla-01',
  rindesTropa: '/reportes/rindes-tropa',
  busquedaFiltro: '/reportes/busqueda-filtro',
  reportesSenasa: '/reportes/senasa',
  reportesSIGICA: '/reportes/sigica',
  exportacionSIGICA: '/reportes/exportacion-sigica',
  reportesGerenciales: '/reportes/gerenciales',
  controlVencimientos: '/reportes/control-vencimientos',
  dashboardEjecutivo: '/reportes/dashboard-ejecutivo',
  facturacion: '/administracion/facturacion',
  precios: '/administracion/precios',
  historialPrecios: '/administracion/historial-precios',
  insumos: '/administracion/insumos',
  stocksInsumos: '/administracion/stocks-insumos',
  alertasStock: '/administracion/alertas-stock',
  configuracion: '/configuracion/general',
  configRotulos: '/configuracion/rotulos',
  editorRotulos: '/configuracion/rotulos/editor',
  configInsumos: '/configuracion/insumos',
  configUsuarios: '/configuracion/usuarios',
  configCodigobarras: '/configuracion/codigo-barras',
  configBalanzas: '/configuracion/balanzas',
  configOperadores: '/configuracion/operadores',
  configProductos: '/configuracion/productos',
  configSubproductos: '/configuracion/subproductos',
  configListadoInsumos: '/configuracion/listado-insumos',
  configCondicionesEmbalaje: '/configuracion/condiciones-embalaje',
  configTiposProducto: '/configuracion/tipos-producto',
  printerBridgeGuide: '/configuracion/printer-bridge',
  calidadRegistroUsuarios: '/calidad/registro-usuarios',
  calidadPh: '/calidad/control-ph',
  auditoriaOperador: '/calidad/auditoria',
  rotulosMejoras: '/diseno/etiquetas',
  reportes: '/reportes/stocks-corrales',
}

// ============================================================
// ROUTE → PAGE ID MAPPING (reverse)
// ============================================================

export const ROUTE_TO_PAGE: Record<string, PageId> = Object.fromEntries(
  Object.entries(PAGE_TO_ROUTE).map(([k, v]) => [v, k as PageId])
) as Record<string, PageId>

// ============================================================
// NAVIGATION STRUCTURE
// ============================================================

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
  permiso?: string
  permisoAlt?: string
  route: string
}

export interface NavSubGroup {
  label: string
  items: NavItem[]
}

export interface NavGroup {
  label: string
  icon?: LucideIcon
  items: NavItem[]
  subGroups?: NavSubGroup[]
}

export const NAV_GROUPS: NavGroup[] = [
  // 1. Pesaje Camiones — destacado al inicio
  {
    label: '',
    items: [
      { id: 'pesajeCamiones', label: 'Pesaje Camiones', icon: Truck, permiso: 'puedePesajeCamiones', route: '/pesaje-camiones' },
    ]
  },
  // 2. CICLO I
  {
    label: 'CICLO I',
    icon: ClipboardList,
    items: [
      { id: 'pesajeIndividual', label: 'Pesaje Individual', icon: Scale, permiso: 'puedePesajeIndividual', route: '/ciclo-1/pesaje-individual' },
      { id: 'movimientoHacienda', label: 'Movimiento de Hacienda', icon: RefreshCw, permiso: 'puedeMovimientoHacienda', route: '/ciclo-1/movimiento-hacienda' },
      { id: 'listaFaena', label: 'Lista de Faena', icon: ClipboardList, permiso: 'puedeListaFaena', route: '/ciclo-1/lista-faena' },
      { id: 'ingresoCajon', label: 'Ingreso a Cajón', icon: BoxSelect, permiso: 'puedeIngresoCajon', route: '/ciclo-1/ingreso-cajon' },
      { id: 'romaneo', label: 'Romaneo', icon: TrendingUp, permiso: 'puedeRomaneo', route: '/ciclo-1/romaneo' },
      { id: 'vbRomaneo', label: 'VB Romaneo', icon: FileText, permiso: 'puedeRomaneo', route: '/ciclo-1/vb-romaneo' },
      { id: 'movimientoCamaras', label: 'Movimiento de Cámaras', icon: RefreshCw, permiso: 'puedeStock', route: '/ciclo-1/movimiento-camaras' },
      { id: 'expedicionUnificada', label: 'Expedición', icon: Truck, permiso: 'puedeStock', permisoAlt: 'puedeExpedicionC2', route: '/ciclo-1/expedicion' },
    ]
  },
  // 3. CICLO II
  {
    label: 'CICLO II',
    icon: Scissors,
    items: [
      { id: 'cuarteo', label: 'Cuarteo', icon: Scissors, permiso: 'puedeCuarteo', route: '/ciclo-2/cuarteo' },
      { id: 'ingresoDesposteUnificado', label: 'Ingreso a Desposte', icon: Package, permiso: 'puedeDesposte', route: '/ciclo-2/ingreso-desposte' },
      { id: 'produccionUnificada', label: 'Producción / Empaque', icon: Scissors, permiso: 'puedeDesposte', permisoAlt: 'puedeEmpaque', route: '/ciclo-2/produccion' },
      { id: 'despachos', label: 'Despachos', icon: Truck, permiso: 'puedeStock', route: '/ciclo-2/despachos' },
      { id: 'c2Subproductos', label: 'Subproductos C2', icon: Package, permiso: 'puedeDesposte', route: '/ciclo-2/subproductos' },
      { id: 'c2Pallets', label: 'Pallets C2', icon: Package, permiso: 'puedeExpedicionC2', route: '/ciclo-2/pallets' },
      { id: 'c2Rendimiento', label: 'Rendimiento C2', icon: TrendingUp, permiso: 'puedeReportes', route: '/ciclo-2/rendimiento' },
      { id: 'c2Degradacion', label: 'Degradación C2', icon: AlertTriangle, permiso: 'puedeDesposte', route: '/ciclo-2/degradacion' },
      { id: 'c2Reportes', label: 'Reportes C2', icon: FileText, permiso: 'puedeReportes', route: '/ciclo-2/reportes' },
      { id: 'movimientosDespostada', label: 'Movimientos de Despostada', icon: RefreshCw, permiso: 'puedeDesposte', route: '/ciclo-2/movimientos' },
      { id: 'cortesDespostada', label: 'Cortes en Despostada', icon: Scissors, permiso: 'puedeDesposte', route: '/ciclo-2/cortes' },
      { id: 'configC2Rubros', label: 'Rubros', icon: Tag, permiso: 'puedeConfiguracion', route: '/ciclo-2/rubros' },
      { id: 'configC2TiposCuarto', label: 'Tipos de Cuarto', icon: Scissors, permiso: 'puedeConfiguracion', route: '/ciclo-2/tipos-cuarto' },
      { id: 'configC2ProductosDesposte', label: 'Productos Desposte', icon: Package, permiso: 'puedeConfiguracion', route: '/ciclo-2/productos-desposte' },
      { id: 'configC2BOM', label: 'BOM (Insumos x Producto)', icon: ClipboardList, permiso: 'puedeConfiguracion', route: '/ciclo-2/bom' },
    ]
  },
  // 4. Subproductos (con subgrupos)
  {
    label: 'Subproductos',
    icon: Package,
    items: [],
    subGroups: [
      {
        label: 'Consumo',
        items: [
          { id: 'menudencias', label: 'Menudencias', icon: Package, permiso: 'puedeMenudencias', route: '/subproductos/menudencias' },
          { id: 'cueros', label: 'Cueros', icon: Tag, permiso: 'puedeMenudencias', route: '/subproductos/cueros' },
        ]
      },
      {
        label: 'Rendering',
        items: [
          { id: 'grasa', label: 'Grasa', icon: TrendingUp, permiso: 'puedeMenudencias', route: '/subproductos/grasa' },
          { id: 'desperdicios', label: 'Desperdicios', icon: Package, permiso: 'puedeMenudencias', route: '/subproductos/desperdicios' },
          { id: 'fondoDigestor', label: 'Fondo de Digestor', icon: Package, permiso: 'puedeMenudencias', route: '/subproductos/fondo-digestor' },
        ]
      }
    ]
  },
  // 5. Reportes
  {
    label: 'Reportes',
    icon: FileText,
    items: [
      { id: 'stocksCorrales', label: 'Stocks Corrales', icon: Warehouse, permiso: 'puedeReportes', route: '/reportes/stocks-corrales' },
      { id: 'stockUnificada', label: 'Stock Cámaras / Cajas', icon: Warehouse, permiso: 'puedeReportes', route: '/reportes/stock-camaras' },
      { id: 'planilla01', label: 'Planilla 01', icon: FileText, permiso: 'puedeReportes', route: '/reportes/planilla-01' },
      { id: 'rindesTropa', label: 'Rindes por Tropa', icon: TrendingUp, permiso: 'puedeReportes', route: '/reportes/rindes-tropa' },
      { id: 'busquedaFiltro', label: 'Búsqueda por Filtro', icon: Search, permiso: 'puedeReportes', route: '/reportes/busqueda-filtro' },
      { id: 'reportesSenasa', label: 'Reportes SENASA', icon: FileText, permiso: 'puedeReportes', route: '/reportes/senasa' },
      { id: 'reportesSIGICA', label: 'Reportes SIGICA', icon: FileText, permiso: 'puedeReportes', route: '/reportes/sigica' },
      { id: 'exportacionSIGICA', label: 'Exportacion SIGICA', icon: FileSpreadsheet, permiso: 'puedeReportes', route: '/reportes/exportacion-sigica' },
      { id: 'reportesGerenciales', label: 'Reportes Gerenciales', icon: TrendingUp, permiso: 'puedeReportes', route: '/reportes/gerenciales' },
      { id: 'controlVencimientos', label: 'Control Vencimientos', icon: AlertTriangle, permiso: 'puedeStock', route: '/reportes/control-vencimientos' },
      { id: 'dashboardEjecutivo', label: 'Dashboard Ejecutivo', icon: LayoutDashboard, permiso: 'puedeReportes', route: '/reportes/dashboard-ejecutivo' },
    ]
  },
  // 6. Administración
  {
    label: 'Administración',
    icon: FileText,
    items: [
      { id: 'facturacion', label: 'Facturación', icon: FileText, permiso: 'puedeFacturacion', route: '/administracion/facturacion' },
      { id: 'precios', label: 'Precios', icon: DollarSign, permiso: 'puedeFacturacion', route: '/administracion/precios' },
      { id: 'historialPrecios', label: 'Historial de Precios', icon: TrendingUp, permiso: 'puedeFacturacion', route: '/administracion/historial-precios' },
      { id: 'insumos', label: 'Insumos', icon: Package, permiso: 'puedeConfiguracion', route: '/administracion/insumos' },
      { id: 'stocksInsumos', label: 'Stocks de Insumos', icon: Package, permiso: 'puedeStock', route: '/administracion/stocks-insumos' },
      { id: 'alertasStock', label: 'Alertas de Stock', icon: AlertTriangle, permiso: 'puedeStock', route: '/administracion/alertas-stock' },
    ]
  },
  // 7. Configuración
  {
    label: 'Configuración',
    icon: Settings,
    items: [
      { id: 'configuracion', label: 'Configuración General', icon: Settings, permiso: 'puedeConfiguracion', route: '/configuracion/general' },
      { id: 'configRotulos', label: 'Rótulos', icon: Tag, permiso: 'puedeConfiguracion', route: '/configuracion/rotulos' },
      { id: 'configInsumos', label: 'Insumos', icon: Package, permiso: 'puedeConfiguracion', route: '/configuracion/insumos' },
      { id: 'configUsuarios', label: 'Usuarios', icon: Users, permiso: 'puedeConfiguracion', route: '/configuracion/usuarios' },
      { id: 'configCodigobarras', label: 'Código de Barras', icon: Barcode, permiso: 'puedeConfiguracion', route: '/configuracion/codigo-barras' },
      { id: 'configBalanzas', label: 'Balanzas', icon: Scale, permiso: 'puedeConfiguracion', route: '/configuracion/balanzas' },
      { id: 'configOperadores', label: 'Operadores', icon: Users, permiso: 'puedeConfiguracion', route: '/configuracion/operadores' },
      { id: 'configProductos', label: 'Productos', icon: Package, permiso: 'puedeConfiguracion', route: '/configuracion/productos' },
      { id: 'configSubproductos', label: 'Subproductos', icon: Package, permiso: 'puedeConfiguracion', route: '/configuracion/subproductos' },
      { id: 'configListadoInsumos', label: 'Listado de Insumos', icon: ClipboardList, permiso: 'puedeConfiguracion', route: '/configuracion/listado-insumos' },
      { id: 'configCondicionesEmbalaje', label: 'Condiciones de Embalaje', icon: Package, permiso: 'puedeConfiguracion', route: '/configuracion/condiciones-embalaje' },
      { id: 'configTiposProducto', label: 'Tipos de Producto', icon: Tag, permiso: 'puedeConfiguracion', route: '/configuracion/tipos-producto' },
      { id: 'printerBridgeGuide', label: 'Instalar Printer Bridge', icon: Printer, permiso: 'puedeConfiguracion', route: '/configuracion/printer-bridge' },
    ]
  },
  // 8. Calidad
  {
    label: 'Calidad',
    icon: Activity,
    items: [
      { id: 'calidadRegistroUsuarios', label: 'Registro de Usuarios', icon: Users, permiso: 'puedeCalidad', route: '/calidad/registro-usuarios' },
      { id: 'calidadPh', label: 'Control de pH', icon: Activity, permiso: 'puedeCalidad', route: '/calidad/control-ph' },
      { id: 'auditoriaOperador', label: 'Auditoría Operadores', icon: Users, permiso: 'puedeCalidad', route: '/calidad/auditoria' },
    ]
  },
  // 9. Diseño de Etiquetas
  {
    label: 'Diseño',
    icon: Tag,
    items: [
      { id: 'rotulosMejoras', label: 'Diseñador Etiquetas', icon: Tag, permiso: 'puedeConfiguracion', route: '/diseno/etiquetas' },
    ]
  }
]
