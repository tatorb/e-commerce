import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { cleanMedia, parseVideoVariants, photoKey, withMarks, type PhotoRef } from '@/domain/media';
import { familyOf } from '@/lib/families';
import { knownMarks, knownVariants, loadMediaSources, MediaError, measuresOf, soleMeasurePhotos, type MediaItem, type MediaSources } from '@/lib/media';
import { setClips } from '@/lib/videos';

// Organización de multimedia de una familia: las fotos de todas sus medidas
// en una sola pantalla, con una ventana por medida, como en una publicación
// con varias medidas. Cada foto es de todas o de algunas medidas. Al guardar,
// cada publicación de la familia queda con las fotos de su medida, en el orden
// de su ventana. Las marcas de los videos quedan en la principal, y cada medida
// lleva los clips que son suyos.

type Db = PrismaClient;

/** Las fotos y los videos de la familia de una publicación, como los usa la pantalla. Null si no es de una familia. */
export async function loadFamilyMedia(db: Db, accountId: string, publicationId: string): Promise<MediaSources | null> {
  const family = await familyOf(db, publicationId);
  if (!family) return null;
  const members = family.members;
  const sources = await Promise.all(members.map((m) => loadMediaSources(db, accountId, m.id)));
  const lead = sources[Math.max(0, members.findIndex((m) => m.lead))];
  const product = await db.product.findUniqueOrThrow({
    where: { id: lead.publication.productId },
    select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } },
  });
  const measures = measuresOf(product.variants).filter((m) => members.some((x) => x.variantKey === m.key));

  // Cada foto con las medidas que la usan y su lugar en cada una.
  const order: string[] = [];
  const merged = new Map<string, { item: MediaItem; keys: Set<string>; positions: Record<string, number> }>();
  members.forEach((m, i) => {
    if (!m.variantKey) return;
    sources[i].current.forEach((item, at) => {
      const entry = merged.get(item.key) ?? { item, keys: new Set<string>(), positions: {} };
      if (!merged.has(item.key)) {
        merged.set(item.key, entry);
        order.push(item.key);
      }
      entry.keys.add(m.variantKey!);
      entry.positions[m.variantKey!] ??= at;
    });
  });
  const current = order.map((key) => {
    const { item, keys, positions } = merged.get(key)!;
    const variants = knownVariants([...keys], measures);
    return { ...item, ref: withMarks(item.ref, { ...item.ref, variants, positions }) };
  });
  const channel = new Map<string, MediaItem>();
  for (const s of sources) for (const c of s.available.channel) if (!channel.has(c.key)) channel.set(c.key, c);
  const leadRow = await db.publication.findUniqueOrThrow({ where: { id: lead.publication.id }, select: { videoVariants: true } });
  const videoMarks = parseVideoVariants(leadRow.videoVariants);
  const clipIds = [...new Set(sources.flatMap((s) => s.clipIds))];
  return {
    ...lead,
    family: true,
    following: sources.every((s) => s.following),
    current,
    available: { ...lead.available, channel: [...channel.values()] },
    measures: measures.length >= 2 ? measures : [],
    channelWithoutVariants: false,
    soleMeasure: null,
    sharedWith: [],
    videos: lead.videos.map((v) => ({ ...v, variants: knownVariants(videoMarks[v.id] ?? [], measures) })),
    clipIds,
  };
}

/**
 * Guarda lo elegido para la familia: cada medida queda con sus fotos, en el
 * orden de su ventana; null vuelve a las del canal en todas. Las marcas de los
 * videos van en la principal y cada medida lleva los clips que le tocan.
 */
export async function saveFamilyMedia(
  db: Db,
  args: { accountId: string; publicationId: string; refs?: PhotoRef[] | null; videos?: Record<string, string[]>; clips?: string[]; userId?: string | null },
): Promise<void> {
  const family = await familyOf(db, args.publicationId);
  if (!family) throw new MediaError('La publicación no es parte de una familia.');
  const sources = await loadFamilyMedia(db, args.accountId, args.publicationId);
  if (!sources) throw new MediaError('La publicación no es parte de una familia.');
  const product = await db.product.findUniqueOrThrow({
    where: { id: sources.publication.productId },
    select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } },
  });
  const all = measuresOf(product.variants);
  const measures = sources.measures;
  const members = family.members.filter((m) => m.variantKey);

  const updates: { id: string; data: Prisma.PublicationUpdateInput }[] = [];
  if (args.refs === null) for (const m of family.members) updates.push({ id: m.id, data: { media: Prisma.DbNull } });
  else if (args.refs) {
    const refs = cleanMedia(args.refs).map((r) => knownMarks(r, measures));
    if (refs.length === 0) throw new MediaError('Elegí al menos una foto.');
    const allowed = new Map([...sources.available.channel, ...sources.available.corrected, ...sources.available.assets].map((m) => [m.key, m]));
    if (refs.some((r) => !allowed.has(photoKey(r)))) throw new MediaError('Una de las fotos ya no está disponible. Recargá la página.');
    const blocked = sources.available.corrected.find((m) => m.blocked && refs.some((r) => photoKey(r) === m.key));
    if (blocked) throw new MediaError(`${blocked.label}: ${blocked.blocked}`);
    for (const m of members) {
      const measure = all.find((x) => x.key === m.variantKey);
      if (!measure) continue;
      // Las del canal se guardan con su link, para verlas aunque cambie la lectura.
      const own = soleMeasurePhotos(refs, all, measure).map((r) => {
        const known = allowed.get(photoKey(r))?.ref;
        return known && known.kind === 'channel' ? withMarks(known, r) : r;
      });
      if (own.length === 0) throw new MediaError(`La medida ${measure.label} se queda sin fotos: marcá al menos una para ella o para todas.`);
      updates.push({ id: m.id, data: { media: own as Prisma.InputJsonValue } });
    }
  }
  const lead = family.members.find((m) => m.lead) ?? family.members[0];
  const marks = args.videos
    ? Object.fromEntries(
        Object.entries(args.videos).flatMap(([id, list]) => {
          const keys = knownVariants(list, measures);
          return sources.videos.some((v) => v.id === id) && keys.length > 0 ? [[id, [...new Set(keys)].sort()]] : [];
        }),
      )
    : null;
  if (marks) {
    const at = updates.find((u) => u.id === lead.id);
    if (at) at.data.videoVariants = marks;
    else updates.push({ id: lead.id, data: { videoVariants: marks } });
  }
  await db.$transaction(updates.map((u) => db.publication.update({ where: { id: u.id }, data: u.data })));

  if (args.clips) {
    const videoMarks = marks ?? Object.fromEntries(sources.videos.map((v) => [v.id, v.variants]));
    for (const m of family.members) {
      const mine = args.clips.filter((id) => {
        const keys = videoMarks[id] ?? [];
        return keys.length === 0 || (m.variantKey !== null && keys.includes(m.variantKey));
      });
      await setClips(db, { accountId: args.accountId, publicationId: m.id, videoIds: mine, userId: args.userId ?? null });
    }
  }
}
