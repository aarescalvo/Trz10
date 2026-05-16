import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
const log = createLogger('app.api.vb-romaneo.route')

// GET - Obtener datos según el tipo solicitado
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || 'pendientes'
    const fecha = searchParams.get('fecha')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    switch (tipo) {
      case 'pendientes':
        return await getPendientesAsignacion(fecha)
      case 'revision':
        return await getTablaRevision(fecha)
      case 'fechas':
        return await getFechasFaena(fechaDesde, fechaHasta)
      default:
        return NextResponse.json({ success: false, error: 'Tipo no válido' }, { status: 400 })
    }
  } catch (error) {
    console.error('[VB Romaneo API] Error:', error)
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 })
  }
}

// Obtener garrones y animales sin asignar
async function getPendientesAsignacion(fecha?: string | null) {
  const fechaFiltro = fecha ? new Date(fecha) : new Date()
  fechaFiltro.setHours(0, 0, 0, 0)
  const fechaFin = new Date(fechaFiltro)
  fechaFin.setHours(23, 59, 59, 999)

  // Buscar listas de faena del día sin VB
  // TODO: Consider adding a filter for ListaFaena that are ABIERTA or EN_PROCESO
  const listasFaena = await db.listaFaena.findMany({
    where: {
      fecha: { gte: fechaFiltro, lte: fechaFin },
    },
    include: {
      tropas: {
        include: {
          tropa: {
            include: {
              animales: {
                where: { estado: 'RECIBIDO' },
                orderBy: { numero: 'asc' }
              }
            }
          }
        }
      },
      asignaciones: {
        orderBy: { garron: 'asc' }
      }
    }
  })

  // Obtener IDs de animales ya asignados
  const animalesAsignadosIds = new Set<string>()
  listasFaena.forEach(lista => {
    lista.asignaciones.forEach(asig => {
      if (asig.animalId) animalesAsignadosIds.add(asig.animalId)
    })
  })

  // Garrones sin asignar (animalId es null)
  const garronesSinAsignar: Array<{
    id: string
    garron: number
    tropaCodigo: string | null
    kgMediaDer: number | null
    kgMediaIzq: number | null
    listaFaenaId: string
  }> = []

  // Animales sin asignar por tropa
  const animalesSinAsignar: Array<{
    id: string
    numero: number
    tropaId: string
    tropaCodigo: string
    kgIngreso: number | null
    tipoAnimal: string | null
  }> = []

  for (const lista of listasFaena) {
    // Garrones sin asignar de esta lista
    for (const asig of lista.asignaciones) {
      if (!asig.animalId) {
        // Buscar romaneo para obtener pesos de medias
        const romaneo = await db.romaneo.findFirst({
          where: { garron: asig.garron }
        })
        
        garronesSinAsignar.push({
          id: asig.id,
          garron: asig.garron,
          tropaCodigo: asig.tropaCodigo,
          kgMediaDer: romaneo?.pesoMediaDer || null,
          kgMediaIzq: romaneo?.pesoMediaIzq || null,
          listaFaenaId: lista.id
        })
      }
    }

    // Animales sin asignar de las tropas de esta lista
    for (const tropaLista of lista.tropas) {
      for (const animal of tropaLista.tropa.animales) {
        if (!animalesAsignadosIds.has(animal.id)) {
          animalesSinAsignar.push({
            id: animal.id,
            numero: animal.numero,
            tropaId: animal.tropaId,
            tropaCodigo: tropaLista.tropa.codigo,
            kgIngreso: animal.pesoVivo,
            tipoAnimal: animal.tipoAnimal
          })
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      garronesSinAsignar,
      animalesSinAsignar,
      totalGarrones: garronesSinAsignar.length,
      totalAnimales: animalesSinAsignar.length
    }
  })
}

// Obtener tabla de revisión
async function getTablaRevision(fecha?: string | null) {
  const fechaFiltro = fecha ? new Date(fecha) : new Date()
  fechaFiltro.setHours(0, 0, 0, 0)
  const fechaFin = new Date(fechaFiltro)
  fechaFin.setHours(23, 59, 59, 999)

  // Buscar romaneos del día
  const romaneos = await db.romaneo.findMany({
    where: {
      fecha: { gte: fechaFiltro, lte: fechaFin }
    },
    orderBy: { garron: 'asc' }
  })

  // Obtener asignaciones para datos adicionales
  const garrones = romaneos.map(r => r.garron)
  const asignaciones = await db.asignacionGarron.findMany({
    where: {
      garron: { in: garrones }
    }
  })

  const asignacionesMap = new Map(asignaciones.map(a => [a.garron, a]))

  const tabla = romaneos.map(r => {
    const asig = asignacionesMap.get(r.garron)
    const pesoTotal = (r.pesoMediaDer || 0) + (r.pesoMediaIzq || 0)
    const rinde = r.pesoVivo && r.pesoVivo > 0 ? (pesoTotal / r.pesoVivo) * 100 : null

    return {
      id: r.id,
      garron: r.garron,
      numeroAnimal: r.numeroAnimal || asig?.animalNumero,
      tropaCodigo: r.tropaCodigo,
      denticion: r.denticion,
      tipoAnimal: r.tipoAnimal || asig?.tipoAnimal,
      kgIngreso: r.pesoVivo || asig?.pesoVivo,
      kgMediaDer: r.pesoMediaDer,
      kgMediaIzq: r.pesoMediaIzq,
      kgTotal: pesoTotal,
      rinde: rinde,
      rindeAlto: rinde !== null && rinde > 70,
      animalId: asig?.animalId,
      listaFaenaId: asig?.listaFaenaId
    }
  })

  return NextResponse.json({
    success: true,
    data: tabla
  })
}

// Obtener fechas de faena
async function getFechasFaena(fechaDesde?: string | null, fechaHasta?: string | null) {
  const where: Record<string, unknown> = {}

  if (fechaDesde || fechaHasta) {
    const fechaFilter: Record<string, Date> = {}
    if (fechaDesde) {
      fechaFilter.gte = new Date(fechaDesde)
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      fechaFilter.lte = hasta
    }
    where.fecha = fechaFilter
  }

  const listasFaena = await db.listaFaena.findMany({
    where,
    include: {
      tropas: {
        include: {
          tropa: { select: { codigo: true, especie: true } }
        }
      },
      supervisor: {
        select: { nombre: true }
      }
    },
    orderBy: { fecha: 'desc' },
    take: 100
  })

  // Agrupar por fecha
  const fechasMap = new Map<string, {
    fecha: Date
    listas: Array<{
      id: string
      numero: number
      cantidadTotal: number
      estado: string
      supervisor: string | null
      tropas: Array<{ codigo: string; especie: string }>
    }>
  }>()

  for (const lista of listasFaena) {
    const fechaKey = lista.fecha.toISOString().split('T')[0]
    if (!fechasMap.has(fechaKey)) {
      fechasMap.set(fechaKey, {
        fecha: lista.fecha,
        listas: []
      })
    }
    
    fechasMap.get(fechaKey)!.listas.push({
      id: lista.id,
      numero: lista.numero,
      cantidadTotal: lista.cantidadTotal,
      estado: lista.estado,
      supervisor: lista.supervisor?.nombre || null,
      tropas: lista.tropas.map(t => ({ codigo: t.tropa.codigo, especie: t.tropa.especie }))
    })
  }

  const fechas = Array.from(fechasMap.values()).map(f => ({
    fecha: f.fecha,
    fechaStr: f.fecha.toLocaleDateString('es-AR'),
    totalAnimales: f.listas.reduce((sum, l) => sum + l.cantidadTotal, 0),
    todasCerradas: f.listas.every(l => l.estado === 'CERRADA'),
    supervisor: f.listas[0]?.supervisor,
    listas: f.listas,
    listaIds: f.listas.map(l => l.id)
  }))

  return NextResponse.json({
    success: true,
    data: fechas
  })
}

// POST - Acciones
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const body = await request.json()
    const { accion, ...data } = body

    switch (accion) {
      case 'asignar':
        return await asignarGarron(data)
      case 'intercambiar':
        return await intercambiarGarrones(data)
      case 'vb':
        return await darVistoBueno(data)
      case 'quitarVb':
        return await quitarVistoBueno(data)
      default:
        return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
    }
  } catch (error) {
    console.error('[VB Romaneo API] Error:', error)
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 })
  }
}

