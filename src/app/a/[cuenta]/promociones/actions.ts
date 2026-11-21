'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import type { EventTier } from '@/domain/promo/plan';
import type { RulesPatch } from '@/domain/promo/rules';
import type { Competition, Lifecycle, Mode, Priority, TagGroup } from '@/domain/promo/tags';
import { applyDue, dueActions, putBack, takeOut } from '@/lib/promo/apply';
import { classifyAccount } from '@/lib/promo/classify';
import { cancelSlot, deleteEvent, saveEvent, saveManualSlot } from '@/lib/promo/manual';
import { overviewProductIds, type OverviewFilter } from '@/lib/promo/overview';
import { generatePlan } from '@/lib/promo/plan';
import { clearManualPlan, modeConflicts, setMode } from '@/lib/promo/mode';
import { loadPromoSettings, PromoError, savePromoSettings } from '@/lib/promo/settings';
import { refreshPublications, sweepInvitations } from '@/lib/promo/sweep';
import { setOptionsExcluded, setPromoTags } from '@/lib/promo/tags';
import { fromZonedInput } from '@/lib/zoned-input';

// Las acciones de Promociones: etiquetas, reglas, calendario, almanaque y
// prender y apagar ofertas. Lo que toca el canal pide además el permiso de
// subir a los canales.

type Ok<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Lo que tarda como mucho una acción antes de devolver lo hecho y lo que falta.
const BUDGET_MS = 40_000;

async function guarded<T extends object>(work: () => Promise<T>): Promise<Ok<T>> {
  try {
    return { ok: true, ...(await work()) };
  } catch (e) {
    if (e instanceof PromoError) return { ok: false, error: e.message };
    throw e;
  }
}

const refresh = (slug: string) => revalidatePath(`/a/${slug}`, 'layout');

export async function saveThresholdsAction(accountSlug: string, input: { healthyMarginPct?: number; floorMarginPct?: number }) {
  return act(accountSlug, { section: 'promociones', does: 'Cambió la rentabilidad de las promociones' }, async ({ account, user }) =>
    guarded(async () => {
      await savePromoSettings(prisma, { accountId: account.id, userId: user.id, healthyMarginPct: input.healthyMarginPct, floorMarginPct: input.floorMarginPct });
      refresh(account.slug);
      return {};
    }),
  );
}

/** El freno de emergencia: mientras está puesto, la app no prende ni apaga nada en el canal. No borra nada. */
export async function setPausedAction(accountSlug: string, paused: boolean) {
  return act(accountSlug, { section: 'promociones', does: paused ? 'Puso el freno de emergencia de promociones' : 'Soltó el freno de emergencia de promociones' }, async ({ account, user }) =>
    guarded(async () => {
      await savePromoSettings(prisma, { accountId: account.id, userId: user.id, paused });
      refresh(account.slug);
      return {};
    }),
  );
}

/** Lo que está en el canal y las reglas no incluirían, para preguntar qué hacer antes de pasar un producto a Automático. */
export async function modeConflictsAction(accountSlug: string, productId: string) {
  return act(accountSlug, { section: 'promociones', level: 'read' }, async ({ account }) => guarded(async () => ({ conflicts: await modeConflicts(prisma, { accountId: account.id, productId: String(productId) }) })));
}

/** Cambia quién arma el almanaque de un producto: una persona (Manual) o las reglas (Automático). */
export async function setModeAction(accountSlug: string, productId: string, mode: Mode, opts: { takeOut?: string[]; clear?: boolean } = {}) {
  // Sacar algo del canal al cambiar pide además el permiso de subir.
  const section = opts.takeOut?.length ? (['subir'] as const) : 'promociones';
  return act(accountSlug, { section, does: mode === 'AUTO' ? 'Pasó un producto a promociones en Automático' : 'Pasó un producto a promociones en Manual', productId }, async ({ account, user }) =>
    guarded(async () => {
      const r = await setMode(prisma, { accountId: account.id, productId: String(productId), mode: mode === 'AUTO' ? 'AUTO' : 'MANUAL', takeOut: opts.takeOut?.map(String), clear: opts.clear === true, userId: user.id });
      refresh(account.slug);
      return { removed: r.removed, kept: r.kept, takenOut: r.takenOut.filter((t) => t.ok).length, failed: r.takenOut.filter((t) => !t.ok).map((t) => `${t.externalId ?? ''} ${t.message ?? ''}`.trim()) };
    }),
  );
}

/** Pasa varios productos de modo. Lo que ya está en el canal sigue hasta que termine: nada se saca en lote. */
export async function setModesAction(accountSlug: string, productIds: string[], mode: Mode) {
  return act(accountSlug, { section: 'promociones', does: mode === 'AUTO' ? 'Pasó productos a promociones en Automático' : 'Pasó productos a promociones en Manual' }, async ({ account, user }) =>
    guarded(async () => {
      const started = Date.now();
      const left: string[] = [];
      let done = 0;
      for (const productId of productIds.map(String)) {
        if (Date.now() - started > BUDGET_MS) {
          left.push(productId);
          continue;
        }
        await setMode(prisma, { accountId: account.id, productId, mode: mode === 'AUTO' ? 'AUTO' : 'MANUAL', userId: user.id });
        done++;
      }
      refresh(account.slug);
      return { done, left };
    }),
  );
}

/** En Manual: borra las franjas que todavía no empezaron. */
export async function clearPlanAction(accountSlug: string, productId: string) {
  return act(accountSlug, { section: 'promociones', does: 'Borró el almanaque de un producto', productId }, async ({ account }) =>
    guarded(async () => {
      const removed = await clearManualPlan(prisma, { accountId: account.id, productId: String(productId) });
      refresh(account.slug);
      return { removed };
    }),
  );
}

export async function saveRulesAction(accountSlug: string, rules: RulesPatch) {
  return act(accountSlug, { section: 'promociones', does: 'Cambió las reglas de promociones' }, async ({ account, user }) =>
    guarded(async () => {
      await savePromoSettings(prisma, { accountId: account.id, userId: user.id, rules });
      refresh(account.slug);
      return {};
    }),
  );
}

export type TagInput = { lifecycle?: Lifecycle | null; competition?: Competition | null; stockControl?: boolean; priority?: Priority | null; release?: TagGroup[] };

/** Pone etiquetas en unos productos y rearma su almanaque. */
export async function setTagsAction(accountSlug: string, productIds: string[], change: TagInput) {
  return act(accountSlug, { section: 'promociones', does: 'Cambió etiquetas de promociones', productId: productIds.length === 1 ? productIds[0] : null }, async ({ account, user }) =>
    guarded(async () => {
      const changed = await setPromoTags(prisma, { accountId: account.id, productIds: productIds.map(String), change, userId: user.id });
      const started = Date.now();
      let replanned = 0;
      for (const productId of productIds) {
        if (Date.now() - started > BUDGET_MS) break;
        await generatePlan(prisma, { accountId: account.id, productId });
        replanned++;
      }
      refresh(account.slug);
      return { changed, replanned };
    }),
  );
}

/** Los productos que pasan el filtro de la lista, para las acciones en lote sobre todos. */
export async function filteredProductsAction(accountSlug: string, filter: OverviewFilter) {
  return act(accountSlug, { section: 'promociones', level: 'read' }, async ({ account }) => guarded(async () => ({ productIds: await overviewProductIds(prisma, account.id, filter) })));
}

/** Rearma el almanaque de unos productos, hasta donde alcanza el tiempo. */
export async function generatePlansAction(accountSlug: string, productIds: string[]) {
  return act(accountSlug, { section: 'promociones', does: 'Rearmó el almanaque de promociones', productId: productIds.length === 1 ? productIds[0] : null }, async ({ account }) =>
    guarded(async () => {
      const started = Date.now();
      const left: string[] = [];
      const skipped: string[] = [];
      let done = 0;
      for (const productId of productIds.map(String)) {
        if (Date.now() - started > BUDGET_MS) {
          left.push(productId);
          continue;
        }
        const r = await generatePlan(prisma, { accountId: account.id, productId });
        if (r.skipped) skipped.push(`${r.name}: ${r.skipped}`);
        done++;
      }
      refresh(account.slug);
      return { done, left, skipped };
    }),
  );
}

/**
 * La regla propone las etiquetas: apply las guarda y rearma el almanaque de
 * los que cambiaron. Con filter, solo de los productos que pasan ese filtro
 * de la lista; sin él, de toda la cuenta.
 */
export async function classifyAction(accountSlug: string, apply: boolean, filter?: OverviewFilter) {
  return act(accountSlug, { section: 'promociones', level: apply ? 'write' : 'read', does: apply ? 'Reclasificó las promociones con la regla' : undefined }, async ({ account }) =>
    guarded(async () => {
      const { classifiedText } = await import('@/lib/promo/classify');
      const productIds = filter ? await overviewProductIds(prisma, account.id, filter) : undefined;
      const r = await classifyAccount(prisma, { accountId: account.id, apply, productIds });
      const left: string[] = [];
      if (apply) {
        const started = Date.now();
        for (const productId of r.changed) {
          if (Date.now() - started > BUDGET_MS) left.push(productId);
          else await generatePlan(prisma, { accountId: account.id, productId });
        }
        refresh(account.slug);
      }
      return { products: r.products.length, changed: r.changed.length, left, rows: r.products.filter((p) => r.changed.includes(p.productId)).slice(0, 200).map((p) => ({ name: p.name, lines: classifiedText(p) })) };
    }),
  );
}

