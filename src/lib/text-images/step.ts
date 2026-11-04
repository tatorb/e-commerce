import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { requestTextImage, type TextImageInput, type TextImageResult } from '@/ai/text-images';
import { ProposalError } from '@/ai/request';
import { LAST_PHOTO_STEP } from '@/domain/photo-steps';
import { richTextToMarkdown } from '@/domain/research';
import {
  brandKeyOf,
  cleanPiece,
  DEFAULT_SEAL,
  emptyPiece,
  parsePiece,
  pieceLengthNotes,
  pieceMissing,
  pieceSchema,
  pieceVersion,
  usedBrands,
  type PieceContent,
  type PieceVersion,
} from '@/domain/text-images';
import { descriptionInput } from '@/lib/descriptions';
import { folderOwner, textImagesFolder, ensureFolder, uploadContent, withDriveToken } from '@/lib/drive';
import { familyOf } from '@/lib/families';
import { photoFileHref } from '@/lib/photo-rules';
import { driveRef, readStored, removeStored } from '@/lib/stored-files';
import { brandLogoHref, brandsForPiece, listBrands } from './brands';
import { textImageHref } from './files';
import type { PieceFit } from './piece-html';
import { renderPiece, type PieceRenderer } from './render';

// El paso Imágenes con texto: la pieza de una publicación, o de toda su
// familia (una sola para todas sus medidas), su foto, la IA que la completa y
// el PNG que arma el servidor. Recibe la base por parámetro para poder probarla.

type Db = PrismaClient;

export class TextImageError extends Error {}

// ───────────────────────────── La publicación y su familia ─────────────────────────────

async function publicationFor(db: Db, accountId: string, publicationId: string) {
  const pub = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: { id: true, title: true, productId: true, textImageId: true, product: { select: { name: true } } },
  });
  if (!pub) throw new TextImageError('La publicación no es de esta cuenta.');
  return pub;
}

/** Las publicaciones que comparten la pieza: toda la familia, o solo ella. */
async function sharing(db: Db, publicationId: string): Promise<{ ids: string[]; family: boolean }> {
  const family = await familyOf(db, publicationId);
  return family && family.members.length > 1 ? { ids: family.members.map((m) => m.id), family: true } : { ids: [publicationId], family: false };
}

/** La pieza de la publicación, o la de alguna de su familia si ella todavía no tiene. */
async function pieceOf(db: Db, publicationId: string) {
  const { ids } = await sharing(db, publicationId);
  const rows = await db.publication.findMany({ where: { id: { in: ids }, textImageId: { not: null } }, select: { id: true, textImageId: true } });
  const id = rows.find((r) => r.id === publicationId)?.textImageId ?? rows[0]?.textImageId ?? null;
  return id ? db.textImage.findUnique({ where: { id } }) : null;
}

// ───────────────────────────── Las fotos ─────────────────────────────

/** Las fotos del paso Fotos que puede llevar la pieza: las corregidas, con su PNG sin fondo, y las que se usan tal cual. */
async function photoOptions(db: Db, productId: string) {
  const edits = await db.photoEdit.findMany({
    where: { productId, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      asIs: true,
      originalUrl: true,
      originalType: true,
      previewUrl: true,
      runs: {
        where: { step: LAST_PHOTO_STEP, status: 'APPROVED', jpgUrl: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, pngUrl: true, jpgUrl: true },
      },
    },
  });
  return edits.flatMap((e, i) => {
    const n = i + 1;
    if (e.asIs) {
      const showable = ['image/jpeg', 'image/png', 'image/webp'].includes(e.originalType);
      return [
        {
          editId: e.id,
          label: `Original ${n}, sin editar`,
          href: photoFileHref(showable || !e.previewUrl ? 'original' : 'antes', { foto: e.id }),
          transparent: false,
          file: { url: e.originalUrl, type: showable ? e.originalType : 'image/jpeg', viaPreview: !showable && Boolean(e.previewUrl), preview: e.previewUrl },
          version: `original:${e.id}`,
        },
      ];
    }
    const run = e.runs[0];
    if (!run) return [];
    const png = Boolean(run.pngUrl);
    return [
      {
        editId: e.id,
        label: `Corregida ${n}`,
        href: photoFileHref(png ? 'png' : 'jpg', { paso: run.id }),
        transparent: png,
        file: { url: (run.pngUrl ?? run.jpgUrl)!, type: png ? 'image/png' : 'image/jpeg', viaPreview: false, preview: null },
        version: `paso:${run.id}`,
      },
    ];
  });
}

