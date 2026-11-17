import { z } from 'zod';
import type { VolumeCampaign, VolumeItem } from '@/channels/volume';
import { ConnectError } from '@/channels/connect';
import {
  changeVolumeItems,
  createVolumeCampaign,
  deleteVolumeCampaign,
  getVolumeCampaign,
  listVolumeCampaigns,
  rawPromotions,
  VolumeError,
} from '@/lib/volume-campaigns';
import { McpToolError, accountArg, defineTool, findPublication, publicationArg, resolveAccount, resolvePublication } from './tool';

// Campañas de descuento por cantidad desde Claude: verlas, crearlas, sumarles
// y sacarles publicaciones y borrarlas. Todo lo que cambia algo en el canal
// pide antes la confirmación de la persona.

const CONFIRM = 'Antes, mostrale a la persona exactamente qué vas a hacer y esperá que confirme.';

const KIND_TEXT = { lleva_paga: 'llevá N y pagá M', descuento_llevando: '% de descuento llevando N', descuento_en_la_unidad: '% de descuento en la unidad N' } as const;

const campaignOut = (c: VolumeCampaign) => ({
  campana: c.id,
  nombre: c.name,
  tipo: c.kind ? KIND_TEXT[c.kind] : null,
  estado: c.status,
  cantidad_a_llevar: c.buyQuantity,
  cantidad_que_se_paga: c.payQuantity,
  descuento_pct: c.discountPct,
  combina_publicaciones: c.combine,
  desde: c.start,
  hasta: c.finish,
  respuesta_del_canal: c.raw,
});

const itemOut = (i: VolumeItem) => ({ codigo: i.externalId, estado: i.status, precio: i.price, precio_original: i.originalPrice, oferta: i.offerId, respuesta_del_canal: i.raw });

/** Los errores del canal, como mensaje para la persona. */
async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof VolumeError || e instanceof ConnectError) throw new McpToolError(e.message);
    throw e;
  }
}

const campaignArg = z.string().min(1).max(60).describe('El código de la campaña en el canal, por ejemplo C-MLA12345, como lo devuelve list_volume_campaigns o create_volume_campaign.');

const listTool = defineTool({
  name: 'list_volume_campaigns',
  section: 'publicaciones',
  title: 'Ver las campañas de descuento por cantidad',
  description:
    'Las campañas de descuento por cantidad de la cuenta en el canal ("llevá 3 y pagá 2", "10 % llevando 2", "50 % en la 2da unidad"), con su estado y sus fechas. Con campana, el detalle de esa y sus publicaciones candidatas y participantes, con el precio que informa el canal. Con publicacion, además, todo lo que el canal informa de las promociones de esa publicación, sin interpretar.',
  input: z.object({
    cuenta: accountArg,
    campana: campaignArg.optional(),
    publicacion: publicationArg.optional().describe('Para ver esa publicación dentro de la campaña y todas sus promociones en el canal.'),
    limite: z.number().int().min(1).max(50).optional().describe('Cuántas publicaciones de la campaña traer. Sin decir, 50.'),
  }),
  readOnly: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const pub = args.publicacion ? await rawPromotions(ctx.db, account.id, await resolvePublication(ctx, account.id, args.publicacion)) : null;
      const extra = pub ? { promociones_de_la_publicacion: { codigo: pub.externalId, respuesta_del_canal: pub.promotions } } : {};
      if (!args.campana) return { cuenta: account.slug, campanas: (await listVolumeCampaigns(ctx.db, account.id)).map(campaignOut), ...extra };
      const r = await getVolumeCampaign(ctx.db, account.id, args.campana, { externalId: pub?.externalId, limit: args.limite });
      return { cuenta: account.slug, ...campaignOut(r.campaign), publicaciones_en_total: r.items.total, publicaciones: r.items.items.map(itemOut), ...extra };
    }),
});