/**
 * Pone las etiquetas de un producto según la regla, ahora: lo que estaba
 * puesto a mano en ciclo de vida y competencia vuelve a quedar a
 * cargo de la regla, y se rearma su almanaque. Devuelve lo que decidió la
 * regla y por qué.
 */
export async function classifyProductAction(accountSlug: string, productId: string) {
  return act(accountSlug, { section: 'promociones', does: 'Puso las etiquetas de un producto según la regla', productId }, async ({ account, user }) =>
    guarded(async () => {
      const { classifiedText } = await import('@/lib/promo/classify');
      const id = String(productId);
      const current = await prisma.productPromotion.findFirst({ where: { productId: id, product: { accountId: account.id } }, select: { manual: true } });
      const manual = (current?.manual ?? []).filter((g): g is TagGroup => g === 'lifecycle' || g === 'competition');
      if (manual.length > 0) await setPromoTags(prisma, { accountId: account.id, productIds: [id], change: { release: manual }, userId: user.id });
      const r = await classifyAccount(prisma, { accountId: account.id, productIds: [id], apply: true });
      if (r.products.length === 0) throw new PromoError('El producto no tiene publicaciones activas en el canal.');
      await generatePlan(prisma, { accountId: account.id, productId: id });
      refresh(account.slug);
      const lines = classifiedText(r.products[0]);
      return { lines: lines.length > 0 ? lines : ['La regla no tiene con qué decidir: faltan las ventas de la tienda o los precios de la competencia. Las etiquetas quedan como están.'] };
    }),
  );
}

/** Relee del canal las invitaciones de un producto. */
export async function refreshProductAction(accountSlug: string, productId: string) {
  return act(accountSlug, { section: 'promociones', level: 'read' }, async ({ account }) =>
    guarded(async () => {
      const pubs = await prisma.publication.findMany({
        where: { product: { accountId: account.id }, productId: String(productId), externalId: { not: null }, channelStatus: { notIn: ['CLOSED', 'DELETED'] }, channelCopy: { is: { missingSince: null } } },
        select: { id: true },
      });
      const r = await refreshPublications(prisma, { accountId: account.id, publicationIds: pubs.map((p) => p.id) });
      await generatePlan(prisma, { accountId: account.id, productId: String(productId) });
      refresh(account.slug);
      return { read: r.read };
    }),
  );
}

/** Una vuelta de la lectura de las invitaciones de toda la cuenta. */
export async function sweepAction(accountSlug: string, restart: boolean) {
  return act(accountSlug, { section: 'promociones', level: 'read' }, async ({ account }) =>
    guarded(async () => {
      const r = await sweepInvitations(prisma, { accountId: account.id, budgetMs: BUDGET_MS, restart });
      if (!r.pending) refresh(account.slug);
      return { pending: r.pending && !r.error, finished: r.finished, items: r.items, error: r.error };
    }),
  );
}

export type ApplyScope = { productIds?: string[]; itemIds?: string[]; force?: boolean };

/** La vista previa de lo que se prende y se apaga. */
export async function previewApplyAction(accountSlug: string, scope: ApplyScope) {
  return act(accountSlug, { section: 'promociones', level: 'read' }, async ({ account }) =>
    guarded(async () => {
      const settings = await loadPromoSettings(prisma, account.id);
      return { actions: await dueActions(prisma, { accountId: account.id, ...scope, joinLeadDays: settings.rules.timing.joinLeadDays }) };
    }),
  );
}

/** Prende y apaga en el canal lo de la vista previa. */
export async function applyAction(accountSlug: string, scope: ApplyScope) {
  return act(accountSlug, { section: ['subir'], does: 'Prendió o apagó ofertas del almanaque' }, async ({ account, user }) =>
    guarded(async () => {
      const r = await applyDue(prisma, { accountId: account.id, ...scope, auto: false, userId: user.id, budgetMs: BUDGET_MS });
      refresh(account.slug);
      return { done: r.done, pending: r.pending, skipped: r.skipped.map((s) => ({ externalId: s.externalId, name: s.name, why: s.why })) };
    }),
  );
}

