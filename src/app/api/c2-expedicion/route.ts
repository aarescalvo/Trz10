import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Listar órdenes de expedición C2
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeExpedicionC2')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const clienteId = searchParams.get('clienteId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (estado) where.estado = estado
    if (clienteId) where.clienteId = clienteId

    const ordenes = await db.c2ExpedicionOrden.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, cuit: true, direccion: true } },
        operador: { select: { id: true, nombre: true } },
        items: {
          include: {
            caja: {
              select: {
                id: true,
                numero: true,
                pesoNeto: true,
                pesoBruto: true,
                tropaCodigo: true,
                fechaFaena: true,
                estado: true,
                productoDesposte: { select: { nombre: true, codigo: true, rubro: { select: { nombre: true } } } }
              }
            }
          }
        }
      },
      orderBy: { fecha: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: ordenes
    })
  } catch (error) {
    console.error('Error fetching expediciones:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener expediciones' },
      { status: 500 }
    )
  }
}

// POST - Crear orden de expedición C2
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeExpedicionC2')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      clienteId,
      transporteNombre,
      patenteCamion,
      choferNombre,
      choferDni,
      nroRemito,
      cajaIds,
      operadorId,
      observaciones
    } = body

    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'Cliente es requerido' },
        { status: 400 }
      )
    }

    if (!cajaIds || !Array.isArray(cajaIds) || cajaIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe seleccionar al menos una caja' },
        { status: 400 }
      )
    }

    // Verificar que las cajas existen y están disponibles
    const cajas = await db.cajaEmpaque.findMany({
      where: {
        id: { in: cajaIds },
        estado: { in: ['ARMADA', 'EN_PALLETS', 'EN_CAMARA'] }
      },
      include: {
        productoDesposte: { select: { nombre: true, codigo: true } }
      }
    })

    if (cajas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron cajas disponibles para despacho' },
        { status: 400 }
      )
    }

    // Validación FIFO: verificar si hay cajas del mismo producto con fecha de faena más antigua
    const fifoAlerts: { producto: string; cajaActual: string; cajasAnteriores: string[] }[] = []
    
    for (const caja of cajas) {
      if (caja.fechaFaena && caja.productoDesposteId) {
        const cajasAnteriores = await db.cajaEmpaque.findMany({
          where: {
            productoDesposteId: caja.productoDesposteId,
            estado: { in: ['ARMADA', 'EN_PALLETS', 'EN_CAMARA'] },
            id: { notIn: cajaIds },
            fechaFaena: { lt: caja.fechaFaena! }
          },
          select: { numero: true, fechaFaena: true },
          take: 3
        })

        if (cajasAnteriores.length > 0) {
          fifoAlerts.push({
            producto: caja.productoDesposte?.nombre || 'Desconocido',
            cajaActual: caja.numero || 'S/N',
            cajasAnteriores: cajasAnteriores.map(c => c.numero || 'S/N')
          })
        }
      }
    }

    // Generar número correlativo
    const ultimaOrden = await db.c2ExpedicionOrden.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true }
    })

    const numero = (ultimaOrden?.numero || 0) + 1

    // Calcular totales
    const cantidadCajas = cajas.length
    const pesoTotal = cajas.reduce((sum, c) => sum + c.pesoNeto, 0)

    // Crear la orden de expedición
    const orden = await db.c2ExpedicionOrden.create({
      data: {
        numero,
        clienteId,
        transporteNombre: transporteNombre || null,
        patenteCamion: patenteCamion || null,
        choferNombre: choferNombre || null,
        choferDni: choferDni || null,
        nroRemito: nroRemito || null,
        estado: 'PENDIENTE',
        cantidadCajas,
        pesoTotal,
        operadorId: operadorId || null,
        observaciones: observaciones || null
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        operador: { select: { nombre: true } }
      }
    })

    // Crear items y actualizar estado de cajas
    for (const caja of cajas) {
      await db.c2ExpedicionItem.create({
        data: {
          ordenId: orden.id,
          cajaId: caja.id,
          palletId: caja.palletId || null
        }
      })

      await db.cajaEmpaque.update({
        where: { id: caja.id },
        data: { estado: 'DESPACHADA' }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...orden,
        items: cajas.length
      },
      fifoAlerts: fifoAlerts.length > 0 ? fifoAlerts : undefined,
      message: `Orden de expedición #${numero} creada - ${cantidadCajas} cajas, ${pesoTotal.toFixed(1)} kg`
    })
  } catch (error) {
    console.error('Error creating expedición:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear orden de expedición' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar orden (cambiar estado, confirmar despacho)
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeExpedicionC2')
  if (authError) return authError
  try {
    const body = await request.json()
    const { id, estado, ...data } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const updateData: any = { updatedAt: new Date() }
    if (estado) {
      updateData.estado = estado
      if (estado === 'DESPACHADO') {
        updateData.fechaDespacho = new Date()
      }
    }
    if (data.transporteNombre !== undefined) updateData.transporteNombre = data.transporteNombre
    if (data.patenteCamion !== undefined) updateData.patenteCamion = data.patenteCamion
    if (data.choferNombre !== undefined) updateData.choferNombre = data.choferNombre
    if (data.nroRemito !== undefined) updateData.nroRemito = data.nroRemito
    if (data.observaciones !== undefined) updateData.observaciones = data.observaciones

    const orden = await db.c2ExpedicionOrden.update({
      where: { id },
      data: updateData,
      include: {
        cliente: { select: { nombre: true } },
        operador: { select: { nombre: true } }
      }
    })

    // Si se anula, devolver cajas a su estado anterior
    if (estado === 'ANULADO') {
      const items = await db.c2ExpedicionItem.findMany({
        where: { ordenId: id }
      })

      for (const item of items) {
        await db.cajaEmpaque.update({
          where: { id: item.cajaId },
          data: { 
            estado: 'ARMADA',
            palletId: null  // Liberar caja del pallet
          }
        })
      }
    }

    return NextResponse.json({ success: true, data: orden })
  } catch (error) {
    console.error('Error updating expedición:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar expedición' },
      { status: 500 }
    )
  }
}
