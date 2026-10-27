import { z } from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import { photoKey, photoVariants, withMarks, withVariants, type PhotoRef } from '@/domain/media';
import { loadMediaSources, MediaError, saveMedia, type MediaItem, type MediaSources } from '@/lib/media';
import { addChannelPhotosOf, setPhotoAsIs } from '@/lib/photo-commands';
import { PhotoError } from '@/lib/photos';
import { PhotoQueueError } from '@/lib/photo-queue';
import { storageError } from '@/lib/stored-files';
import { VideoError } from '@/lib/videos';
import { appLink, McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication, type McpContext } from './tool';

// Las fotos y los videos de una publicación desde Claude, con las mismas
// reglas que el paso Organización de multimedia: ver qué hay, elegir y
// ordenar las fotos y sus medidas, elegir los clips, sumar al paso Imágenes
// las fotos del canal y decidir si una foto se usa tal cual. Lo que se elige
// queda en el borrador hasta que se sube al canal.

async function target(ctx: McpContext, args: { cuenta?: string; publicacion: string }) {
  const account = await resolveAccount(ctx, args.cuenta);
  const id = await resolvePublication(ctx, account.id, args.publicacion);
  return { account, id };
}

/** Los errores de fotos se le muestran a Claude tal cual. */
async function asToolError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof MediaError || e instanceof PhotoError || e instanceof PhotoQueueError || e instanceof VideoError) throw new McpToolError(e.message);
    const storage = storageError(e);
    if (storage) throw new McpToolError(storage);
    throw e;
  }
}

/** Un link que se pueda abrir: las vistas de la app van con su dirección completa. */
const linkOf = (ctx: McpContext, thumb: string | null) => (!thumb ? null : thumb.startsWith('/') ? `${ctx.baseUrl}${thumb}` : thumb);

function measureNames(keys: string[], sources: MediaSources): string[] | 'todas' {
  if (keys.length === 0) return 'todas';
  return keys.map((k) => sources.measures.find((m) => m.key === k)?.label ?? k);
}

/** Lo que hay para elegir y lo elegido, como lo lee Claude. */
function mediaOut(ctx: McpContext, sources: MediaSources, lines: { id: string; originalName: string; asIs: boolean }[]) {
  const chosen = new Set(sources.current.map((m) => m.key));
  const option = (m: MediaItem) => ({
    foto: m.key,
    nombre: m.label,
    link: linkOf(ctx, m.thumb),
    elegida: chosen.has(m.key),
    ...(m.blocked ? { no_se_puede_usar: m.blocked } : {}),
  });
  const ready = new Set(sources.available.corrected.map((m) => m.key));
  const clipOrder = new Map(sources.clipIds.map((id, i) => [id, i + 1]));
  return {
    canal: sources.channelName,
    sigue_a_las_del_canal: sources.following,
    medidas: sources.measures.map((m) => ({ clave: m.key, nombre: m.label })),
    ...(sources.soleMeasure ? { vende_solo_la_medida: sources.soleMeasure.label } : {}),
    ...(sources.channelWithoutVariants ? { aviso: 'En el canal la publicación no tiene medidas: todas las fotos se ven juntas.' } : {}),
    ...(sources.sharedWith.length > 0 ? { comparten_las_fotos_en_el_canal: sources.sharedWith } : {}),
    elegidas: sources.current.map((m, i) => ({
      orden: i + 1,
      foto: m.key,
      nombre: m.label,
      link: linkOf(ctx, m.thumb),
      medidas: measureNames(photoVariants(m.ref), sources),
      ...(m.note ? { nota: m.note } : {}),
    })),
    para_elegir: {
      en_el_canal: sources.available.channel.map(option),
      corregidas_en_el_paso_imagenes: sources.available.corrected.map(option),
      del_producto: sources.available.assets.map(option),
    },
    linea_del_paso_imagenes: lines.map((l) => ({
      foto: l.id,
      nombre: l.originalName,
      tal_cual: l.asIs,
      lista_para_usar: ready.has(`corregida:${l.id}`),
    })),
    videos: sources.videos.map((v) => ({
      video: v.id,
      nombre: v.name,
      duracion_seg: v.durationMs === null ? null : Math.round(v.durationMs / 1000),
      medidas: measureNames(v.variants, sources),
      es_clip: clipOrder.has(v.id),
      ...(clipOrder.has(v.id) ? { orden_como_clip: clipOrder.get(v.id) } : {}),
      ...(v.check && v.check.problems.length > 0 ? { no_sirve_como_clip_porque: v.check.problems } : {}),
    })),
    ...(sources.clip ? { clips: { como_los_llama_el_canal: sources.clip.name, uno_distinto_por_medida: sources.clip.perVariant } } : {}),
  };
}

