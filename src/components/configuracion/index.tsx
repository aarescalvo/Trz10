'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { Settings, Building2, Warehouse, UserCheck, Package, Users, Truck, Beef, DollarSign, Receipt, Search, X, Shield, Server } from 'lucide-react'
import { ConfigFrigorifico } from './config-frigorifico'
import { Corrales } from './corrales'
import { Camaras } from './camaras'
import { Tipificadores } from './tipificadores'
import { Productos } from './productos'
import { Operadores } from './operadores'
import { Transportistas } from './transportistas'
import { Clientes } from './clientes'
import { TiposServicioConfig } from './tipos-servicio'
import { PreciosServicioConfig } from './precios-servicio'
import { AdminSistemaModule } from './admin-sistema'
import { ConfigSistema } from './config-sistema'
import { AuditoriaConfig } from './auditoria'

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function ConfiguracionModule({ operador }: { operador: Operador }) {
  const [busquedaConfig, setBusquedaConfig] = useState('')
  const [activeTab, setActiveTab] = useState('frigorifico')
  const [commandOpen, setCommandOpen] = useState(false)

  const configItems = [
    { id: 'frigorifico', label: 'Frigorífico', tab: 'frigorifico', icon: Building2, group: 'General' },
    { id: 'corrales', label: 'Corrales', tab: 'corrales', icon: Warehouse, group: 'Instalaciones' },
    { id: 'camaras', label: 'Cámaras', tab: 'camaras', icon: Warehouse, group: 'Instalaciones' },
    { id: 'tipificadores', label: 'Tipificadores', tab: 'tipificadores', icon: UserCheck, group: 'Producción' },
    { id: 'productos', label: 'Productos', tab: 'productos', icon: Package, group: 'Producción' },
    { id: 'clientes', label: 'Clientes', tab: 'clientes', icon: Beef, group: 'Comercial' },
    { id: 'tiposServicio', label: 'Tipos de Servicio', tab: 'tiposServicio', icon: Receipt, group: 'Comercial' },
    { id: 'preciosServicio', label: 'Precios de Servicio', tab: 'preciosServicio', icon: DollarSign, group: 'Comercial' },
    { id: 'transportistas', label: 'Transportistas', tab: 'transportistas', icon: Truck, group: 'Logística' },
    { id: 'operadores', label: 'Operadores', tab: 'operadores', icon: Users, group: 'Sistema' },
    { id: 'adminSistema', label: 'Admin. Sistema', tab: 'adminSistema', icon: Server, group: 'Sistema' },
    { id: 'configSistema', label: 'Config. Sistema', tab: 'configSistema', icon: Settings, group: 'Sistema' },
    { id: 'auditoria', label: 'Auditoría', tab: 'auditoria', icon: Shield, group: 'Sistema' },
  ]

  const filteredTabs = busquedaConfig
    ? configItems.filter(item =>
        item.label.toLowerCase().includes(busquedaConfig.toLowerCase()) ||
        item.id.toLowerCase().includes(busquedaConfig.toLowerCase())
      )
    : configItems

  // Ctrl+K keyboard shortcut to open command palette
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setCommandOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSelectSearch = (tabValue: string) => {
    setActiveTab(tabValue)
    setBusquedaConfig('')
  }

  const handleCommandSelect = (tabValue: string) => {
    setActiveTab(tabValue)
    setCommandOpen(false)
    setBusquedaConfig('')
  }

  // Group config items for command palette
  const groupedItems = configItems.reduce<Record<string, typeof configItems>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800">Configuración</h1>
            <p className="text-stone-500">Gestión del sistema Solemar Alimentaria</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-stone-500 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:border-stone-300 transition-colors shadow-sm"
            >
              <Search className="w-4 h-4" />
              <span className="hidden md:inline">Buscar...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-stone-400 bg-stone-100 border border-stone-200 rounded">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>
        </div>

        {/* Command Palette Dialog */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Buscar sección de configuración..." />
          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center">
                <Settings className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p>No se encontraron secciones para &ldquo;{busquedaConfig}&rdquo;</p>
              </div>
            </CommandEmpty>
            {Object.entries(groupedItems).map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.id} ${item.group}`}
                      onSelect={() => handleCommandSelect(item.tab)}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-stone-100 shrink-0">
                        <Icon className="w-4 h-4 text-stone-600" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium">{item.label}</span>
                        <p className="text-xs text-stone-400">{item.group}</p>
                      </div>
                      <CommandShortcut>
                        <span className="text-[10px]">{item.id}</span>
                      </CommandShortcut>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandDialog>

        {/* Inline search bar (fallback) */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              id="config-search"
              placeholder="Buscar configuración... (Ctrl+K para paleta)"
              value={busquedaConfig}
              onChange={(e) => setBusquedaConfig(e.target.value)}
              className="pl-10 pr-10"
              onFocus={() => setCommandOpen(true)}
              readOnly
            />
          </div>
        </div>

        {/* Search results dropdown */}
        {busquedaConfig && (
          <div className="mb-4 bg-white border border-stone-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {filteredTabs.length > 0 ? (
              filteredTabs.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSearch(item.tab)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0"
                  >
                    <Icon className="w-4 h-4 text-stone-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-stone-700">{item.label}</span>
                  </button>
                )
              })
            ) : (
              <div className="px-4 py-6 text-center text-stone-400 text-sm">
                No se encontraron configuraciones para &ldquo;{busquedaConfig}&rdquo;
              </div>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full gap-1 h-auto">
            {configItems.map((item) => {
              const Icon = item.icon
              // Hide tab if search is active and item not in filtered results
              if (busquedaConfig && !filteredTabs.find(f => f.id === item.id)) return null
              return (
                <TabsTrigger key={item.id} value={item.tab} className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-2 justify-center">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline truncate">{item.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="frigorifico">
            <ConfigFrigorifico operador={operador} />
          </TabsContent>
          <TabsContent value="corrales">
            <Corrales operador={operador} />
          </TabsContent>
          <TabsContent value="camaras">
            <Camaras operador={operador} />
          </TabsContent>
          <TabsContent value="tipificadores">
            <Tipificadores operador={operador} />
          </TabsContent>
          <TabsContent value="productos">
            <Productos operador={operador} />
          </TabsContent>
          <TabsContent value="clientes">
            <Clientes operador={operador} />
          </TabsContent>
          <TabsContent value="tiposServicio">
            <TiposServicioConfig operador={{ ...operador, rol: ('rol' in operador ? operador.rol : 'ADMINISTRADOR') as string } } />
          </TabsContent>
          <TabsContent value="preciosServicio">
            <PreciosServicioConfig operador={{ ...operador, rol: ('rol' in operador ? operador.rol : 'ADMINISTRADOR') as string } } />
          </TabsContent>
          <TabsContent value="transportistas">
            <Transportistas operador={operador} />
          </TabsContent>
          <TabsContent value="operadores">
            <Operadores operador={operador} />
          </TabsContent>
          <TabsContent value="adminSistema">
            <AdminSistemaModule operador={{ ...operador, rol: ('rol' in operador ? operador.rol : 'ADMINISTRADOR') as string, permisos: ('permisos' in operador ? operador.permisos : { puedeConfiguracion: true }) } as any} />
          </TabsContent>
          <TabsContent value="configSistema">
            <ConfigSistema operador={{ ...operador, rol: ('rol' in operador ? operador.rol : 'ADMINISTRADOR') as string } as any} />
          </TabsContent>
          <TabsContent value="auditoria">
            <AuditoriaConfig operador={{ ...operador, rol: ('rol' in operador ? operador.rol : 'ADMINISTRADOR') as string, permisos: ('permisos' in operador ? operador.permisos : { puedeConfiguracion: true }) } as any} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ConfiguracionModule
