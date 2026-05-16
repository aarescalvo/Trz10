import { NextRequest, NextResponse } from 'next/server'
import { TipoRotulo } from '@prisma/client'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// ==================== PLANTILLAS ZPL (ZEBRA) ====================

const ZPL_PESAJE_INDIVIDUAL = `^XA
^FX Rótulo Pesaje Individual - SOLEMAR
^PW400
^LL200
^CI28
^FO20,15^A0N,28,28^FD**SOLEMAR ALIMENTARIA**^FS
^FO20,50^A0N,48,48^FD#{{NUMERO}}^FS
^FO20,105^A0N,18,18^FDTropa: {{TROPA}}^FS
^FO200,105^A0N,18,18^FDTipo: {{TIPO}}^FS
^FO20,130^A0N,22,22^FD{{PESO}} kg^FS
^FO150,130^A0N,16,16^FD{{RAZA}}^FS
^FO20,160^BCN,30,Y,Y,N^FD{{CODIGO}}^FS
^XZ`

const ZPL_MEDIA_RES = `^XA
^FX Rótulo Media Res - SOLEMAR
^PW320
^LL480
^CI28
^FO10,10^A0N,25,25^FD**ROTULO DEFINITIVO**^FS
^FO10,40^A0N,20,20^FDSOLEMAR ALIMENTARIA^FS
^FO10,70^A0N,18,18^FDEst. N 3986^FS
^FO10,100^A0N,30,30^FD{{PRODUCTO}}^FS
^FO10,140^A0N,18,18^FDFecha: {{FECHA}}^FS
^FO160,140^A0N,18,18^FDTropa: {{TROPA}}^FS
^FO10,170^A0N,18,18^FDLado: {{LADO}}^FS
^FO160,170^A0N,18,18^FDPeso: {{PESO}} kg^FS
^FO10,210^A0N,15,15^FDConsumir antes: {{FECHA_VENC}}^FS
^FO10,250^BCN,50,Y,Y,N^FD{{CODIGO_BARRAS}}^FS
^FO10,320^A0N,12,12^FDConservar a -1.5C a 4C^FS
^XZ`

const ZPL_MENUDENCIA = `^XA
^FX Rótulo Menudencia - SOLEMAR
^PW240
^LL320
^CI28
^FO10,10^A0N,20,20^FDSOLEMAR ALIMENTARIA^FS
^FO10,40^A0N,25,25^FD{{PRODUCTO}}^FS
^FO10,80^A0N,15,15^FDFecha: {{FECHA}}^FS
^FO130,80^A0N,15,15^FD{{PESO}}kg^FS
^FO10,110^A0N,12,12^FDVto: {{FECHA_VENC}}^FS
^FO10,150^BCN,40,Y,Y,N^FD{{CODIGO_BARRAS}}^FS
^FO10,210^A0N,10,10^FDConservar a -1.5C a 4C^FS
^XZ`

// ==================== PLANTILLAS DPL (DATAMAX) ====================

const DPL_PESAJE_INDIVIDUAL = `<STX>C
<STX>E
<STX>H10
<STX>O0220
<STX>f320
<STX>c0400
<STX>d1
<STX>D
<STX>191100401000025SOLEMAR ALIMENTARIA
<STX>191100601500050#{{NUMERO}}
<STX>191100401000105Tropa: {{TROPA}}
<STX>191100402000105Tipo: {{TIPO}}
<STX>191100401000130{{PESO}} kg
<STX>191100401500130{{RAZA}}
<STX>1e000200001600080{{CODIGO}}
<ETX>`

const DPL_MEDIA_RES = `<STX>C
<STX>E
<STX>H10
<STX>O0220
<STX>f480
<STX>c0320
<STX>d1
<STX>D
<STX>191100201000010ROTULO DEFINITIVO
<STX>191100201000040SOLEMAR ALIMENTARIA
<STX>191100201000070Est. N 3986
<STX>191100301000100{{PRODUCTO}}
<STX>191100201000140Fecha: {{FECHA}}
<STX>191100201600140Tropa: {{TROPA}}
<STX>191100201000170Lado: {{LADO}}
<STX>191100201600170Peso: {{PESO}} kg
<STX>191100151000210Consumir antes: {{FECHA_VENC}}
<STX>1e00020000100250080{{CODIGO_BARRAS}}
<ETX>`

