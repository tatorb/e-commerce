import { z } from 'zod';
import { CANCEL_BY_LABEL, dayText, isReleased, parsePeriod, SALE_STATE_LABEL, SHIP_STATE_LABEL, PERIODS } from '@/domain/sales';
import { cashPage, findSaleId, getSale, listSales, readerStatus, SALE_FILTERS, SHIP_FILTERS, shipmentGroups, type SaleRow } from '@/lib/sales/queries';
import { McpToolError, accountArg, defineTool, resolveAccount, when, type AccountRef, type McpContext } from './tool';

// Las ventas para Claude, solo para ver: la lista con filtros, una venta con
// lo que dejó, la caja de un período y los envíos por despachar. Las mismas
// cuentas que las pantallas de Ventas.

const periodArgs = {
  periodo: z
    .enum(PERIODS.map((p) => p.key) as [string, ...string[]])
    .optional()
    .describe('Un atajo: hoy, 7d, mes (este mes), mes-pasado, 30d o 12m. Sin periodo ni fechas, los últimos 30 días.'),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('El primer día, como 2026-10-01. Gana sobre periodo.'),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('El último día, incluido.'),
};

const saleLink = (ctx: McpContext, account: AccountRef, id: string) => `${ctx.baseUrl}/a/${account.slug}/ventas/${id}`;

/** Una venta en pocas palabras, para las listas. */
function brief(ctx: McpContext, account: AccountRef, r: SaleRow, now: Date) {
  return {
    venta: r.orderId,
    fecha: when(r.orderedAt, account),
    estado: SALE_STATE_LABEL[r.state],
    comprador: r.buyer,
    productos: r.lines.map((l) => ({ titulo: l.title, codigo: l.listingId, medida: l.measure, cantidad: l.quantity, precio_unitario: l.unitPrice })),
    vendido: r.money.sold,
    comision: r.money.fee,
    envio_a_cargo: r.money.shipping,
    queda: r.money.net,
    ganancia: r.money.profit,
    envio: r.shipState === 'NONE' ? null : `${SHIP_STATE_LABEL[r.shipState]}${r.shipKindLabel ? ` · ${r.shipKindLabel}` : ''}${r.shipDetail ? ` · ${r.shipDetail}` : ''}`,
    ...(r.shipState === 'TO_SHIP' && r.dispatchBy ? { despachar_antes_del: when(r.dispatchBy, account) } : {}),
    ...(r.claim ? { reclamo: true } : {}),
    plata: r.state !== 'PAID' ? null : isReleased(r, now) ? 'liberada' : r.releaseAt ? `se libera el ${when(r.releaseAt, account)}` : 'por liberar, sin fecha',
    link_app: saleLink(ctx, account, r.id),
  };
}

const listSalesTool = defineTool({
  name: 'list_sales',
  section: 'ventas',
  title: 'Ver las ventas',
  description:
    'Las ventas de la cuenta en un período, las más nuevas primero, con lo que pagó el comprador, la comisión del canal, el envío a cargo de la tienda, lo que queda, la ganancia y el estado del envío y de la plata. Trae también el resumen de todas las que coinciden. Filtra por estado, por envío y por texto: código de la venta, comprador, SKU, código de la publicación o producto. La ganancia resta además el IVA y los impuestos estimados con los parámetros de Ajustes, Precios, el embalaje y el costo de reposición; es null si falta el costo de algún producto.',
  input: z.object({
    cuenta: accountArg,
    ...periodArgs,
    estado: z.enum(SALE_FILTERS.map((f) => f.key) as [string, ...string[]]).optional().describe('todas, pagadas, sin-pagar, canceladas o reclamos.'),
    envio: z.enum(SHIP_FILTERS.map((f) => f.key) as [string, ...string[]]).optional().describe('todos, despachar, camino, entregados, problemas o full (los que despacha el canal).'),
    buscar: z.string().max(100).optional(),
    limite: z.number().int().min(1).max(100).optional().describe('Cuántas ventas traer. Sin decir, 30.'),
    pagina: z.number().int().min(1).optional(),
  }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const now = new Date();
    const period = parsePeriod(args, now, account.timezone);
    const list = await listSales(ctx.db, account.id, {
      period,
      state: (args.estado ?? 'todas') as never,
      ship: (args.envio ?? 'todos') as never,
      q: args.buscar ?? '',
      page: args.pagina,
      take: args.limite ?? 30,
    });
    const s = list.summary;
    return {
      periodo: period.label,
      total: list.total,
      pagina: list.page,
      paginas: list.pages,
      resumen: {
        ventas_pagadas: s.count,
        unidades: s.units,
        vendido: s.sold,
        comision: s.fee,
        envios_a_cargo: s.shipping,
        queda: s.net,
        ganancia: s.withCost.count > 0 ? s.withCost.profit : null,
        margen_sobre_costo_pct: s.withCost.marginPct,
        ventas_sin_costo: s.withoutCost,
        canceladas: s.cancelled.count,
        sin_pagar: s.pending.count,
        reclamos: s.claims,
      },
      ventas: list.rows.map((r) => brief(ctx, account, r, now)),
    };
  },
});

