'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Truck, Beef, Scale, ClipboardList, TrendingUp, Package, Tag, Scissors,
  Warehouse, FileText, Settings, Search, RefreshCw, BoxSelect, LayoutDashboard,
  ChevronRight, Activity, DollarSign
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { PAGE_TO_ROUTE, type PageId } from '@/lib/navigation'

// ============================================================
// DASHBOARD — Página principal con stats y accesos directos
// ============================================================

interface Tropa {
  id: string; numero: number; codigo: string
  productor?: { nombre: string }
  usuarioFaena: { nombre: string }
  especie: string; cantidadCabezas: number
  estado: string; fechaRecepcion: string
}

interface Stats {
  tropasActivas: number; enPesaje: number; pesajesHoy: number; enCamara: number
}

const MODULOS_PRINCIPALES = [
  { id: 'pesajeCamiones' as PageId, label: 'Pesaje Camiones', icon: Truck, color: 'bg-amber-500', desc: 'Pesaje de camiones de hacienda', permiso: 'puedePesajeCamiones' },
  { id: 'pesajeIndividual' as PageId, label: 'Pesaje Individual', icon: Scale, color: 'bg-emerald-600', desc: 'Pesaje individual de animales', permiso: 'puedePesajeIndividual' },
  { id: 'movimientoHacienda' as PageId, label: 'Movimiento de Hacienda', icon: RefreshCw, color: 'bg-blue-600', desc: 'Movimiento entre corrales', permiso: 'puedeMovimientoHacienda' },
  { id: 'listaFaena' as PageId, label: 'Lista de Faena', icon: ClipboardList, color: 'bg-red-600', desc: 'Gestión de lista de faena', permiso: 'puedeListaFaena' },
  { id: 'ingresoCajon' as PageId, label: 'Ingreso a Cajón', icon: BoxSelect, color: 'bg-purple-600', desc: 'Asignación de garrones', permiso: 'puedeIngresoCajon' },
  { id: 'romaneo' as PageId, label: 'Romaneo', icon: TrendingUp, color: 'bg-orange-500', desc: 'Pesaje de medias reses', permiso: 'puedeRomaneo' },
]

const MODULOS_SUBPRODUCTOS = [
  { id: 'menudencias' as PageId, label: 'Menudencias', icon: Package, color: 'bg-teal-600', desc: 'Procesamiento de menudencias', permiso: 'puedeMenudencias' },
  { id: 'cueros' as PageId, label: 'Cueros', icon: Tag, color: 'bg-yellow-600', desc: 'Gestión de cueros', permiso: 'puedeMenudencias' },
]

const MODULOS_REPORTES = [
  { id: 'stocksCorrales' as PageId, label: 'Stocks Corrales', icon: Warehouse, color: 'bg-indigo-600', desc: 'Stock en corrales', permiso: 'puedeReportes' },
  { id: 'stockUnificada' as PageId, label: 'Stock Cámaras / Cajas', icon: Warehouse, color: 'bg-cyan-600', desc: 'Stock en cámaras y cajas C2', permiso: 'puedeReportes' },
  { id: 'planilla01' as PageId, label: 'Planilla 01', icon: FileText, color: 'bg-gray-600', desc: 'Planilla oficial SENASA', permiso: 'puedeReportes' },
  { id: 'rindesTropa' as PageId, label: 'Rindes por Tropa', icon: TrendingUp, color: 'bg-lime-600', desc: 'Análisis de rindes', permiso: 'puedeReportes' },
]

const MODULOS_ADMIN = [
  { id: 'facturacion' as PageId, label: 'Facturación', icon: FileText, color: 'bg-slate-700', desc: 'Gestión de facturación', permiso: 'puedeFacturacion' },
]

