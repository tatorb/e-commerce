import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { ChannelStatus } from '@/generated/prisma/enums';
import { getChannelAdapter } from '@/channels';
import { CHANNEL_STATUS_LABEL, STATUS_ACTIONS } from '@/domain/channel-status';
import { CatalogError } from '@/domain/catalog-data';
import { planLabel } from '@/domain/pricing';
import { ensureChannelCategory } from '@/lib/catalog-categories';
import { saveCatalogData } from '@/lib/catalog-data';
import { createChecks, createInChannel } from '@/lib/channel-create';
import { changeStatus } from '@/lib/channel-status';
import { readOne } from '@/lib/channel-sync';
import { listScoredPublications } from '@/lib/queries/scoring';
import { createSaleOption, SaleOptionCopyError } from '@/lib/sale-option-copy';
import { movePipelineWork } from '@/lib/sale-options';
import { setTaskStatus } from '@/lib/tasks';

// Recrear un producto en otra categoría. Cuando el canal le cambia la
// categoría a una opción de venta, el producto del canal queda con otro tipo y
// no acepta opciones nuevas. La salida es crear el producto de nuevo en la
// categoría que va, como otro producto del canal, con sus formas de cobro y los
// mismos precios; pasarle el trabajo del pipeline, y recién al final finalizar
// las viejas. Las que el canal no deja finalizar (por ejemplo, en revisión)
// quedan pendientes: la tarea de cada hora lo reintenta y hay una tarea que lo
// avisa. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export class RecreateError extends Error {}

// Las que siguen en el canal: se finalizan al terminar.
const GONE: ChannelStatus[] = ['CLOSED', 'DELETED', 'UNPUBLISHED'];
// Para el precio sin cuotas de la principal nueva.
const NO_INSTALLMENTS = 0;
// La principal nueva se crea sin cuotas, en el tipo de publicación clásico: las cuotas van en sus opciones.
const MAIN_LISTING_TYPE = 'clasica';

export type OldOption = {
  id: string;
  externalId: string;
  plan: number;
  planLabel: string;
  price: number | null;
  status: ChannelStatus;
  statusLabel: string;
  statusReason: string | null;
  visits: number | null;
  sales: number | null;
  main: boolean;
  // Si se va a poder finalizar al terminar; si no, por qué.
  closeBlocked: string | null;
};

export type RecreatePlan = {
  product: { id: string; name: string };
  channelName: string;
  category: { id: string; name: string; path: string | null };
  // La publicación de la app que se crea en el canal como principal nueva. created: hay que crearla en la app copiando la principal vieja.
  newMain: { id: string | null; title: string | null; categoryNow: string | null; created: boolean };
  old: OldOption[];
  toCreate: { plan: number; label: string; price: number | null; main: boolean }[];
  // Lo que falta antes de poder aplicar, de los controles de crear.
  missing: string[];
  notes: string[];
};

