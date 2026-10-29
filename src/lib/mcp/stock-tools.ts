import { z } from 'zod';
import { matchSlot, StockError, stockSlots, stockText } from '@/domain/stock';
import { setProductStock, setShowMore } from '@/lib/stock';
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
    'Cambia el stock del producto de una publicación: las unidades que hay, o las de cada medida. Lo heredan todas sus publicaciones y las de los combos en que está, y la cantidad nueva se sube sola al canal. Las ventas del canal lo descuentan solas: usalo solo para lo que la persona te dice que cambió, por ejemplo mercadería que entró. Un combo no tiene stock propio: se cambia en sus piezas. También prende o apaga "Mostrar más de 5" (mostrar_mas_de_5): con stock de 1 a 5, los canales muestran 6 para que la publicación no se pause al vender la última, con alarmas para reponer; se pueden vender 2 sin tenerlas y, sin reponer, a los dos días se pausa. Cargar el stock resuelve sus alarmas. Antes de cambiarlo, mostrale a la persona qué vas a cambiar y esperá que confirme.',
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
    const r = await setProductStock(ctx.db, { accountId: account.id, productId: pub.product.id, userId: ctx.userId, stock });
    if (args.mostrar_mas_de_5 !== undefined) await setShowMore(ctx.db, { accountId: account.id, productId: pub.product.id, on: args.mostrar_mas_de_5, userId: ctx.userId });
    const now = await ctx.db.productStock.findMany({ where: { productId: pub.product.id }, select: { key: true, quantity: true } });
    return {
      guardado: true,
      stock: stockText(slots.map((s) => ({ label: s.label, quantity: now.find((n) => n.key === s.key)?.quantity ?? 0 }))),
      publicaciones_actualizadas: r.sync.sent,
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

export const STOCK_TOOLS = [setProductStockTool, setProductCostTool];