export default function DashboardPage() {
  const router = useRouter()
  const { operador, hasPermission } = useAuth()
  const [tropas, setTropas] = useState<Tropa[]>([])
  const [stats, setStats] = useState<Stats>({ tropasActivas: 0, enPesaje: 0, pesajesHoy: 0, enCamara: 0 })
  const [actividadReciente, setActividadReciente] = useState<Array<{ id: string; tipo: string; descripcion: string; fecha: string }>>([])

  useEffect(() => {
    if (!operador) return
    fetchTropas()
    fetchStats()
    fetchActividad()
  }, [operador])

  const fetchTropas = async () => {
    try {
      const res = await fetch('/api/tropas')
      const data = await res.json()
      if (data.success) setTropas(data.data)
    } catch (error) { console.error('Error fetching tropas:', error) }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard')
      const data = await res.json()
      if (data.success) setStats(data.data)
    } catch (error) { console.error('Error fetching stats:', error) }
  }

  const fetchActividad = async () => {
    try {
      const res = await fetch('/api/actividad-operador?limite=10')
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) setActividadReciente(data.data)
    } catch (error) { console.error('Error fetching actividad:', error) }
  }

  const navigateTo = (pageId: PageId) => {
    const route = PAGE_TO_ROUTE[pageId]
    if (route) router.push(route)
  }

  const renderModuleCard = (modulo: { id: PageId; label: string; icon: typeof Beef; color: string; desc: string; permiso: string }) => {
    const hasAccess = hasPermission(modulo.permiso)
    return (
      <Card
        key={modulo.id}
        className={`border-0 shadow-md cursor-pointer transition-all duration-200 ${hasAccess ? 'hover:shadow-lg hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
        onClick={() => hasAccess && navigateTo(modulo.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`${modulo.color} p-3 rounded-lg`}>
              <modulo.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-stone-800">{modulo.label}</p>
              <p className="text-xs text-stone-500">{modulo.desc}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-stone-800">Sistema Frigorífico - Solemar Alimentaria</h1>
          <p className="text-stone-500 mt-1 flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="border-0 shadow-sm bg-amber-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateTo('pesajeCamiones')}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Beef className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-xs text-stone-500">Tropas Activas</p>
                    <p className="text-xl font-bold text-amber-700">{stats.tropasActivas}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateTo('pesajeIndividual')}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-xs text-stone-500">En Pesaje</p>
                    <p className="text-xl font-bold text-emerald-700">{stats.enPesaje}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-blue-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateTo('pesajeCamiones')}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-stone-500">Pesajes Hoy</p>
                    <p className="text-xl font-bold text-blue-700">{stats.pesajesHoy}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-purple-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateTo('stockUnificada')}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-stone-500">En Cámara</p>
                    <p className="text-xl font-bold text-purple-700">{stats.enCamara}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CICLO I Modules */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-3 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            CICLO I - Módulos Principales
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {MODULOS_PRINCIPALES.map(renderModuleCard)}
          </div>
        </div>

        {/* Subproductos y Reportes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-600" />
              Subproductos
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {MODULOS_SUBPRODUCTOS.map(renderModuleCard)}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Reportes
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {MODULOS_REPORTES.map(renderModuleCard)}
            </div>
          </div>
        </div>

        {/* Administración */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-3 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600" />
            Administración
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MODULOS_ADMIN.map(renderModuleCard)}
          </div>
        </div>

        {/* Últimas Tropas */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-stone-50 rounded-t-lg py-3">
            <CardTitle className="text-base font-semibold text-stone-800 flex items-center gap-2">
              <Beef className="w-5 h-5" />
              Últimas Tropas Registradas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tropas.length === 0 ? (
              <div className="p-6 text-center text-stone-400">
                <Beef className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No hay tropas registradas</p>
              </div>
            ) : (
              <div className="divide-y max-h-64 overflow-y-auto">
                {tropas.slice(0, 5).map((tropa) => (
                  <div key={tropa.id} className="p-3 hover:bg-stone-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono font-bold text-stone-800">{tropa.codigo}</p>
                        <p className="text-sm text-stone-500">
                          {tropa.usuarioFaena?.nombre} • {tropa.cantidadCabezas} cabezas • {tropa.especie}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-amber-300 text-amber-600">
                        {tropa.estado}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos Movimientos */}
        <Card className="border-0 shadow-md mt-4">
          <CardHeader className="bg-stone-50 rounded-t-lg py-3">
            <CardTitle className="text-base font-semibold text-stone-800 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Últimos Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {actividadReciente.length === 0 ? (
              <div className="p-6 text-center text-stone-400">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No hay movimientos recientes</p>
              </div>
            ) : (
              <div className="divide-y max-h-64 overflow-y-auto">
                {actividadReciente.slice(0, 10).map((mov) => (
                  <div key={mov.id} className="p-3 hover:bg-stone-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-stone-200 text-stone-500 capitalize">
                        {mov.tipo}
                      </Badge>
                      <span className="text-sm text-stone-700">{mov.descripcion}</span>
                    </div>
                    <span className="text-xs text-stone-400">{new Date(mov.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