/** Saca a mano unos casilleros de su oferta. */
export async function takeOutAction(accountSlug: string, itemIds: string[], why: string) {
  return act(accountSlug, { section: ['subir'], does: 'Sacó formas de cobro de una oferta' }, async ({ account, user }) =>
    guarded(async () => {
      const done = await takeOut(prisma, { accountId: account.id, itemIds: itemIds.map(String), why, userId: user.id });
      refresh(account.slug);
      return { done };
    }),
  );
}

/** Deshace lo sacado a mano o lo que no se pudo. */
export async function putBackAction(accountSlug: string, itemIds: string[]) {
  return act(accountSlug, { section: 'promociones', does: 'Volvió a decidir formas de cobro de una oferta' }, async ({ account }) =>
    guarded(async () => {
      const count = await putBack(prisma, { accountId: account.id, itemIds: itemIds.map(String) });
      refresh(account.slug);
      return { count };
    }),
  );
}

/** Prohíbe unas formas de cobro en todas las ofertas, o lo levanta. */
export async function excludeAction(accountSlug: string, productId: string, publicationIds: string[], excluded: boolean, why: string) {
  return act(accountSlug, { section: 'promociones', does: excluded ? 'Prohibió formas de cobro en las promociones' : 'Levantó la prohibición de formas de cobro', productId }, async ({ account, user }) =>
    guarded(async () => {
      await setOptionsExcluded(prisma, { accountId: account.id, publicationIds: publicationIds.map(String), excluded, why, userId: user.id });
      await generatePlan(prisma, { accountId: account.id, productId: String(productId) });
      refresh(account.slug);
      return {};
    }),
  );
}

const zoned = (value: string | undefined, timeZone: string) => (value ? fromZonedInput(value.includes('T') ? value : `${value}T00:00`, timeZone) : null);

export type SlotInput = { slotId?: string; group?: string | null; start?: string; finish?: string; targetMarginPct?: number; name?: string; note?: string };

/** Pone una franja a mano o cambia una. */
export async function saveSlotAction(accountSlug: string, productId: string, input: SlotInput) {
  return act(accountSlug, { section: 'promociones', does: input.slotId ? 'Cambió una franja del almanaque' : 'Puso una franja en el almanaque', productId }, async ({ account }) =>
    guarded(async () => {
      const start = zoned(input.start, account.timezone);
      const finish = zoned(input.finish, account.timezone);
      if ((input.start && !start) || (input.finish && !finish)) throw new PromoError('Revisá las fechas.');
      await saveManualSlot(prisma, { accountId: account.id, input: { productId: String(productId), slotId: input.slotId, group: input.group ?? null, start: start ?? undefined, finish: finish ?? undefined, targetMarginPct: input.targetMarginPct, name: input.name, note: input.note } });
      refresh(account.slug);
      return {};
    }),
  );
}

/** Decide que una franja no va, o la vuelve a poner. */
export async function cancelSlotAction(accountSlug: string, slotId: string, cancelled: boolean, takeOutNow: boolean, why: string) {
  return act(accountSlug, { section: takeOutNow ? ['subir'] : 'promociones', does: cancelled ? 'Sacó una franja del almanaque' : 'Volvió a poner una franja en el almanaque' }, async ({ account, user }) =>
    guarded(async () => {
      const r = await cancelSlot(prisma, { accountId: account.id, slotId: String(slotId), cancelled, takeOutNow, why: why || null, userId: user.id });
      refresh(account.slug);
      return r;
    }),
  );
}

export type EventForm = { id?: string; name: string; tier: EventTier; start: string; finish: string; match?: string; notes?: string };

export async function saveEventAction(accountSlug: string, input: EventForm) {
  return act(accountSlug, { section: 'promociones', does: input.id ? 'Cambió un evento del calendario de promociones' : 'Cargó un evento en el calendario de promociones', targetLabel: input.name }, async ({ account }) =>
    guarded(async () => {
      const start = zoned(input.start, account.timezone);
      const last = zoned(input.finish, account.timezone);
      if (!start || !last) throw new PromoError('Revisá las fechas del evento.');
      // El último día va entero.
      await saveEvent(prisma, account.id, { id: input.id, name: input.name, tier: input.tier, start, finish: new Date(last.getTime() + 86_400_000), match: input.match, notes: input.notes });
      refresh(account.slug);
      return {};
    }),
  );
}

export async function deleteEventAction(accountSlug: string, id: string) {
  return act(accountSlug, { section: 'promociones', does: 'Borró un evento del calendario de promociones' }, async ({ account }) =>
    guarded(async () => {
      await deleteEvent(prisma, account.id, String(id));
      refresh(account.slug);
      return {};
    }),
  );
}
