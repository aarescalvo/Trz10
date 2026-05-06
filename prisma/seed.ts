/**
 * Seed Script: Datos Reales de Solemar Alimentaria
 * 
 * ELIMINA todos los datos existentes y carga SOLAMENTE los datos reales
 * provenientes de Trazasole_Datos_Consolidados.xlsx (archivos JSON en seed-data/).
 * 
 * Ejecutar con: bun run db:seed
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

function logOk(msg: string, count: number | string) {
  console.log(`  ✅ ${msg}: ${count}`)
}

function logErr(msg: string, error: unknown) {
  console.error(`  ❌ ${msg}`)
  if (error instanceof Error) console.error(`     ${error.message}`)
}

function normalize(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

/** Calcular similitud Jaro entre dos strings normalizados (0 a 1). */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1
  if (!s1 || !s2) return 0

  const len1 = s1.length
  const len2 = s2.length
  const matchDistance = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)

  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3
  )
}

function findCliente(
  clientes: { id: string; nombre: string; cuit: string | null }[],
  cuit?: string | null,
  nombre?: string | null,
): { id: string } | undefined {
  // 1) Búsqueda exacta por CUIT
  if (cuit) {
    const byCuit = clientes.find((c) => c.cuit === cuit)
    if (byCuit) return byCuit
  }
  if (!nombre) return undefined

  const norm = normalize(nombre)

  // 2) Contención directa (substring) — funciona para "MORAGA" ⊂ "MORAGAMAXIMILIANO"
  const directMatch = clientes.find((c) => {
    const cn = normalize(c.nombre)
    return cn.includes(norm) || norm.includes(cn)
  })
  if (directMatch) return directMatch

  // 3) Similitud Jaro ≥ 0.85 — maneja "BOSQUE AMADO" vs "BOSQUES AMADOS" (0.89)
  //    El umbral 0.85 evita falsos positivos como FERREYRA RUBEN → FERREYRA MARTIN (0.83)
  let bestMatch: { id: string } | undefined
  let bestScore = 0.85
  for (const c of clientes) {
    const score = jaroSimilarity(norm, normalize(c.nombre))
    if (score > bestScore) {
      bestScore = score
      bestMatch = c
    }
  }
  if (bestMatch) return bestMatch

  return undefined
}

// ─── LIMPIEZA TOTAL ────────────────────────────────────────────────────────────