// Asignar garrón a animal
async function asignarGarron(data: { garronId: string; animalId: string; operadorId?: string }) {
  const { garronId, animalId, operadorId } = data

  // Verificar que el garrón existe
  const garron = await db.asignacionGarron.findUnique({
    where: { id: garronId }
  })

  if (!garron) {
    return NextResponse.json({ success: false, error: 'Garrón no encontrado' }, { status: 404 })
  }

  if (garron.animalId) {
    return NextResponse.json({ success: false, error: 'El garrón ya tiene un animal asignado' }, { status: 400 })
  }

  // Verificar que el animal existe
  const animal = await db.animal.findUnique({
    where: { id: animalId },
    include: { tropa: true }
  })

  if (!animal) {
    return NextResponse.json({ success: false, error: 'Animal no encontrado' }, { status: 404 })
  }

  // Verificar que el animal no esté ya asignado
  const yaAsignado = await db.asignacionGarron.findFirst({
    where: { animalId }
  })

  if (yaAsignado) {
    return NextResponse.json({ success: false, error: 'El animal ya está asignado a otro garrón' }, { status: 400 })
  }

  // Actualizar asignación
  const actualizado = await db.asignacionGarron.update({
    where: { id: garronId },
    data: {
      animalId,
      tropaCodigo: animal.tropa.codigo,
      animalNumero: animal.numero,
      tipoAnimal: animal.tipoAnimal,
      pesoVivo: animal.pesoVivo,
      operadorId
    }
  })

  // Actualizar romaneo si existe
  await db.romaneo.updateMany({
    where: { garron: garron.garron },
    data: {
      numeroAnimal: animal.numero,
      tropaCodigo: animal.tropa.codigo,
      tipoAnimal: animal.tipoAnimal,
      pesoVivo: animal.pesoVivo
    }
  })

  return NextResponse.json({ success: true, data: actualizado })
}

