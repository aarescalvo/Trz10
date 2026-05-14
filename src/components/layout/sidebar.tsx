'use client'

import { useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  ChevronDown, ChevronRight, LayoutDashboard,
  PanelLeftClose, PanelLeftOpen, LogOut, Users, Beef,
  Wifi, WifiOff, Loader2, CloudUpload
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { useOfflineStore } from '@/stores/offlineStore'
import { useAppStore } from '@/stores/appStore'
import { NAV_GROUPS, type NavGroup, type NavItem } from '@/lib/navigation'

// ============================================================
// OFFLINE STATUS INDICATOR
// ============================================================

function OfflineStatusIndicator() {
  const isOnline = useOfflineStore((s) => s.isOnline)
  const queue = useOfflineStore((s) => s.queue)
  const isSyncing = useOfflineStore((s) => s.isSyncing)
  const syncAll = useOfflineStore((s) => s.syncAll)
  const pending = queue.filter((q) => !q.synced).length

  if (isOnline && pending === 0) {
    return (
      <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
        <Wifi className="w-3.5 h-3.5" />
        <span>Conectado</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Sin conexión{pending > 0 ? ` · ${pending} pendiente${pending > 1 ? 's' : ''}` : ''}</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => syncAll()}
      className="flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
      disabled={isSyncing}
    >
      {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
      <span>{isSyncing ? 'Sincronizando...' : `${pending} pendiente${pending > 1 ? 's' : ''} · Sincronizar`}</span>
    </button>
  )
}

// ============================================================
// SIDEBAR COMPONENT
// ============================================================

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { operador, logout, hasPermissionOr } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const expandedGroups = useAppStore((s) => s.expandedGroups)
  const setExpandedGroups = useAppStore((s) => s.setExpandedGroups)
  const expandedSubGroups = useAppStore((s) => s.expandedSubGroups)
  const setExpandedSubGroups = useAppStore((s) => s.setExpandedSubGroups)
  const dirtyModules = useAppStore((s) => s.dirtyModules)

  // Navigate with dirty module check
  const navigateTo = (route: string, pageId?: string) => {
    // Check if current module has unsaved changes
    const currentPageId = pathname
    if (pageId && dirtyModules.has(pageId)) {
      const confirmed = window.confirm('Hay cambios sin guardar. ¿Desea salir de todos modos?')
      if (!confirmed) return
    }
    router.push(route)
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  // Toggle group expansion
  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(
      expandedGroups.includes(groupLabel)
        ? expandedGroups.filter(g => g !== groupLabel)
        : [...expandedGroups, groupLabel]
    )
  }

  const toggleSubGroup = (parentLabel: string, subLabel: string) => {
    const key = `${parentLabel}-${subLabel}`
    setExpandedSubGroups(
      expandedSubGroups.includes(key)
        ? expandedSubGroups.filter(g => g !== key)
        : [...expandedSubGroups, key]
    )
  }

  // Filter nav groups by permission — memoizado para evitar recalcular en cada render
  const visibleNavGroups: NavGroup[] = useMemo(() => NAV_GROUPS.map(group => {
    const filteredItems = group.items.filter(item =>
      hasPermissionOr(item.permiso, item.permisoAlt)
    )
    const filteredSubGroups = group.subGroups?.map(subGroup => ({
      ...subGroup,
      items: subGroup.items.filter(item => hasPermissionOr(item.permiso, item.permisoAlt))
    })).filter(subGroup => subGroup.items.length > 0)

    return { ...group, items: filteredItems, subGroups: filteredSubGroups }
  }).filter(group => group.items.length > 0 || (group.subGroups && group.subGroups.length > 0)), [hasPermissionOr])

  if (!operador) return null

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 bg-white border-r flex flex-col shadow-lg transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Collapse Toggle */}
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="h-7 w-7 text-stone-400 hover:text-stone-600"
        >
          {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>
      </div>

      {/* Logo */}
      <div className={`h-28 flex items-center gap-3 px-4 border-b bg-gradient-to-r from-amber-50 to-white ${sidebarCollapsed ? 'justify-center px-2' : ''}`}>
        <div className={`relative flex-shrink-0 ${sidebarCollapsed ? 'w-10 h-10' : 'w-20 h-20'}`}>
          <Image src="/logo.png" alt="Solemar" fill className="object-contain" priority />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col">
            <h1 className="font-bold text-stone-800 text-sm leading-tight">Solemar Alimentaria</h1>
            <p className="text-xs text-amber-600 font-medium">CICLO I</p>
          </div>
        )}
      </div>

      {/* Operator info */}
      <div className={`p-3 border-b bg-stone-50 ${sidebarCollapsed ? 'px-2' : ''}`}>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <Users className="w-4 h-4 text-stone-400 flex-shrink-0" />
            {!sidebarCollapsed && (
              <div>
                <p className="text-sm font-medium text-stone-700">{operador.nombre}</p>
                <p className="text-xs text-stone-400">{operador.rol}</p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-stone-400 hover:text-red-500">
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
        {!sidebarCollapsed && <OfflineStatusIndicator />}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {/* Dashboard / Home button */}
        <button
          onClick={() => navigateTo('/dashboard')}
          title={sidebarCollapsed ? 'Inicio' : undefined}
          className={`
            flex items-center gap-3 rounded-lg w-full text-left transition-all duration-150 mb-2
            ${sidebarCollapsed ? 'px-0 py-3 justify-center' : 'px-4 py-3'}
            ${pathname === '/dashboard'
              ? 'bg-stone-800 text-white font-medium shadow-md'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }
          `}
        >
          <LayoutDashboard className={`w-5 h-5 flex-shrink-0 ${pathname === '/dashboard' ? 'text-white' : 'text-stone-500'}`} />
          {!sidebarCollapsed && <span className="text-sm font-semibold">Inicio</span>}
        </button>

        {visibleNavGroups.map((group) => {
          // Grupo sin label = botón destacado (Pesaje Camiones)
          if (!group.label) {
            const item = group.items[0]
            if (!item) return null
            const isActive = pathname === item.route
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.route, item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`
                  flex items-center gap-3 rounded-lg w-full text-left transition-all duration-150 mb-2
                  ${sidebarCollapsed ? 'px-0 py-3 justify-center' : 'px-4 py-3'}
                  ${isActive
                    ? 'bg-amber-500 text-white font-medium shadow-md'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-amber-600'}`} />
                {!sidebarCollapsed && <span className="text-sm font-semibold">{item.label}</span>}
              </button>
            )
          }

          // Grupos normales
          const isExpanded = expandedGroups.includes(group.label)
          const hasActiveItem = group.items.some(item => pathname === item.route) ||
            (group.subGroups?.some(sg => sg.items.some(item => pathname === item.route)) ?? false)

          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                title={sidebarCollapsed ? group.label : undefined}
                className={`
                  flex items-center justify-between rounded-lg w-full text-left transition-all duration-150
                  ${sidebarCollapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'}
                  ${hasActiveItem ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-50'}
                `}
              >
                <div className="flex items-center gap-2">
                  {group.icon && <group.icon className={`w-4 h-4 flex-shrink-0 ${hasActiveItem ? 'text-amber-600' : ''}`} />}
                  {!sidebarCollapsed && <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>}
                </div>
                {!sidebarCollapsed && (isExpanded
                  ? <ChevronDown className={`w-4 h-4 ${hasActiveItem ? 'text-amber-500' : 'text-stone-400'}`} />
                  : <ChevronRight className={`w-4 h-4 ${hasActiveItem ? 'text-amber-500' : 'text-stone-400'}`} />
                )}
              </button>

              {isExpanded && (
                <div className="ml-2 mt-1 space-y-0.5 border-l-2 border-stone-100 pl-2">
                  {group.items.map((item: NavItem) => {
                    const isActive = pathname === item.route
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateTo(item.route, item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`
                          flex items-center gap-3 rounded-lg transition-all duration-150 w-full text-left
                          ${sidebarCollapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'}
                          ${isActive
                            ? 'bg-amber-100 text-amber-800 font-medium shadow-sm'
                            : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                          }
                        `}
                      >
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-600' : ''}`} />
                        {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                      </button>
                    )
                  })}

                  {/* SubGroups */}
                  {group.subGroups?.map((subGroup) => {
                    const subKey = `${group.label}-${subGroup.label}`
                    const isSubExpanded = expandedSubGroups.includes(subKey)
                    const hasActiveSubItem = subGroup.items.some(item => pathname === item.route)

                    return (
                      <div key={subGroup.label} className="mt-1">
                        <button
                          onClick={() => toggleSubGroup(group.label, subGroup.label)}
                          title={sidebarCollapsed ? subGroup.label : undefined}
                          className={`
                            flex items-center justify-between rounded w-full text-left transition-all duration-150
                            ${sidebarCollapsed ? 'px-0 py-1.5 justify-center' : 'px-3 py-1.5'}
                            ${hasActiveSubItem ? 'text-amber-600' : 'text-stone-500 hover:text-stone-700'}
                          `}
                        >
                          {!sidebarCollapsed && <span className="text-xs font-medium">{subGroup.label}</span>}
                          {!sidebarCollapsed && (isSubExpanded
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />
                          )}
                        </button>

                        {isSubExpanded && (
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-stone-200 pl-2">
                            {subGroup.items.map((item: NavItem) => {
                              const isActive = pathname === item.route
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => navigateTo(item.route, item.id)}
                                  title={sidebarCollapsed ? item.label : undefined}
                                  className={`
                                    flex items-center gap-2 rounded w-full text-left transition-all duration-150
                                    ${sidebarCollapsed ? 'px-0 py-1.5 justify-center' : 'px-2 py-1.5'}
                                    ${isActive
                                      ? 'bg-amber-50 text-amber-700 font-medium'
                                      : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                                    }
                                  `}
                                >
                                  <item.icon className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-amber-500' : ''}`} />
                                  {!sidebarCollapsed && <span className="text-xs">{item.label}</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={`p-4 border-t bg-stone-50 ${sidebarCollapsed ? 'px-2 text-center' : ''}`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'} text-xs text-stone-500`}>
          <Beef className="w-4 h-4 text-amber-500 flex-shrink-0" />
          {!sidebarCollapsed && <span>Frigorífico Solemar Alimentaria</span>}
        </div>
      </div>
    </aside>
  )
}