const getSaleTool = defineTool({
  name: 'get_sale',
  section: 'ventas',
  title: 'Ver una venta',
  description:
    'Una venta con todo: los productos con su medida, publicación y costo, la cuenta de lo que dejó (vendido, comisión, envío, IVA e impuestos estimados, embalaje, costo y ganancia), los pagos con las cuotas y cuándo se libera la plata, el envío con su estado, seguimiento y hora límite para despachar, y lo que movió del stock.',
  input: z.object({ cuenta: accountArg, venta: z.string().min(1).max(40).describe('El código de la venta en el canal, el del carrito o el de la app.') }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await findSaleId(ctx.db, account.id, args.venta.trim());
    if (!id) throw new McpToolError(`La venta ${args.venta} no está en la cuenta. Si es nueva, puede que todavía no se haya leído: las ventas se leen cada hora y al tocar «Traer ventas ahora» en Ventas.`);
    const s = (await getSale(ctx.db, account.id, id))!;
    const now = new Date();
    const m = s.money;
    return {
      ...brief(ctx, account, s, now),
      tienda: s.storeName,
      canal: s.channelName,
      link_canal: s.url,
      ...(s.state === 'CANCELLED' ? { cancelada: { la_pidio: s.cancelBy ? (CANCEL_BY_LABEL[s.cancelBy] ?? s.cancelBy) : null, motivo: s.cancelReason } } : {}),
      productos: s.lines.map((l) => ({
        titulo: l.title,
        codigo: l.listingId,
        sku: l.sku,
        medida: l.measure,
        cantidad: l.quantity,
        precio_unitario: l.unitPrice,
        precio_publicado: l.listPrice,
        costo_unitario: l.unitCost,
        producto: l.productId ? (s.products.get(l.productId)?.name ?? null) : null,
      })),
      cuenta: m.cancelled
        ? null
        : {
            vendido: m.sold,
            descuento: m.discount,
            comision: m.fee,
            comision_estimada: m.feeEstimated,
            envio_a_cargo: m.shipping,
            envio_sin_dato: m.shippingUnknown,
            queda: m.net,
            iva_estimado: m.vat,
            impuestos_estimados: m.taxes,
            embalaje: m.packaging,
            costo: m.cost,
            ganancia: m.profit,
            margen_sobre_costo_pct: m.marginPct,
            deposita_el_medio_de_pago: m.receivedFromPayment ? m.received : null,
            retenido_de_mas: m.withheld || null,
          },
      pagos: s.payments.map((p) => ({ monto: p.amount, medio: p.method, cuotas: p.installments, estado: p.state, aprobado: p.approvedAt })),
      envio_detalle:
        s.shipState === 'NONE'
          ? null
          : {
              estado: SHIP_STATE_LABEL[s.shipState],
              detalle: s.shipDetail,
              como: s.shipKindLabel,
              seguimiento: s.tracking,
              despachar_antes_del: when(s.dispatchBy, account),
              salio: when(s.shippedAt, account),
              llego: when(s.deliveredAt, account),
              llega_mas_o_menos: when(s.estimatedAt, account),
              demorado: s.shipDelayed,
            },
      stock: s.stock ? { estado: s.stock.status, movimientos: s.stock.moves.map((mv) => ({ producto: mv.productName, medida: mv.measure, cambio: mv.delta, quedo: mv.after })) } : null,
      ...(s.incomplete ? { aviso: 'Todavía falta leer el envío y el pago de esta venta: se completa en la próxima lectura.' } : {}),
    };
  },
});