// ───────────────────────────── La huella del PNG ─────────────────────────────

/** Lo que tenía la pieza: si cambia algo, el PNG queda desactualizado. También si cambia el logo de una marca que usa. */
async function pieceHash(db: Db, content: PieceContent, photoVersion: string | null): Promise<string> {
  const keys = usedBrands(content);
  const brands =
    keys.length > 0 ? await db.vehicleBrand.findMany({ where: { key: { in: keys } }, orderBy: { key: 'asc' }, select: { key: true, name: true, logoUpdatedAt: true } }) : [];
  const print = JSON.stringify({ content, photo: photoVersion, brands: brands.map((b) => [b.key, b.name, b.logoUpdatedAt?.getTime() ?? null]) });
  return createHash('sha256').update(print).digest('hex');
}

// ───────────────────────────── El paso ─────────────────────────────


export async function loadTextImageStep(db: Db, args: { accountId: string; publicationId: string }) {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  const [row, share, photos, brands] = await Promise.all([pieceOf(db, pub.id), sharing(db, pub.id), photoOptions(db, pub.productId), listBrands(db)]);
  const content = row ? parsePiece(row.content) : emptyPiece();
  const photo = photos.find((p) => p.editId === row?.photoEditId) ?? null;
  const used = usedBrands(content);
  const known = new Map(brands.map((b) => [b.key, b]));
  const hash = row?.pngRef ? await pieceHash(db, content, photo?.version ?? null) : null;
  return {
    publication: { id: pub.id, title: pub.title, productName: pub.product.name },
    // En una familia, cuántas publicaciones comparten la pieza.
    sharedBy: share.family ? share.ids.length : 1,
    content,
    saved: row !== null,
    photoEditId: photo?.editId ?? null,
    photos: photos.map(({ editId, label, href, transparent }) => ({ editId, label, href, transparent })),
    brands: brands.map((b) => ({ key: b.key, name: b.name, aliases: b.aliases, logo: brandLogoHref(b.key, b.logoUpdatedAt) })),
    version: pieceVersion(content),
    missing: pieceMissing(content, photo !== null),
    lengthNotes: pieceLengthNotes(content),
    // Las marcas que usa y que todavía no tienen logo, y las que ya no están en la base.
    withoutLogo: used.filter((k) => known.has(k) && !known.get(k)!.hasLogo).map((k) => known.get(k)!.name),
    unknownBrands: used.filter((k) => !known.has(k)),
    png:
      row?.pngRef && row.pngAt
        ? { id: row.id, href: textImageHref(row.id, row.pngAt), at: row.pngAt, outdated: hash !== row.pngHash }
        : null,
  };
}

export type TextImageStep = Awaited<ReturnType<typeof loadTextImageStep>>;

/**
 * Guarda la pieza, o parte de ella: lo que no llega queda como estaba. En una
 * familia se guarda una sola vez para todas sus medidas. Las marcas tienen que
 * estar en la base y la foto tiene que ser del paso Fotos del producto.
 */
