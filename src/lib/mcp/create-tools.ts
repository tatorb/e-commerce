import { z } from 'zod';
import { familyMemberIds } from '@/domain/family-members';
import { createChecks, createInChannel, CreateError } from '@/lib/channel-create';
import { syncStock } from '@/lib/stock';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication } from './tool';

// Crear en el canal, desde Claude, una publicación que todavía no está
// publicada: lo mismo que la tarjeta "Crear en el canal" del paso Publicación,
// con la misma revisión de lo que falta. Con varias medidas se crea una
// publicación por medida, en la misma familia.

const getCreateStep = defineTool({
  name: 'get_create_step',
  section: 'subir',
  title: 'Ver qué falta para crear en el canal',
  description:
    'Muestra lo mismo que la tarjeta "Crear en el canal" del paso Publicación, para una publicación que todavía no está publicada en el canal: qué está listo y qué falta (título, categoría, datos obligatorios, fotos de cada medida, medidas, descripción, garantía), las medidas que se van a crear (con varias medidas, una publicación por medida, en la misma familia), el precio guardado en el paso Precio, el stock de cada medida y los tipos de publicación que acepta el canal. Alcanza con una foto por medida: no hace falta un mínimo de fotos. Usala antes de create_in_channel.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    try {
      const info = await createChecks(ctx.db, { accountId: account.id, publicationId: id });
      const missing = info.checks.filter((c) => c.blocking && !c.ok);
      return {
        canal: info.channelName,
        se_puede_crear: info.ready,
        ...(info.blocked ? { motivo: info.blocked } : missing.length > 0 ? { falta: missing.map((c) => `${c.label}: ${c.detail}`) } : {}),
        revision: info.checks.map((c) => ({ dato: c.label, listo: c.ok, detalle: c.detail, ...(c.blocking ? {} : { se_puede_crear_sin_esto: true }) })),
        ...(info.measures.length > 0
          ? {
              medidas: info.measures.map((m) => ({
                medida: m.label,
                ...(m.price !== null ? { precio_propio: m.price } : {}),
                ...(info.stock ? { stock: info.stock.quantities[m.key] ?? null } : {}),
              })),
            }
          : info.stock
            ? { stock: info.stock.quantity }
            : {}),
        ...(info.published.length > 0 ? { ya_publicadas: info.published.map((x) => ({ medida: x.label, publicacion: x.externalId })) } : {}),
        precio_guardado: info.price,
        tipos_de_publicacion: info.listingTypes.map((t) => ({ tipo: t.value, nombre: t.label })),
        cantidad: info.stock ? 'Arranca con el stock del producto; después la app la mantiene con cada venta.' : 'El producto no lleva stock en la app: pasá la cantidad.',
      };
    } catch (e) {
      if (e instanceof CreateError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

const createInChannelTool = defineTool({
  name: 'create_in_channel',
  section: 'subir',
  title: 'Crear la publicación en el canal',
  description:
    'Crea en el canal una publicación que todavía no está publicada, como el botón "Crear en el canal" del paso Publicación: con el título, la descripción, la categoría, los datos de catálogo y las fotos que tiene en la app. Si el producto tiene varias medidas, crea una publicación por medida, todas en la misma familia, cada una con su SKU, su cantidad y sus fotos; la que tiene precio propio va con el suyo. Alcanza con una foto por medida. Antes, mirá con get_create_step que no falte nada. El precio, sin mandarlo, es el guardado en el paso Precio. La cantidad, sin mandarla, es el stock del producto (de cada medida); si el producto no lleva stock en la app, pasala. Al crearla, la app carga el código del canal de cada medida y sube el stock. Devuelve el código y el link de cada una, o el motivo exacto si el canal no la aceptó. Crea la publicación de verdad en el canal: antes, mostrale a la persona el título, las medidas, el precio, la cantidad de cada medida y el tipo de publicación, y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    tipo: z.string().min(1).max(40).describe('El tipo de publicación: su tipo en tipos_de_publicacion de get_create_step, por ejemplo "clasica" o "premium".'),
    precio: z.number().positive().max(1_000_000_000).optional().describe('El precio publicado, en pesos. Sin mandarlo, el guardado en el paso Precio.'),
    cantidad: z.number().int().min(1).max(99_999).optional().describe('Sin medidas: la cantidad. Sin mandarla, el stock del producto.'),
    cantidades: z
      .array(z.object({ medida: z.string().min(1).max(200), cantidad: z.number().int().min(1).max(99_999) }))
      .max(50)
      .optional()
      .describe('Con varias medidas: la cantidad de cada una, por su medida en get_create_step. Las que no mandes van con su stock.'),
  }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    try {
      const info = await createChecks(ctx.db, { accountId: account.id, publicationId: id });
      if (info.blocked) throw new McpToolError(info.blocked);
      const missing = info.checks.filter((c) => c.blocking && !c.ok);
      if (missing.length > 0) throw new McpToolError(`Todavía no se puede crear: ${missing.map((c) => `${c.label}: ${c.detail}`).join(' ')}`);
      const type = info.listingTypes.find((t) => t.value === args.tipo.trim().toLowerCase());
      if (!type) throw new McpToolError(`Ese tipo de publicación no está. Los que acepta ${info.channelName}: ${info.listingTypes.map((t) => t.value).join(', ')}.`);
      const price = args.precio ?? info.price;
      if (price === null) throw new McpToolError('Falta el precio: guardalo en el paso Precio con save_price o pasalo en precio.');

      // El stock, si alcanza para empezar.
      const usable = (n: number | null | undefined) => (typeof n === 'number' && n >= 1 ? n : undefined);
      let quantity: number | undefined;
      let quantities: Record<string, number> | undefined;
      if (info.measures.length === 0) {
        quantity = args.cantidad ?? usable(info.stock?.quantity);
        if (quantity === undefined) throw new McpToolError(info.stock ? 'El producto no tiene stock: pasá la cantidad o cargá el stock con set_product_stock.' : 'Pasá la cantidad.');
      } else {
        const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
        const unknown = (args.cantidades ?? []).filter((c) => !info.measures.some((m) => norm(m.label) === norm(c.medida)));
        if (unknown.length > 0) {
          throw new McpToolError(`No hay una medida ${unknown.map((c) => `«${c.medida}»`).join(', ')} para crear. Las medidas son ${info.measures.map((m) => m.label).join(', ')}.`);
        }
        quantities = {};
        const short: string[] = [];
        for (const m of info.measures) {
          const given = args.cantidades?.find((c) => norm(c.medida) === norm(m.label))?.cantidad;
          const n = given ?? usable(info.stock?.quantities[m.key]);
          if (n === undefined) short.push(m.label);
          else quantities[m.key] = n;
        }
        if (short.length > 0) throw new McpToolError(`Falta la cantidad de ${short.join(', ')}${info.stock ? ', que no tiene stock' : ''}: pasala en cantidades.`);
      }

      const created = await createInChannel(ctx.db, { accountId: account.id, publicationId: id, price, quantity, quantities, listingType: type.value, userId: ctx.userId });
      // Como el botón: si el producto lleva stock en la app, queda con ese, en cada medida de la familia.
      const members = await familyMemberIds(ctx.db, id);
      await syncStock(ctx.db, { publicationIds: members, userId: ctx.userId, note: 'Al crearla, con el stock del producto.' }).catch((e) =>
        console.error('No se pudo subir el stock', e instanceof Error ? e.message : e),
      );
      const codes = created.created.length > 0 ? created.created.map((c) => c.externalId) : [created.externalId];
      const rows = await ctx.db.publication.findMany({ where: { id: { in: members }, externalId: { in: codes } }, select: { externalId: true, url: true } });
      const link = new Map(rows.map((r) => [r.externalId, r.url]));
      const items =
        created.created.length > 0
          ? created.created.map((c) => ({ medida: c.label, publicacion: c.externalId, link: link.get(c.externalId) ?? null }))
          : [{ publicacion: created.externalId, link: link.get(created.externalId) ?? created.url }];
      const notCreated = info.measures.filter((m) => !created.created.some((c) => c.label === m.label)).map((m) => m.label);
      return {
        creada: true,
        tipo: type.label,
        precio: price,
        publicaciones: items,
        ...(info.measures.length > 0 && notCreated.length > 0 ? { no_se_crearon: notCreated } : {}),
        confirmado_en_el_canal: created.confirmed,
        ...(created.warnings.length > 0 ? { avisos: created.warnings } : {}),
      };
    } catch (e) {
      if (e instanceof CreateError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

export const CREATE_TOOLS = [getCreateStep, createInChannelTool];
