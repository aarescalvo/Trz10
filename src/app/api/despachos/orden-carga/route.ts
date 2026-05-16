import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Obtener orden de carga
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const despachoId = searchParams.get('despachoId')

    if (!despachoId) {
      return NextResponse.json(
        { success: false, error: 'ID de despacho requerido' },
        { status: 400 }
      )
    }

    const ordenCarga = await db.ordenCarga.findUnique({
      where: { despachoId },
      include: {
        despacho: {
          include: {
            items: true,
          }
        }
      }
    })

    return NextResponse.json({ success: true, data: ordenCarga })
  } catch (error) {
    console.error('Error fetching orden de carga:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener orden de carga' },
      { status: 500 }
    )
  }
}

// POST - Generar orden de carga
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { despachoId, operadorId } = body

    // Obtener próximo número
    const numerador = await db.numerador.upsert({
      where: { nombre: 'ORDEN_CARGA' },
      update: { ultimoNumero: { increment: 1 } },
      create: { nombre: 'ORDEN_CARGA', ultimoNumero: 1 }
    })

    const anio = new Date().getFullYear()
    const codigo = `ORD-${anio}-${String(numerador.ultimoNumero).padStart(4, '0')}`

    const ordenCarga = await db.ordenCarga.create({
      data: {
        despachoId,
        numero: numerador.ultimoNumero,
        codigo,
        horaPreparacion: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        estado: 'PENDIENTE'
      },
      include: {
        despacho: {
          include: {
            items: true,
          }
        }
      }
    })

    // Actualizar estado del despacho
    await db.despacho.update({
      where: { id: despachoId },
      data: { 
        estado: 'PENDIENTE',
      }
    })

    // Registrar auditoría
    await db.auditoria.create({
      data: {
        operadorId,
        modulo: 'DESPACHO',
        accion: 'CREATE',
        entidad: 'OrdenCarga',
        entidadId: ordenCarga.id,
        descripcion: `Orden de carga ${codigo} generada`
      }
    })

    return NextResponse.json({ success: true, data: ordenCarga })
  } catch (error) {
    console.error('Error creating orden de carga:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear orden de carga' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar orden (firmas, verificaciones)
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, firmaOperario, firmaChofer, tempCargaOK, tempTransporteOK, precintosOK, estado } = body

    const ordenCarga = await db.ordenCarga.update({
      where: { id },
      data: {
        ...(firmaOperario && { firmaOperario }),
        ...(firmaChofer && { firmaChofer }),
        ...(tempCargaOK !== undefined && { tempCargaOK }),
        ...(tempTransporteOK !== undefined && { tempTransporteOK }),
        ...(precintosOK !== undefined && { precintosOK }),
        ...(estado && { estado })
      }
    })

    return NextResponse.json({ success: true, data: ordenCarga })
  } catch (error) {
    console.error('Error updating orden de carga:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar orden de carga' },
      { status: 500 }
    )
  }
}
