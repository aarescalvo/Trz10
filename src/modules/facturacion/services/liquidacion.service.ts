import { liquidacionRepository } from '../repositories/liquidacion.repository'
import { tarifasService } from './tarifas.service'
import { eventBus } from '@/core/events/event-bus'
import { db } from '@/lib/db'
import { ESPECIE_TARIFA_MAP, CONDICION_IVA_COMPROBANTE, ALICUOTAS_IVA } from '../constants'

export class LiquidacionService {
  
  /**
   * Genera una liquidación pre-calculada desde el romaneo cerrado.
   * No emite factura aún — solo crea el borrador para revisión.
   */
  async crearDesdeRomaneo(tropaId: string, operadorId: string) {
    // 1. Obtener datos de la tropa (READ ONLY)
    const tropa = await db.tropa.findUniqueOrThrow({
      where: { id: tropaId },
      include: {
        usuarioFaena: true,
      }
    })
    
    if (!tropa.fechaFaena) throw new Error('La tropa no tiene fecha de faena')
    if (!tropa.kgGancho) throw new Error('La tropa no tiene kg de romaneo (kgGancho)')
    
    // Check if already has liquidacion
    const existing = await db.liquidacionFaena.findFirst({ where: { tropaId } })
    if (existing) throw new Error('Esta tropa ya tiene una liquidación')
    
    const kgRomaneo = tropa.kgGancho
    const fechaFaena = tropa.fechaFaena
    const especie = tropa.especie
    
    // 2. Resolver tarifa vigente a la fecha de faena
    const tipoTarifaCodigo = ESPECIE_TARIFA_MAP[especie] || `FAENA_${especie}`
    const tarifa = await tarifasService.getTarifaVigente({
      tipoTarifaCodigo,
      fechaFaena,
      clienteId: tropa.usuarioFaenaId,
      especie,
    })
    
    // 3. Calcular item principal
    const subtotalFaena = kgRomaneo * tarifa.valor
    const ivaFaena = subtotalFaena * (ALICUOTAS_IVA.SERVICIO_FAENA / 100)
    
    // 4. Crear liquidación en estado BORRADOR
    const liquidacion = await liquidacionRepository.createFromRomaneo({
      tropaId,
      clienteId: tropa.usuarioFaenaId,
      fechaFaena,
      dteSenasa: tropa.dte,
      cantCabezas: tropa.cantidadCabezas,
      kgRomaneo,
      tarifaFaenaId: tarifa.id,
      tarifaFaenaValor: tarifa.valor,
      subtotalNeto: subtotalFaena,
      totalIVA: ivaFaena,
      totalFinal: subtotalFaena + ivaFaena,
      operadorId,
      items: [{
        tipoTarifaId: tarifa.tipoTarifaId,
        descripcion: `Servicio de faena ${especie.toLowerCase()} — ${kgRomaneo} kg`,
        unidad: 'POR_KG',
        cantidad: kgRomaneo,
        tarifaValor: tarifa.valor,
        subtotal: subtotalFaena,
        alicuotaIVA: ALICUOTAS_IVA.SERVICIO_FAENA,
        importeIVA: ivaFaena,
      }]
    })
    
    eventBus.emit('liquidacion.creada', { liquidacionId: liquidacion.id, tropaId })
    
    return liquidacion
  }
  
  /**
   * Agregar/quitar conceptos adicionales al borrador
   */
  async actualizarItems(liquidacionId: string, items: Array<Record<string, unknown>>) {
    const liq = await liquidacionRepository.findById(liquidacionId)
    if (!liq) throw new Error('Liquidación no encontrada')
    if (liq.estado !== 'BORRADOR') throw new Error('Solo se pueden editar borradores')
    
    return liquidacionRepository.updateItems(liquidacionId, items as any)
  }
  