async function loadOut(ctx: McpContext, accountId: string, publicationId: string) {
  const sources = await loadMediaSources(ctx.db, accountId, publicationId);
  const lines = await ctx.db.photoEdit.findMany({
    where: { productId: sources.publication.productId, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, originalName: true, asIs: true },
  });
  return mediaOut(ctx, sources, lines);
}

/** Las claves de las medidas que pidió Claude: por su clave, su nombre o su SKU. "todas" es ninguna marca. */
function measureKeys(names: string[] | undefined, sources: MediaSources): string[] {
  if (!names || names.length === 0) return [];
  if (names.some((n) => n.trim().toLowerCase() === 'todas')) return [];
  if (sources.measures.length === 0) {
    throw new McpToolError(
      sources.soleMeasure
        ? `La publicación vende solo la medida ${sources.soleMeasure.label}: todas las fotos van a ella, sin marcar medidas.`
        : 'El producto no tiene dos o más medidas: no hay medidas para marcar.',
    );
  }
  return names.map((raw) => {
    const n = raw.trim().toLowerCase();
    const m = sources.measures.find((x) => x.key.toLowerCase() === n || x.label.toLowerCase() === n || x.sku?.toLowerCase() === n);
    if (!m) throw new McpToolError(`No hay una medida «${raw}». Las medidas son: ${sources.measures.map((x) => x.label).join(', ')}.`);
    return m.key;
  });
}

const getMediaTool = defineTool({
  name: 'get_publication_media',
  section: ['pipeline', 'publicaciones'],
  title: 'Ver las fotos y los videos de una publicación',
  description:
    'Muestra las fotos y los videos de una publicación como en Organización de multimedia: las fotos elegidas en orden (la primera es la portada) con sus medidas, las que hay para elegir (las que tiene en el canal, las corregidas en el paso Imágenes y las demás del producto), la línea del paso Imágenes, las medidas que se pueden marcar, y los videos del producto con cuáles son clips. Cada foto tiene una clave en «foto» que se usa para elegirla con set_publication_media.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    return { ...(await asToolError(() => loadOut(ctx, account.id, id))), link_app: appLink(ctx, account, id) };
  },
});

const setMediaTool = defineTool({
  name: 'set_publication_media',
  section: ['pipeline', 'publicaciones'],
  title: 'Elegir y ordenar las fotos y los videos de una publicación',
  description:
    'Elige qué fotos lleva la publicación y en qué orden (la primera es la portada), en qué medidas va cada una, qué videos son clips y de qué medidas es cada video. Usá las claves de get_publication_media. Lo que no mandes queda como está; «fotos» reemplaza la lista entera. Sin medidas, o con «todas», la foto va en todas. usar_las_del_canal vuelve a las que tiene en el canal. Queda en el borrador: se sube al canal desde la app, con Subir. Mostrale a la persona cómo va a quedar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    fotos: z
      .array(
        z.object({
          foto: z.string().min(1).describe('La clave de la foto, como la da get_publication_media.'),
          medidas: z.array(z.string()).optional().describe('Las medidas donde va, por su nombre (por ejemplo STD o 0.50). Sin mandar o «todas»: en todas.'),
        }),
      )
      .max(60)
      .optional()
      .describe('Las fotos que van, en orden.'),
    usar_las_del_canal: z.boolean().optional().describe('true deja de elegir: la publicación vuelve a llevar las fotos que tiene en el canal.'),
    clips: z.array(z.string()).max(20).optional().describe('Los videos que van como clip, en orden, por su clave «video». Una lista vacía saca todos.'),
    medidas_de_los_videos: z
      .array(z.object({ video: z.string().min(1), medidas: z.array(z.string()) }))
      .optional()
      .describe('De qué medidas es cada video; reemplaza las marcas de todos los videos.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    if (args.fotos && args.usar_las_del_canal) throw new McpToolError('Mandá las fotos o usar_las_del_canal, no las dos.');
    if (!args.fotos && !args.usar_las_del_canal && !args.clips && !args.medidas_de_los_videos) {
      throw new McpToolError('No mandaste nada para cambiar.');
    }
    return asToolError(async () => {
      const sources = await loadMediaSources(ctx.db, account.id, id);
      let refs: PhotoRef[] | null | undefined;
      if (args.usar_las_del_canal) refs = null;
      else if (args.fotos) {
        const byKey = new Map(
          [...sources.available.channel, ...sources.available.corrected, ...sources.available.assets].map((m) => [m.key, m.ref]),
        );
        refs = args.fotos.map((f) => {
          const ref = byKey.get(f.foto.trim());
          if (!ref) throw new McpToolError(`No hay una foto «${f.foto}» para esta publicación. Pedí la lista con get_publication_media.`);
          return withVariants(ref, measureKeys(f.medidas, sources));
        });
      }
      const knownVideos = new Set(sources.videos.map((v) => v.id));
      const checkVideo = (v: string) => {
        if (!knownVideos.has(v)) throw new McpToolError(`No hay un video «${v}» en el producto.`);
        return v;
      };
      const videos = args.medidas_de_los_videos
        ? Object.fromEntries(args.medidas_de_los_videos.map((v) => [checkVideo(v.video), measureKeys(v.medidas, sources)]))
        : undefined;
      const clips = args.clips?.map(checkVideo);
      await saveMedia(ctx.db, { accountId: account.id, publicationId: id, refs, videos, clips, userId: ctx.userId });
      const out = await loadOut(ctx, account.id, id);
      return {
        listo: true,
        nota: 'Quedó en el borrador: para que llegue al canal, se sube desde la app con Subir.',
        elegidas: out.elegidas,
        sigue_a_las_del_canal: out.sigue_a_las_del_canal,
        clips: out.videos.filter((v) => v.es_clip).map((v) => v.nombre),
        link_app: appLink(ctx, account, id),
      };
    });
  },
});

