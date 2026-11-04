import type { PrismaClient } from '@/generated/prisma/client';
import { markLabelOf, markState, type MarkState } from '@/domain/photo-measures';
import { measuresOf, type Measure } from '@/lib/media';
import { photoFileHref } from '@/lib/photo-rules';

// Las medidas de las fotos de un producto con varias medidas, y la medida que
// vende cada publicación de su familia: cuáles apuntan a una medida que ya no
// está en la ficha, para avisar y dejar elegir a cuál va cada una. Nada se
// corrige solo. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export class PhotoMeasureError extends Error {}

export type MeasureCheck = Awaited<ReturnType<typeof measureCheck>>;

/** Lo que hay que revisar de las medidas de un producto. Sin medidas para marcar (menos de dos), nada. */
export async function measureCheck(db: Db, productId: string) {
  const product = await db.product.findUniqueOrThrow({
    where: { id: productId },
    select: {
      variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
      photoEdits: {
        where: { archivedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, originalName: true, previewUrl: true, variantKey: true, variantLabel: true },
      },
      videos: { where: { goneAt: null }, select: { id: true, name: true, variantKey: true, variantLabel: true } },
      publications: { where: { familyId: { not: null } }, select: { id: true, title: true, externalId: true, variantKey: true, familyId: true } },
    },
  });
  const measures = measuresOf(product.variants);
  const many = measures.length >= 2;
  const photos = product.photoEdits.map((e) => ({
    editId: e.id,
    name: e.originalName,
    thumb: photoFileHref(e.previewUrl ? 'antes' : 'original', { foto: e.id }),
    state: many ? markState(e.variantKey, e.variantLabel, measures) : ({ kind: 'all' } as MarkState),
  }));
  const videos = product.videos.map((v) => ({ videoId: v.id, name: v.name, state: many ? markState(v.variantKey, v.variantLabel, measures) : ({ kind: 'all' } as MarkState) }));
  // En una familia, cada publicación vende una medida: sin medida o con una que ya no está, hay que elegirla.
  const members = product.publications.map((p) => {
    const state = markState(p.variantKey, null, measures);
    return { publicationId: p.id, title: p.title, externalId: p.externalId, familyId: p.familyId!, state: state.kind === 'all' ? ({ kind: 'none' } as const) : state };
  });
  const memberIssues = members.filter((m) => m.state.kind !== 'measure');
  // Dos publicaciones de la misma familia con la misma medida tampoco puede ser.
  const repeated = members.filter((m, i) => m.state.kind === 'measure' && members.some((o, j) => j !== i && o.familyId === m.familyId && o.state.kind === 'measure' && o.state.key === (m.state as { key: string }).key));
  return {
    measures: many ? measures : [],
    photos,
    videos,
    members,
    unknownPhotos: photos.filter((p) => p.state.kind === 'unknown'),
    unknownVideos: videos.filter((v) => v.state.kind === 'unknown'),
    memberIssues,
    repeatedMembers: repeated,
    hasIssues: photos.some((p) => p.state.kind === 'unknown') || videos.some((v) => v.state.kind === 'unknown') || memberIssues.length > 0 || repeated.length > 0,
  };
}

/** La medida de la ficha por su clave; null es todas. Si no está en la ficha, error. */
function measureFor(measures: Measure[], key: string | null): { variantKey: string | null; variantLabel: string | null } {
  if (key === null) return { variantKey: null, variantLabel: null };
  const m = measures.find((x) => x.key === key);
  if (!m) throw new PhotoMeasureError('Esa medida no está en la ficha del producto.');
  return { variantKey: m.key, variantLabel: markLabelOf(m) };
}

/**
 * Le pone a cada foto la medida elegida (null: todas). Solo fotos del
 * producto. Lo que ya se eligió en Organización de multimedia no cambia: la
 * pantalla vuelve a proponer el orden con las medidas nuevas.
 */
export async function setPhotoMeasures(
  db: Db,
  args: { accountId: string; productId: string; photos?: { editId: string; variantKey: string | null }[]; videos?: { videoId: string; variantKey: string | null }[] },
): Promise<number> {
  const product = await db.product.findFirst({ where: { id: args.productId, accountId: args.accountId }, select: { variants: { select: { sku: true, measure: true } } } });
  if (!product) throw new PhotoMeasureError('El producto no es de esta cuenta.');
  const measures = measuresOf(product.variants);
  const photos = (args.photos ?? []).map((p) => ({ id: p.editId, data: measureFor(measures, p.variantKey) }));
  const videos = (args.videos ?? []).map((v) => ({ id: v.videoId, data: measureFor(measures, v.variantKey) }));
  return db.$transaction(async (tx) => {
    let n = 0;
    for (const p of photos) {
      const r = await tx.photoEdit.updateMany({ where: { id: p.id, productId: args.productId }, data: p.data });
      if (r.count === 0) throw new PhotoMeasureError('Una de las fotos ya no está en el producto. Recargá la página.');
      n += r.count;
    }
    for (const v of videos) {
      const r = await tx.productVideo.updateMany({ where: { id: v.id, productId: args.productId }, data: v.data });
      if (r.count === 0) throw new PhotoMeasureError('Uno de los videos ya no está en el producto. Recargá la página.');
      n += r.count;
    }
    return n;
  });
}

/** Lo que hay que revisar en toda la cuenta: los productos con fotos, videos o publicaciones de familia con una medida que ya no está. */
export async function accountMeasureIssues(db: Db, accountId: string) {
  // Solo los que tienen dos medidas o más y algo marcado o una familia.
  const products = await db.product.findMany({
    where: {
      accountId,
      variants: { some: {} },
      OR: [{ photoEdits: { some: { variantKey: { not: null }, archivedAt: null } } }, { videos: { some: { variantKey: { not: null } } } }, { publications: { some: { familyId: { not: null } } } }],
    },
    select: { id: true, name: true, partNumber: true, _count: { select: { variants: true } } },
    orderBy: { name: 'asc' },
  });
  const out = [];
  for (const p of products.filter((x) => x._count.variants >= 2)) {
    const c = await measureCheck(db, p.id);
    if (!c.hasIssues) continue;
    out.push({ productId: p.id, name: p.name, partNumber: p.partNumber, check: c });
  }
  return out;
}

/** Cómo se dice el estado de una marca. */
export function stateText(s: MarkState | { kind: 'none' }): string {
  if (s.kind === 'all') return 'todas';
  if (s.kind === 'none') return 'sin medida';
  if (s.kind === 'measure') return s.label;
  return `«${s.label}», que ya no está en la ficha${s.guess ? ` (parece ${s.guess.label})` : ''}`;
}
