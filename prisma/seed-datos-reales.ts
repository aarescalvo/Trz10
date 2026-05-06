/**
 * Seed script: Datos Reales del Frigorífico
 * Carga datos operacionales desde archivos JSON a la base de datos SQLite.
 *
 * Uso: npx tsx prisma/seed-datos-reales.ts
 */

import bcrypt from 'bcryptjs'
import {
  PrismaClient,
  Especie,
  RolOperador,
  TipoAnimal,
  EstadoTropa,
  EstadoAnimal,
  EstadoRomaneo,
  EstadoFactura,
  TipoCamara,
} from '@prisma/client'
import * as path from 'path'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ─── Helpers ────────────────────────────────────────────────────────────────────

function readJsonFile<T>(filename: string): T[] {
  const filePath = path.join(__dirname, 'seed-data', filename)
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️  Archivo no encontrado: ${filename}`)
    return []
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as T[]
}

function logHeader(title: string) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'═'.repeat(60)}`)
}

function logOk(msg: string, count: number) {
  console.log(`  ✅ ${msg}: ${count}`)
}

function logErr(msg: string, error: unknown) {
  console.error(`  ❌ ${msg}`)
  if (error instanceof Error) console.error(`     ${error.message}`)
}

/**
 * Fuzzy match: normaliza un string para comparación (quita tildes, puntos, espacios extra, etc.)
 */
function normalize(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^A-Z0-9]/g, '')       // solo letras y números
    .trim()
}