const DPL_MENUDENCIA = `<STX>C
<STX>E
<STX>H10
<STX>O0220
<STX>f320
<STX>c0240
<STX>d1
<STX>D
<STX>191100201000010SOLEMAR ALIMENTARIA
<STX>191100251000040{{PRODUCTO}}
<STX>191100151000080Fecha: {{FECHA}}
<STX>191100151300080{{PESO}}kg
<STX>191100121000110Vto: {{FECHA_VENC}}
<STX>1e00020000100150070{{CODIGO_BARRAS}}
<ETX>`

// ==================== VARIABLES ====================

const VARIABLES_PESAJE = JSON.stringify([
  { variable: '{{NUMERO}}', campo: 'numero', descripcion: 'Número de animal' },
  { variable: '{{TROPA}}', campo: 'tropa', descripcion: 'Código de tropa' },
  { variable: '{{TIPO}}', campo: 'tipoAnimal', descripcion: 'Tipo de animal' },
  { variable: '{{PESO}}', campo: 'pesoVivo', descripcion: 'Peso vivo' },
  { variable: '{{CODIGO}}', campo: 'codigo', descripcion: 'Código del animal' },
  { variable: '{{RAZA}}', campo: 'raza', descripcion: 'Raza' },
  { variable: '{{CARAVANA}}', campo: 'caravana', descripcion: 'Caravana' },
])

const VARIABLES_MEDIA_RES = JSON.stringify([
  { variable: '{{PRODUCTO}}', campo: 'nombreProducto', descripcion: 'Nombre del producto' },
  { variable: '{{FECHA}}', campo: 'fechaFaena', descripcion: 'Fecha de faena' },
  { variable: '{{TROPA}}', campo: 'tropa', descripcion: 'Código de tropa' },
  { variable: '{{LADO}}', campo: 'ladoMedia', descripcion: 'Lado (I/D)' },
  { variable: '{{PESO}}', campo: 'peso', descripcion: 'Peso' },
  { variable: '{{FECHA_VENC}}', campo: 'fechaVencimiento', descripcion: 'Fecha vencimiento' },
  { variable: '{{CODIGO_BARRAS}}', campo: 'codigoBarras', descripcion: 'Código de barras' },
])

const VARIABLES_MENUDENCIA = JSON.stringify([
  { variable: '{{PRODUCTO}}', campo: 'nombreProducto', descripcion: 'Producto' },
  { variable: '{{FECHA}}', campo: 'fechaFaena', descripcion: 'Fecha' },
  { variable: '{{PESO}}', campo: 'peso', descripcion: 'Peso' },
  { variable: '{{FECHA_VENC}}', campo: 'fechaVencimiento', descripcion: 'Vencimiento' },
  { variable: '{{CODIGO_BARRAS}}', campo: 'codigoBarras', descripcion: 'Código barras' },
])

// ==================== POST - CREAR RÓTULOS ====================

