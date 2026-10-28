import type { z } from 'zod';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { parseMedia, photoKey, withVariants, type PhotoRef } from '@/domain/media';
import { addToPipeline } from '@/domain/pipeline';
import { createPipelinePublication } from '@/domain/pipeline-publications';
import {
  illustrationType,
  inputProblem,
  photoPlacement,
  protocolInput,
  SHOOT_KIND_TEXT,
  stepInput,
  videoMarks,
  type MediaKind,
  type Shot,
  type ShootKind,
} from '@/domain/shoot';
import { driveRef, ensureFolder, getFile, protocolsFolder, startResumableUpload, withDriveToken } from '@/lib/drive';
import { familyByMeasure } from '@/lib/families';
import { measuresOf, productPublicationsMedia, readyPhotoIds, type Measure } from '@/lib/media';
import { originalTypeFor, photoFolderId, photoOwner } from '@/lib/photo-files';
import { photoFileHref } from '@/lib/photo-rules';
import { addDriveOriginal, originalProblem, type ShotMarks } from '@/lib/photos';
import { productCode } from '@/lib/publication-facts';
import { productSearchWhere } from '@/lib/queries/product-search';
import { removeStored } from '@/lib/stored-files';
import { finishVideoUpload, startVideoUpload } from '@/lib/videos';

// Registro de productos: los protocolos de cada cuenta con sus pasos e
// ilustraciones, y lo que sube el operario desde el celular. Las fotos van a
// la carpeta Originales del producto y entran al paso Imágenes como cualquier
// foto; cuando están listas se suman solas a las publicaciones del producto,
// con su medida. Los videos van a la carpeta Videos y quedan marcados con su
// medida al subirse. Recibe la base por parámetro para poder probarlo.

export class ShootError extends Error {}

type Db = PrismaClient;

// ───────────────────────────── Protocolos ─────────────────────────────

/** Los protocolos de la cuenta, con sus pasos en orden. Los archivados, al final. */
export async function listProtocols(db: Db, accountId: string, opts: { archived?: boolean } = {}) {
  const rows = await db.shootProtocol.findMany({
    where: { accountId, ...(opts.archived ? {} : { archivedAt: null }) },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      archivedAt: true,
      steps: {
        where: { archivedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, title: true, kind: true, explanation: true, illustrationUrl: true, illustrationName: true, updatedAt: true },
      },
    },
  });
  const list = rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    archived: p.archivedAt !== null,
    steps: p.steps.map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind as ShootKind,
      explanation: s.explanation,
      illustration: s.illustrationUrl ? { href: illustrationHref(s.id, s.updatedAt), name: s.illustrationName ?? 'Ilustración' } : null,
    })),
  }));
  return [...list.filter((p) => !p.archived), ...list.filter((p) => p.archived)];
}

export type ProtocolView = Awaited<ReturnType<typeof listProtocols>>[number];
export type StepView = ProtocolView['steps'][number];

/** Dónde se ve la ilustración de un paso. Cambia con el paso, para no mostrar una vieja. */
export const illustrationHref = (stepId: string, updatedAt: Date) => `/api/protocolos/${stepId}?v=${updatedAt.getTime()}`;

async function protocolIn(db: Db, accountId: string, protocolId: string) {
  const p = await db.shootProtocol.findFirst({ where: { id: protocolId, accountId }, select: { id: true } });
  if (!p) throw new ShootError('El protocolo no es de esta cuenta.');
  return p;
}

async function stepIn(db: Db, accountId: string, stepId: string) {
  const s = await db.shootStep.findFirst({
    where: { id: stepId, protocol: { accountId } },
    select: { id: true, protocolId: true, kind: true, illustrationUrl: true, archivedAt: true },
  });
  if (!s) throw new ShootError('El paso no es de esta cuenta.');
  return s;
}

function parsed<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  const problem = inputProblem(r);
  if (problem) throw new ShootError(problem);
  return r.data as z.infer<T>;
}