const cashSummaryTool = defineTool({
  name: 'get_cash_summary',
  section: 'ventas',
  title: 'Ver la caja',
  description:
    'La caja de un período: lo vendido con lo que se llevó el canal, el IVA y los impuestos estimados, el costo y la ganancia; la plata que liberó el medio de pago en el período y la que falta liberar, día por día; las cancelaciones y reclamos, y lo que dejó cada producto. Sin período, este mes.',
  input: z.object({ cuenta: accountArg, ...periodArgs, productos: z.number().int().min(0).max(100).optional().describe('Cuántos productos traer, los que más vendieron primero. Sin decir, 20.') }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const now = new Date();
    const period = parsePeriod(args, now, account.timezone, 'mes');
    const [data, status] = await Promise.all([cashPage(ctx.db, account.id, period, now, account.timezone), readerStatus(ctx.db, account.id)]);
    const s = data.summary;
    const reading = status.filter((x) => (x.history && !x.history.done) || x.incomplete > 0 || x.lastError);
    return {
      periodo: period.label,
      resultado: {
        ventas_pagadas: s.count,
        unidades: s.units,
        vendido: s.sold,
        descuentos: s.discount,
        comision: s.fee,
        envios_a_cargo: s.shipping,
        queda: s.net,
        iva_estimado: s.vat,
        impuestos_estimados: s.taxes,
        embalaje: s.packaging,
        costo: s.withCost.cost,
        ganancia: s.withCost.count > 0 ? s.withCost.profit : null,
        margen_sobre_costo_pct: s.withCost.marginPct,
        ventas_sin_costo: s.withoutCost,
        envios_sin_costo_todavia: s.shippingUnknown,
      },
      plata: {
        liberada_en_el_periodo: data.cash.released.amount,
        por_liberar: data.cash.waiting.amount,
        por_liberar_por_dia: data.cash.waiting.days.map((d) => ({ dia: dayText(d.day), monto: d.amount, ventas: d.count })),
        por_liberar_sin_fecha: data.cash.waiting.undated.amount,
      },
      canceladas: s.cancelled,
      sin_pagar: s.pending,
      reclamos: s.claims,
      productos: data.products.slice(0, args.productos ?? 20).map((p) => ({ producto: p.name, unidades: p.units, vendido: p.sold, costo: p.cost, ganancia: p.profit })),
      ...(reading.length > 0
        ? {
            aviso: reading
              .map((x) => (x.lastError ? `${x.storeName}: ${x.lastError}` : x.history && !x.history.done ? `${x.storeName}: todavía se están trayendo las ventas de los últimos 12 meses (${x.history.pct} %).` : `${x.storeName}: falta leer el envío y el pago de ${x.incomplete} ventas.`))
              .join(' '),
          }
        : {}),
    };
  },
});

const shipmentsTool = defineTool({
  name: 'get_shipments',
  section: 'ventas',
  title: 'Ver los envíos',
  description:
    'Los envíos de la cuenta: los que hay que despachar, primero los que vencen antes, con su hora límite; los que tienen problemas (demorados, no entregados o que vuelven); los que están en camino; los entregados en los últimos 7 días, y los que despacha el canal desde su depósito, como Full.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const now = new Date();
    const g = await shipmentGroups(ctx.db, account.id, now);
    const map = (rows: SaleRow[]) => rows.map((r) => brief(ctx, account, r, now));
    return {
      para_despachar: map(g.toShip),
      con_problemas: map(g.problems),
      en_camino: map(g.onTheWay),
      entregados_7_dias: g.delivered.length,
      los_despacha_el_canal: g.channel.length,
    };
  },
});

export const SALES_TOOLS = [listSalesTool, getSaleTool, cashSummaryTool, shipmentsTool];
