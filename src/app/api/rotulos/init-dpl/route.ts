import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

/**
 * POST - Crear rótulos DPL por defecto para Datamax Mark II
 * Formato: 6cm alto x 9cm ancho
 * 
 * EAN-128 (GS1-128) Application Identifiers:
 * - (10) Número de lote/tropa
 * - (21) Número de serie/animal
 * - (3100) Peso neto en kg (sin decimales)
 */
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const rotulosCreados: Awaited<ReturnType<typeof db.rotulo.create>>[] = []

    // ========================================
    // RÓTULO PESAJE INDIVIDUAL - EAN-128 con Application Identifiers
    // Layout: Tropa | N° Animal + Peso | Código EAN-128
    // ========================================
    const rotuloPesajeIndividualEAN128 = `n
M1084
O0220
SO
d
L
D11
PO
pG
SO
A2
; === CÓDIGO DE BARRAS EAN-128 ===
; Formato: (10)Tropa (21)Número (3100)Peso
; FNC1 = 1e para indicar GS1-128
1e8406900410065C{CODIGO_EAN128}
ySE1
; === TEXTO LEGIBLE ===
1911A1200220110(10){TROPA} (21){NUMERO} (3100){PESO}kg
; === TROPA ARRIBA ===
1911A1201950010TROPA:
1911A1401940058{TROPA}
; === N° ANIMAL ===
1911A1201660081N° Animal:
1911A1601650200{NUMERO}
; === PESO ===
1911A1201360215Peso:
1911A1801330270{PESO} kg
Q0001
E
`.trim()

    // Verificar si ya existe
    const existentePesaje = await db.rotulo.findFirst({
      where: { 
        codigo: 'PESAJE_INDIVIDUAL_EAN128_V3',
        tipoImpresora: 'DATAMAX'
      }
    })

    if (!existentePesaje) {
      // Desmarcar otros como default
      await db.rotulo.updateMany({
        where: { 
          tipo: 'MEDIA_RES',
          tipoImpresora: 'DATAMAX',
          esDefault: true 
        },
        data: { esDefault: false }
      })

      const nuevoRotulo = await db.rotulo.create({
        data: {
          nombre: 'Pesaje Individual 9x6cm - EAN-128 (GS1)',
          codigo: 'PESAJE_INDIVIDUAL_EAN128_V3',
          tipo: 'MEDIA_RES',
          tipoImpresora: 'DATAMAX',
          contenido: rotuloPesajeIndividualEAN128,
          ancho: 90,  // 9cm
          alto: 60,   // 6cm
          dpi: 203,
          activo: true,
          esDefault: true,
          variables: JSON.stringify([
            { variable: 'CODIGO_EAN128', campo: 'codigo_ean128' },
            { variable: 'TROPA', campo: 'tropa' },
            { variable: 'NUMERO', campo: 'numero' },
            { variable: 'PESO', campo: 'peso' }
          ])
        }
      })
      rotulosCreados.push(nuevoRotulo)
    }

    // ========================================
    // RÓTULO PESAJE INDIVIDUAL - VERSIÓN COMPACTA (sin código barras)
    // ========================================
    const rotuloCompacto = `
<STX>L
D11
H14
PG
C0002

; Número animal MUY GRANDE - CENTRADO
1K0200
1V0040
2f550
3c0000
e{NUMERO}

; Tropa y Peso
1K0150
1V0200
2f280
3c0000
eTropa: {TROPA}

1K0150
1V0280
2f350
3c0000
e{PESO} kg

E
`.trim()

    const existenteCompacto = await db.rotulo.findFirst({
      where: { 
        codigo: 'PESAJE_INDIVIDUAL_COMPACTO_DPL',
        tipoImpresora: 'DATAMAX'
      }
    })

    if (!existenteCompacto) {
      const nuevoRotulo = await db.rotulo.create({
        data: {
          nombre: 'Pesaje Individual Compacto 9x6cm - Datamax',
          codigo: 'PESAJE_INDIVIDUAL_COMPACTO_DPL',
          tipo: 'MEDIA_RES',
          tipoImpresora: 'DATAMAX',
          contenido: rotuloCompacto,
          ancho: 90,
          alto: 60,
          dpi: 203,
          activo: true,
          esDefault: false,
          variables: JSON.stringify([
            { variable: 'NUMERO', campo: 'numero' },
            { variable: 'TROPA', campo: 'tropa' },
            { variable: 'PESO', campo: 'peso' }
          ])
        }
      })
      rotulosCreados.push(nuevoRotulo)
    }

    // ========================================
    // RÓTULO MEDIA RES - Para faena (8x12cm) con EAN-128
    // ========================================
    const rotuloMediaRes = `
<STX>L
D11
H14
PG
C0010

; Header empresa
1K0250
1V0010
2f200
3c0000
eSOLEMAR ALIMENTARIA

; Número Garrón GRANDE
1K0300
1V0060
2f350
3c0000
e#{GARRON}

; Tropa
1K0300
1V0140
2f220
3c0000
eTropa: {TROPA}

; Peso
1K0300
1V0200
2f280
3c0000
ePeso: {PESO} kg

; Lado
1K0550
1V0140
2f220
3c0000
eLado: {LADO}

; Fecha
1K0300
1V0280
2f160
3c0000
e{FECHA}

; Código de barras EAN-128
1K0100
1V0350
2B4201
3c0000
e{CODIGO_EAN128}

E
`.trim()

    const existenteMediaRes = await db.rotulo.findFirst({
      where: { 
        codigo: 'MEDIA_RES_EAN128_V3',
        tipoImpresora: 'DATAMAX'
      }
    })

    if (!existenteMediaRes) {
      // Desmarcar otros media res como default
      await db.rotulo.updateMany({
        where: { 
          tipo: 'MEDIA_RES',
          tipoImpresora: 'DATAMAX',
          esDefault: true 
        },
        data: { esDefault: false }
      })

      const nuevoRotulo = await db.rotulo.create({
        data: {
          nombre: 'Media Res 8x12cm + EAN-128 - Datamax',
          codigo: 'MEDIA_RES_EAN128_V3',
          tipo: 'MEDIA_RES',
          tipoImpresora: 'DATAMAX',
          contenido: rotuloMediaRes,
          ancho: 80,
          alto: 120,
          dpi: 203,
          activo: true,
          esDefault: true,
          diasConsumo: 30,
          variables: JSON.stringify([
            { variable: 'GARRON', campo: 'garron' },
            { variable: 'TROPA', campo: 'tropa' },
            { variable: 'PESO', campo: 'peso' },
            { variable: 'LADO', campo: 'lado' },
            { variable: 'FECHA', campo: 'fecha' },
            { variable: 'CODIGO_EAN128', campo: 'codigo_ean128' }
          ])
        }
      })
      rotulosCreados.push(nuevoRotulo)
    }

    return NextResponse.json({
      success: true,
      message: `${rotulosCreados.length} rótulos DPL creados para Datamax Mark II con EAN-128`,
      rotulos: rotulosCreados.map(r => ({
        id: r.id,
        nombre: r.nombre,
        codigo: r.codigo,
        tipo: r.tipo,
        tipoImpresora: r.tipoImpresora,
        esDefault: r.esDefault
      }))
    })

  } catch (error) {
    console.error('Error al crear rótulos DPL:', error)
    return NextResponse.json(
      { error: 'Error al crear rótulos DPL', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET - Listar rótulos DPL disponibles
 */
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const rotulos = await db.rotulo.findMany({
      where: {
        tipoImpresora: 'DATAMAX',
        activo: true
      },
      orderBy: [
        { tipo: 'asc' },
        { esDefault: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      count: rotulos.length,
      data: rotulos.map(r => ({
        id: r.id,
        nombre: r.nombre,
        codigo: r.codigo,
        tipo: r.tipo,
        tipoImpresora: r.tipoImpresora,
        ancho: r.ancho,
        alto: r.alto,
        esDefault: r.esDefault
      }))
    })
  } catch (error) {
    console.error('Error al listar rótulos DPL:', error)
    return NextResponse.json(
      { error: 'Error al listar rótulos DPL' },
      { status: 500 }
    )
  }
}
