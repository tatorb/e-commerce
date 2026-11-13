import { z } from 'zod';
import { ConnectError } from '@/channels/connect';
import { logActivity } from '@/lib/activity';
import { findMeasure, loadMeasureChoice, MeasureError, sendPendingSku, setPublicationMeasure } from '@/lib/publication-measure';
import { McpToolError, accountArg, defineTool, findPublication, resolveAccount } from './tool';

// La medida que vende una publicación publicada sola cuando su SKU en el canal
// no dice cuál es (por ejemplo "SP-413" en un producto con SP-413-00 y
// SP-413-50), y mandar al canal el SKU correcto desde Por subir.

const measureTool = defineTool({
  name: 'set_publication_measure',
  section: ['publicaciones', 'pipeline'],
  title: 'Elegir la medida que vende una publicación',
  description:
    'Para una publicación ya publicada, de un producto con varias medidas, cuya medida la app no sabe porque su SKU en el canal no la dice (get_publication muestra en cantidad_disponible que su SKU no dice de cuál es, o la familia la muestra como "sin elegir"). Elige la medida de la ficha (la fuente de verdad) para la publicación y sus opciones de venta (la misma medida con otra forma de cobro), aunque pases una sola. Las opciones de venta que tienen las medidas adentro en el canal ya saben las suyas: no se tocan y se avisa. Con eso su cantidad sale del stock de esa medida, el paso Precio toma su costo y la familia la muestra. No deja elegir una medida que ya vende otra publicación de la familia. medida: la medida (por ejemplo "STD") o su SKU (por ejemplo "SP-413-00"). Con subir_sku, deja el SKU de la medida en Por subir en las que tienen otro en el canal: se manda con push_skus. Si la cantidad sigue al stock, al guardar se sube al canal la de esa medida: primero llamá con vista_previa en true, mostrale a la persona la medida, las opciones de venta y cómo cambia la cantidad, y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: z.string().min(1).describe('Cualquiera de sus opciones de venta: su id en la app, su código en el canal o su link.'),
    medida: z.string().min(1).max(80).describe('La medida de la ficha (por ejemplo "STD") o su SKU (por ejemplo "SP-413-00").'),
    subir_sku: z.boolean().default(false).describe('Dejar el SKU de la medida en Por subir, para mandarlo con push_skus.'),
    vista_previa: z.boolean().default(false).describe('Solo mostrar qué pasaría, sin guardar nada.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await findPublication(ctx.db, account.id, args.publicacion);
    ctx.touched = { ...ctx.touched, publicationId: id };
    const choice = await loadMeasureChoice(ctx.db, { accountId: account.id, publicationId: id }).catch((e) => {
      if (e instanceof MeasureError) throw new McpToolError(e.message);
      throw e;
    });
    if (!choice) throw new McpToolError('A esta publicación no se le elige medida: su producto tiene una sola, o tiene las medidas adentro en el canal.');
    const measure = findMeasure(choice.measures, args.medida);
    if (!measure) throw new McpToolError(`Esa medida no está en la ficha. Las que hay: ${choice.measures.map((m) => (m.sku ? `${m.label} (${m.sku})` : m.label)).join(', ')}.`);
    const m = choice.measures.find((x) => x.key === measure.key)!;
    const skuDiffers = (sku: string | null) => (sku ?? '').trim().toUpperCase() !== (m.sku ?? '').trim().toUpperCase();
    if (args.vista_previa) {
      return {
        vista_previa: true,
        medida: m.label,
        sku_de_la_medida: m.sku,
        medida_actual: choice.current?.label ?? 'sin elegir',
        ...(m.takenBy ? { no_se_puede: `La medida ${m.label} ya la vende ${m.takenBy} en la familia.` } : {}),
        opciones_de_venta: choice.options.map((o) => {
          const q = m.quantities.find((x) => x.externalId === o.externalId);
          return {
            codigo: o.externalId,
            sku_en_el_canal: o.channelSku,
            ...(q ? { cantidad_en_el_canal: q.from, cantidad_con_la_medida: q.to } : {}),
            ...(args.subir_sku && m.sku && o.externalId && skuDiffers(o.channelSku) ? { sku_queda_en_por_subir: m.sku } : {}),
          };
        }),
        ...(choice.withMeasuresInside.length > 0 ? { no_se_tocan: `${choice.withMeasuresInside.join(', ')}: tienen las medidas adentro en el canal, ya saben las suyas.` } : {}),
        ...(m.quantityNote ? { cantidad: `No cambia sola: ${m.quantityNote}` } : { cantidad: 'Al guardar se sube al canal la cantidad de esa medida en las que cambia.' }),
      };
    }
    try {
      const r = await setPublicationMeasure(ctx.db, { accountId: account.id, publicationId: id, measure: measure.key, sendSku: args.subir_sku, userId: ctx.userId });
      return {
        cambio: true,
        medida: r.measure.label,
        opciones_de_venta: r.publications.map((p) => p.externalId ?? p.id),
        ...(r.withMeasuresInside.length > 0 ? { no_se_tocaron: `${r.withMeasuresInside.join(', ')}: tienen las medidas adentro en el canal.` } : {}),
        cantidad_subida_al_canal: r.stock.sent,
        ...(r.stock.failed.length > 0 ? { cantidad_no_subida: r.stock.failed.map((f) => f.error) } : {}),
        ...(r.skuToPush > 0 ? { sku_en_por_subir: `${r.measure.sku} en ${r.skuToPush}: se manda con push_skus, con la confirmación de la persona.` } : {}),
      };
    } catch (e) {
      if (e instanceof MeasureError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

const pushSkusTool = defineTool({
  name: 'push_skus',
  section: 'subir',
  title: 'Mandar al canal el SKU de la medida',
  description:
    'Manda al canal el SKU de la medida que quedó en Por subir (set_publication_measure con subir_sku o la tarjeta Medida de la publicación), como el botón de subir de Por subir pero solo eso. En publicaciones pasá ids o códigos del canal, hasta 100: van también sus otras opciones de venta con el SKU por subir. Sin la lista, todas las de la cuenta. Por cada una dice si quedó o el motivo exacto del rechazo del canal. Cambia la publicación en el canal de verdad: antes de subir, mostrale a la persona qué SKU va a cuáles, y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(100).optional().describe('Las publicaciones: su id en la app o su código en el canal. Sin la lista, todas las de la cuenta con el SKU por subir.'),
  }),
  readOnly: false,
  destructive: true,
  logsItself: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    let where: { id: { in: string[] } } | { skuToPush: { not: null } } = { skuToPush: { not: null } };
    const salteadas: { publicacion: string; motivo: string }[] = [];
    if (args.publicaciones) {
      const ids: string[] = [];
      for (const ref of args.publicaciones) {
        try {
          ids.push(await findPublication(ctx.db, account.id, ref));
        } catch (e) {
          if (!(e instanceof McpToolError)) throw e;
          salteadas.push({ publicacion: ref, motivo: e.message });
        }
      }
      const mains = await ctx.db.publication.findMany({ where: { id: { in: ids } }, select: { id: true, mainOptionId: true } });
      const heads = mains.map((p) => p.mainOptionId ?? p.id);
      const group = await ctx.db.publication.findMany({ where: { OR: [{ id: { in: heads } }, { mainOptionId: { in: heads } }] }, select: { id: true } });
      where = { id: { in: [...new Set([...ids, ...group.map((g) => g.id)])] } };
    }
    const rows = await ctx.db.publication.findMany({
      where: { ...where, product: { accountId: account.id } },
      select: { id: true, externalId: true, skuToPush: true },
      orderBy: { externalId: 'asc' },
    });
    const subidas: Record<string, unknown>[] = [];
    for (const p of rows) {
      const code = p.externalId ?? p.id;
      if (!p.skuToPush) {
        if (args.publicaciones?.some((r) => r === code || r === p.id)) salteadas.push({ publicacion: code, motivo: 'No tiene SKU por subir.' });
        continue;
      }
      try {
        const r = await sendPendingSku(ctx.db, { accountId: account.id, publicationId: p.id });
        if (!r) continue;
        subidas.push({ publicacion: code, sku: r.sku, resultado: r.ok ? 'subido' : 'rechazado', ...(r.ok ? {} : { motivo: r.message }) });
        await logActivity(ctx.db, {
          userId: ctx.userId,
          accountId: account.id,
          section: 'subir',
          summary: 'Subió cambios al canal',
          publicationId: p.id,
          detail: r.ok ? `Mandó el SKU ${r.sku}` : r.message,
          via: 'CLAUDE',
        });
      } catch (e) {
        subidas.push({ publicacion: code, sku: p.skuToPush, resultado: 'error', motivo: e instanceof ConnectError ? e.message : 'No se pudo subir: hubo un error en la app. Probá de nuevo.' });
      }
    }
    return {
      subidas,
      ...(salteadas.length > 0 ? { salteadas } : {}),
      ...(subidas.length === 0 && salteadas.length === 0 ? { aviso: 'No hay SKU por subir en la cuenta.' } : {}),
    };
  },
});

export const MEASURE_TOOLS = [measureTool, pushSkusTool];
