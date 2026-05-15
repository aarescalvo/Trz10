import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// Función para generar código de barras completo (32 dígitos)
function generarCodigoBarras(data: {
  codigoArticulo: string      // 3 dígitos
  codigoEspecie: string       // 1 dígito
  codigoTipificacion: string  // 2 dígitos
  codigoTrabajo: string       // 1 dígito
  codigoTransporte: string    // 1 dígito
  codigoDestino: string       // 2 dígitos
  fechaProduccion: Date       // YYMMDD (6 dígitos)
  loteNumero: number          // 6 dígitos
  unidades: number            // 2 dígitos
  pesoNeto: number            // 5 dígitos (kg * 100)
  numeradorCaja: number       // 4 dígitos
  pesoBruto: number           // 5 dígitos (kg * 100)
}): string {
  const fecha = data.fechaProduccion
  const yy = String(fecha.getFullYear()).slice(-2)
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  const fechaStr = `${yy}${mm}${dd}`

  // Parte fija (10 dígitos)
  const parteFija = 
    data.codigoArticulo.padStart(3, '0') +
    data.codigoEspecie +
    data.codigoTipificacion.padStart(2, '0') +
    data.codigoTrabajo +
    data.codigoTransporte +
    data.codigoDestino.padStart(2, '0')

  // Parte variable (22 dígitos)
  const parteVariable = 
    fechaStr +
    String(data.loteNumero).padStart(6, '0') +
    String(data.unidades).padStart(2, '0') +
    String(Math.round(data.pesoNeto * 100)).padStart(5, '0') +
    String(data.numeradorCaja).padStart(4, '0') +
    String(Math.round(data.pesoBruto * 100)).padStart(5, '0')

  return parteFija + parteVariable
}

// GET - Listar cajas de empaque
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeEmpaque')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const loteId = searchParams.get('loteId')
    const productoId = searchParams.get('productoId')
    const estado = searchParams.get('estado')
    const camaraId = searchParams.get('camaraId')
    const palletId = searchParams.get('palletId')

    const where: any = {}
    if (loteId) where.loteId = loteId
    if (productoId) where.productoId = productoId
    if (estado) where.estado = estado
    // Nota: CajaEmpaque no tiene camaraId directamente; la cámara se accede via Pallet
    if (palletId) where.palletId = palletId

    const cajas = await db.cajaEmpaque.findMany({
      where,
      include: {
        producto: {
          select: { id: true, codigo: true, nombre: true, tara: true }
        },
        lote: {
          select: { id: true, numero: true, estado: true }
        },
        propietario: {
          select: { id: true, nombre: true }
        },
        pallet: {
          select: { id: true, numero: true, estado: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular estadísticas
    const stats = {
      total: cajas.length,
      pesoNetoTotal: cajas.reduce((acc, c) => acc + c.pesoNeto, 0),
      pesoBrutoTotal: cajas.reduce((acc, c) => acc + c.pesoBruto, 0),
      piezasTotal: cajas.reduce((acc, c) => acc + (c.piezas || 0), 0),
      porEstado: {
        enCamara: cajas.filter(c => c.estado === 'EN_CAMARA').length,
        enPallet: cajas.filter(c => c.estado === 'EN_PALLETS').length,
        despachadas: cajas.filter(c => c.estado === 'DESPACHADA').length
      }
    }

    return NextResponse.json({ success: true, data: cajas, stats })
  } catch (error) {
    console.error('Error al obtener cajas:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener cajas' }, { status: 500 })
  }
}

// POST - Crear nueva caja de empaque
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeEmpaque')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      productoId,
      loteId,
      propietarioId,
      unidades,
      pesoNeto
    } = body

    // Obtener producto para los códigos
    const producto = await db.producto.findUnique({
      where: { id: productoId }
    })

    if (!producto) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    // Obtener lote
    const lote = await db.loteDespostada.findUnique({
      where: { id: loteId }
    })

    if (!lote) {
      return NextResponse.json({ success: false, error: 'Lote no encontrado' }, { status: 404 })
    }

    // Calcular tara y peso bruto
    const tara = producto.tara || 0
    const pesoBruto = pesoNeto + (tara * unidades)

    // Obtener códigos del producto
    const codigoArticulo = producto.codigo
    const codigoEspecie = producto.especie === 'BOVINO' ? '1' : '2'
    const codigoTipificacion = producto.codigoTipificacion || '00'
    const codigoTrabajo = producto.codigoTipoTrabajo || '0'
    const codigoTransporte = producto.codigoTransporte || '0'
    const codigoDestino = producto.codigoDestino || '00'

    // Obtener numerador de caja para el día y producto
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const cajasHoy = await db.cajaEmpaque.count({
      where: {
        productoId,
        createdAt: {
          gte: hoy
        }
      }
    })

    const numeradorCaja = cajasHoy + 1

    // Generar código de barras
    const codigoBarras = generarCodigoBarras({
      codigoArticulo,
      codigoEspecie,
      codigoTipificacion,
      codigoTrabajo,
      codigoTransporte,
      codigoDestino,
      fechaProduccion: new Date(),
      loteNumero: lote.numero,
      unidades,
      pesoNeto,
      numeradorCaja,
      pesoBruto
    })

    // Calcular fecha de vencimiento
    const fechaVencimiento = new Date()
    if (producto.diasConservacion) {
      fechaVencimiento.setDate(fechaVencimiento.getDate() + producto.diasConservacion)
    }

    // Generar numero unico para la caja
    const fechaStr = `${String(hoy.getFullYear())}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`
    const numero = `${producto.codigo}-${fechaStr}-${String(numeradorCaja).padStart(4, '0')}`

    // Crear caja
    const caja = await db.cajaEmpaque.create({
      data: {
        codigoBarras: codigoBarras || '0000000000',
        codigoArticulo: '000',
        codigoEspecie: '0',
        codigoTipificacion: '00',
        codigoTrabajo: '0',
        codigoTransporte: '0',
        codigoDestino: '00',
        loteNumero: 1,
        unidades: unidades || 1,
        numeradorCaja: 1,
        numero,
        tara,
        piezas: unidades,
        pesoNeto,
        pesoBruto,
        productoId,
        loteId,
        propietarioId,
        fechaFaena: new Date(),
        fechaVencimiento: producto.diasConservacion ? fechaVencimiento : null,
        estado: 'ARMADA'
      },
      include: {
        producto: {
          select: { id: true, codigo: true, nombre: true }
        },
        lote: {
          select: { id: true, numero: true }
        },
        propietario: {
          select: { id: true, nombre: true }
        }
      }
    })

    // Actualizar total kg del lote
    await db.loteDespostada.update({
      where: { id: loteId },
      data: {
        totalKg: {
          increment: pesoNeto
        }
      }
    })

    return NextResponse.json({ success: true, data: caja })
  } catch (error) {
    console.error('Error al crear caja:', error)
    return NextResponse.json({ success: false, error: 'Error al crear caja' }, { status: 500 })
  }
}