async function load(db: Db, accountId: string, publicationId: string) {
  const pub = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: { id: true, productId: true, storeId: true, product: { select: { name: true } }, store: { select: { channel: { select: { kind: true, name: true } } } } },
  });
  if (!pub) throw new RecreateError('La publicación no está en la cuenta.');
  const all = await db.publication.findMany({
    where: { productId: pub.productId, storeId: pub.storeId },
    select: {
      id: true,
      externalId: true,
      title: true,
      familyId: true,
      mainOptionId: true,
      channelStatus: true,
      channelCategory: true,
      installments: true,
      price: true,
      createdAt: true,
      channelCopy: { select: { installments: true, price: true, status: true, statusReason: true, missingSince: true, categoryId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return { pub, all };
}

/** Qué se va a hacer, sin cambiar nada: las opciones vivas, la categoría destino y qué se crea. */
export async function planRecreate(db: Db, args: { accountId: string; publicationId: string; categoryId: string; allPlans: boolean }): Promise<RecreatePlan> {
  const { pub, all } = await load(db, args.accountId, args.publicationId);
  const channelName = getChannelAdapter(pub.store.channel.kind, pub.store.channel.name).name;
  if (all.some((p) => p.familyId)) throw new RecreateError('Este producto tiene medidas en familia: recrearlo en otra categoría todavía no se puede desde la app.');
  let category;
  try {
    category = await ensureChannelCategory(db, { storeId: pub.storeId, kind: pub.store.channel.kind, categoryId: args.categoryId });
  } catch (e) {
    if (e instanceof CatalogError) throw new RecreateError(e.message);
    throw e;
  }

  const live = all.filter((p) => p.externalId && !GONE.includes(p.channelCopy?.status ?? p.channelStatus) && !p.channelCopy?.missingSince);
  if (live.length === 0) throw new RecreateError(`El producto no tiene publicaciones vivas en ${channelName}: no hay nada que recrear. Creala con create_in_channel.`);
  const figures = new Map((await listScoredPublications(args.accountId, { productId: pub.productId }, db)).map((r) => [r.id, r]));
  const oldMainId = live.find((p) => !p.mainOptionId)?.id ?? live[0].mainOptionId ?? live[0].id;
  const old: OldOption[] = live.map((p) => {
    const status = p.channelCopy?.status ?? p.channelStatus;
    const plan = p.channelCopy?.installments ?? p.installments ?? NO_INSTALLMENTS;
    const price = p.channelCopy?.price ?? p.price;
    return {
      id: p.id,
      externalId: p.externalId!,
      plan,
      planLabel: planLabel(plan),
      price: price === null ? null : Number(price),
      status,
      statusLabel: CHANNEL_STATUS_LABEL[status],
      statusReason: p.channelCopy?.statusReason ?? null,
      visits: figures.get(p.id)?.visits ?? null,
      sales: figures.get(p.id)?.sales ?? null,
      main: p.id === oldMainId,
      closeBlocked: STATUS_ACTIONS.close.from.includes(status)
        ? null
        : `Está ${CHANNEL_STATUS_LABEL[status].toLowerCase()}: ${channelName} no deja finalizarla así. Queda pendiente y la app lo reintenta cada hora.`,
    };
  });

  // La principal nueva: la que se pidió, si no está publicada, o una sin publicar del producto. Si no hay, se crea copiando la vieja.
  const unpublished = all.filter((p) => !p.externalId && !p.mainOptionId);
  const chosen = unpublished.find((p) => p.id === pub.id) ?? unpublished[unpublished.length - 1] ?? null;
  const oldMain = all.find((p) => p.id === oldMainId)!;
  const mainPrice = old.find((o) => o.plan === NO_INSTALLMENTS)?.price ?? (chosen?.price != null ? Number(chosen.price) : null) ?? old.find((o) => o.main)?.price ?? null;
  const plans = args.allPlans ? [...new Set(old.map((o) => o.plan).filter((p) => p !== NO_INSTALLMENTS))].sort((a, b) => a - b) : [];
  const toCreate = [
    { plan: NO_INSTALLMENTS, label: planLabel(NO_INSTALLMENTS), price: mainPrice, main: true },
    ...plans.map((plan) => ({ plan, label: planLabel(plan), price: old.find((o) => o.plan === plan)?.price ?? null, main: false })),
  ];

  const notes: string[] = [];
  const missing: string[] = [];
  if (chosen) {
    if (chosen.channelCategory !== category.id) notes.push(`La publicación nueva está en otra categoría en la app: al aplicar se le pone ${category.name} (${category.id}) y hay que revisar sus datos de catálogo.`);
    const info = await createChecks(db, { accountId: args.accountId, publicationId: chosen.id, recreate: true });
    if (info.blocked) missing.push(info.blocked);
    for (const c of info.checks) {
      if (c.ok || !c.blocking) continue;
      // La categoría se pone al aplicar: lo que diga ahora de la categoría no frena.
      if (c.label === 'Categoría' && chosen.channelCategory !== category.id) continue;
      missing.push(`${c.label}: ${c.detail}`);
    }
    for (const c of info.checks) if (c.label.startsWith('Categoría en') && !c.ok) notes.push(c.detail);
  } else {
    notes.push(`No hay una publicación sin publicar del producto: al aplicar se crea en la app copiando ${oldMain.externalId ?? 'la principal vieja'}, con su título, descripción, fotos y datos de catálogo.`);
  }
  if (toCreate.some((t) => t.price === null)) missing.push('Falta el precio de alguna forma de cobro.');
  for (const o of old) if (o.closeBlocked) notes.push(`${o.externalId}: ${o.closeBlocked}`);
  notes.push(`Las viejas se finalizan recién al final, cuando la nueva y sus opciones ya existen en ${channelName}.`);

  return {
    product: { id: pub.productId, name: pub.product.name },
    channelName,
    category: { id: category.id, name: category.name, path: 'path' in category ? ((category as { path?: string | null }).path ?? null) : null },
    newMain: { id: chosen?.id ?? null, title: chosen?.title ?? oldMain.title, categoryNow: chosen?.channelCategory ?? null, created: !chosen },
    old,
    toCreate,
    missing,
    notes,
  };
}

export type RecreateResult = {
  plan: RecreatePlan;
  newMainId: string;
  created: { plan: number; label: string; externalId: string | null; confirmed: boolean; error: string | null }[];
  closed: string[];
  pending: { externalId: string; why: string }[];
  warnings: string[];
};

/** Copia en la app la principal vieja como una publicación nueva, sin publicar. */
async function copyAsNew(db: Db, fromId: string): Promise<string> {
  const p = await db.publication.findUniqueOrThrow({ where: { id: fromId } });
  const json = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));
  const made = await db.publication.create({
    data: {
      productId: p.productId,
      storeId: p.storeId,
      title: p.title,
      description: p.description,
      attributes: json(p.attributes) as Prisma.InputJsonValue,
      faq: p.faq,
      answerRules: p.answerRules,
      autoAnswer: p.autoAnswer,
      media: json(p.media),
      warranty: json(p.warranty),
      variantKey: p.variantKey,
      price: p.price,
      currency: p.currency,
      channelStatus: 'UNPUBLISHED',
    },
  });
  return made.id;
}

/**
 * Recrea el producto en la categoría: crea la principal nueva y sus opciones,
 * las confirma leyéndolas del canal, le pasa el trabajo del pipeline y recién
 * entonces finaliza las viejas. Si algo de la creación falla, no finaliza nada.
 */
export async function applyRecreate(
  db: Db,
  args: { accountId: string; publicationId: string; categoryId: string; allPlans: boolean; userId: string | null; now?: Date },
): Promise<RecreateResult> {
  const plan = await planRecreate(db, args);
  if (plan.missing.length > 0) throw new RecreateError(`Antes de recrear falta: ${plan.missing.join(' ')}`);
  const warnings: string[] = [];
  const oldMain = plan.old.find((o) => o.main)!;

  // 1. La principal nueva en la app, en la categoría destino.
  const newMainId = plan.newMain.id ?? (await copyAsNew(db, oldMain.id));
  if (plan.newMain.categoryNow !== plan.category.id) await saveCatalogData(db, { publicationId: newMainId, category: plan.category.id, values: {} });
  const info = await createChecks(db, { accountId: args.accountId, publicationId: newMainId, recreate: true });
  const failing = info.checks.filter((c) => c.blocking && !c.ok).map((c) => `${c.label}: ${c.detail}`);
  if (info.blocked || failing.length > 0) throw new RecreateError(`No se puede crear la nueva: ${[info.blocked, ...failing].filter(Boolean).join(' ')}`);

  // 2. La principal nueva en el canal, como otro producto: sin juntarla a la vieja.
  const main = plan.toCreate.find((t) => t.main)!;
  const made = await createInChannel(db, {
    accountId: args.accountId,
    publicationId: newMainId,
    price: main.price!,
    quantity: info.stock?.quantity ?? 1,
    listingType: MAIN_LISTING_TYPE,
    userId: args.userId,
    now: args.now,
    recreate: true,
  });
  warnings.push(...made.warnings);
  const created: RecreateResult['created'] = [{ plan: main.plan, label: main.label, externalId: made.externalId, confirmed: made.confirmed, error: null }];

  // 3. Sus opciones de venta, con los mismos precios por forma de cobro.
  for (const t of plan.toCreate.filter((x) => !x.main)) {
    try {
      const o = await createSaleOption(db, { accountId: args.accountId, publicationId: newMainId, sourceId: newMainId, plan: t.plan, price: t.price ?? undefined, userId: args.userId, now: args.now, recreate: true });
      created.push({ plan: t.plan, label: t.label, externalId: o.externalId, confirmed: true, error: null });
      warnings.push(...(o.warnings ?? []));
    } catch (e) {
      if (!(e instanceof SaleOptionCopyError)) throw e;
      created.push({ plan: t.plan, label: t.label, externalId: null, confirmed: false, error: e.message });
    }
  }

  // 4. Que existan en el canal: se leen de nuevo.
  const fresh = await db.publication.findMany({ where: { OR: [{ id: newMainId }, { mainOptionId: newMainId }], externalId: { not: null } }, select: { id: true, externalId: true } });
  for (const f of fresh) {
    const row = created.find((c) => c.externalId === f.externalId);
    try {
      const taken = await readOne(db, { accountId: args.accountId, publicationId: f.id, now: args.now });
      const copy = await db.channelCopy.findUnique({ where: { publicationId: f.id }, select: { missingSince: true } });
      if (row) row.confirmed = taken !== null && !copy?.missingSince;
    } catch {
      if (row) row.confirmed = false;
    }
  }
  const unconfirmed = created.filter((c) => !c.confirmed || c.error);
  if (unconfirmed.length > 0) {
    // Sin todas las nuevas confirmadas, las viejas no se tocan: se sigue vendiendo con ellas.
    throw new RecreateError(
      `Se creó la nueva (${made.externalId}), pero ${unconfirmed.map((c) => `${c.label}${c.error ? `: ${c.error}` : ': no se pudo confirmar en el canal'}`).join('; ')}. Las viejas no se finalizaron: revisá y volvé a correrlo, o finalizalas a mano.`,
    );
  }

  // 5. El trabajo del pipeline pasa a la principal nueva.
  await db.$transaction((tx) => movePipelineWork(tx, oldMain.id, newMainId));
  await db.channelSyncChange.createMany({
    data: plan.old.map((o) => ({
      publicationId: o.id,
      field: 'publication',
      kind: 'MAIN_OPTION_CHANGED' as const,
      before: { externalId: o.externalId },
      after: { externalId: made.externalId },
      message: `El producto se recreó en ${plan.category.name} (${plan.category.id}) como ${made.externalId}.`,
      userId: args.userId,
    })),
  });

  // 6. Recién ahora, las viejas se finalizan. Las que no se pueden quedan pendientes.
  const why = `El producto se recreó en ${plan.category.name} (${plan.category.id}) como ${made.externalId}.`;
  const closable = plan.old.filter((o) => !o.closeBlocked).map((o) => o.id);
  const r = closable.length > 0 ? await changeStatus(db, { accountId: args.accountId, publicationIds: closable, action: 'close', userId: args.userId }) : { done: [], failed: [] };
  const failedIds = new Set(r.failed.map((f) => f.id));
  const pendingRows = plan.old.filter((o) => o.closeBlocked || failedIds.has(o.id));
  const pending = pendingRows.map((o) => ({ externalId: o.externalId, why: r.failed.find((f) => f.id === o.id)?.message ?? o.closeBlocked! }));
  if (pendingRows.length > 0) await markPendingClose(db, { accountId: args.accountId, publicationIds: pendingRows.map((o) => o.id), why, userId: args.userId, now: args.now });
  return { plan, newMainId, created, closed: plan.old.filter((o) => r.done.some((d) => d.id === o.id)).map((o) => o.externalId), pending, warnings };
}

// ───────────────────────────── Las que quedan por finalizar ─────────────────────────────

/** Deja anotado que hay que finalizarlas, con una tarea que lo avisa. */
export async function markPendingClose(db: Db, args: { accountId: string; publicationIds: string[]; why: string; userId: string | null; now?: Date }): Promise<void> {
  const now = args.now ?? new Date();
  const rows = await db.publication.findMany({ where: { id: { in: args.publicationIds } }, select: { id: true, externalId: true } });
  const codes = rows.map((r) => r.externalId ?? r.id);
  const task = await db.task.create({
    data: {
      accountId: args.accountId,
      title: `Finalizar ${codes.join(', ')} en el canal`,
      description: `${args.why} ${codes.length === 1 ? 'Esta publicación no se pudo' : 'Estas publicaciones no se pudieron'} finalizar todavía, por ejemplo porque están en revisión. La app lo reintenta cada hora y cierra esta tarea cuando lo logra.`,
      createdById: args.userId,
      ...(args.userId ? { assignees: { create: [{ userId: args.userId, notifiedAt: now }] } } : {}),
      publications: { create: rows.map((r) => ({ publicationId: r.id })) },
    },
  });
  await db.publication.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { closeWantedAt: now, closeWantedWhy: args.why, closeTaskId: task.id } });
}

