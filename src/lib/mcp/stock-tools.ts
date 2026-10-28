import { z } from 'zod';
import { matchSlot, stockSlots, stockText } from '@/domain/stock';
import { setProductStock } from '@/lib/stock';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication } from './tool';

// El stock del producto desde Claude: se cambia en el producto y se sube solo
// a todas sus publicaciones, con los mismos permisos que en la app.

const setProductStockTool = defineTool({
  name: 'set_product_stock',
  section: 'productos',
  title: 'Cambiar el stock del producto',
  description:
    'Cambia el stock del producto de una publicación: las unidades que hay, o las de cada medida. Lo heredan todas sus publicaciones y las de los combos en que está, y la cantidad nueva se sube sola al canal. Las ventas del canal lo descuentan solas: usalo solo para lo que la persona te dice que cambió, por ejemplo mercadería que entró. Un combo no tiene stock propio: se cambia en sus piezas. Antes de cambiarlo, mostrale a la persona qué vas a cambiar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    unidades: z.number().int().min(0).max(99_999).optional().describe('Las unidades, si el producto no tiene medidas.'),
    medidas: z
      .array(z.object({ medida: z.string().min(1).describe('La medida o el SKU, por ejemplo STD o 0.50.'), unidades: z.number().int().min(0).max(99_999) }))
      .max(100)
      .optional()
      .describe('Las unidades de cada medida, si el producto tiene medidas. Las que no se mandan quedan como están.'),
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
    const now = await ctx.db.productStock.findMany({ where: { productId: pub.product.id }, select: { key: true, quantity: true } });
    return {
      guardado: true,
      stock: stockText(slots.map((s) => ({ label: s.label, quantity: now.find((n) => n.key === s.key)?.quantity ?? 0 }))),
      publicaciones_actualizadas: r.sync.sent,
      ...(r.sync.failed.length > 0 ? { no_se_pudo_subir: r.sync.failed.map((f) => ({ publicacion: f.title, motivo: f.error })) } : {}),
    };
  },
});

export const STOCK_TOOLS = [setProductStockTool];