export async function createProtocol(db: Db, args: { accountId: string; input: unknown; userId: string | null }): Promise<string> {
  const data = parsed(protocolInput, args.input);
  const last = await db.shootProtocol.aggregate({ where: { accountId: args.accountId }, _max: { position: true } });
  const p = await db.shootProtocol.create({
    data: { accountId: args.accountId, ...data, position: (last._max.position ?? -1) + 1, createdById: args.userId },
  });
  return p.id;
}

export async function updateProtocol(db: Db, args: { accountId: string; protocolId: string; input: unknown }): Promise<void> {
  await protocolIn(db, args.accountId, args.protocolId);
  await db.shootProtocol.update({ where: { id: args.protocolId }, data: parsed(protocolInput, args.input) });
}

/** Archivado no se ofrece al operario, pero lo que se sacó con él sigue anotado. */
export async function archiveProtocol(db: Db, args: { accountId: string; protocolId: string; archived: boolean }): Promise<void> {
  await protocolIn(db, args.accountId, args.protocolId);
  await db.shootProtocol.update({ where: { id: args.protocolId }, data: { archivedAt: args.archived ? new Date() : null } });
}

/** Lo corre un lugar para arriba (-1) o para abajo (1) y deja el orden prolijo. */
async function reorder(ids: string[], id: string, by: number, save: (id: string, position: number) => Promise<unknown>) {
  const from = ids.indexOf(id);
  const to = from + Math.sign(by);
  if (from < 0 || to < 0 || to >= ids.length) return;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  for (const [i, item] of next.entries()) await save(item, i);
}

export async function moveProtocol(db: Db, args: { accountId: string; protocolId: string; by: number }): Promise<void> {
  await protocolIn(db, args.accountId, args.protocolId);
  const ids = (await listProtocols(db, args.accountId)).map((p) => p.id);
  await db.$transaction(async (tx) => {
    await reorder(ids, args.protocolId, args.by, (id, position) => tx.shootProtocol.update({ where: { id }, data: { position } }));
  });
}

export async function addStep(db: Db, args: { accountId: string; protocolId: string; input: unknown }): Promise<string> {
  await protocolIn(db, args.accountId, args.protocolId);
  const data = parsed(stepInput, args.input);
  const last = await db.shootStep.aggregate({ where: { protocolId: args.protocolId }, _max: { position: true } });
  const s = await db.shootStep.create({ data: { protocolId: args.protocolId, ...data, position: (last._max.position ?? -1) + 1 } });
  return s.id;
}

export async function updateStep(db: Db, args: { accountId: string; stepId: string; input: unknown }): Promise<void> {
  await stepIn(db, args.accountId, args.stepId);
  await db.shootStep.update({ where: { id: args.stepId }, data: parsed(stepInput, args.input) });
}

/** Saca el paso del protocolo. Lo que se sacó con él sigue anotado, por eso no se borra. */
export async function removeStep(db: Db, args: { accountId: string; stepId: string }): Promise<void> {
  await stepIn(db, args.accountId, args.stepId);
  await db.shootStep.update({ where: { id: args.stepId }, data: { archivedAt: new Date() } });
}

export async function moveStep(db: Db, args: { accountId: string; stepId: string; by: number }): Promise<void> {
  const step = await stepIn(db, args.accountId, args.stepId);
  const ids = (
    await db.shootStep.findMany({ where: { protocolId: step.protocolId, archivedAt: null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } })
  ).map((s) => s.id);
  await db.$transaction(async (tx) => {
    await reorder(ids, args.stepId, args.by, (id, position) => tx.shootStep.update({ where: { id }, data: { position } }));
  });
}

/** Abre la subida de una ilustración a la carpeta Protocolos de fotos de la cuenta. El navegador la sube directo. */
export async function startIllustrationUpload(
  db: Db,
  args: { accountId: string; stepId: string; file: { name: string; size: number }; origin: string },
): Promise<string> {
  await stepIn(db, args.accountId, args.stepId);
  const name = String(args.file?.name ?? '').trim().slice(0, 200);
  const check = illustrationType({ name, size: Number(args.file?.size) });
  if (!check.ok) throw new ShootError(check.error);
  const account = await db.account.findUniqueOrThrow({ where: { id: args.accountId }, select: { id: true, name: true } });
  return withDriveToken(db, async (token, email) =>
    startResumableUpload(token, {
      folderId: await ensureFolder(db, token, email, protocolsFolder(account)),
      name,
      type: check.type,
      size: Number(args.file.size),
      origin: args.origin,
      properties: { mrbCuenta: account.id },
    }),
  );
}