const addChannelPhotosTool = defineTool({
  name: 'add_channel_photos',
  section: ['pipeline', 'productos'],
  title: 'Sumar al paso Imágenes las fotos del canal',
  description:
    'Baja las fotos que la publicación tiene en el canal, en su tamaño más grande, y las suma a la línea del paso Imágenes del producto para corregirlas o usarlas tal cual. Las que ya estaban no se repiten. Las fotos son del producto: las ven todas sus publicaciones.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const pub = await ctx.db.publication.findUniqueOrThrow({ where: { id }, select: { productId: true } });
    const message = await asToolError(() => addChannelPhotosOf(ctx.db, { productId: pub.productId, userId: ctx.userId }));
    return { listo: true, resultado: message, link_app: appLink(ctx, account, id) };
  },
});

const setAsIsTool = defineTool({
  name: 'set_photo_as_is',
  section: ['pipeline', 'productos'],
  title: 'Usar una foto tal cual o mandarla a corregir',
  description:
    'Una foto de la línea del paso Imágenes que ya viene editada se usa tal cual: no pasa por la Mac y al canal va el mismo archivo. Con tal_cual false vuelve a la línea para corregirla en la Mac. El canal tiene que aceptar el archivo así; si no, devuelve el motivo. La foto se nombra por su clave en linea_del_paso_imagenes de get_publication_media.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    foto: z.string().min(1).describe('La clave de la foto en la línea del paso Imágenes.'),
    tal_cual: z.boolean(),
  }),
  readOnly: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const editId = args.foto.trim().replace(/^corregida:/, '');
    const message = await asToolError(() => setPhotoAsIs(ctx.db, { publicationId: id, editId, asIs: args.tal_cual }));
    if (message === null) throw new McpToolError(`No hay una foto «${args.foto}» en la línea del paso Imágenes de este producto.`);
    return { listo: true, resultado: message, link_app: appLink(ctx, account, id) };
  },
});

/**
 * Copia las fotos elegidas (con sus medidas) y los clips de otra publicación
 * del mismo producto. Las fotos del canal de la otra solo se copian si esta
 * también las tiene; las demás son del producto y sirven igual.
 */
export async function copyMedia(
  db: PrismaClient,
  args: { accountId: string; fromId: string; toId: string; photos: boolean; clips: boolean; userId: string },
): Promise<{ fotos?: number; fotos_que_no_estan_en_esta?: number; clips?: number }> {
  const [from, target] = await Promise.all([loadMediaSources(db, args.accountId, args.fromId), loadMediaSources(db, args.accountId, args.toId)]);
  const out: { fotos?: number; fotos_que_no_estan_en_esta?: number; clips?: number } = {};
  let refs: PhotoRef[] | undefined;
  if (args.photos) {
    const usable = new Map([...target.available.channel, ...target.available.corrected, ...target.available.assets].map((m) => [m.key, m.ref]));
    const wanted = from.current.map((m) => m.ref);
    const kept = wanted.flatMap((r) => {
      const ref = usable.get(photoKey(r));
      return ref ? [withMarks(ref, r)] : [];
    });
    if (kept.length > 0) refs = kept;
    out.fotos = kept.length;
    if (kept.length < wanted.length) out.fotos_que_no_estan_en_esta = wanted.length - kept.length;
  }
  const clips = args.clips ? from.clipIds : undefined;
  if (clips) out.clips = clips.length;
  if (refs || clips) await saveMedia(db, { accountId: args.accountId, publicationId: args.toId, refs, clips, userId: args.userId });
  return out;
}

export const MEDIA_TOOLS = [getMediaTool, setMediaTool, addChannelPhotosTool, setAsIsTool];