/** Las que quedan por finalizar de la cuenta, para Por subir. */
export async function listPendingClose(db: Db, accountId: string) {
  return db.publication.findMany({
    where: { closeWantedAt: { not: null }, product: { accountId } },
    orderBy: { closeWantedAt: 'asc' },
    select: { id: true, externalId: true, title: true, channelStatus: true, closeWantedAt: true, closeWantedWhy: true },
  });
}

/**
 * En la tarea de cada hora: vuelve a intentar finalizar las que quedaron
 * pendientes. Las que ya están finalizadas o eliminadas salen de la lista, y la
 * tarea se cierra cuando no queda ninguna.
 */
export async function closePendingPass(db: Db, opts: { budgetMs?: number } = {}): Promise<{ closed: number; still: number }> {
  const started = Date.now();
  const rows = await db.publication.findMany({
    where: { closeWantedAt: { not: null } },
    select: { id: true, channelStatus: true, closeTaskId: true, product: { select: { accountId: true } } },
  });
  let closed = 0;
  let still = 0;
  const tasks = new Map<string, string>();
  for (const p of rows) {
    if (opts.budgetMs !== undefined && Date.now() - started > opts.budgetMs) break;
    let done = p.channelStatus === 'CLOSED' || p.channelStatus === 'DELETED';
    if (!done) {
      const r = await changeStatus(db, { accountId: p.product.accountId, publicationIds: [p.id], action: 'close', userId: null }).catch(() => null);
      done = Boolean(r && r.done.length > 0);
    }
    if (!done) {
      still++;
      continue;
    }
    closed++;
    await db.publication.update({ where: { id: p.id }, data: { closeWantedAt: null, closeWantedWhy: null, closeTaskId: null } });
    if (p.closeTaskId) tasks.set(p.closeTaskId, p.product.accountId);
  }
  // La tarea se cierra cuando ninguna de sus publicaciones queda pendiente.
  for (const [taskId, accountId] of tasks) {
    const left = await db.publication.count({ where: { closeTaskId: taskId } });
    if (left === 0) await setTaskStatus(db, { accountId, taskId, status: 'DONE' }).catch(() => undefined);
  }
  return { closed, still };
}