// PUT - Actualizar caja (cambiar estado, asignar a pallet)
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeEmpaque')
  if (authError) return authError
  try {
    const body = await request.json()
    const { id, estado, palletId } = body

    const updateData: any = {}
    if (estado) updateData.estado = estado
    if (palletId !== undefined) updateData.palletId = palletId || null

    const caja = await db.cajaEmpaque.update({
      where: { id },
      data: updateData,
      include: {
        producto: {
          select: { id: true, codigo: true, nombre: true }
        },
        pallet: {
          select: { id: true, numero: true, estado: true }
        }
      }
    })

    // Si se asigna a pallet, actualizar peso del pallet
    if (palletId) {
      const cajasPallet = await db.cajaEmpaque.findMany({
        where: { palletId },
        select: { pesoNeto: true }
      })
      
      await db.pallet.update({
        where: { id: palletId },
        data: {
          cantidadCajas: cajasPallet.length,
          pesoTotal: cajasPallet.reduce((acc, c) => acc + c.pesoNeto, 0)
        }
      })
    }

    return NextResponse.json({ success: true, data: caja })
  } catch (error) {
    console.error('Error al actualizar caja:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar caja' }, { status: 500 })
  }
}

// DELETE - Anular caja
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeEmpaque')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    }

    const caja = await db.cajaEmpaque.findUnique({
      where: { id },
      include: { lote: true }
    })

    if (!caja) {
      return NextResponse.json({ success: false, error: 'Caja no encontrada' }, { status: 404 })
    }

    // Eliminar la caja (EstadoCaja no tiene estado ANULADA)
    const cajaAnulada = await db.cajaEmpaque.delete({
      where: { id }
    })

    // Actualizar total kg del lote (restar)
    if (caja.loteId) {
      await db.loteDespostada.update({
        where: { id: caja.loteId },
        data: {
          totalKg: {
            decrement: caja.pesoNeto
          }
        }
      })
    }

    return NextResponse.json({ success: true, data: cajaAnulada })
  } catch (error) {
    console.error('Error al anular caja:', error)
    return NextResponse.json({ success: false, error: 'Error al anular caja' }, { status: 500 })
  }
}