/** Pone en el paso la ilustración que el navegador terminó de subir. La anterior va a la papelera del Drive. */
export async function setIllustration(db: Db, args: { accountId: string; stepId: string; fileId: string }): Promise<void> {
  const step = await stepIn(db, args.accountId, args.stepId);
  const account = await db.account.findUniqueOrThrow({ where: { id: args.accountId }, select: { id: true, name: true } });
  const file = await withDriveToken(db, async (token, email) => {
    const folderId = await ensureFolder(db, token, email, protocolsFolder(account));
    const f = await getFile(token, String(args.fileId ?? ''), 'id,name,size,parents,trashed');
    if (!f || f.trashed || !f.parents?.includes(folderId)) throw new ShootError('La ilustración no quedó en la carpeta de la cuenta. Probá de nuevo.');
    return f;
  });
  const check = illustrationType({ name: file.name ?? '', size: Number(file.size ?? 0) });
  if (!check.ok) {
    await removeStored(db, driveRef(file.id)).catch(() => undefined);
    throw new ShootError(check.error);
  }
  await db.shootStep.update({
    where: { id: step.id },
    data: { illustrationUrl: driveRef(file.id), illustrationType: check.type, illustrationName: (file.name ?? '').slice(0, 200) },
  });
  if (step.illustrationUrl && step.illustrationUrl !== driveRef(file.id)) await removeStored(db, step.illustrationUrl).catch(() => undefined);
}

export async function removeIllustration(db: Db, args: { accountId: string; stepId: string }): Promise<void> {
  const step = await stepIn(db, args.accountId, args.stepId);
  if (!step.illustrationUrl) return;
  await db.shootStep.update({ where: { id: step.id }, data: { illustrationUrl: null, illustrationType: null, illustrationName: null } });
  await removeStored(db, step.illustrationUrl).catch(() => undefined);
}

// ───────────────────────────── El operario ─────────────────────────────

const PICK_SELECT = {
  id: true,
  name: true,
  partNumber: true,
  variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
  publications: { orderBy: { createdAt: 'asc' }, take: 1, select: { channelCopy: { select: { photos: true } } } },
} satisfies Prisma.ProductSelect;

type PickRow = Prisma.ProductGetPayload<{ select: typeof PICK_SELECT }>;

function pickOf(p: PickRow) {
  const photos = p.publications[0]?.channelCopy?.photos;
  const thumb = Array.isArray(photos) && typeof photos[0] === 'string' ? (photos[0] as string) : null;
  return { id: p.id, name: p.name, code: productCode(p), thumb, measures: measuresOf(p.variants).length };
}

export type ShootPick = ReturnType<typeof pickOf>;

/** Los productos para elegir: por código, nombre, SKU o código de publicación. Sin buscar, los últimos registrados. */
export async function searchShootProducts(db: Db, accountId: string, q: string): Promise<ShootPick[]> {
  const term = q.trim();
  if (term.length >= 2) {
    const rows = await db.product.findMany({ where: { accountId, ...productSearchWhere(term) }, orderBy: { name: 'asc' }, take: 20, select: PICK_SELECT });
    return rows.map(pickOf);
  }
  // Los que tienen fotos o videos registrados hace poco, para seguir donde se dejó.
  const recent = await db.photoEdit.findMany({
    where: { shot: true, product: { accountId } },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { productId: true },
  });
  const ids = [...new Set(recent.map((r) => r.productId))].slice(0, 8);
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({ where: { id: { in: ids } }, select: PICK_SELECT });
  return ids.flatMap((id) => rows.filter((r) => r.id === id)).map(pickOf);
}

