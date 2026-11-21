import { z } from 'zod';
import { matchSlot, MAX_UNITS_PER_SALE, StockError, stockSlots, stockText } from '@/domain/stock';
import { previewUnitsPerSale, setUnitsPerSale, type UnitsRow } from '@/lib/units-per-sale';
import { setStockBulk, type BulkRowResult } from '@/lib/stock-bulk';
import { setProductStock, setShowMore } from '@/lib/stock';
import { accountBranches, branchStockText, findBranch } from '@/lib/branches';
import { CostError, costsForClaude, loadProductCosts, setProductCosts } from '@/lib/costs';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication } from './tool';

// El stock y el costo del producto desde Claude, con los mismos permisos que
// en la app. El stock se cambia en el producto y se sube solo a todas sus
// publicaciones; el costo lo heredan en el paso Precio.

const setProductStockTool = defineTool({
  name: 'set_product_stock',
  section: 'productos',
  title: 'Cambiar el stock del producto',
  description:
    'Cambia el stock del producto de una publicación: las unidades que hay, o las de cada medida. Lo heredan todas sus publicaciones y las de los combos en que está, y la cantidad nueva se sube sola al canal. Las ventas del canal lo descuentan solas: usalo solo para lo que la persona te dice que cambió, por ejemplo mercadería que entró. Un combo no tiene stock propio: se cambia en sus piezas. También prende o apaga "Mostrar más de 5" (mostrar_mas_de_5): con stock de 5 o menos, también en 0, los canales muestran 6 y la publicación nunca se pausa sola. Cuando una medida queda en 1 o en 0, por una venta, un ajuste o una carga, sale la alarma con una tarea para reponer, y al día sin reponer otro aviso; si hay que pausar, se pausa a mano con set_publication_status. Cargar el stock resuelve sus alarmas. En una cuenta con sucursales (get_branches), se carga el stock de una sucursal (sucursal) y el del producto es la suma; si una sucursal con Flex queda con o sin stock, Envíos Flex se prende o se apaga solo en sus publicaciones. Antes de cambiarlo, mostrale a la persona qué vas a cambiar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    unidades: z.number().int().min(0).max(99_999).optional().describe('Las unidades, si el producto no tiene medidas.'),
    medidas: z
      .array(z.object({ medida: z.string().min(1).describe('La medida o el SKU, por ejemplo STD o 0.50.'), unidades: z.number().int().min(0).max(99_999) }))
      .max(100)
      .optional()
      .describe('Las unidades de cada medida, si el producto tiene medidas. Las que no se mandan quedan como están.'),
    mostrar_mas_de_5: z.boolean().optional().describe('Prende o apaga "Mostrar más de 5" en el producto. Sin mandar, queda como está.'),
    sucursal: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe('En una cuenta con sucursales (get_branches): la sucursal cuyo stock se carga, por su nombre. Las unidades son las de esa sucursal; el stock del producto es la suma de todas.'),
  }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const publicationId = await resolvePublication(ctx, account.id, args.publicacion);
    const pub = await ctx.db.publication.findUniqueOrThrow({
      where: { id: publicationId },
      select: { product: { select: { id: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } } },
    });
    const slots = stockSlots(pub.product.variants);
    const onlySwitch = args.unidades === undefined && !args.medidas?.length && args.mostrar_mas_de_5 !== undefined;
    if (onlySwitch) {
      try {
        const sync = await setShowMore(ctx.db, { accountId: account.id, productId: pub.product.id, on: args.mostrar_mas_de_5!, userId: ctx.userId });
        return { guardado: true, mostrar_mas_de_5: args.mostrar_mas_de_5, publicaciones_actualizadas: sync.sent };
      } catch (e) {
        if (e instanceof StockError) throw new McpToolError(e.message);
        throw e;
      }
    }
    const stock: Record<string, number> = {};
    if (slots.length === 1) {
      if (args.unidades === undefined) throw new McpToolError('El producto no tiene medidas: pasá las unidades.');
      stock[slots[0].key] = args.unidades;
    } else {
      if (!args.medidas?.length) throw new McpToolError(`El producto tiene medidas: pasá las unidades de cada una (${slots.map((s) => s.label).join(', ')}).`);
      for (const m of args.medidas) {
        const key = matchSlot(slots, { sku: m.medida, measure: m.medida });
        if (key === null) throw new McpToolError(`"${m.medida}" no es una medida del producto. Medidas: ${slots.map((s) => s.label).join(', ')}.`);
        stock[key] = m.unidades;
      }
    }
    const branches = await accountBranches(ctx.db, account.id);
    let branchId: string | null = null;
    if (branches.length > 0) {
      const found = args.sucursal ? findBranch(branches, args.sucursal) : branches.length === 1 ? branches[0] : null;
      if (!found) throw new McpToolError(`${args.sucursal ? `"${args.sucursal}" no es una sucursal de la cuenta.` : 'La cuenta tiene sucursales: pasá de cuál es el stock.'} Sucursales: ${branches.map((b) => b.name).join(', ')}.`);
      branchId = found.id;
    } else if (args.sucursal) {
      throw new McpToolError('La cuenta no tiene sucursales: el stock es uno solo. Se crean con save_branch.');
    }
    let r;
    try {
      r = await setProductStock(ctx.db, { accountId: account.id, productId: pub.product.id, userId: ctx.userId, stock, branchId });
    } catch (e) {
      if (e instanceof StockError) throw new McpToolError(e.message);
      throw e;
    }
    if (args.mostrar_mas_de_5 !== undefined) await setShowMore(ctx.db, { accountId: account.id, productId: pub.product.id, on: args.mostrar_mas_de_5, userId: ctx.userId });
    const now = await ctx.db.productStock.findMany({ where: { productId: pub.product.id }, select: { key: true, quantity: true } });
    return {
      guardado: true,
      stock: stockText(slots.map((s) => ({ label: s.label, quantity: now.find((n) => n.key === s.key)?.quantity ?? 0 }))),
      ...(branchId ? { stock_por_sucursal: await branchStockText(ctx.db, pub.product.id, slots) } : {}),
      publicaciones_actualizadas: r.sync.sent,
      ...(r.sync.flex?.length ? { flex_cambiado_por_stock: r.sync.flex.map((f) => ({ publicacion_id: f.publicationId, flex: f.on ? 'prendido' : 'apagado' })) } : {}),
      ...(r.sync.failed.length > 0 ? { no_se_pudo_subir: r.sync.failed.map((f) => ({ publicacion: f.title, motivo: f.error })) } : {}),
    };
  },
});