async function limpiarBaseDeDatos() {
  logHeader('🗑️  LIMPIEZA TOTAL - Eliminando TODOS los datos existentes')

  // Detectar si es PostgreSQL o SQLite por la URL de conexión
  const dbUrl = process.env.DATABASE_URL || ''
  const isPostgres = dbUrl.includes('postgresql') || dbUrl.includes('postgres')

  try {
    if (isPostgres) {
      console.log('  ⚙️  Base de datos: PostgreSQL')
      // Desactivar FK en PostgreSQL
      await prisma.$executeRawUnsafe('SET session_replication_role = \'replica\'')
      console.log('  ⚙️  Foreign keys desactivadas')
    } else {
      console.log('  ⚙️  Base de datos: SQLite')
      await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF')
      console.log('  ⚙️  Foreign keys desactivadas')
    }

    // Tablas con datos que dependen de otras (orden inverso de dependencias)
    const tablas = [
      // Ciclo II
      'MovimientoDespostada',
      'MermaDespostada',
      'CajaEmpaque',
      'Cuarto',
      'LoteDespostada',
      'ExpedicionCicloII',
      'Pallet',

      // Despachos
      'DespachoItem',
      'Despacho',

      // Precios
      'HistorialPrecioCorte',
      'PrecioCorte',
      'HistorialPrecio',
      'PrecioCliente',

      // Reclamos
      'ArchivoReclamo',
      'RespuestaReclamo',
      'ReclamoCliente',

      // Emails
      'HistorialEnvio',
      'ProgramacionReporte',
      'DestinatarioReporte',

      // Barras
      'CodigoDestinoBarcode',
      'CodigoTransporteBarcode',
      'CodigoTrabajoBarcode',
      'CodigoTipificacionBarcode',
      'CodigoEspecieBarcode',
      'CodigoArticulo',
      'NumeradorCicloII',

      // Rendering y Cueros
      'RegistroRendering',
      'RegistroCuero',

      // Facturación
      'DetalleFactura',
      'Factura',

      // Menudencias
      'Menudencia',
      'TipoMenudencia',

      // Romaneo / Medias Reses
      'MediaRes',
      'StockMediaRes',
      'MovimientoCamara',
      'Romaneo',

      // Faena
      'AsignacionGarron',
      'ListaFaenaTropa',
      'ListaFaena',

      // Animales / Pesaje
      'PesajeIndividual',
      'PesajeCamion',
      'TropaAnimalCantidad',
      'Animal',
      'Tropa',

      // Auditoría
      'Auditoria',

      // Documentos
      'CCIR',
      'DeclaracionJurada',

      // Maestros
      'Operador',
      'Cliente',
      'Transportista',
      'Corral',
      'Camara',
      'Tipificador',
      'Producto',
      'Insumo',
      'TipoProducto',
      'SubproductoConfig',
      'CondicionEmbalaje',
      'Rotulo',
      'Numerador',
      'LayoutGlobalModulo',

      // Códigos
      'CodigoEspecie',
      'CodigoTransporte',
      'CodigoDestino',
      'CodigoTipoTrabajo',
      'CodigoTipificacion',

      // Configuración
      'ConfiguracionFrigorifico',
    ]

    if (isPostgres) {
      // En PostgreSQL usar TRUNCATE CASCADE (más rápido y limpio)
      const allTables = tablas.map(t => `"${t}"`).join(', ')
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${allTables} CASCADE`)
        console.log('  ✅ TRUNCATE CASCADE ejecutado en todas las tablas')
      } catch (e) {
        // Si falla, hacer DELETE individual
        console.log('  ⚠️  TRUNCATE falló, usando DELETE individual...')
        for (const tabla of tablas) {
          try {
            await prisma.$executeRawUnsafe(`DELETE FROM "${tabla}"`)
            console.log(`  🗑️  ${tabla}: OK`)
          } catch (e2) {
            console.log(`  ⏭️  ${tabla}: saltada`)
          }
        }
      }
      // Reactivar FK
      await prisma.$executeRawUnsafe('SET session_replication_role = \'origin\'')
      console.log('  ⚙️  Foreign keys reactivadas')
    } else {
      // SQLite: DELETE individual
      for (const tabla of tablas) {
        try {
          await prisma.$executeRawUnsafe(`DELETE FROM "${tabla}"`)
          console.log(`  🗑️  ${tabla}: OK`)
        } catch (e) {
          console.log(`  ⏭️  ${tabla}: saltada (no existe)`)
        }
      }
      await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')
      console.log('  ⚙️  Foreign keys reactivadas')
    }

    console.log('  ✅ Base de datos limpiada completamente')
  } catch (error) {
    console.error('  ❌ Error durante la limpieza:', error)
    throw error
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 SOLEMAR ALIMENTARIA - Seed de Datos Reales')
  console.log('   (Elimina datos previos y carga solo datos del Excel)')
  console.log('   Fuente: Trazasole_Datos_Consolidados.xlsx → seed-data/*.json')
  const startTime = Date.now()

  // ═══ PASO 0: LIMPIEZA TOTAL ═══
  await limpiarBaseDeDatos()

  try {
    // ═══ PASO 1: Operador Admin ═══
    logHeader('1️⃣  Operador Administrador')
    try {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      const admin = await prisma.operador.create({
        data: {
          nombre: 'Administrador',
          usuario: 'admin',
          password: hashedPassword,
          pin: '1234',
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
      })
      logOk('Operador admin creado', admin.usuario)
    } catch (e) {
      logErr('Error creando operador admin', e)
    }

    // ═══ PASO 2: Configuración del Frigorífico ═══
    logHeader('2️⃣  Configuración del Frigorífico')
    try {
      const config = await prisma.configuracionFrigorifico.create({
        data: {
          id: 'cfg-solemar',
          nombre: 'Solemar Alimentaria',
          direccion: 'Ruta Provincial N°7, Km 1180',
          numeroEstablecimiento: '3820',
          cuit: '30-70116296-3',
          numeroMatricula: 'N° 1234',
        },
      })
      logOk('Configuración creada', config.nombre)
    } catch (e) {
      logErr('Error creando configuración', e)
    }

    // ═══ PASO 3: Corrales (desde JSON) ═══
    logHeader('3️⃣  Corrales')
    try {
      const corralesData = readJsonFile<{
        id: string; nombre: string; capacidad: number; observaciones: string | null
      }>('corrales.json')
      if (corralesData.length > 0) {
        const count = await prisma.corral.createMany({
          data: corralesData.map((c) => ({
            nombre: c.nombre,
            capacidad: c.capacidad,
            observaciones: c.observaciones ?? undefined,
            activo: true,
          })),
        })
        logOk('Corrales creados', count.count)
      } else {
        console.log('  ⏭️  Sin datos de corrales')
      }
    } catch (e) {
      logErr('Error creando corrales', e)
    }

    // ═══ PASO 4: Cámaras (desde JSON) ═══
    logHeader('4️⃣  Cámaras')
    try {
      const camarasData = readJsonFile<{
        id: string; nombre: string; tipo: string; capacidad: number; observaciones: string | null
      }>('camaras.json')
      if (camarasData.length > 0) {
        const count = await prisma.camara.createMany({
          data: camarasData.map((c) => ({
            nombre: c.nombre,
            tipo: (c.tipo as TipoCamara) || TipoCamara.DEPOSITO,
            capacidad: c.capacidad,
            observaciones: c.observaciones ?? undefined,
            activo: true,
          })),
        })
        logOk('Cámaras creadas', count.count)
      } else {
        console.log('  ⏭️  Sin datos de cámaras')
      }
    } catch (e) {
      logErr('Error creando cámaras', e)
    }

    // ═══ PASO 5: Tipificadores (desde JSON) ═══
    logHeader('5️⃣  Tipificadores')
    try {
      const tipificadoresData = readJsonFile<{
        id: string; nombre: string; apellido: string; numero: string | null; matricula: string
      }>('tipificadores.json')
      if (tipificadoresData.length > 0) {
        const count = await prisma.tipificador.createMany({
          data: tipificadoresData.map((t) => ({
            nombre: t.nombre,
            apellido: t.apellido,
            numero: t.numero ?? undefined,
            matricula: t.matricula,
            activo: true,
          })),
        })
        logOk('Tipificadores creados', count.count)
      } else {
        console.log('  ⏭️  Sin datos de tipificadores')
      }
    } catch (e) {
      logErr('Error creando tipificadores', e)
    }

    // ═══ PASO 6: Clientes (desde JSON) ═══
    logHeader('6️⃣  Clientes (Productores + Usuarios de Faena)')
    let clientes: { id: string; nombre: string; cuit: string | null; esProductor: boolean; esUsuarioFaena: boolean }[] = []

    try {
      const clientesData = readJsonFile<{
        id: string; nombre: string; cuit: string | null; email: string | null;
        telefono: string | null; contacto: string | null; esProductor: boolean; esUsuarioFaena: boolean
      }>('clientes.json')

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
          const errMsg = err instanceof Error ? err.message : String(err)
          const errCode = (err as any)?.code || ''
          console.warn(`  ⚠️  No se pudo crear cliente: ${c.nombre} (${c.cuit}) — [${errCode}] ${errMsg}`)
          if (errMsg.includes('Unique constraint')) {
            console.warn(`     → Intentando buscar cliente existente con CUIT ${c.cuit}...`)
            const existente = await prisma.cliente.findFirst({ where: { cuit: c.cuit ?? undefined } })
            if (existente) {
              console.warn(`     → Encontrado: ${existente.id} — se usará este ID`)
              clientes.push({
                id: existente.id,
                nombre: existente.nombre,
                cuit: existente.cuit,
                esProductor: existente.esProductor,
                esUsuarioFaena: existente.esUsuarioFaena,
              })
            }
          }
        }
      }
      logOk('Clientes creados', clientes.length)
    } catch (e) {
      logErr('Error creando clientes', e)
    }

    // ═══ PASO 6b: Verificar cobertura de usuarios de faena ═══
    //    Solo reporta cuáles no matchean (no crea clientes inexistentes)
    logHeader('6b️⃣ Verificar usuarios de faena desde tropas')
    try {
      const tropasData = readJsonFile<{
        productorNombre: string | null; productorCuit: string | null;
        usuarioFaenaNombre: string | null;
      }>('tropas.json')

      const ufSinMatch = new Set<string>()
      for (const t of tropasData) {
        if (t.usuarioFaenaNombre) {
          const existing = findCliente(clientes, null, t.usuarioFaenaNombre)
          if (!existing) ufSinMatch.add(t.usuarioFaenaNombre.trim())
        }
      }
      if (ufSinMatch.size > 0) {
        console.log(`  ⚠️  ${ufSinMatch.size} usuarios de faena sin match (usarán cliente por defecto):`)
        for (const n of [...ufSinMatch].sort()) console.log(`     - ${n}`)
      } else {
        console.log('  ✅ Todos los usuarios de faena matchean correctamente')
      }
      logOk('Total clientes disponibles', clientes.length)
    } catch (e) {
      logErr('Error verificando usuarios de faena', e)
    }

    // Cliente por defecto para relaciones que no coincidan
    let defaultClienteId: string
    try {
      const defCliente = await prisma.cliente.create({
        data: {
          nombre: 'Cliente sin identificar',
          cuit: '00-00000000-0',
          esUsuarioFaena: true,
          activo: true,
          observaciones: 'Cliente genérico para relaciones sin coincidencia',
        },
      })
      defaultClienteId = defCliente.id
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      console.warn(`  ⚠️  No se pudo crear cliente por defecto: ${errMsg}`)
      defaultClienteId = clientes[0]?.id || ''
    }
    if (!defaultClienteId) {
      console.error('  ❌ ERROR CRÍTICO: No hay ningún cliente disponible. Las tropas y facturas no se podrán crear.')
    }

    // ═══ PASO 7: Tropas (desde JSON) ═══
    logHeader('7️⃣  Tropas')
    const tropaIdMap = new Map<number, string>()
    const tropaCodigoMap = new Map<number, string>()

    try {
      const tropasData = readJsonFile<{
        numero: number; codigo: string; especie: string; cantidadCabezas: number;
        productorNombre: string | null; productorCuit: string | null;
        usuarioFaenaNombre: string | null; usuarioFaenaCuit?: string | null;
        dte: string | null; guia: string | null; corral: string | null;
        matriculaMatarife: string | null; cuitTitular: string | null;
        fechaFaena: string | null; fechaIngreso: string | null; estado: string;
        pesoVivo: number | null; kgGancho: number | null; rindePct: number | null;
        observaciones: string | null
      }>('tropas.json')

      let tropasCreadas = 0
      let tropasSinDatos = 0
      for (const t of tropasData) {
        try {
          // Saltar tropas sin datos (173-200 estaban vacías en el Excel)
          if (!t.cantidadCabezas || t.cantidadCabezas <= 0) {
            tropasSinDatos++
            continue
          }

          // NOTA: productorId es opcional (solo trazabilidad). Si no matchea,
          // se guarda el nombre en observaciones para no perder el dato.
          const productor = findCliente(clientes, t.productorCuit, t.productorNombre)
          const usuarioFaena = findCliente(clientes, t.usuarioFaenaCuit ?? null, t.usuarioFaenaNombre)

          const especie = t.especie === 'EQUINO' ? Especie.EQUINO : Especie.BOVINO
          const estadoTropa = t.estado === 'FAENADO' ? EstadoTropa.FAENADO
            : t.estado === 'DESPACHADO' ? EstadoTropa.DESPACHADO
            : t.estado === 'EN_FAENA' ? EstadoTropa.EN_FAENA
            : t.estado === 'PESADO' ? EstadoTropa.PESADO
            : EstadoTropa.RECIBIDO

          // Construir observaciones incluyendo datos del productor si no tiene FK
          const obsParts: string[] = []
          if (t.observaciones) obsParts.push(t.observaciones)
          if (t.productorNombre && !productor) {
            const prodInfo = t.productorCuit
              ? `Productor: ${t.productorNombre} (CUIT: ${t.productorCuit})`
              : `Productor: ${t.productorNombre}`
            obsParts.push(prodInfo)
          }

          const created = await prisma.tropa.create({
            data: {
              numero: t.numero,
              codigo: t.codigo,
              productorId: productor?.id ?? null,
              usuarioFaenaId: usuarioFaena?.id ?? defaultClienteId,
              especie,
              dte: t.dte || `DTE-2026-${String(t.numero).padStart(4, '0')}`,
              guia: t.guia ? String(t.guia) : `GUIA-2026-${String(t.numero).padStart(4, '0')}`,
              cantidadCabezas: t.cantidadCabezas,
              estado: estadoTropa,
              pesoBruto: t.pesoVivo ? t.pesoVivo * 1.15 : null,
              pesoNeto: t.pesoVivo ?? null,
              observaciones: obsParts.length > 0 ? obsParts.join(' | ') : undefined,
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
      if (tropasSinDatos > 0) console.log(`  ℹ️  Tropas sin datos (saltadas): ${tropasSinDatos}`)
    } catch (e) {
      logErr('Error general en tropas', e)
    }

    // ═══ PASO 8: Animales (desde JSON) ═══
    logHeader('8️⃣  Animales')
    try {
      const animalesData = readJsonFile<{
        tropaNumero: number; numero: number; codigo: string; caravana: string | null;
        raza: string | null; tipoAnimal: string; pesoVivo: number | null;
        kgEntrada: number | null; kgMediaA: number | null; kgMediaB: number | null;
        totalKg: number | null; rindePct: number | null; garron: number | null;
        estado: string
      }>('animales.json')

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
          : a.estado === 'PESADO' ? EstadoAnimal.PESADO
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

      const BATCH_SIZE = 500
      let animalsCreated = 0
      for (let i = 0; i < animalData.length; i += BATCH_SIZE) {
        const batch = animalData.slice(i, i + BATCH_SIZE)
        const result = await prisma.animal.createMany({ data: batch })
        animalsCreated += result.count
      }
      logOk('Animales creados', animalsCreated)
      if (skipped > 0) console.log(`  ℹ️  Animales saltados (sin tropa/tipo inválido): ${skipped}`)
    } catch (e) {
      logErr('Error creando animales', e)
    }

    // ═══ PASO 9: Romaneos (desde JSON) ═══
    logHeader('9️⃣  Romaneos')
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
          const result = await prisma.romaneo.createMany({ data: romaneoData })
          romaneosCreados += result.count
        }
      }
      logOk('Romaneos creados', romaneosCreados)
    } catch (e) {
      logErr('Error creando romaneos', e)
    }

    // ═══ PASO 10: Facturas (desde JSON) ═══
    logHeader('🔟 Facturas')
    try {
      const facturasData = readJsonFile<{
        tropaNumero: number; usuario: string; fechaFaena: string | null;
        cantAnimales: number; kgGancho: number; totalServicioIVA: number;
        tasaInspVet: number; arancelIPCVA: number; totalFacturaImp: number;
        noFactura: string; fechaFactura: string | null; fechaPago: string | null;
        montoDepositado: number; estadoPago: string
      }>('facturas.json')

      let facturasCreadas = 0
      let facturasDuplicadas = 0
      const facturasVistas = new Set<string>()

      for (const f of facturasData) {
        try {
          // Saltar facturas duplicadas por número
          if (facturasVistas.has(f.noFactura)) {
            facturasDuplicadas++
            continue
          }
          facturasVistas.add(f.noFactura)

          const cliente = findCliente(clientes, null, f.usuario) || { id: defaultClienteId } as { id: string }

          // Si no hay cliente válido, saltar esta factura
          if (!cliente.id) {
            console.warn(`  ⚠️  Factura ${f.noFactura} saltada: no hay cliente disponible para "${f.usuario}"`)
            continue
          }

          const estado = f.estadoPago === 'PAGADO' ? EstadoFactura.PAGADA
            : f.estadoPago === 'EMITIDA' ? EstadoFactura.EMITIDA
            : f.estadoPago === 'ANULADA' ? EstadoFactura.ANULADA
            : EstadoFactura.PENDIENTE

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
              observaciones: `Tropa #${f.tropaNumero} | ${f.cantAnimales} animales | ${f.kgGancho} kg gancho | Tasa Insp. Vet: ${f.tasaInspVet} | IPCVA: ${f.arancelIPCVA}`,
              remito: f.noFactura,
            },
          })
          facturasCreadas++
        } catch (err) {
          console.warn(`  ⚠️  Error creando factura ${f.noFactura}: ${(err as Error).message}`)
        }
      }
      logOk('Facturas creadas', facturasCreadas)
      if (facturasDuplicadas > 0) console.log(`  ℹ️  Facturas duplicadas (saltadas): ${facturasDuplicadas}`)
    } catch (e) {
      logErr('Error general en facturas', e)
    }

    // ═══ PASO 11: Menudencias (desde JSON) ═══
    logHeader('1️⃣1️⃣ Menudencias')
    try {
      const menudenciasData = readJsonFile<{
        tropaNumero: number; item: string; cantidad: number | null; kg: number | null;
        unidades: number | null; kgDecomiso: number | null; tipoMenudenciaNombre: string
      }>('menudencias.json')

      // Crear tipos de menudencia únicos
      const tiposMenudenciaSet = new Set<string>()
      for (const m of menudenciasData) {
        if (m.tipoMenudenciaNombre) tiposMenudenciaSet.add(m.tipoMenudenciaNombre)
      }

      const tiposNombres = Array.from(tiposMenudenciaSet)
      const tiposMap = new Map<string, string>()
      await prisma.tipoMenudencia.createMany({
        data: tiposNombres.map((nombre) => ({ nombre, activo: true })),
      })
      console.log(`  ✅ Tipos de menudencia creados: ${tiposNombres.length}`)

      // Buscar IDs de tipos creados
      for (const nombre of tiposNombres) {
        const tipo = await prisma.tipoMenudencia.findFirst({ where: { nombre } })
        if (tipo) tiposMap.set(nombre, tipo.id)
      }

      // Filtrar menudencias con datos
      const menudenciasValidas = menudenciasData.filter((m) => m.kg != null || m.cantidad != null)

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
              cantidadBolsas: m.unidades ? Math.round(m.unidades) : undefined,
              fechaIngreso: new Date(),
              observaciones: m.item ? `Item: ${m.item}${m.kgDecomiso ? ` | Decomiso: ${m.kgDecomiso} kg` : ''}` : undefined,
            }
          })
          .filter((d) => d.tipoMenudenciaId)

        if (data.length > 0) {
          const result = await prisma.menudencia.createMany({ data })
          menudenciasCreadas += result.count
        }
      }
      logOk('Menudencias creadas', menudenciasCreadas)
    } catch (e) {
      logErr('Error creando menudencias', e)
    }

    // ═══ PASO 12: Numeradores ═══
    logHeader('1️⃣2️⃣ Numeradores')
    try {
      await prisma.numerador.createMany({
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
      logOk('Numeradores creados', 7)
    } catch (e) {
      logErr('Error creando numeradores', e)
    }

    // ═══ RESUMEN ═══
    logHeader('📊 Resumen del Seed')
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`  ⏱️  Tiempo total: ${elapsed}s`)
    console.log('  📦 Datos cargados (solo del Excel):')
    console.log(`     • Operador Admin: 1`)
    console.log(`     • Configuración: 1`)
    console.log(`     • Clientes (productores + usuarios faena): ${clientes.length}`)
    console.log(`     • Tropas: ${tropaIdMap.size}`)
    console.log('     • Animales, Romaneos, Facturas, Menudencias')
    console.log('     • Numeradores: 7')
    console.log(`\n  ⚠️  Datos de prueba ELIMINADOS. Solo quedan datos reales del Excel.`)
    console.log('\n🎉 Seed completado exitosamente!\n')
  } catch (error) {
    console.error('\n💥 Error fatal durante el seed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