// Intercambiar datos entre dos garrones
async function intercambiarGarrones(data: { 
  garron1: number
  garron2: number
}) {
  const { garron1, garron2 } = data

  log.info('[VB Romaneo] Intercambiando garrones:', { garron1, garron2 } as Record<string, unknown>)

  if (garron1 === garron2) {
    return NextResponse.json({ success: false, error: 'Los garrones deben ser diferentes' }, { status: 400 })
  }

  try {
    // Obtener romaneos
    const romaneo1 = await db.romaneo.findFirst({
      where: { garron: garron1 }
    })
    const romaneo2 = await db.romaneo.findFirst({
      where: { garron: garron2 }
    })

    log.info('[VB Romaneo] Romaneos encontrados:', { 
      romaneo1: romaneo1 ? { id: romaneo1.id, garron: romaneo1.garron, tropa: romaneo1.tropaCodigo } : null,
      romaneo2: romaneo2 ? { id: romaneo2.id, garron: romaneo2.garron, tropa: romaneo2.tropaCodigo } : null
    } as Record<string, unknown>)

    if (!romaneo1 || !romaneo2) {
      return NextResponse.json({ success: false, error: 'Uno o ambos garrones no tienen romaneo' }, { status: 404 })
    }

    // Verificar que sean de la misma tropa (ambos deben tener tropa y ser iguales)
    // Si uno tiene tropa y el otro no, no se pueden intercambiar
    const tropa1 = romaneo1.tropaCodigo
    const tropa2 = romaneo2.tropaCodigo
    
    if (tropa1 !== tropa2) {
      return NextResponse.json({ 
        success: false, 
        error: `Solo se pueden intercambiar garrones de la misma tropa. Tropa ${garron1}: ${tropa1 || 'sin asignar'}, Tropa ${garron2}: ${tropa2 || 'sin asignar'}` 
      }, { status: 400 })
    }

    // Intercambiar en transacción
    await db.$transaction(async (tx) => {
      // Guardar datos del romaneo 1
      const datos1 = {
        numeroAnimal: romaneo1.numeroAnimal,
        tipoAnimal: romaneo1.tipoAnimal,
        pesoVivo: romaneo1.pesoVivo,
        tropaCodigo: romaneo1.tropaCodigo
      }

      // Guardar datos del romaneo 2
      const datos2 = {
        numeroAnimal: romaneo2.numeroAnimal,
        tipoAnimal: romaneo2.tipoAnimal,
        pesoVivo: romaneo2.pesoVivo,
        tropaCodigo: romaneo2.tropaCodigo
      }

      log.info('[VB Romaneo] Intercambiando datos:', { datos1, datos2 } as Record<string, unknown>)

      // Actualizar romaneo 1 con datos del 2
      await tx.romaneo.update({
        where: { id: romaneo1.id },
        data: datos2
      })

      // Actualizar romaneo 2 con datos del 1
      await tx.romaneo.update({
        where: { id: romaneo2.id },
        data: datos1
      })

      // También actualizar asignaciones si existen
      const asig1 = await tx.asignacionGarron.findFirst({
        where: { garron: garron1 }
      })
      const asig2 = await tx.asignacionGarron.findFirst({
        where: { garron: garron2 }
      })

      log.info('[VB Romaneo] Asignaciones encontradas:', { asig1: !!asig1, asig2: !!asig2 } as Record<string, unknown>)

      if (asig1 && asig2) {
        // Guardar datos completos para el intercambio
        const asigDatos1 = {
          animalId: asig1.animalId,
          animalNumero: asig1.animalNumero,
          tipoAnimal: asig1.tipoAnimal,
          pesoVivo: asig1.pesoVivo,
          tropaCodigo: asig1.tropaCodigo
        }
        const asigDatos2 = {
          animalId: asig2.animalId,
          animalNumero: asig2.animalNumero,
          tipoAnimal: asig2.tipoAnimal,
          pesoVivo: asig2.pesoVivo,
          tropaCodigo: asig2.tropaCodigo
        }

        // IMPORTANTE: Primero poner null en ambos animalId para evitar violación de unique constraint
        // Luego actualizar con los nuevos valores
        await tx.asignacionGarron.update({
          where: { id: asig1.id },
          data: { animalId: null }
        })
        await tx.asignacionGarron.update({
          where: { id: asig2.id },
          data: { animalId: null }
        })
        
        // Ahora podemos asignar los nuevos valores sin conflicto
        await tx.asignacionGarron.update({
          where: { id: asig1.id },
          data: {
            animalId: asigDatos2.animalId,
            animalNumero: asigDatos2.animalNumero,
            tipoAnimal: asigDatos2.tipoAnimal,
            pesoVivo: asigDatos2.pesoVivo,
            tropaCodigo: asigDatos2.tropaCodigo
          }
        })
        await tx.asignacionGarron.update({
          where: { id: asig2.id },
          data: {
            animalId: asigDatos1.animalId,
            animalNumero: asigDatos1.animalNumero,
            tipoAnimal: asigDatos1.tipoAnimal,
            pesoVivo: asigDatos1.pesoVivo,
            tropaCodigo: asigDatos1.tropaCodigo
          }
        })
      }
    })

    log.info('[VB Romaneo] Intercambio completado exitosamente')
    return NextResponse.json({ success: true, message: 'Garrones intercambiados correctamente' })
  } catch (error) {
    console.error('[VB Romaneo] Error en intercambio:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Error al intercambiar: ' + (error instanceof Error ? error.message : 'Error desconocido') 
    }, { status: 500 })
  }
}