const createTool = defineTool({
  name: 'create_volume_campaign',
  section: 'subir',
  title: 'Crear una campaña de descuento por cantidad',
  description: `Crea en el canal una campaña de descuento por cantidad del vendedor. El descuento lo paga entero la tienda. Tipos: lleva_paga (llevá N y pagá M: cantidad y paga), descuento_llevando (P % llevando N: cantidad y descuento_pct) y descuento_en_la_unidad (P % en la unidad N: cantidad y descuento_pct). combinar dice si se llega a la cantidad sumando publicaciones distintas. Crearla no suma ninguna publicación: eso se hace después con set_volume_campaign_items. Las fechas de inicio y de fin no se pueden cambiar después. Si a una publicación que participa se le sube el precio, sale sola de la oferta y no se puede volver a sumar. ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    nombre: z.string().min(1).max(80),
    tipo: z.enum(['lleva_paga', 'descuento_llevando', 'descuento_en_la_unidad']),
    cantidad: z.number().int().min(2).max(100).describe('Cuántas unidades hay que llevar.'),
    paga: z.number().int().min(1).max(99).optional().describe('Solo en lleva_paga: cuántas se pagan.'),
    descuento_pct: z.number().gt(0).lt(100).optional().describe('En descuento_llevando y descuento_en_la_unidad: el % de descuento.'),
    combinar: z.boolean().describe('true = se llega a la cantidad combinando publicaciones distintas de la campaña.'),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('El día en que empieza, como 2026-11-25.'),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('El día en que termina, como 2026-12-02.'),
  }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const c = await createVolumeCampaign(ctx.db, account.id, {
        name: args.nombre,
        kind: args.tipo,
        buyQuantity: args.cantidad,
        payQuantity: args.paga,
        discountPct: args.descuento_pct,
        combine: args.combinar,
        start: `${args.desde}T00:00:00`,
        finish: `${args.hasta}T00:00:00`,
      });
      return { creada: true, ...campaignOut(c) };
    }),
});

const itemsTool = defineTool({
  name: 'set_volume_campaign_items',
  section: 'subir',
  title: 'Sumar o sacar publicaciones de una campaña por cantidad',
  description: `Suma publicaciones a una campaña de descuento por cantidad, o las saca. Devuelve, de cada una, el precio y el precio original que informa el canal al sumarla, y el motivo de las que no se pudieron. Queda anotado en el Registro de cada publicación. ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    campana: campaignArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(50).describe('Las publicaciones: su id en la app, su código en el canal o su link.'),
    accion: z.enum(['sumar', 'sacar']),
  }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const ids: string[] = [];
      for (const ref of args.publicaciones) ids.push(await findPublication(ctx.db, account.id, ref));
      const r = await changeVolumeItems(ctx.db, { accountId: account.id, campaignId: args.campana, publicationIds: ids, join: args.accion === 'sumar', userId: ctx.userId });
      if (r.done.length === 0 && r.failed.length > 0) throw new McpToolError(`No cambió ninguna. ${r.failed.map((f) => `${f.externalId ?? f.id}: ${f.message}`).join(' ')}`);
      return {
        campana: args.campana,
        accion: args.accion,
        listas: r.done.map((d) => ({ codigo: d.externalId, titulo: d.title, oferta: d.offerId ?? null, precio: d.price ?? null, precio_original: d.originalPrice ?? null, respuesta_del_canal: d.raw ?? null })),
        no_se_pudieron: r.failed.map((f) => ({ codigo: f.externalId, titulo: f.title, motivo: f.message })),
      };
    }),
});

const deleteTool = defineTool({
  name: 'delete_volume_campaign',
  section: 'subir',
  title: 'Borrar una campaña de descuento por cantidad',
  description: `Borra una campaña de descuento por cantidad del canal: se dan de baja todas las ofertas de sus publicaciones. No tiene vuelta atrás. Para borrarla, repetí el código de la campaña en confirmar_campana. ${CONFIRM}`,
  input: z.object({ cuenta: accountArg, campana: campaignArg, confirmar_campana: z.string().describe('El mismo código de la campaña, después de que la persona lo confirme.') }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      if (args.confirmar_campana.trim() !== args.campana.trim()) throw new McpToolError('Para borrarla, repetí el código de la campaña en confirmar_campana.');
      await deleteVolumeCampaign(ctx.db, account.id, args.campana);
      return { borrada: true, campana: args.campana };
    }),
});

export const VOLUME_TOOLS = [listTool, createTool, itemsTool, deleteTool];