/** Lo que necesita la pantalla del operario para un producto: sus medidas, los protocolos y lo que ya se registró. */
export async function shootPlan(db: Db, accountId: string, productId: string) {
  const p = await db.product.findFirst({ where: { id: productId, accountId }, select: PICK_SELECT });
  if (!p) return null;
  const [protocols, photos, videos, checks] = await Promise.all([
    listProtocols(db, accountId),
    db.photoEdit.findMany({
      where: { productId, shot: true, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, shootStepId: true, variantKey: true, variantLabel: true, originalName: true, previewUrl: true, createdAt: true, createdBy: { select: { name: true } } },
    }),
    db.productVideo.findMany({
      where: { productId, shot: true, goneAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, shootStepId: true, variantKey: true, variantLabel: true, name: true, createdAt: true, uploadedBy: { select: { name: true } } },
    }),
    db.shootCheck.findMany({
      where: { productId },
      orderBy: { doneAt: 'desc' },
      select: { id: true, shootStepId: true, variantKey: true, variantLabel: true, doneAt: true, doneBy: { select: { name: true } } },
    }),
  ]);
  const measures = measuresOf(p.variants);
  // Dónde se ve cada cosa: la miniatura y el archivo para agrandar. La vista liviana de la foto, si ya está.
  const shots: (Shot & { id: string; kind: ShootKind; name: string; variantLabel: string | null; at: string; by: string | null; thumb: string | null; src: string | null })[] = [
    ...photos.map((f) => {
      const href = photoFileHref(f.previewUrl ? 'antes' : 'original', { foto: f.id });
      return { id: f.id, kind: 'PHOTO' as const, stepId: f.shootStepId, variantKey: f.variantKey, variantLabel: f.variantLabel, name: f.originalName, at: f.createdAt.toISOString(), by: f.createdBy?.name ?? null, thumb: href, src: href };
    }),
    ...videos.map((v) => ({
      id: v.id,
      kind: 'VIDEO' as const,
      stepId: v.shootStepId,
      variantKey: v.variantKey,
      variantLabel: v.variantLabel,
      name: v.name,
      at: v.createdAt.toISOString(),
      by: v.uploadedBy?.name ?? null,
      thumb: `/api/drive/videos/${v.id}/miniatura`,
      src: `/api/drive/videos/${v.id}`,
    })),
    ...checks.map((c) => ({ id: c.id, kind: 'CHECK' as const, stepId: c.shootStepId, variantKey: c.variantKey, variantLabel: c.variantLabel, name: 'Listo', at: c.doneAt.toISOString(), by: c.doneBy?.name ?? null, thumb: null, src: null })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return {
    product: pickOf(p),
    // Con una sola medida no hay nada que elegir.
    measures: measures.length >= 2 ? measures.map((m) => ({ key: m.key, label: m.label })) : [],
    protocols,
    shots,
  };
}

export type ShootPlan = NonNullable<Awaited<ReturnType<typeof shootPlan>>>;

/** El paso y la medida que manda el navegador, controlados: el paso de la cuenta y del tipo, la medida del producto. */
async function marksFor(db: Db, args: { accountId: string; productId: string; kind: ShootKind; stepId: string | null; variantKey: string | null }): Promise<ShotMarks> {
  let shootStepId: string | null = null;
  if (args.stepId) {
    const step = await stepIn(db, args.accountId, args.stepId);
    if (step.kind !== args.kind) throw new ShootError(`Ese paso es ${SHOOT_KIND_TEXT[step.kind]}.`);
    shootStepId = step.id;
  }
  if (!args.variantKey) return { shootStepId, variantKey: null, variantLabel: null };
  const variants = await db.productVariant.findMany({ where: { productId: args.productId }, orderBy: { position: 'asc' }, select: { sku: true, measure: true } });
  const measure: Measure | undefined = measuresOf(variants).find((m) => m.key === args.variantKey);
  if (!measure) throw new ShootError('Esa medida ya no está en la ficha del producto. Volvé a elegirla.');
  return { shootStepId, variantKey: measure.key, variantLabel: measure.label };
}

async function productIn(db: Db, accountId: string, productId: string) {
  const p = await db.product.findFirst({ where: { id: productId, accountId }, select: { id: true } });
  if (!p) throw new ShootError('El producto no es de esta cuenta.');
}

/** Abre la subida de una foto o un video del producto. El navegador lo sube directo al Drive, sin achicarlo. */
export async function startShotUpload(
  db: Db,
  args: { accountId: string; productId: string; kind: MediaKind; file: { name: string; size: number; type: string }; origin: string },
): Promise<string> {
  await productIn(db, args.accountId, args.productId);
  const name = String(args.file?.name ?? '').trim().slice(0, 200);
  const size = Number(args.file?.size);
  if (args.kind === 'VIDEO') {
    const r = await startVideoUpload(db, { accountId: args.accountId, productId: args.productId, file: { name, size, type: String(args.file?.type ?? '') }, origin: args.origin });
    return r.uploadUrl;
  }
  const problem = originalProblem({ name, size });
  if (problem) throw new ShootError(problem);
  const owner = await photoOwner(db, args.productId);
  return withDriveToken(db, async (token, email) =>
    startResumableUpload(token, {
      folderId: await photoFolderId(db, token, email, owner, 'originales'),
      name,
      type: originalTypeFor(name)!,
      size,
      origin: args.origin,
      properties: { mrbProducto: args.productId },
    }),
  );
}

/** Anota la foto que terminó de subir el navegador: entra al paso Imágenes con su paso del protocolo y su medida. */
export async function finishShotPhoto(
  db: Db,
  args: { accountId: string; productId: string; fileId: string; userId: string | null; stepId: string | null; variantKey: string | null },
): Promise<string> {
  await productIn(db, args.accountId, args.productId);
  const marks = await marksFor(db, { ...args, kind: 'PHOTO' });
  const owner = await photoOwner(db, args.productId);
  const file = await withDriveToken(db, async (token, email) => {
    const folderId = await photoFolderId(db, token, email, owner, 'originales');
    const f = await getFile(token, String(args.fileId ?? ''), 'id,name,size,parents,trashed');
    if (!f || f.trashed || !f.parents?.includes(folderId)) throw new ShootError('La foto no quedó en la carpeta del producto. Probá de nuevo.');
    return f;
  });
  const edit = await addDriveOriginal(db, { productId: args.productId, file, userId: args.userId, shot: marks });
  return edit.id;
}

/** Anota el video que terminó de subir el navegador, con su paso y su medida, y lo marca en las publicaciones. */
export async function finishShotVideo(
  db: Db,
  args: {
    accountId: string;
    productId: string;
    fileId: string;
    size: number;
    measure: unknown;
    userId: string | null;
    stepId: string | null;
    variantKey: string | null;
  },
): Promise<string> {
  const marks = await marksFor(db, { ...args, kind: 'VIDEO' });
  const { videoId } = await finishVideoUpload(db, {
    accountId: args.accountId,
    productId: args.productId,
    fileId: args.fileId,
    size: args.size,
    measure: args.measure,
    userId: args.userId,
  });
  await db.productVideo.update({ where: { id: videoId }, data: { shot: true, ...marks } });
  await markShotVideo(db, videoId);
  return videoId;
}

/**
 * Marca Listo un paso sin registro en el producto, para la medida elegida o
 * para todas. Si ya estaba, queda a nombre de quien lo marcó ahora.
 */
export async function markShotCheck(
  db: Db,
  args: { accountId: string; productId: string; stepId: string; variantKey: string | null; userId: string | null },
): Promise<void> {
  await productIn(db, args.accountId, args.productId);
  const marks = await marksFor(db, { ...args, kind: 'CHECK' });
  const where = { productId: args.productId, shootStepId: marks.shootStepId!, variantKey: marks.variantKey };
  await db.$transaction([
    db.shootCheck.deleteMany({ where }),
    db.shootCheck.create({ data: { ...where, variantLabel: marks.variantLabel, doneById: args.userId } }),
  ]);
}

/** Saca el Listo de un paso para esa misma medida, o para todas. El de la otra elección queda. */
export async function undoShotCheck(db: Db, args: { accountId: string; productId: string; stepId: string; variantKey: string | null }): Promise<void> {
  await productIn(db, args.accountId, args.productId);
  await stepIn(db, args.accountId, args.stepId);
  await db.shootCheck.deleteMany({ where: { productId: args.productId, shootStepId: args.stepId, variantKey: args.variantKey } });
}

// ───────────────────────────── Al pipeline ─────────────────────────────

/** Las publicaciones del producto que siguen en el canal o sin publicar: las finalizadas o borradas no vuelven al pipeline desde acá. */
function livePublications(db: Prisma.TransactionClient, accountId: string, productId: string) {
  return db.publication.findMany({
    where: { productId, product: { accountId }, channelStatus: { notIn: ['CLOSED', 'DELETED'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, pipelineStatus: true, family: { select: { leadId: true } } },
  });
}

/** La que se abre en el pipeline: la principal de su familia, o la primera. */
const leadOf = (list: { id: string; family: { leadId: string | null } | null }[]) => (list.find((p) => p.family?.leadId === p.id) ?? list[0]).id;

/**
 * Cómo está el producto para el pipeline, para el interruptor del registro:
 * sin publicaciones, con alguna fuera del pipeline, o todas adentro. Con la
 * que se abre, si hay alguna adentro.
 */
export async function shootPipelineState(db: Db, accountId: string, productId: string): Promise<{ state: 'none' | 'out' | 'in'; openId: string | null }> {
  const pubs = await livePublications(db, accountId, productId);
  if (pubs.length === 0) return { state: 'none', openId: null };
  const inside = pubs.filter((p) => p.pipelineStatus === 'IN_PIPELINE');
  return { state: inside.length === pubs.length ? 'in' : 'out', openId: inside.length > 0 ? leadOf(inside) : null };
}

/**
 * Deja el producto en el pipeline desde Registro de productos. Sin
 * publicaciones, crea una sin publicar en la tienda (una por medida, en su
 * familia) que entra en Información; con publicaciones fuera del pipeline, las
 * agrega. Las fotos registradas que ya están listas se suman a las nuevas.
 * Devuelve la que se abre.
 */
export async function shootToPipeline(
  db: Db,
  args: { accountId: string; productId: string; storeId: string | null; userId: string | null },
): Promise<{ publicationId: string; outcome: 'created' | 'added' | 'already' }> {
  await productIn(db, args.accountId, args.productId);
  const r = await db.$transaction(async (tx) => {
    // El mismo turno que usa el pipeline: dos personas a la vez no crean dos publicaciones.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pipeline:${args.accountId}`}))`;
    const pubs = await livePublications(tx, args.accountId, args.productId);
    if (pubs.length === 0) {
      const stores = await tx.store.findMany({ where: { accountId: args.accountId }, select: { id: true } });
      const storeId = args.storeId ?? (stores.length === 1 ? stores[0].id : null);
      if (!storeId) throw new ShootError(stores.length === 0 ? 'La cuenta todavía no tiene tiendas.' : 'Elegí en qué tienda va la publicación.');
      const made = await createPipelinePublication(tx, { accountId: args.accountId, storeId, productId: args.productId, userId: args.userId });
      // Con varias medidas, una publicación por medida, en su familia.
      await familyByMeasure(tx, { publicationId: made.publicationId, userId: args.userId });
      return { publicationId: made.publicationId, outcome: 'created' as const };
    }
    const out = pubs.filter((p) => p.pipelineStatus !== 'IN_PIPELINE');
    if (out.length > 0) await addToPipeline(tx, { accountId: args.accountId, publicationIds: out.map((p) => p.id), userId: args.userId });
    return { publicationId: leadOf(pubs), outcome: out.length > 0 ? ('added' as const) : ('already' as const) };
  });
  if (r.outcome !== 'already') await placeShotPhotosQuietly(db, args.productId);
  return r;
}

// ───────────────────────────── A las publicaciones ─────────────────────────────

/** Marca la medida del video en las publicaciones del producto que tienen varias medidas. */
export async function markShotVideo(db: Db, videoId: string): Promise<void> {
  const video = await db.productVideo.findUnique({ where: { id: videoId }, select: { productId: true, variantKey: true } });
  if (!video?.variantKey) return;
  for (const pub of await productPublicationsMedia(db, video.productId)) {
    const marks = videoMarks(pub.measures, video.variantKey);
    if (marks.length === 0) continue;
    await db.publication.update({ where: { id: pub.id }, data: { videoVariants: { ...pub.videoVariants, [videoId]: marks } } });
  }
}

/**
 * Suma a las publicaciones del producto las fotos registradas que ya están
 * listas: corregidas y aprobadas, o para usar tal cual. Van al final, con su
 * medida; si la publicación seguía a las del canal, queda con esas y después
 * las nuevas. Cada foto se suma una sola vez. Si el producto todavía no tiene
 * publicaciones, espera a la próxima. Devuelve cuántas fotos sumó.
 */
export async function placeShotPhotos(db: Db, productId: string, now = new Date()): Promise<number> {
  const pending = await db.photoEdit.findMany({
    where: { productId, shot: true, placedAt: null, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, variantKey: true },
  });
  if (pending.length === 0) return 0;
  const ready = await readyPhotoIds(db, productId);
  const photos = pending.filter((p) => ready.has(p.id));
  if (photos.length === 0) return 0;
  const pubs = await productPublicationsMedia(db, productId);
  if (pubs.length === 0) return 0;
  return db.$transaction(async (tx) => {
    // Cada foto la toma un solo pedido, aunque haya dos a la vez.
    const mine: typeof photos = [];
    for (const p of photos) {
      const claimed = await tx.photoEdit.updateMany({ where: { id: p.id, placedAt: null }, data: { placedAt: now } });
      if (claimed.count === 1) mine.push(p);
    }
    if (mine.length === 0) return 0;
    for (const pub of pubs) {
      // Las fotos elegidas como están ahora, sin pisar un cambio que se guarde a la vez.
      await tx.$queryRaw`SELECT id FROM publications WHERE id = ${pub.id} FOR UPDATE`;
      const row = await tx.publication.findUniqueOrThrow({ where: { id: pub.id }, select: { media: true } });
      const current: PhotoRef[] = parseMedia(row.media) ?? pub.channelRefs;
      const keys = new Set(current.map(photoKey));
      const added: PhotoRef[] = [];
      for (const p of mine) {
        const place = photoPlacement(pub.measures, p.variantKey);
        const ref: PhotoRef = { kind: 'edit', editId: p.id };
        if (!place.add || keys.has(photoKey(ref))) continue;
        added.push(withVariants(ref, place.variants));
      }
      if (added.length === 0) continue;
      await tx.publication.update({ where: { id: pub.id }, data: { media: [...current, ...added] as Prisma.InputJsonValue } });
    }
    return mine.length;
  });
}

/**
 * Lo mismo, sin cortar lo que se estaba haciendo si falla, por ejemplo al
 * aprobar una foto: la tarea de cada hora la vuelve a probar.
 */
export async function placeShotPhotosQuietly(db: Db, productId: string): Promise<void> {
  try {
    await placeShotPhotos(db, productId);
  } catch (e) {
    console.error('No se pudieron sumar las fotos registradas a las publicaciones.', e);
  }
}

/** Para la tarea de cada hora: suma las fotos registradas que quedaron listas sin sumarse. */
export async function placeAllShotPhotos(db: Db, opts: { budgetMs: number }): Promise<{ placed: number; pending: boolean }> {
  const begun = Date.now();
  const rows = await db.photoEdit.findMany({
    where: { shot: true, placedAt: null, archivedAt: null },
    distinct: ['productId'],
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { productId: true },
  });
  let placed = 0;
  for (const [i, r] of rows.entries()) {
    if (i > 0 && Date.now() - begun > opts.budgetMs) return { placed, pending: true };
    placed += await placeShotPhotos(db, r.productId);
  }
  return { placed, pending: false };
}
