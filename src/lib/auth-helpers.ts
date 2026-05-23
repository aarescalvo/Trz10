import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AuthHelpers')

/**
 * Extrae el operadorId únicamente del header x-operador-id.
 * El header es establecido por el middleware después de la validación JWT.
 * NO se usa query param fallback para evitar session hijacking.
 */
export function getOperadorId(request: NextRequest): string | null {
  return request.headers.get('x-operador-id')
}

/**
 * Valida que un operador tenga un permiso específico.
 * ADMINISTRADOR tiene todos los permisos automáticamente.
 * 
 * @param operadorId - ID del operador
 * @param permiso - Nombre del permiso (ej: 'puedeFacturacion')
 * @returns true si tiene permiso, false si no
 */
export async function validarPermiso(operadorId: string | null | undefined, permiso: string): Promise<boolean> {
  if (!operadorId) return false

  type OperadorPermCheck = {
    rol: string
    activo: boolean
    [key: string]: unknown
  }

  const operador = await db.operador.findUnique({
    where: { id: operadorId },
    select: { rol: true, activo: true, [permiso]: true }
  }) as OperadorPermCheck | null

  if (!operador) return false
  if (!operador.activo) return false

  // ADMINISTRADOR tiene todos los permisos
  if (operador.rol === 'ADMINISTRADOR') return true

  // Verificar el permiso específico
  return operador[permiso] === true
}

/**
 * Valida que un operador tenga al menos uno de los permisos indicados (por ID directo).
 * ADMINISTRADOR tiene todos los permisos automáticamente.
 *
 * @param operadorId - ID del operador
 * @param permisos - Lista de permisos, se aprueba si tiene alguno
 * @returns true si tiene al menos uno de los permisos
 */
export async function validarPermisoAny(
  operadorId: string | null | undefined,
  permisos: string[]
): Promise<boolean> {
  if (!operadorId) return false

  // ADMINISTRADOR tiene todos los permisos
  const operador = await db.operador.findUnique({
    where: { id: operadorId },
    select: { rol: true, activo: true }
  })

  if (!operador || !operador.activo) return false
  if (operador.rol === 'ADMINISTRADOR') return true

  for (const permiso of permisos) {
    const has = await validarPermiso(operadorId, permiso)
    if (has) return true
  }

  return false
}

/**
 * Valida que un operador tenga al menos uno de los permisos indicados.
 * ADMINISTRADOR tiene todos los permisos automáticamente.
 * Útil para endpoints compartidos entre múltiples módulos (ej: lectura de balanza).
 *
 * @param request - Request del Next.js
 * @param permisos - Lista de permisos, se aprueba si tiene alguno
 * @returns null si autorizado, o NextResponse de error si no
 */
export async function checkAnyPermission(
  request: NextRequest,
  permisos: string[]
): Promise<NextResponse | null> {
  const operadorId = request.headers.get('x-operador-id')

  if (!operadorId) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  for (const permiso of permisos) {
    const hasPermission = await validarPermiso(operadorId, permiso)
    if (hasPermission) return null
  }

  logger.warn('Permiso denegado (ninguno coincide)', { operadorId, permisos })
  return NextResponse.json(
    { success: false, error: 'Sin permisos suficientes' },
    { status: 403 }
  )
}

/**
 * Valida que un operador tenga permiso de facturación.
 * Si no tiene, devuelve una respuesta de error.
 */
export async function requireFacturacion(operadorId: string | null | undefined): Promise<{ authorized: boolean; error?: Response }> {
  const hasPermission = await validarPermiso(operadorId, 'puedeFacturacion')
  if (!hasPermission) {
    return {
      authorized: false,
      error: new Response(JSON.stringify({ success: false, error: 'Sin permisos de facturación' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  return { authorized: true }
}

/**
 * Extrae el operadorId del request (header o query param) y valida
 * que tenga el permiso requerido. Devuelve null si autorizado,
 * o una NextResponse de error si no.
 * 
 * Uso típico en route handlers:
 *   const authError = await checkPermission(request, 'puedeConfiguracion')
 *   if (authError) return authError
 */
export async function checkPermission(
  request: NextRequest,
  permiso: string
): Promise<NextResponse | null> {
  const operadorId = request.headers.get('x-operador-id')

  if (!operadorId) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  const hasPermission = await validarPermiso(operadorId, permiso)
  if (!hasPermission) {
    logger.warn('Permiso denegado', { operadorId, permiso })
    return NextResponse.json(
      { success: false, error: 'Sin permisos suficientes' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Valida que un operador tenga AL MENOS UNO de los permisos indicados.
 * Útil para endpoints que son accedidos desde múltiples módulos.
 * 
 * @example
 *   const authError = await checkAnyPermission(request, ['puedeMovimientoHacienda', 'puedeCalidad'])
 *   if (authError) return authError
 */
export async function checkAnyPermission(
  request: NextRequest,
  permisos: string[]
): Promise<NextResponse | null> {
  const operadorId = request.headers.get('x-operador-id')

  if (!operadorId) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  for (const permiso of permisos) {
    const hasPermission = await validarPermiso(operadorId, permiso)
    if (hasPermission) return null
  }

  logger.warn('Permiso denegado (ninguno de los requeridos)', { operadorId, permisos })
  return NextResponse.json(
    { success: false, error: 'Sin permisos suficientes' },
    { status: 403 }
  )
}

/**
 * Valida que un operador tenga rol ADMINISTRADOR.
 * Solo los administradores pueden realizar operaciones críticas como:
 * - Crear/eliminar operadores
 * - Ejecutar migraciones y seeds
 * - Modificar configuración del sistema
 * 
 * @param operadorId - ID del operador
 * @returns true si es ADMINISTRADOR, false si no
 */
export async function validarRolAdmin(operadorId: string | null | undefined): Promise<boolean> {
  if (!operadorId) return false

  const operador = await db.operador.findUnique({
    where: { id: operadorId },
    select: { rol: true, activo: true }
  })

  if (!operador) return false
  if (!operador.activo) return false

  return operador.rol === 'ADMINISTRADOR'
}

/**
 * Extrae el operadorId del request y valida que tenga rol ADMINISTRADOR.
 * Devuelve null si es admin, o una NextResponse de error si no.
 * 
 * Uso típico en route handlers:
 *   const adminError = await checkAdminRole(request)
 *   if (adminError) return adminError
 */
export async function checkAdminRole(
  request: NextRequest
): Promise<NextResponse | null> {
  const operadorId = request.headers.get('x-operador-id')

  if (!operadorId) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  const isAdmin = await validarRolAdmin(operadorId)
  if (!isAdmin) {
    logger.warn('Acceso denegado: se requiere rol ADMINISTRADOR', { operadorId })
    return NextResponse.json(
      { success: false, error: 'Se requiere rol ADMINISTRADOR para esta operación' },
      { status: 403 }
    )
  }

  return null
}
