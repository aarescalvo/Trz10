'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AppSidebar } from '@/components/layout/sidebar'
import { useAuth } from '@/components/providers/auth-provider'
import { ROUTE_TO_PAGE, NAV_GROUPS } from '@/lib/navigation'

// ============================================================
// (app) LAYOUT — Layout protegido con sidebar
// Verifica autenticación y permisos antes de renderizar children
// ============================================================

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { operador, loading, hasPermissionOr } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Redirigir a login si no hay sesión
  useEffect(() => {
    if (!loading && !operador) {
      router.push('/login')
    }
  }, [loading, operador, router])

  // Escuchar evento de production-mode-change desde módulos hijos
  useEffect(() => {
    const handleProductionMode = (e: CustomEvent) => {
      setSidebarCollapsed(e.detail.active)
    }
    window.addEventListener('production-mode-change', handleProductionMode as EventListener)
    return () => window.removeEventListener('production-mode-change', handleProductionMode as EventListener)
  }, [])

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  // No autenticado
  if (!operador) return null

  // Verificar permisos para la ruta actual
  const pageId = ROUTE_TO_PAGE[pathname]
  let hasAccess = true
  if (pageId) {
    for (const group of NAV_GROUPS) {
      const item = group.items.find(n => n.id === pageId)
      if (item) {
        hasAccess = hasPermissionOr(item.permiso, item.permisoAlt)
        break
      }
      if (group.subGroups) {
        for (const sg of group.subGroups) {
          const subItem = sg.items.find(n => n.id === pageId)
          if (subItem) {
            hasAccess = hasPermissionOr(subItem.permiso, subItem.permisoAlt)
            break
          }
        }
      }
      if (!hasAccess) break
    }
    // Special pages always accessible
    if (pageId === 'dashboard' || pageId === 'configuracion') hasAccess = true
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-stone-100">
        <AppSidebar />
        <main className="ml-64 min-h-screen flex items-center justify-center">
          <Card className="border-0 shadow-md max-w-md">
            <CardContent className="p-8 text-center">
              <Lock className="w-12 h-12 mx-auto mb-4 text-red-400" />
              <p className="text-lg font-medium text-stone-800">Acceso Denegado</p>
              <p className="text-sm text-stone-500 mt-2">No tiene permisos para acceder a este módulo</p>
              <Button className="mt-4" onClick={() => router.push('/dashboard')}>
                Volver al Inicio
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-100 flex">
      <AppSidebar />
      <main className={`flex-1 min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  )
}
