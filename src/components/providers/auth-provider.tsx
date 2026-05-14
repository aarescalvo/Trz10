'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react'

// ============================================================
// AUTH PROVIDER — Gestiona sesión del operador
// Valida JWT cookie, refresh periódico, y visibility handler
// ============================================================

interface Operador {
  id: string
  nombre: string
  usuario: string
  rol: string
  nivel?: string
  email?: string
  permisos: {
    puedePesajeCamiones: boolean
    puedePesajeIndividual: boolean
    puedeMovimientoHacienda: boolean
    puedeListaFaena: boolean
    puedeIngresoCajon: boolean
    puedeRomaneo: boolean
    puedeMenudencias: boolean
    puedeStock: boolean
    puedeReportes: boolean
    puedeCCIR: boolean
    puedeFacturacion: boolean
    puedeConfiguracion: boolean
    puedeDesposte: boolean
    puedeCuarteo: boolean
    puedeEmpaque: boolean
    puedeExpedicionC2: boolean
    puedeCalidad: boolean
    puedeAutorizarReportes: boolean
  }
}

interface AuthContextValue {
  operador: Operador | null
  loading: boolean
  login: (body: { usuario?: string; password?: string; pin?: string }) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshSession: () => Promise<boolean>
  hasPermission: (permiso: string | undefined) => boolean
  hasPermissionOr: (permiso: string | undefined, permisoAlt: string | undefined) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Hook para usar dentro de rutas autenticadas — devuelve Operador no-nullable */
export function useOperador(): Operador {
  const { operador, loading } = useAuth()
  if (loading || !operador) return null as unknown as Operador
  return operador
}

export type { Operador }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [operador, setOperador] = useState<Operador | null>(null)
  const [loading, setLoading] = useState(true)

  // Ref para acceder siempre al operador actual sin causar re-renders
  const operadorRef = useRef<Operador | null>(null)

  // Comparación profunda de permisos para evitar re-renders innecesarios
  const permisosKey = useMemo(() => {
    if (!operador) return null
    return JSON.stringify(operador.permisos) + '|' + operador.rol
  }, [operador?.permisos, operador?.rol])

  // Actualizar operador solo si los permisos o rol cambiaron (evita cascada de re-renders)
  const prevPermisosKey = useRef<string | null>(null)
  const updateOperador = useCallback((newOperador: Operador | null) => {
    operadorRef.current = newOperador
    if (!newOperador) {
      prevPermisosKey.current = null
      setOperador(null)
      return
    }
    const newKey = JSON.stringify(newOperador.permisos) + '|' + newOperador.rol
    if (newKey !== prevPermisosKey.current) {
      prevPermisosKey.current = newKey
      setOperador(newOperador)
    }
  }, [])

  // Validar sesión al montar + refresh periódico
  useEffect(() => {
    let refreshInterval: ReturnType<typeof setInterval> | null = null
    let mounted = true

    const validateSession = async () => {
      try {
        const res = await fetch('/api/auth')
        const data = await res.json()
        if (mounted && data.success && data.data) {
          updateOperador(data.data)
        } else if (mounted && res.status === 401) {
          updateOperador(null)
        }
      } catch {
        // Network error - don't logout
      }
      if (mounted) setLoading(false)
    }

    const refreshSessionPeriodic = async () => {
      try {
        const res = await fetch('/api/auth', { method: 'PATCH' })
        if (!mounted) return
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            updateOperador(data.data)
          }
        }
      } catch {
        // Ignore
      }
    }

    validateSession()
    refreshInterval = setInterval(refreshSessionPeriodic, 10 * 60 * 1000)

    return () => {
      mounted = false
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [updateOperador])

  // Re-validar cuando el usuario vuelve a la pestaña
  useEffect(() => {
    let mounted = true

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && operadorRef.current) {
        try {
          const res = await fetch('/api/auth', { method: 'PATCH' })
          if (!mounted) return
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.data) updateOperador(data.data)
          } else if (res.status === 401) {
            // Retry once before forcing logout
            setTimeout(async () => {
              if (!mounted) return
              try {
                const retryRes = await fetch('/api/auth')
                if (!mounted) return
                if (retryRes.status === 401) updateOperador(null)
              } catch { /* keep logged in */ }
            }, 3000)
          }
        } catch { /* keep logged in */ }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, []) // Removido `operador` de dependencias - usa operadorRef

  const login = useCallback(async (body: { usuario?: string; password?: string; pin?: string }) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        // Login siempre fuerza actualización completa
        prevPermisosKey.current = null
        setOperador(data.data)
        return { success: true }
      }
      return { success: false, error: data.error || 'Error de autenticación' }
    } catch {
      return { success: false, error: 'Error de conexión' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
    } catch { /* ignore */ }
    operadorRef.current = null
    prevPermisosKey.current = null
    setOperador(null)
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth', { method: 'PATCH' })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          updateOperador(data.data)
          return true
        }
      }
    } catch { /* ignore */ }
    return false
  }, [updateOperador])

  // Permisos estables: usan ref para no depender de `operador` en el array de dependencias
  const hasPermission = useCallback((permiso: string | undefined): boolean => {
    if (!permiso) return true
    const op = operadorRef.current
    if (op?.rol === 'ADMINISTRADOR') return true
    return op?.permisos[permiso as keyof typeof op.permisos] === true
  }, []) // Sin dependencias - función estable, lee del ref

  const hasPermissionOr = useCallback((permiso: string | undefined, permisoAlt: string | undefined): boolean => {
    const op = operadorRef.current
    if (op?.rol === 'ADMINISTRADOR') return true
    if (!permiso && !permisoAlt) return true
    return (permiso ? op?.permisos[permiso as keyof typeof op.permisos] === true : false) ||
           (permisoAlt ? op?.permisos[permisoAlt as keyof typeof op.permisos] === true : false)
  }, []) // Sin dependencias - función estable

  const contextValue = useMemo(() => ({
    operador,
    loading,
    login,
    logout,
    refreshSession,
    hasPermission,
    hasPermissionOr
  }), [operador, loading, login, logout, refreshSession, hasPermission, hasPermissionOr])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}
