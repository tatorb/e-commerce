import { z } from 'zod';
import { matchSlot, StockError, stockSlots, stockText } from '@/domain/stock';
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

export const STOCK_TOOLS = [setProductStockTool, setProductCostTool];