  /**
   * Emitir la factura desde la liquidación aprobada
   */
  async emitirFactura(liquidacionId: string) {
    const liq = await liquidacionRepository.findById(liquidacionId)
    if (!liq) throw new Error('Liquidación no encontrada')
    if (liq.estado !== 'BORRADOR') throw new Error('Solo se pueden emitir borradores')
    
    // Determinar tipo de comprobante según condición IVA del cliente
    const condicionIva = liq.cliente?.condicionIva || 'CF'
    const tipoComprobante = CONDICION_IVA_COMPROBANTE[condicionIva] || 'FACTURA_B'
    
    // Discriminar IVA según tipo
    const discriminadoIva = tipoComprobante === 'FACTURA_A'
    const subtotal = liq.subtotalNeto
    const iva = discriminadoIva ? liq.totalIVA : 0
    const total = discriminadoIva ? liq.totalFinal : liq.subtotalNeto
    
    // Ejecutar numerador + factura + liquidación EN TRANSACCIÓN
    const factura = await db.$transaction(async (tx) => {
      // Get next factura number (atómico dentro de la tx)
      const numerador = await tx.numerador.upsert({
        where: { nombre: 'FACTURA' },
        update: { ultimoNumero: { increment: 1 } },
        create: { nombre: 'FACTURA', ultimoNumero: 1 }
      })
      
      const numeroInterno = numerador.ultimoNumero
      const numero = String(numeroInterno).padStart(8, '0')
      
      // Crear factura
      const fac = await tx.factura.create({
        data: {
          numero,
          numeroInterno,
          tipoComprobante: tipoComprobante as any,
          clienteId: liq.clienteId,
          subtotal,
          iva,
          total,
          estado: 'PENDIENTE',
          condicionVenta: 'CUENTA_CORRIENTE',
          detalles: {
            create: liq.items?.map(item => ({
              tipoProducto: item.esDescuento ? 'OTRO' : 'OTRO',
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              unidad: item.unidad,
              precioUnitario: item.tarifaValor,
              subtotal: item.subtotal,
              pesoKg: item.unidad === 'POR_KG' || item.unidad === 'POR_KG_POR_DIA' ? item.cantidad : null,
            })) || []
          }
        }
      })
      
      // Actualizar liquidación (directamente en la tx)
      await tx.liquidacionFaena.update({
        where: { id: liquidacionId },
        data: {
          estado: 'EMITIDA',
          facturaId: fac.id,
        }
      })
      
      return fac
    })
    
    eventBus.emit('factura.generada', { facturaId: factura.id, liquidacionId })
    
    return factura
  }
  
  async getPendientes() {
    return liquidacionRepository.findPendientes()
  }
  
  async getById(id: string) {
    return liquidacionRepository.findById(id)
  }
  
  async getAll(filtros?: { estado?: string; clienteId?: string; desde?: Date; hasta?: Date }) {
    return liquidacionRepository.findAll(filtros)
  }
  
  async anular(liquidacionId: string) {
    const liq = await liquidacionRepository.findById(liquidacionId)
    if (!liq) throw new Error('Liquidación no encontrada')
    if (liq.estado === 'EMITIDA') throw new Error('No se puede anular una liquidación emitida. Genere una nota de crédito.')
    return liquidacionRepository.anular(liquidacionId)
  }
  
  async autorizarEdicion(liquidacionId: string, pin: string, operadorId: string) {
    // Verify supervisor PIN
    const supervisor = await db.operador.findFirst({
      where: {
        pinSupervisor: pin,
        activo: true,
        rol: { in: ['SUPERVISOR', 'ADMINISTRADOR'] }
      }
    })
    
    if (!supervisor) throw new Error('PIN de supervisor no válido')
    
    await liquidacionRepository.setSupervisor(liquidacionId, supervisor.id)
    
    return { autorizado: true, supervisorId: supervisor.id, supervisorNombre: supervisor.nombre }
  }
}

export const liquidacionService = new LiquidacionService()