export async function saveTextImage(
  db: Db,
  args: { accountId: string; publicationId: string; content?: Partial<PieceContent>; photoEditId?: string | null; userId: string | null },
): Promise<void> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  const row = await pieceOf(db, pub.id);
  const before = row ? parsePiece(row.content) : emptyPiece();
  const merged = pieceSchema.safeParse({ ...before, ...(args.content ?? {}) });
  if (!merged.success) throw new TextImageError(problemOf(merged.error));
  const content = cleanPiece(merged.data);
  const brands = await listBrands(db);
  const missing = usedBrands(content).filter((k) => !brands.some((b) => b.key === k));
  if (missing.length > 0) throw new TextImageError(`Estas marcas no están en la base de marcas de vehículos: ${missing.join(', ')}.`);
  let photoEditId = row?.photoEditId ?? null;
  if (args.photoEditId !== undefined) {
    if (args.photoEditId !== null && !(await photoOptions(db, pub.productId)).some((p) => p.editId === args.photoEditId)) {
      throw new TextImageError('Esa foto no está lista en el paso Fotos de este producto.');
    }
    photoEditId = args.photoEditId;
  }
  const { ids } = await sharing(db, pub.id);
  await db.$transaction(async (tx) => {
    const data = { content: content as Prisma.InputJsonValue, photoEditId, updatedById: args.userId };
    const id = row ? (await tx.textImage.update({ where: { id: row.id }, data })).id : (await tx.textImage.create({ data: { accountId: args.accountId, ...data } })).id;
    // Todas las medidas de la familia apuntan a la misma.
    await tx.publication.updateMany({ where: { id: { in: ids } }, data: { textImageId: id } });
  });
}

function problemOf(e: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = e.issues[0];
  if (!issue) return 'Revisá los datos.';
  const where = issue.path.map(String).join(' › ');
  return where ? `${where}: ${issue.message}` : issue.message;
}

// ───────────────────────────── El PNG ─────────────────────────────

export type GenerateResult = { fit: PieceFit; at: Date; version: PieceVersion };

/** Lo que el servidor le pasa a la pieza para armar el PNG: todo adentro, como data:. */
async function paintFor(db: Db, content: PieceContent, file: { url: string; type: string; viaPreview: boolean; preview: string | null }) {
  const res = await readStored(db, file.viaPreview && file.preview ? file.preview : file.url);
  if (!res) throw new TextImageError('La foto ya no está guardada en el Drive. Elegí otra.');
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    content,
    photoUrl: `data:${file.type};base64,${bytes.toString('base64')}`,
    brands: await brandsForPiece(db, usedBrands(content)),
    preview: false,
  };
}

/**
 * Arma el PNG de 1200 × 1200 en el servidor, igual a la vista previa, y lo
 * guarda en el Drive del producto. Si la pieza no entra ni achicando los ítems,
 * no lo arma: hay que juntar ítems.
 */
export async function generateTextImage(
  db: Db,
  args: { accountId: string; publicationId: string; userId: string | null; now?: Date },
  render: PieceRenderer = renderPiece,
): Promise<GenerateResult> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  const row = await pieceOf(db, pub.id);
  if (!row) throw new TextImageError('Todavía no hay nada cargado en la imagen con texto.');
  const content = parsePiece(row.content);
  const photo = (await photoOptions(db, pub.productId)).find((p) => p.editId === row.photoEditId) ?? null;
  const missing = pieceMissing(content, photo !== null);
  if (missing.length > 0) throw new TextImageError(missing.join(' '));
  const { png, fit } = await render(await paintFor(db, content, photo!.file));
  if (!fit.fits) throw new TextImageError('No entra todo ni achicando los ítems al 55 %. Juntá ítems de la misma marca y el mismo motor, o acortá los textos.');
  const hash = await pieceHash(db, content, photo!.version);
  const at = args.now ?? new Date();
  const owner = await folderOwner(db, pub.productId);
  const name = `${pub.product.name} · imagen con texto · ${at.toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')}.png`;
  const ref = await withDriveToken(db, async (token, email) => {
    const folderId = await ensureFolder(db, token, email, textImagesFolder(owner.account, owner.product));
    return driveRef((await uploadContent(token, { folderId, name, type: 'image/png', data: png, properties: { mrbProducto: pub.productId } })).id);
  });
  const old = row.pngRef;
  await db.textImage.update({ where: { id: row.id }, data: { pngRef: ref, pngAt: at, pngHash: hash, updatedById: args.userId } });
  // El anterior, a la papelera del Drive. Si no se puede, queda ahí.
  if (old && old !== ref) await removeStored(db, old).catch((e) => console.error('No se pudo sacar el PNG anterior del Drive.', e));
  return { fit, at, version: fit.version };
}

