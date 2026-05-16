import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validarPermiso } from '@/lib/auth-helpers'

function getOperadorId(request: NextRequest): string | null {
  return request.headers.get('x-operador-id')
}

// GET - Obtener tropas con datos de servicio faena para facturación
export async function GET(request: NextRequest) {
  try {
    const operadorId = getOperadorId(request)
    const puedeVer = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeVer) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }
    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const usuarioId = searchParams.get('usuarioId')
    const estadoPago = searchParams.get('estadoPago')
    const search = searchParams.get('search')
    const soloSinFacturar = searchParams.get('sinFacturar') === 'true'

    // Construir filtros
    const where: any = {
      especie: 'BOVINO',
      estado: { in: ['FAENADO', 'DESPACHADO'] }
    }

    if (desde || hasta) {
      where.fechaFaena = {}
      if (desde) where.fechaFaena.gte = new Date(desde)
      if (hasta) where.fechaFaena.lte = new Date(hasta + 'T23:59:59')
    }

    if (usuarioId) {
      where.usuarioFaenaId = usuarioId
    }

    // Nota: Tropa doesn't have estadoPago or numeroFactura fields.
    // These filters are removed - filtering should be done client-side or via Factura relations.

    const tropas = await db.tropa.findMany({
      where,
      include: {
        usuarioFaena: {
          select: {
            id: true,
            nombre: true,
            cuit: true,
            condicionIva: true,
          }
        },
        tiposAnimales: true,
      },
      orderBy: { fechaFaena: 'desc' }
    })

    // Buscar precios sugeridos desde PrecioServicio
    const tropasConPrecio = await Promise.all(
      tropas.map(async (tropa) => {
        if (tropa.usuarioFaenaId) {
          const precioVigente = await db.precioServicio.findFirst({
            where: {
              clienteId: tropa.usuarioFaenaId,
              tipoServicio: { codigo: 'FAENA' },
              fechaHasta: null,
            },
            orderBy: { fechaDesde: 'desc' }
          })
          return {
            ...tropa,
            precioSugerido: precioVigente?.precio || null,
          }
        }
        return {
          ...tropa,
          precioSugerido: null,
        }
      })
    )

    // Calcular resumen
    const totalCabezas = tropasConPrecio.reduce((sum, t) => sum + t.cantidadCabezas, 0)
    const totalKgPie = tropasConPrecio.reduce((sum, t) => sum + (t.pesoTotalIndividual || 0), 0)
    const totalKgGancho = tropasConPrecio.reduce((sum, t) => sum + (t.kgGancho || 0), 0)
    const totalServicioFaena = tropasConPrecio.reduce((sum, t) => sum + ((t.kgGancho || 0) * (t.precioSugerido || 0)), 0)
    // Nota: montoFactura, montoDepositado, estadoPago, numeroFactura don't exist on Tropa.
    // These would need to be computed from Factura relations.
    const totalFacturado = 0
    const totalPagado = 0
    const pendienteFacturar = tropasConPrecio.length // All tropas shown as pending until facturado
    const pendienteCobrar = 0

    // Resumen por cliente
    const porCliente: Record<string, {
      clienteId: string
      cliente: string
      cuit: string | null
      tropas: number
      cabezas: number
      kgGancho: number
      totalServicio: number
      totalFactura: number
      totalPagado: number
      pendiente: number
    }> = {}

    for (const tropa of tropasConPrecio) {
      const cid = tropa.usuarioFaenaId
      if (!porCliente[cid]) {
        porCliente[cid] = {
          clienteId: cid,
          cliente: tropa.usuarioFaena?.nombre || 'Sin cliente',
          cuit: tropa.usuarioFaena?.cuit || null,
          tropas: 0,
          cabezas: 0,
          kgGancho: 0,
          totalServicio: 0,
          totalFactura: 0,
          totalPagado: 0,
          pendiente: 0,
        }
      }
      porCliente[cid].tropas += 1
      porCliente[cid].cabezas += tropa.cantidadCabezas
      porCliente[cid].kgGancho += tropa.kgGancho || 0
      porCliente[cid].totalServicio += (tropa.kgGancho || 0) * (tropa.precioSugerido || 0)
      // Nota: montoFactura, montoDepositado, estadoPago, numeroFactura don't exist on Tropa.
      porCliente[cid].totalFactura += 0
      porCliente[cid].totalPagado += 0
      porCliente[cid].pendiente += 0
    }

    return NextResponse.json({
      success: true,
      data: {
        tropas: tropasConPrecio,
        resumen: {
          totalTropas: tropasConPrecio.length,
          totalCabezas,
          totalKgPie,
          totalKgGancho,
          rindePromedio: totalKgPie > 0 ? (totalKgGancho / totalKgPie * 100) : 0,
          totalServicioFaena,
          totalFacturado,
          totalPagado,
          pendienteFacturar,
          pendienteCobrar,
        },
        porCliente: Object.values(porCliente),
      }
    })
  } catch (error) {
    console.error('Error fetching servicio faena:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos de servicio faena' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar datos de facturación de una tropa
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { tropaId, operadorId, ...data } = body

    // Validate permissions
    const puedeFacturar = await validarPermiso(operadorId, 'puedeFacturacion')
    if (!puedeFacturar) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos de facturación' },
        { status: 403 }
      )
    }

    if (!tropaId) {
      return NextResponse.json(
        { success: false, error: 'ID de tropa es requerido' },
        { status: 400 }
      )
    }

    // Campos actualizables
    const updateData: any = {}
    const allowedFields = [
      'kgGancho', 'fechaFaena'
    ]

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field.includes('fecha') && data[field]) {
          updateData[field] = new Date(data[field])
        } else {
          updateData[field] = data[field]
        }
      }
    }

    const tropa = await db.tropa.update({
      where: { id: tropaId },
      data: updateData,
      include: {
        usuarioFaena: {
          select: { id: true, nombre: true, cuit: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: tropa
    })
  } catch (error) {
    console.error('Error updating tropa billing:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar datos de facturación' },
      { status: 500 }
    )
  }
}
