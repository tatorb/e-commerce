import { z } from 'zod';
import { categoryText, listCategoryClashes } from '@/lib/channel-category';
import { accountArg, defineTool, resolveAccount } from './tool';

// Los productos con opciones de venta en categorías distintas en el canal,
// para dejarlas todas en la misma antes de que el canal finalice las otras.

const clashesTool = defineTool({
  name: 'list_category_clashes',
  section: ['publicaciones', 'sincronizacion'],
  title: 'Ver productos con opciones en categorías distintas en el canal',
  description:
    'Lista los productos de la cuenta que tienen publicaciones activas (medidas y opciones de venta) en categorías distintas en el canal, como las leyó la última sincronización. Mercado Libre cambia a veces la categoría de algunas ("Elegimos por vos una nueva categoría") y finaliza las que quedan en la vieja, mezcladas con las nuevas dentro del mismo producto. Por cada producto dice cada categoría con sus códigos, la que tiene la mayoría primero. Solo lee: la categoría se cambia en Mercado Libre, y en la app en Datos de catálogo (save_catalog_data).',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const list = await listCategoryClashes(ctx.db, account.id);
    return {
      cuenta: account.slug,
      productos: list.length,
      con_categorias_distintas: list.map((c) => ({
        producto: c.product,
        tienda: `${c.channelName} · ${c.store}`,
        categorias: c.groups.map((g) => ({ categoria: categoryText(g), publicaciones_activas: g.externalIds })),
      })),
      ...(list.length === 0 ? { aviso: 'Ningún producto tiene publicaciones activas en categorías distintas.' } : {}),
    };
  },
});

export const CATEGORY_TOOLS = [clashesTool];