// ───────────────────────────── Completar con IA ─────────────────────────────

type Requester = (input: TextImageInput) => Promise<TextImageResult>;

export type CompleteResult = { ok: true; costUsd: number; missingBrands: string[] } | { ok: false; error: string; costUsd: number };

/**
 * Pide a Claude todo el contenido a partir del paso Información y lo guarda.
 * La foto queda como estaba. Si ya hay contenido, solo lo reemplaza con replace.
 */
export async function completeTextImage(
  db: Db,
  args: { accountId: string; publicationId: string; userId: string | null; replace?: boolean },
  request: Requester = requestTextImage,
): Promise<CompleteResult> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  const row = await pieceOf(db, pub.id);
  const current = row ? parsePiece(row.content) : emptyPiece();
  const filled = Boolean(current.TIPO_PRODUCTO || current.MOTOR || current.compatible.length || current.no_compatible.length || current.dudas.length);
  if (filled && !args.replace) return { ok: false, error: 'Ya hay contenido cargado: confirmá que querés reemplazarlo.', costUsd: 0 };
  const [info, qa, research, brands] = await Promise.all([
    descriptionInput(db, args.accountId, pub.id),
    db.publication.findUniqueOrThrow({ where: { id: pub.id }, select: { faq: true, answerRules: true } }),
    db.productResearch.findUnique({ where: { productId: pub.productId }, select: { competitorQuestions: true } }),
    listBrands(db),
  ]);
  let r: TextImageResult;
  try {
    r = await request({
      info,
      faq: richTextToMarkdown(qa.faq ?? null),
      rules: richTextToMarkdown(qa.answerRules ?? null),
      competitorQuestions: richTextToMarkdown(research?.competitorQuestions ?? null),
      brands: brands.map((b) => ({ key: b.key, name: b.name, aliases: b.aliases })),
    });
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.message, costUsd: e.usage?.costUsd ?? 0 };
    throw e;
  }
  const o = r.output;
  const missingBrands = [...new Set(o.marcas_faltantes.map((m) => m.trim()).filter(Boolean))];
  // Una clave que no está en la base no se inventa: el ítem queda sin marca.
  const item = (x: (typeof o.compatible)[number]) =>
    x.tipo === 'motor'
      ? { tipo: 'motor' as const, titulo: x.titulo, detalle: x.detalle }
      : { tipo: 'vehiculo' as const, marca: brandKeyOf(x.marca, brands), titulo: x.titulo, detalle: x.detalle };
  const content = {
    TIPO_PRODUCTO: o.TIPO_PRODUCTO,
    MOTOR: o.MOTOR,
    SELLO: DEFAULT_SEAL,
    compatible: o.compatible.map(item),
    no_compatible: o.no_compatible.map(item),
    TITULO_DUDAS: o.TITULO_DUDAS,
    dudas: o.dudas.slice(0, 4),
  };
  try {
    await saveTextImage(db, { accountId: args.accountId, publicationId: pub.id, content, userId: args.userId });
  } catch (e) {
    if (e instanceof TextImageError) return { ok: false, error: e.message, costUsd: r.usage.costUsd };
    throw e;
  }
  return { ok: true, costUsd: r.usage.costUsd, missingBrands };
}
