import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { EstadoTropa, Especie } from '@prisma/client'

// Estados válidos para referencia
import { checkPermission, checkAnyPermission } from '@/lib/auth-helpers'
const ESTADOS_VALIDOS = Object.values(EstadoTropa)

// API de Tropas - V2: Stock corral, capacidad, DTE/Guía, transacciones

// GET - Fetch all tropas
export async function GET(request: NextRequest) {
  const authError = await checkAnyPermission(request, ['puedeMovimientoHacienda', 'puedeCalidad', 'puedePesajeIndividual', 'puedePesajeCamiones', 'puedeIngresoCajon'])
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const estadoParam = searchParams.get('estado')
    const especie = searchParams.get('especie')
    const busqueda = searchParams.get('busqueda')?.trim()
    
    const where: Record<string, unknown> = {}

    // Búsqueda por texto (código, productor, usuario faena)
    if (busqueda) {
      where.OR = [
        { codigo: { contains: busqueda, mode: 'insensitive' } },
        { codigoSimplificado: { contains: busqueda, mode: 'insensitive' } },
        { productor: { nombre: { contains: busqueda, mode: 'insensitive' } } },
        { productor: { cuit: { contains: busqueda, mode: 'insensitive' } } },
        { usuarioFaena: { nombre: { contains: busqueda, mode: 'insensitive' } } },
        { usuarioFaena: { cuit: { contains: busqueda, mode: 'insensitive' } } },
      ]
    }

    // Manejar estados múltiples separados por coma
    if (estadoParam && estadoParam !== 'todos') {
      const estados = estadoParam
        .split(',')
        .map(e => e.trim().toUpperCase())
        .filter(e => ESTADOS_VALIDOS.includes(e as EstadoTropa))
      
      if (estados.length === 1) {
        where.estado = estados[0]
      } else if (estados.length > 1) {
        where.estado = { in: estados }
      }
    }
    
    if (especie && especie !== 'todos') {
      where.especie = especie.toUpperCase()
    }
    
    const tropas = await db.tropa.findMany({
      where,
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        tiposAnimales: true,
        animales: {
          orderBy: { numero: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return NextResponse.json({
      success: true,
      data: tropas.map(t => ({
        id: t.id,
        numero: t.numero,
        codigo: t.codigo,
        codigoSimplificado: t.codigoSimplificado,
        productor: t.productor,
        usuarioFaena: t.usuarioFaena,
        especie: t.especie,
        cantidadCabezas: t.cantidadCabezas,
        corralId: t.corralId,
        corral: t.corral,
        estado: t.estado,
        fechaRecepcion: t.fechaRecepcion.toISOString(),
        pesoBruto: t.pesoBruto,
        pesoTara: t.pesoTara,
        pesoNeto: t.pesoNeto,
        pesoTotalIndividual: t.pesoTotalIndividual,
        dte: t.dte,
        guia: t.guia,
        observaciones: t.observaciones,
        tiposAnimales: t.tiposAnimales,
        animales: t.animales?.map(a => ({
          id: a.id,
          numero: a.numero,
          codigo: a.codigo,
          tipoAnimal: a.tipoAnimal,
          caravana: a.caravana,
          raza: a.raza,
          pesoVivo: a.pesoVivo,
          estado: a.estado,
          corralId: a.corralId,
          fechaBaja: a.fechaBaja,
          motivoBaja: a.motivoBaja,
          pesoBaja: a.pesoBaja
        }))
      }))
    })
  } catch (error) {
    console.error('Error fetching tropas:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener tropas' },
      { status: 500 }
    )
  }
}

// PUT - Update tropa (with corral stock update, capacity check, DTE validation)
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeMovimientoHacienda')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, estado, cantidadCabezas, corralId, pesoBruto, pesoTara, pesoNeto, pesoTotalIndividual, observaciones, dte, guia, forzarCapacidad } = body

    // === VALIDAR DTE/GUÍA DUPLICADOS si se están actualizando ===
    if (dte !== undefined && dte && dte.trim()) {
      const dteExistente = await db.tropa.findFirst({
        where: { 
          dte: dte.trim(),
          id: { not: id } // Excluir la tropa actual
        }
      })
      if (dteExistente) {
        return NextResponse.json({
          success: false,
          error: `Ya existe otra tropa con DTE "${dte.trim()}" (Tropa: ${dteExistente.codigo}).`
        }, { status: 400 })
      }
    }
    
    if (guia !== undefined && guia && guia.trim()) {
      const guiaExistente = await db.tropa.findFirst({
        where: { 
          guia: guia.trim(),
          id: { not: id }
        }
      })
      if (guiaExistente) {
        return NextResponse.json({
          success: false,
          error: `Ya existe otra tropa con Guía "${guia.trim()}" (Tropa: ${guiaExistente.codigo}).`
        }, { status: 400 })
      }
    }

    // Si se cambia corralId, manejar stock con transacción
    if (corralId !== undefined) {
      // Obtener tropa actual
      const tropaActual = await db.tropa.findUnique({
        where: { id },
        include: { animales: { where: { estado: { not: 'FALLECIDO' } } } }
      })
      
      if (!tropaActual) {
        return NextResponse.json(
          { success: false, error: 'Tropa no encontrada' },
          { status: 404 }
        )
      }
      
      const nuevoCorralId = corralId || null
      const corralAnteriorId = tropaActual.corralId
      const cantidadAnimales = tropaActual.animales.length || tropaActual.cantidadCabezas
      const especie = tropaActual.especie
      const stockField = especie === 'BOVINO' ? 'stockBovinos' : 'stockEquinos'
      let advertenciaCapacidad: string | null = null
      
      // Verificar capacidad del nuevo corral (advertencia, no bloqueante)
      if (nuevoCorralId) {
        const corralDestino = await db.corral.findUnique({
          where: { id: nuevoCorralId }
        })
        
        if (corralDestino) {
          const stockActual = especie === 'BOVINO' ? corralDestino.stockBovinos : corralDestino.stockEquinos
          const disponible = corralDestino.capacidad - stockActual
          
          if (disponible < cantidadAnimales && !forzarCapacidad) {
            return NextResponse.json({
              success: false,
              requiresConfirmation: true,
              error: `Capacidad insuficiente en corral "${corralDestino.nombre}". Disponible: ${disponible}, Se requieren: ${cantidadAnimales}. ¿Desea continuar de todas formas?`,
              capacidadInfo: {
                corral: corralDestino.nombre,
                capacidad: corralDestino.capacidad,
                stockActual,
                disponible,
                cantidadIngresar: cantidadAnimales
              }
            }, { status: 409 })
          }
          
          if (disponible < cantidadAnimales && forzarCapacidad) {
            advertenciaCapacidad = `ATENCIÓN: Se excedió la capacidad del corral "${corralDestino.nombre}" al asignar tropa.`
          }
        }
      }
      
      // Ejecutar actualización con transacción
      const tropa = await db.$transaction(async (tx) => {
        // Decrementar stock del corral anterior
        if (corralAnteriorId) {
          await tx.corral.update({
            where: { id: corralAnteriorId },
            data: { [stockField]: { decrement: cantidadAnimales } }
          })
        }
        
        // Incrementar stock del nuevo corral
        if (nuevoCorralId) {
          await tx.corral.update({
            where: { id: nuevoCorralId },
            data: { [stockField]: { increment: cantidadAnimales } }
          })
        }
        
        // Actualizar tropa
        const updateData: Record<string, unknown> = { corralId: nuevoCorralId }
        if (estado) updateData.estado = estado
        if (cantidadCabezas) updateData.cantidadCabezas = parseInt(cantidadCabezas)
        if (pesoBruto !== undefined) updateData.pesoBruto = parseFloat(pesoBruto) || null
        if (pesoTara !== undefined) updateData.pesoTara = parseFloat(pesoTara) || null
        if (pesoNeto !== undefined) updateData.pesoNeto = parseFloat(pesoNeto) || null
        if (pesoTotalIndividual !== undefined) updateData.pesoTotalIndividual = parseFloat(pesoTotalIndividual) || null
        if (observaciones !== undefined) updateData.observaciones = observaciones
        if (dte !== undefined) updateData.dte = dte
        if (guia !== undefined) updateData.guia = guia
        
        const updated = await tx.tropa.update({
          where: { id },
          data: updateData,
          include: {
            productor: true,
            usuarioFaena: true,
            corral: true,
            tiposAnimales: true
          }
        })
        
        // Actualizar corralId de los animales que no están fallecidos
        await tx.animal.updateMany({
          where: { 
            tropaId: id,
            estado: { not: 'FALLECIDO' }
          },
          data: { corralId: nuevoCorralId }
        })
        
        // Registrar movimiento de corral
        if (nuevoCorralId) {
          await tx.movimientoCorral.create({
            data: {
              corralOrigenId: corralAnteriorId,
              corralDestinoId: nuevoCorralId,
              cantidad: cantidadAnimales,
              especie: especie as Especie,
              tropaId: id,
              observaciones: `Cambio de corral de tropa ${updated.codigo}`
            }
          })
        }
        
        return updated
      })
      
      const response: any = {
        success: true,
        data: {
          id: tropa.id,
          numero: tropa.numero,
          codigo: tropa.codigo,
          productor: tropa.productor,
          usuarioFaena: tropa.usuarioFaena,
          especie: tropa.especie,
          cantidadCabezas: tropa.cantidadCabezas,
          corralId: tropa.corralId,
          corral: tropa.corral,
          estado: tropa.estado,
          tiposAnimales: tropa.tiposAnimales
        }
      }
      
      if (advertenciaCapacidad) {
        response.advertencia = advertenciaCapacidad
      }
      
      return NextResponse.json(response)
    }
    
    // Actualización sin cambio de corral
    const updateData: Record<string, unknown> = {}
    if (estado) updateData.estado = estado
    if (cantidadCabezas) updateData.cantidadCabezas = parseInt(cantidadCabezas)
    if (pesoBruto !== undefined) updateData.pesoBruto = parseFloat(pesoBruto) || null
    if (pesoTara !== undefined) updateData.pesoTara = parseFloat(pesoTara) || null
    if (pesoNeto !== undefined) updateData.pesoNeto = parseFloat(pesoNeto) || null
    if (pesoTotalIndividual !== undefined) updateData.pesoTotalIndividual = parseFloat(pesoTotalIndividual) || null
    if (observaciones !== undefined) updateData.observaciones = observaciones
    if (dte !== undefined) updateData.dte = dte
    if (guia !== undefined) updateData.guia = guia

    const tropa = await db.tropa.update({
      where: { id },
      data: updateData,
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        tiposAnimales: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: tropa.id,
        numero: tropa.numero,
        codigo: tropa.codigo,
        productor: tropa.productor,
        usuarioFaena: tropa.usuarioFaena,
        especie: tropa.especie,
        cantidadCabezas: tropa.cantidadCabezas,
        corralId: tropa.corralId,
        corral: tropa.corral,
        estado: tropa.estado,
        tiposAnimales: tropa.tiposAnimales
      }
    })
  } catch (error) {
    console.error('Error updating tropa:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar tropa' },
      { status: 500 }
    )
  }
}