const setProductCostTool = defineTool({
  name: 'set_product_cost',
  section: 'productos',
  title: 'Guardar el costo del producto',
  description:
    'Guarda el costo de reposición sin IVA del producto de una publicación, en pesos: uno solo si el producto no tiene medidas, o el de cada medida. Lo heredan sus publicaciones en el paso Precio. Usalo solo con los costos que te da la persona: no los supongas. Las medidas que no se mandan quedan como están. Los costos guardados se ven en get_publication, y al guardar te dice cómo quedaron. Antes de guardar, mostrale a la persona qué vas a cambiar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    costo: z.number().positive().max(999_999_999).optional().describe('El costo sin IVA, en pesos, si el producto no tiene medidas.'),
    medidas: z
      .array(z.object({ medida: z.string().min(1).describe('La medida o el SKU, por ejemplo STD o 0.50.'), costo: z.number().positive().max(999_999_999).describe('El costo sin IVA, en pesos.') }))
      .max(100)
      .optional()
      .describe('El costo de cada medida, si el producto tiene medidas.'),
  }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const publicationId = await resolvePublication(ctx, account.id, args.publicacion);
    const pub = await ctx.db.publication.findUniqueOrThrow({
      where: { id: publicationId },
      select: { product: { select: { id: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } } },
    });
    const slots = stockSlots(pub.product.variants);
    const costs: Record<string, number> = {};
    if (slots.length === 1) {
      if (args.costo === undefined) throw new McpToolError('El producto no tiene medidas: pasá el costo.');
      costs[slots[0].key] = args.costo;
    } else {
      if (!args.medidas?.length) throw new McpToolError(`El producto tiene medidas: pasá el costo de cada una (${slots.map((s) => s.label).join(', ')}).`);
      for (const m of args.medidas) {
        const key = matchSlot(slots, { sku: m.medida, measure: m.medida });
        if (key === null) throw new McpToolError(`"${m.medida}" no es una medida del producto. Medidas: ${slots.map((s) => s.label).join(', ')}.`);
        costs[key] = m.costo;
      }
    }
    try {
      const r = await setProductCosts(ctx.db, { accountId: account.id, productId: pub.product.id, costs, keepMissing: true });
      const now = await loadProductCosts(ctx.db, { accountId: account.id, productId: pub.product.id });
      return { guardado: true, medidas_cambiadas: r.changed, costo_de_reposicion_sin_iva: costsForClaude(now!.lines) };
    } catch (e) {
      if (e instanceof CostError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

const setUnitsPerSaleTool = defineTool({
  name: 'set_units_per_sale',
  section: 'productos',
  title: 'Cambiar de a cuántas unidades vende la publicación',
  description:
    'Las unidades por venta: de a cuántas unidades del stock del producto vende la publicación. El stock y el costo del producto quedan siempre en la unidad en que se cargan (por ejemplo aros por boca, pistones sueltos) y no se dividen; lo que cambia es que la publicación vende un juego de 4 o una caja de 6. Con unidades por venta 4 y 90 en el stock, el canal muestra 22; cada unidad vendida descuenta 4 y una cancelada devuelve 4; las alarmas y "Mostrar más de 5" cuentan lo que queda para vender; y en el paso Precio el costo de la publicación es el costo unitario por 4. Es de la familia y de todas sus opciones de venta (formas de cobro): se guarda en todas a la vez. Con solo_esta_medida, solo en la medida de esa publicación y sus opciones. Con vista_previa muestra, por medida y opción de venta, la cantidad que tiene hoy en el canal y la que le quedaría, sin guardar nada. Sin vista_previa lo guarda y sube la cantidad nueva al canal: primero llamala con vista_previa, mostrale a la persona qué cambia y esperá que confirme. Después de cambiarlo conviene revisar el precio con get_price_step, porque el costo de la publicación cambia.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    unidades: z.number().int().min(1).max(MAX_UNITS_PER_SALE).describe('De a cuántas unidades del stock vende, por ejemplo 4 para un juego de aros de 4 cilindros. 1 es de a una.'),
    vista_previa: z.boolean().optional().describe('true: solo muestra cómo quedaría, sin guardar ni subir nada.'),
    solo_esta_medida: z.boolean().optional().describe('true: solo la medida de esa publicación y sus opciones de venta, no toda la familia.'),
  }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const publicationId = await resolvePublication(ctx, account.id, args.publicacion);
    const base = { accountId: account.id, publicationId, units: args.unidades, onlyThisMeasure: args.solo_esta_medida === true };
    const row = (r: UnitsRow) => ({
      publicacion: r.externalId ?? r.id,
      titulo: r.title,
      ...(r.measure ? { medida: r.measure } : {}),
      ...(r.plan ? { forma_de_cobro: r.plan } : {}),
      unidades_por_venta_antes: r.before,
      unidades_por_venta: r.after,
      stock_del_producto_en_unidades: r.stock,
      cantidad_en_el_canal_hoy: r.inChannel,
      ...(r.note ? { la_cantidad_no_sale_del_stock: r.note } : { cantidad_que_le_toca: r.planned }),
    });
    try {
      if (args.vista_previa) {
        const p = await previewUnitsPerSale(ctx.db, base);
        return { vista_previa: true, unidades_por_venta: p.units, publicaciones: p.rows.map(row), aviso: 'No se guardó nada. Para guardarlo y subir la cantidad, volvé a llamar sin vista_previa cuando la persona confirme.' };
      }
      const r = await setUnitsPerSale(ctx.db, { ...base, userId: ctx.userId });
      return {
        guardado: true,
        unidades_por_venta: r.units,
        publicaciones_que_cambiaron: r.changed,
        publicaciones: r.rows.map(row),
        cantidades_subidas_al_canal: r.sync.sent,
        ...(r.sync.failed.length > 0 ? { no_se_pudo_subir: r.sync.failed.map((f) => ({ publicacion: f.title, motivo: f.error })) } : {}),
        aviso: 'El costo de la publicación en el paso Precio ahora es el costo unitario por las unidades por venta: revisá el precio con get_price_step.',
      };
    } catch (e) {
      if (e instanceof StockError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

const setStockBulkTool = defineTool({
  name: 'set_stock_bulk',
  section: 'productos',
  title: 'Cargar el stock de muchos productos',
  description:
    'Carga el stock de muchos productos en una sola llamada, hasta 300 filas, cada fila con su sucursal: sirve para pasar a la app lo que dice el sistema de la tienda, depósito por depósito. Cada fila es un producto (su número de pieza o el SKU de una de sus medidas; no importan espacios, guiones ni mayúsculas), la sucursal si la cuenta tiene sucursales, la medida si el producto tiene varias y no vino por el SKU, y las unidades de esa sucursal, en la unidad en que se carga el stock (sin dividir por las unidades por venta). Lo que no viene queda como está. Si hay dos productos con el mismo código va el que está publicado; si no se puede saber, la fila vuelve con error y se carga por su publicación con set_product_stock. Los combos no llevan stock propio. Guarda todo y al final sube las cantidades al canal y revisa Flex una sola vez; lo que no entra en el tiempo lo termina la pasada de cada hora (o sync_flex_by_stock). Con solo_mostrar no guarda nada: dice qué haría cada fila, con lo que tiene hoy y lo que quedaría. Devuelve cada fila con su resultado (guardada, igual o error con el motivo). Antes de guardar, llamala con solo_mostrar, mostrale a la persona cuántas cambian y los errores, y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    filas: z
      .array(
        z.object({
          producto: z.string().min(1).max(120).describe('El número de pieza del producto o el SKU de una de sus medidas.'),
          sucursal: z.string().min(1).max(80).optional().describe('La sucursal, por su nombre. Obligatoria si la cuenta tiene más de una.'),
          medida: z.string().min(1).max(80).optional().describe('La medida o su SKU, si el producto tiene varias y producto no es el SKU de la medida.'),
          unidades: z.number().int().min(0).max(99_999),
        }),
      )
      .min(1)
      .max(300),
    solo_mostrar: z.boolean().optional().describe('true: no guarda nada, solo dice qué haría cada fila.'),
  }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const r = await setStockBulk(ctx.db, {
      accountId: account.id,
      userId: ctx.userId,
      preview: args.solo_mostrar === true,
      rows: args.filas.map((f) => ({ product: f.producto, branch: f.sucursal ?? null, measure: f.medida ?? null, units: f.unidades })),
    });
    const row = (x: BulkRowResult) => ({
      fila: x.row,
      producto: x.product,
      ...(x.name ? { nombre: x.name } : {}),
      ...(x.branch ? { sucursal: x.branch } : {}),
      ...(x.measure ? { medida: x.measure } : {}),
      resultado: args.solo_mostrar && x.result === 'guardada' ? 'cambiaria' : x.result,
      ...(x.before !== undefined ? { tenia: x.before, queda: x.after } : {}),
      ...(x.message ? { motivo: x.message } : {}),
    });
    // Las que quedan igual no hace falta listarlas: van solo las que cambian y las que fallan.
    const shown = r.rows.filter((x) => x.result !== 'igual');
    return {
      ...(args.solo_mostrar ? { solo_mostrar: true, cambiarian: r.saved } : { guardadas: r.saved, productos_que_cambiaron: r.products }),
      iguales: r.same,
      con_error: r.failed,
      filas: shown.map(row),
      ...(r.sync
        ? {
            cantidades_subidas_al_canal: r.sync.sent,
            ...(r.sync.flex?.length ? { flex_prendido_en: r.sync.flex.filter((f) => f.on).length, flex_apagado_en: r.sync.flex.filter((f) => !f.on).length } : {}),
            ...(r.sync.failed.length > 0 ? { no_se_pudo_subir: r.sync.failed.slice(0, 20).map((f) => ({ publicacion: f.title, motivo: f.error })) } : {}),
            ...(r.sync.pending ? { aviso: 'Quedaron cantidades o Flex por subir: lo termina la pasada de cada hora, o sync_flex_by_stock para Flex.' } : {}),
          }
        : {}),
    };
  },
});

export const STOCK_TOOLS = [setProductStockTool, setProductCostTool, setUnitsPerSaleTool, setStockBulkTool];