export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const rotulos = [
      // ZEBRA ZT230 (203 DPI)
      {
        nombre: 'Pesaje Individual - Zebra ZT230',
        codigo: 'PESAJE_IND_ZT230',
        tipo: TipoRotulo.MEDIA_RES,
        categoria: 'PESAJE_INDIVIDUAL',
        tipoImpresora: 'ZEBRA',
        ancho: 100,
        alto: 50,
        dpi: 203,
        contenido: ZPL_PESAJE_INDIVIDUAL,
        variables: VARIABLES_PESAJE,
        diasConsumo: 30,
        temperaturaMax: 5.0,
        activo: true,
        esDefault: true
      },
      // ZEBRA ZT410 (300 DPI)
      {
        nombre: 'Pesaje Individual - Zebra ZT410',
        codigo: 'PESAJE_IND_ZT410',
        tipo: TipoRotulo.MEDIA_RES,
        categoria: 'PESAJE_INDIVIDUAL',
        tipoImpresora: 'ZEBRA',
        ancho: 100,
        alto: 50,
        dpi: 300,
        contenido: ZPL_PESAJE_INDIVIDUAL,
        variables: VARIABLES_PESAJE,
        diasConsumo: 30,
        temperaturaMax: 5.0,
        activo: true,
        esDefault: false
      },
      // DATAMAX MARK II
      {
        nombre: 'Pesaje Individual - Datamax Mark II',
        codigo: 'PESAJE_IND_MARK2',
        tipo: TipoRotulo.MEDIA_RES,
        categoria: 'PESAJE_INDIVIDUAL',
        tipoImpresora: 'DATAMAX',
        ancho: 100,
        alto: 50,
        dpi: 203,
        contenido: DPL_PESAJE_INDIVIDUAL,
        variables: VARIABLES_PESAJE,
        diasConsumo: 30,
        temperaturaMax: 5.0,
        activo: true,
        esDefault: false
      },
      // MEDIA RES - ZEBRA
      {
        nombre: 'Media Res - Zebra ZT230',
        codigo: 'MEDIA_RES_ZT230',
        tipo: TipoRotulo.MEDIA_RES,
        categoria: 'MEDIA_RES',
        tipoImpresora: 'ZEBRA',
        ancho: 80,
        alto: 120,
        dpi: 203,
        contenido: ZPL_MEDIA_RES,
        variables: VARIABLES_MEDIA_RES,
        diasConsumo: 30,
        temperaturaMax: 5.0,
        activo: true,
        esDefault: true
      },
      // MEDIA RES - DATAMAX
      {
        nombre: 'Media Res - Datamax Mark II',
        codigo: 'MEDIA_RES_MARK2',
        tipo: TipoRotulo.MEDIA_RES,
        categoria: 'MEDIA_RES',
        tipoImpresora: 'DATAMAX',
        ancho: 80,
        alto: 120,
        dpi: 203,
        contenido: DPL_MEDIA_RES,
        variables: VARIABLES_MEDIA_RES,
        diasConsumo: 30,
        temperaturaMax: 5.0,
        activo: true,
        esDefault: false
      },
      // MENUDENCIA - ZEBRA
      {
        nombre: 'Menudencia - Zebra ZT230',
        codigo: 'MENUDENCIA_ZT230',
        tipo: TipoRotulo.MENUDENCIA,
        categoria: 'MENUDENCIA',
        tipoImpresora: 'ZEBRA',
        ancho: 60,
        alto: 80,
        dpi: 203,
        contenido: ZPL_MENUDENCIA,
        variables: VARIABLES_MENUDENCIA,
        diasConsumo: 30,
        temperaturaMax: 5.0,
        activo: true,
        esDefault: true
      },
      // MENUDENCIA - DATAMAX
      {
        nombre: 'Menudencia - Datamax Mark II',
        codigo: 'MENUDENCIA_MARK2',
        tipo: TipoRotulo.MENUDENCIA,
        categoria: 'MENUDENCIA',
        tipoImpresora: 'DATAMAX',
        ancho: 60,
        alto: 80,
        dpi: 203,
        contenido: DPL_MENUDENCIA,
        variables: VARIABLES_MENUDENCIA,
        diasConsumo: 30,
        temperaturaMax: 5.0,
        activo: true,
        esDefault: false
      }
    ]

    let creados = 0
    let actualizados = 0
    const errores: string[] = []

    for (const rotulo of rotulos) {
      try {
        const existente = await db.rotulo.findUnique({
          where: { codigo: rotulo.codigo }
        })

        if (existente) {
          await db.rotulo.update({
            where: { codigo: rotulo.codigo },
            data: {
              contenido: rotulo.contenido,
              variables: rotulo.variables
            }
          })
          actualizados++
        } else {
          await db.rotulo.create({ data: rotulo as unknown as Parameters<typeof db.rotulo.create>[0]['data'] })
          creados++
        }
      } catch (e) {
        errores.push(`${rotulo.codigo}: ${String(e)}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Rótulos inicializados correctamente',
      creados,
      actualizados,
      total: creados + actualizados,
      errores: errores.length > 0 ? errores : undefined,
      impresorasSoportadas: [
        { marca: 'Zebra', modelos: ['ZT410 (300 DPI)', 'ZT230 (203 DPI)'], formato: 'ZPL' },
        { marca: 'Datamax', modelos: ['Mark II'], formato: 'DPL' }
      ]
    })
  } catch (error) {
    console.error('Error al inicializar rótulos:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}

// ==================== GET - VER ESTADO ====================

export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const total = await db.rotulo.count()
    const activos = await db.rotulo.count({ where: { activo: true } })
    const defaults = await db.rotulo.count({ where: { esDefault: true } })

    const zebra = await db.rotulo.count({ where: { tipoImpresora: 'ZEBRA' } })
    const datamax = await db.rotulo.count({ where: { tipoImpresora: 'DATAMAX' } })

    const lista = await db.rotulo.findMany({
      select: { codigo: true, nombre: true, tipo: true, categoria: true, tipoImpresora: true },
      orderBy: { codigo: 'asc' }
    })

    return NextResponse.json({
      success: true,
      total,
      activos,
      defaults,
      porTipo: { zebra, datamax },
      rotulos: lista
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}