/** Busca cliente por CUIT exacto o por nombre aproximado */
function findCliente(
  clientes: { id: string; nombre: string; cuit: string | null }[],
  cuit?: string | null,
  nombre?: string | null,
): { id: string } | undefined {
  if (cuit) {
    const byCuit = clientes.find((c) => c.cuit === cuit)
    if (byCuit) return byCuit
  }
  if (nombre) {
    const norm = normalize(nombre)
    // Busca coincidencia parcial (el nombre de tropa suele ser substring del nombre de cliente)
    const match = clientes.find((c) => normalize(c.nombre).includes(norm) || norm.includes(normalize(c.nombre)))
    if (match) return match
    // Intenta buscando por la primera parte del nombre (antes de un espacio)
    const firstPart = nombre.split(' ')[0]
    if (firstPart.length > 3) {
      const normFirst = normalize(firstPart)
      const match2 = clientes.find((c) => normalize(c.nombre).includes(normFirst) || normFirst.includes(normalize(c.nombre)))
      if (match2) return match2
    }
  }
  return undefined
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Iniciando seed de datos reales...')
  const startTime = Date.now()

  try {
    // ── 1. Operadores ────────────────────────────────────────────────────────
    logHeader('1️⃣  Operadores')
    try {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      const operadores = await prisma.operador.createMany({
        data: [
          {
            nombre: 'Administrador',
            usuario: 'admin',
            password: hashedPassword,
            rol: RolOperador.ADMINISTRADOR,
            email: 'admin@solemar.com.ar',
            activo: true,
            puedePesajeCamiones: true,
            puedePesajeIndividual: true,
            puedeMovimientoHacienda: true,
            puedeListaFaena: true,
            puedeRomaneo: true,
            puedeIngresoCajon: true,
            puedeMenudencias: true,
            puedeStock: true,
            puedeReportes: true,
            puedeCCIR: true,
            puedeFacturacion: true,
            puedeConfiguracion: true,
          },
          {
            nombre: 'Supervisor',
            usuario: 'supervisor',
            password: hashedPassword,
            rol: RolOperador.SUPERVISOR,
            email: 'supervisor@solemar.com.ar',
            activo: true,
            puedePesajeCamiones: true,
            puedePesajeIndividual: true,
            puedeMovimientoHacienda: true,
            puedeListaFaena: true,
            puedeRomaneo: true,
            puedeMenudencias: true,
            puedeStock: true,
            puedeReportes: true,
            puedeFacturacion: true,
          },
          {
            nombre: 'Operador',
            usuario: 'operador',
            password: hashedPassword,
            rol: RolOperador.OPERADOR,
            email: 'operador@solemar.com.ar',
            activo: true,
            puedePesajeCamiones: true,
            puedePesajeIndividual: true,
            puedeMovimientoHacienda: true,
          },
        ],
      })
      logOk('Operadores creados', operadores.count)
    } catch (e) {
      logErr('Error creando operadores', e)
    }

    // ── 2. Configuración ─────────────────────────────────────────────────────
    logHeader('2️⃣  Configuración del Frigorífico')
    try {
      await prisma.configuracionFrigorifico.upsert({
        where: { id: 'cfg-001' },
        update: {},
        create: {
          id: 'cfg-001',
          nombre: 'Solemar Alimentaria',
          direccion: 'Ruta Provincial N°7, Km 1180',
          numeroEstablecimiento: '3820',
          cuit: '30-70116296-3',
          numeroMatricula: 'N° 1234',
        },
      })
      console.log('  ✅ Configuración creada/actualizada: 1')
    } catch (e) {
      logErr('Error creando configuración', e)
    }

    // ── 3. Transportistas ────────────────────────────────────────────────────
    logHeader('3️⃣  Transportistas')
    try {
      const tCount = await prisma.transportista.createMany({
        data: [
          { nombre: 'Transportes del Sur S.R.L.', cuit: '30-70555555-1', telefono: '2994-555555' },
          { nombre: 'Logística Patagónica', cuit: '30-70666666-2', telefono: '2994-666666' },
          { nombre: 'Fletes Ruta 7', cuit: '30-70777777-3', telefono: '2994-777777' },
          { nombre: 'Transporte Propio', telefono: '2994-888888' },
        ],
      })
      logOk('Transportistas creados', tCount.count)
    } catch (e) {
      logErr('Error creando transportistas', e)
    }

    // ── 4. Corrales ─────────────────────────────────────────────────────────
    logHeader('4️⃣  Corrales')
    try {
      const corralesData = readJsonFile<{
        id: string; nombre: string; capacidad: number; observaciones: string | null
      }>('corrales.json')
      const corralesCount = await prisma.corral.createMany({
        data: corralesData.map((c) => ({
          nombre: c.nombre,
          capacidad: c.capacidad,
          observaciones: c.observaciones ?? undefined,
          activo: true,
        })),
      })
      logOk('Corrales creados', corralesCount.count)
    } catch (e) {
      logErr('Error creando corrales', e)
    }

    // ── 5. Cámaras ──────────────────────────────────────────────────────────
    logHeader('5️⃣  Cámaras')
    try {
      const camarasData = readJsonFile<{
        id: string; nombre: string; tipo: string; capacidad: number; observaciones: string | null
      }>('camaras.json')
      const camarasCount = await prisma.camara.createMany({
        data: camarasData.map((c) => ({
          nombre: c.nombre,
          tipo: (c.tipo as TipoCamara) || TipoCamara.DEPOSITO,
          capacidad: c.capacidad,
          observaciones: c.observaciones ?? undefined,
          activo: true,
        })),
      })
      logOk('Cámaras creadas', camarasCount.count)
    } catch (e) {
      logErr('Error creando cámaras', e)
    }

    // ── 6. Tipificadores ──────────────────────────────────────────────────────
    logHeader('6️⃣  Tipificadores')
    try {
      const tipificadoresData = readJsonFile<{
        id: string; nombre: string; apellido: string; numero: string | null; matricula: string
      }>('tipificadores.json')
      const tipCount = await prisma.tipificador.createMany({
        data: tipificadoresData.map((t) => ({
          nombre: t.nombre,
          apellido: t.apellido,
          numero: t.numero ?? undefined,
          matricula: t.matricula,
          activo: true,
        })),
      })
      logOk('Tipificadores creados', tipCount.count)
    } catch (e) {
      logErr('Error creando tipificadores', e)
    }

    // ── 7. Clientes ──────────────────────────────────────────────────────────
    logHeader('7️⃣  Clientes')
    let clientes: { id: string; nombre: string; cuit: string | null; esProductor: boolean; esUsuarioFaena: boolean }[] = []

    try {
      const clientesData = readJsonFile<{
        id: string; nombre: string; cuit: string | null; email: string | null;
        telefono: string | null; contacto: string | null; esProductor: boolean; esUsuarioFaena: boolean
      }>('clientes.json')

      // Crear cliente por cliente usando create para obtener IDs
      for (const c of clientesData) {
        try {
          const created = await prisma.cliente.create({
            data: {
              nombre: c.nombre,
              cuit: c.cuit ?? undefined,
              email: c.email ?? undefined,
              telefono: c.telefono ?? undefined,
              esProductor: c.esProductor,
              esUsuarioFaena: c.esUsuarioFaena,
              activo: true,
              observaciones: c.contacto ? `Contacto: ${c.contacto}` : undefined,
            },
          })
          clientes.push({
            id: created.id,
            nombre: created.nombre,
            cuit: created.cuit,
            esProductor: created.esProductor,
            esUsuarioFaena: created.esUsuarioFaena,
          })
        } catch (err) {
          // Si ya existe, intentar buscarlo
          const existing = await prisma.cliente.findFirst({
            where: { cuit: c.cuit ?? undefined },
          })
          if (existing) {
            clientes.push({
              id: existing.id,
              nombre: existing.nombre,
              cuit: existing.cuit,
              esProductor: existing.esProductor,
              esUsuarioFaena: existing.esUsuarioFaena,
            })
          } else {
            console.warn(`  ⚠️  No se pudo crear/find cliente: ${c.nombre} (${c.cuit})`)
          }
        }
      }
      logOk('Clientes creados', clientes.length)
    } catch (e) {
      logErr('Error creando clientes', e)
    }

    // Crear un cliente por defecto para relaciones que no coincidan
    let defaultClienteId: string
    try {
      const defCliente = await prisma.cliente.upsert({
        where: { cuit: '00-00000000-0' },
        update: {},
        create: {
          nombre: 'Cliente sin identificar',
          cuit: '00-00000000-0',
          esUsuarioFaena: true,
          activo: true,
          observaciones: 'Cliente genérico creado por el seed script para relaciones sin coincidencia',
        },
      })
      defaultClienteId = defCliente.id
      console.log('  ℹ️  Cliente por defecto creado para fallback')
    } catch (e) {
      logErr('Error creando cliente por defecto', e)
      defaultClienteId = clientes[0]?.id || ''
    }

    // ── 8. Tropas ────────────────────────────────────────────────────────────
    logHeader('8️⃣  Tropas')
    const tropaIdMap = new Map<number, string>()
    const tropaCodigoMap = new Map<number, string>()

    try {
      const tropasData = readJsonFile<{
        numero: number; codigo: string; especie: string; cantidadCabezas: number;
        productorNombre: string | null; productorCuit: string | null;
        usuarioFaenaNombre: string | null; usuarioFaenaCuit?: string | null;
        fechaFaena: string | null; estado: string;
        pesoVivo: number | null; kgGancho: number | null; rindePct: number | null;
        observaciones: string | null
      }>('tropas.json')

      let tropasCreadas = 0
      for (const t of tropasData) {
        try {
          // Buscar productor
          const productor = findCliente(clientes, t.productorCuit, t.productorNombre)
          // Buscar usuario de faena
          const usuarioFaena = findCliente(clientes, t.usuarioFaenaCuit ?? null, t.usuarioFaenaNombre)

          const especie = t.especie === 'EQUINO' ? Especie.EQUINO : Especie.BOVINO
          const estadoTropa = t.estado === 'FAENADO' ? EstadoTropa.FAENADO
            : t.estado === 'DESPACHADO' ? EstadoTropa.DESPACHADO
            : t.estado === 'EN_FAENA' ? EstadoTropa.EN_FAENA
            : EstadoTropa.RECIBIDO

          const created = await prisma.tropa.create({
            data: {
              numero: t.numero,
              codigo: t.codigo,
              productorId: productor?.id ?? null,
              usuarioFaenaId: usuarioFaena?.id ?? defaultClienteId,
              especie,
              dte: `DTE-2026-${String(t.numero).padStart(4, '0')}`,
              guia: `GUIA-2026-${String(t.numero).padStart(4, '0')}`,
              cantidadCabezas: t.cantidadCabezas,
              estado: estadoTropa,
              pesoBruto: t.pesoVivo ? t.pesoVivo * 1.15 : null,
              pesoNeto: t.pesoVivo ?? null,
              observaciones: t.observaciones ?? undefined,
              fechaRecepcion: t.fechaFaena ? new Date(t.fechaFaena) : new Date(),
            },
          })
          tropaIdMap.set(t.numero, created.id)
          tropaCodigoMap.set(t.numero, t.codigo)
          tropasCreadas++
        } catch (err) {
          console.warn(`  ⚠️  Error creando tropa #${t.numero}: ${(err as Error).message}`)
        }
      }
      logOk('Tropas creadas', tropasCreadas)
    } catch (e) {
      logErr('Error general en tropas', e)
    }

    // ── 9. Animales ─────────────────────────────────────────────────────────
    logHeader('9️⃣  Animales')
    try {
      const animalesData = readJsonFile<{
        tropaNumero: number; numero: number; codigo: string; caravana: string | null;
        raza: string | null; tipoAnimal: string; pesoVivo: number | null;
        kgEntrada: number | null; kgMediaA: number | null; kgMediaB: number | null;
        totalKg: number | null; rindePct: number | null; garron: number | null;
        estado: string
      }>('animales.json')

      // Validar TipoAnimal y manejar duplicados de código
      const codigoSet = new Set<string>()
      const animalData: {
        tropaId: string; numero: number; codigo: string; caravana: string | null;
        tipoAnimal: TipoAnimal; raza: string | null; pesoVivo: number | null;
        estado: EstadoAnimal
      }[] = []

      const validTipos = new Set<string>(Object.values(TipoAnimal))
      let skipped = 0

      for (const a of animalesData) {
        const tropaId = tropaIdMap.get(a.tropaNumero)
        if (!tropaId) {
          skipped++
          continue
        }

        // Validar tipoAnimal
        if (!validTipos.has(a.tipoAnimal)) {
          skipped++
          continue
        }

        // Manejar duplicados de código
        let codigo = a.codigo
        if (codigoSet.has(codigo)) {
          let suffix = 2
          while (codigoSet.has(`${a.codigo}-${suffix}`)) suffix++
          codigo = `${a.codigo}-${suffix}`
        }
        codigoSet.add(codigo)

        const estado = a.estado === 'FAENADO' ? EstadoAnimal.FAENADO
          : a.estado === 'DESPACHADO' ? EstadoAnimal.DESPACHADO
          : a.estado === 'EN_CAMARA' ? EstadoAnimal.EN_CAMARA
          : EstadoAnimal.RECIBIDO

        animalData.push({
          tropaId,
          numero: a.numero,
          codigo,
          caravana: a.caravana ?? undefined,
          tipoAnimal: a.tipoAnimal as TipoAnimal,
          raza: a.raza ?? undefined,
          pesoVivo: a.pesoVivo ?? undefined,
          estado,
        })
      }

      // Insertar en batches de 500
      const BATCH_SIZE = 500
      let animalsCreated = 0
      for (let i = 0; i < animalData.length; i += BATCH_SIZE) {
        const batch = animalData.slice(i, i + BATCH_SIZE)
        const result = await prisma.animal.createMany({
          data: batch,
        })
        animalsCreated += result.count
      }
      logOk('Animales creados', animalsCreated)
      if (skipped > 0) console.log(`  ℹ️  Animales saltados (sin tropa/tipo inválido): ${skipped}`)
    } catch (e) {
      logErr('Error creando animales', e)
    }

    // ── 10. Romaneos ─────────────────────────────────────────────────────────
    logHeader('🔟 Romaneos')
    try {
      const romaneosData = readJsonFile<{
        tropaNumero: number; animalNumero: number; garron: number;
        tropaCodigo: string | null; tipoAnimal: string | null; raza: string | null;
        pesoVivo: number | null; kgMediaIzq: number | null; kgMediaDer: number | null;
        pesoTotal: number | null; rinde: number | null; fecha: string | null;
        estado: string
      }>('romaneos.json')

      const validTipos = new Set<string>(Object.values(TipoAnimal))
      const BATCH_SIZE = 500
      let romaneosCreados = 0

      for (let i = 0; i < romaneosData.length; i += BATCH_SIZE) {
        const batch = romaneosData.slice(i, i + BATCH_SIZE)
        const romaneoData = batch
          .filter((r) => !r.tipoAnimal || validTipos.has(r.tipoAnimal))
          .map((r) => ({
            fecha: r.fecha ? new Date(r.fecha) : new Date(),
            garron: r.garron,
            tropaCodigo: r.tropaCodigo ?? undefined,
            numeroAnimal: r.animalNumero,
            tipoAnimal: r.tipoAnimal ? (r.tipoAnimal as TipoAnimal) : undefined,
            raza: r.raza ?? undefined,
            pesoVivo: r.pesoVivo ?? undefined,
            pesoMediaIzq: r.kgMediaIzq ?? undefined,
            pesoMediaDer: r.kgMediaDer ?? undefined,
            pesoTotal: r.pesoTotal ?? undefined,
            rinde: r.rinde ?? undefined,
            estado: r.estado === 'CONFIRMADO' ? EstadoRomaneo.CONFIRMADO
              : r.estado === 'ANULADO' ? EstadoRomaneo.ANULADO
              : EstadoRomaneo.PENDIENTE,
          }))

        if (romaneoData.length > 0) {
          const result = await prisma.romaneo.createMany({
            data: romaneoData,
          })
          romaneosCreados += result.count
        }
      }
      logOk('Romaneos creados', romaneosCreados)
    } catch (e) {
      logErr('Error creando romaneos', e)
    }

    // ── 11. Facturas ──────────────────────────────────────────────────────────
    logHeader('1️⃣1️⃣ Facturas')
    try {
      const facturasData = readJsonFile<{
        tropaNumero: number; usuario: string; fechaFaena: string | null;
        cantAnimales: number; kgGancho: number; totalServicioIVA: number;
        tasaInspVet: number; arancelIPCVA: number; totalFacturaImp: number;
        noFactura: string; fechaFactura: string | null; fechaPago: string | null;
        montoDepositado: number; estadoPago: string
      }>('facturas.json')

      // Buscar cliente por nombre de usuario de factura
      const facturaEstadoMap: Record<string, EstadoFactura> = {
        'PENDIENTE': EstadoFactura.PENDIENTE,
        'PAGADO': EstadoFactura.PAGADA,
        'EMITIDA': EstadoFactura.EMITIDA,
        'ANULADA': EstadoFactura.ANULADA,
      }

      let facturasCreadas = 0
      for (const f of facturasData) {
        try {
          const cliente = findCliente(clientes, null, f.usuario) ||
            { id: defaultClienteId } as { id: string }

          const estado = facturaEstadoMap[f.estadoPago] || EstadoFactura.PENDIENTE

          // Extraer número interno del noFactura (última parte después del guion)
          const numParts = f.noFactura.split('-')
          const numeroInterno = parseInt(numParts[numParts.length - 1] || '0', 10) || facturasCreadas + 1

          await prisma.factura.create({
            data: {
              numero: f.noFactura,
              numeroInterno,
              clienteId: cliente.id,
              fecha: f.fechaFaena ? new Date(f.fechaFaena) : new Date(),
              fechaEmision: f.fechaFactura ? new Date(f.fechaFactura) : undefined,
              fechaPago: f.fechaPago ? new Date(f.fechaPago) : undefined,
              subtotal: f.totalServicioIVA ?? 0,
              iva: f.tasaInspVet ?? 0,
              total: f.totalFacturaImp ?? 0,
              estado,
              observaciones: `Tropa #${f.tropaNumero} - ${f.cantAnimales} animales - ${f.kgGancho} kg gancho - Tasa Insp. Vet: ${f.tasaInspVet} - IPCVA: ${f.arancelIPCVA}`,
              remito: f.noFactura,
            },
          })
          facturasCreadas++
        } catch (err) {
          console.warn(`  ⚠️  Error creando factura ${f.noFactura}: ${(err as Error).message}`)
        }
      }
      logOk('Facturas creadas', facturasCreadas)
    } catch (e) {
      logErr('Error general en facturas', e)
    }

    // ── 12. Menudencias ──────────────────────────────────────────────────────
    logHeader('1️⃣2️⃣ Menudencias')
    try {
      const menudenciasData = readJsonFile<{
        tropaNumero: number; item: string; cantidad: number | null; kg: number | null;
        unidades: number | null; kgDecomiso: number | null; tipoMenudenciaNombre: string
      }>('menudencias.json')

      // Recolectar tipos de menudencia únicos
      const tiposMenudenciaSet = new Set<string>()
      for (const m of menudenciasData) {
        if (m.tipoMenudenciaNombre) tiposMenudenciaSet.add(m.tipoMenudenciaNombre)
      }

      // Crear tipos de menudencia
      const tiposNombres = Array.from(tiposMenudenciaSet)
      const tiposMap = new Map<string, string>()
      const tiposCount = await prisma.tipoMenudencia.createMany({
        data: tiposNombres.map((nombre) => ({ nombre, activo: true })),
      })
      console.log(`  ✅ Tipos de menudencia creados: ${tiposNombres.length}`)

      // Buscar los IDs de los tipos creados
      for (const nombre of tiposNombres) {
        const tipo = await prisma.tipoMenudencia.findFirst({ where: { nombre } })
        if (tipo) tiposMap.set(nombre, tipo.id)
      }

      // Filtrar menudencias con datos (al menos kg o cantidad)
      const menudenciasValidas = menudenciasData.filter(
        (m) => m.kg != null || m.cantidad != null
      )

      // Crear menudencias en batches
      const BATCH_SIZE = 500
      let menudenciasCreadas = 0
      for (let i = 0; i < menudenciasValidas.length; i += BATCH_SIZE) {
        const batch = menudenciasValidas.slice(i, i + BATCH_SIZE)
        const data = batch
          .filter((m) => tiposMap.has(m.tipoMenudenciaNombre))
          .map((m) => {
            const tropaCodigo = tropaCodigoMap.get(m.tropaNumero)
            return {
              tipoMenudenciaId: tiposMap.get(m.tipoMenudenciaNombre)!,
              tropaCodigo: tropaCodigo ?? undefined,
              pesoIngreso: m.kg ?? undefined,
              pesoElaborado: undefined,
              cantidadBolsas: m.unidades ? Math.round(m.unidades) : undefined,
              fechaIngreso: new Date(),
              observaciones: m.item ? `Item: ${m.item}${m.kgDecomiso ? ` | Decomiso: ${m.kgDecomiso} kg` : ''}` : undefined,
            }
          })
          .filter((d) => d.tipoMenudenciaId) // asegurar que el tipo existe

        if (data.length > 0) {
          const result = await prisma.menudencia.createMany({
            data,
          })
          menudenciasCreadas += result.count
        }
      }
      logOk('Menudencias creadas', menudenciasCreadas)
    } catch (e) {
      logErr('Error creando menudencias', e)
    }

    // ── 13. Numeradores ──────────────────────────────────────────────────────
    logHeader('1️⃣3️⃣  Numeradores')
    try {
      const numCount = await prisma.numerador.createMany({
        data: [
          { nombre: 'TROPA_BOVINO', ultimoNumero: 200, anio: 2026 },
          { nombre: 'TROPA_EQUINO', ultimoNumero: 0, anio: 2026 },
          { nombre: 'FACTURA', ultimoNumero: 172, anio: 2026 },
          { nombre: 'TICKET', ultimoNumero: 0, anio: 2026 },
          { nombre: 'ROMANEO', ultimoNumero: 1861, anio: 2026 },
          { nombre: 'PESAJE_CAMION', ultimoNumero: 0, anio: 2026 },
          { nombre: 'MENUDENCIA', ultimoNumero: 0, anio: 2026 },
        ],
      })
      logOk('Numeradores creados', numCount.count)
    } catch (e) {
      logErr('Error creando numeradores', e)
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    logHeader('📊 Resumen del Seed')
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`  ⏱️  Tiempo total: ${elapsed}s`)
    console.log('  📦 Entidades cargadas:')
    console.log('     • Operadores, Config, Transportistas')
    console.log('     • Corrales, Cámaras, Tipificadores')
    console.log(`     • Clientes: ${clientes.length}`)
    console.log(`     • Tropas: ${tropaIdMap.size}`)
    console.log('     • Animales, Romaneos')
    console.log('     • Facturas')
    console.log('     • Menudencias (con Tipos)')
    console.log('     • Numeradores')
    console.log('\n🎉 Seed completado exitosamente!\n')
  } catch (error) {
    console.error('\n💥 Error fatal durante el seed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