// Dar visto bueno
async function darVistoBueno(data: { listaIds: string[]; operadorId: string }) {
  const { listaIds, operadorId } = data

  if (!listaIds || listaIds.length === 0) {
    return NextResponse.json({ success: false, error: 'No se especificaron listas' }, { status: 400 })
  }

  const ahora = new Date()

  // TODO: ListaFaena doesn't have vbRomaneo fields. Consider closing the lista (estado: 'CERRADA')
  // and tracking the supervisor who approved via a separate mechanism or using estado field.
  await db.listaFaena.updateMany({
    where: { id: { in: listaIds } },
    data: {
      estado: 'CERRADA',
      supervisorId: operadorId
    }
  })

  return NextResponse.json({ 
    success: true, 
    message: 'Visto bueno otorgado correctamente',
    data: { fecha: ahora }
  })
}

// Quitar visto bueno
async function quitarVistoBueno(data: { listaIds: string[] }) {
  const { listaIds } = data

  if (!listaIds || listaIds.length === 0) {
    return NextResponse.json({ success: false, error: 'No se especificaron listas' }, { status: 400 })
  }

  // TODO: ListaFaena doesn't have vbRomaneo fields. Consider reopening the lista.
  await db.listaFaena.updateMany({
    where: { id: { in: listaIds } },
    data: {
      estado: 'ABIERTA',
      supervisorId: null
    }
  })

  return NextResponse.json({ success: true, message: 'Visto bueno removido' })
}
