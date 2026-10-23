'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { todayIn } from '@/domain/applications';
import { competitorsSchema, saveCompetitors, type CompetitorsInput } from '@/domain/competitors';
import { productInfoSchema, updateProductInfo, type ProductInfoInput } from '@/domain/product-info';
import {
  approveTitle,
  decideLock,
  savePosition,
  saveSeeds,
  saveSuggestions,
  setMainSearches,
  setWordStatus,
  TitleError,
} from '@/domain/title-work';
import { parsePastedSuggestions, type WordStatus } from '@/domain/titles';
import type { TitleLockDecision } from '@/generated/prisma/enums';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { loadTitleContext } from '@/lib/queries/title-step';
import { readPosition, readSuggestions } from '@/lib/research';
import { generateTitles } from '@/lib/titles';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';

// Lo que se hace desde los pasos Información y Título.

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function target(accountSlug: string, publicationId: string) {
  const account = await getAccountBySlug(accountSlug);
  if (!account) return null;
  const pub = await prisma.publication.findFirst({
    where: { id: publicationId, product: { accountId: account.id } },
    select: { id: true, productId: true, externalId: true, store: { select: { id: true, channel: { select: { id: true, kind: true } } } } },
  });
  return pub ? { account, pub, channel: pub.store.channel, storeId: pub.store.id } : null;
}

const NOT_FOUND: Result = { ok: false, error: 'La publicación no existe en esta cuenta.' };

function done(accountSlug: string, message?: string): Result {
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true, message };
}

async function guard(run: () => Promise<Result>): Promise<Result> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof TitleError) return { ok: false, error: e.message };
    throw e;
  }
}

// ───────────────────────────── Información ─────────────────────────────

/** Guarda en la ficha maestra los datos que se editaron en Información. */
export async function saveProductInfoAction(accountSlug: string, publicationId: string, input: ProductInfoInput): Promise<Result> {
  await requireUser();
  const t = await target(accountSlug, publicationId);
  if (!t) return NOT_FOUND;
  const filled = (values: unknown[]) => values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
  const parsed = productInfoSchema.safeParse({
    ...input,
    variants: (input.variants ?? []).filter((v) => filled([v.measure, v.sku])),
    compatibilities: (input.compatibilities ?? []).filter((c) =>
      filled([c.vehicleBrand, c.model, c.engine, c.displacement, c.fuel, c.yearFrom, c.yearTo, c.note]),
    ),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
  await prisma.$transaction((tx) => updateProductInfo(tx, { accountId: t.account.id, productId: t.pub.productId, data: parsed.data }));
  return done(accountSlug, 'Guardado en la ficha.');
}

export async function saveCompetitorsAction(accountSlug: string, publicationId: string, rows: CompetitorsInput): Promise<Result> {
  await requireUser();
  const t = await target(accountSlug, publicationId);
  if (!t) return NOT_FOUND;
  const parsed = competitorsSchema.safeParse(
    (rows ?? []).filter((r) =>
      [r.url, r.title, r.soldQuantity, r.sellerName, r.listPrice, r.notes].some((v) => v !== null && String(v ?? '').trim() !== ''),
    ),
  );
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
  await prisma.$transaction((tx) => saveCompetitors(tx, publicationId, parsed.data, todayIn(t.account.timezone)));
  return done(accountSlug, 'Competencia guardada.');
}

// ───────────────────────────── Título ─────────────────────────────

export async function saveSeedsAction(accountSlug: string, publicationId: string, seeds: string[]): Promise<Result> {
  await requireUser();
  if (!(await target(accountSlug, publicationId))) return NOT_FOUND;
  await prisma.$transaction((tx) => saveSeeds(tx, publicationId, Array.isArray(seeds) ? seeds.map(String) : []));
  return done(accountSlug);
}

/** Lee solas las sugerencias de una semilla; con "expand", también con cada letra de la a a la z. */
export async function readSuggestionsAction(accountSlug: string, publicationId: string, seed: string, expand: boolean): Promise<Result> {
  await requireUser();
  const t = await target(accountSlug, publicationId);
  if (!t) return NOT_FOUND;
  const r = await readSuggestions(prisma, {
    accountId: t.account.id,
    channel: t.channel,
    publicationId,
    seed: String(seed),
    expand: Boolean(expand),
  });
  revalidatePath(`/a/${accountSlug}`, 'layout');
  const parts = [
    r.read === 1 ? 'Se leyó 1 búsqueda.' : r.read > 1 ? `Se leyeron ${r.read} búsquedas.` : null,
    r.cached === 1 ? '1 ya estaba leída en los últimos 7 días.' : r.cached > 1 ? `${r.cached} ya estaban leídas en los últimos 7 días.` : null,
    r.empty === 1 ? '1 sin sugerencias.' : r.empty > 1 ? `${r.empty} sin sugerencias.` : null,
  ].filter(Boolean);
  if (r.error) {
    return { ok: false, error: `${r.error}${parts.length ? ` ${parts.join(' ')}` : ''} Podés pegarlas a mano.` };
  }
  return { ok: true, message: parts.join(' ') || 'Listo.' };
}

/** Guarda las sugerencias pegadas a mano para una semilla. */
export async function pasteSuggestionsAction(accountSlug: string, publicationId: string, seed: string, text: string): Promise<Result> {
  await requireUser();
  const t = await target(accountSlug, publicationId);
  if (!t) return NOT_FOUND;
  const suggestions = parsePastedSuggestions(String(text ?? ''));
  if (suggestions.length === 0) return { ok: false, error: 'Pegá al menos una sugerencia, una por línea.' };
  const clean = String(seed).toLowerCase().replace(/\s+/g, ' ').trim();
  await saveSuggestions(prisma, {
    accountId: t.account.id,
    channelId: t.channel.id,
    seed: clean,
    query: clean,
    suggestions,
    source: 'MANUAL',
    publicationId,
  });
  return done(accountSlug, suggestions.length === 1 ? 'Se guardó 1 sugerencia.' : `Se guardaron ${suggestions.length} sugerencias.`);
}

/** Borra una captura de sugerencias, por ejemplo una pegada por error. */
export async function deleteCaptureAction(accountSlug: string, captureId: string): Promise<Result> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return NOT_FOUND;
  await prisma.searchSuggestion.deleteMany({ where: { id: String(captureId), accountId: account.id } });
  return done(accountSlug);
}

export async function setWordStatusAction(
  accountSlug: string,
  publicationId: string,
  word: string,
  status: WordStatus | null,
): Promise<Result> {
  await requireUser();
  if (!(await target(accountSlug, publicationId))) return NOT_FOUND;
  const value = status === 'use' || status === 'discard' ? status : null;
  return guard(async () => {
    await prisma.$transaction((tx) => setWordStatus(tx, publicationId, String(word), value));
    return done(accountSlug);
  });
}

export async function generateTitlesAction(accountSlug: string, publicationId: string): Promise<Result> {
  await requireUser();
  const t = await target(accountSlug, publicationId);
  if (!t) return NOT_FOUND;
  if (!isAiConfigured()) return { ok: false, error: AI_NOT_CONFIGURED };
  const r = await generateTitles(prisma, { accountId: t.account.id, publicationId });
  if (!r.ok) return { ok: false, error: r.error };
  return done(accountSlug);
}

export async function setMainSearchesAction(accountSlug: string, publicationId: string, searches: string[]): Promise<Result> {
  await requireUser();
  if (!(await target(accountSlug, publicationId))) return NOT_FOUND;
  return guard(async () => {
    await prisma.$transaction((tx) => setMainSearches(tx, publicationId, Array.isArray(searches) ? searches.map(String) : []));
    return done(accountSlug);
  });
}

/** Guarda a mano la página y la posición. Sin página: no aparece en las primeras 3. */
export async function savePositionAction(
  accountSlug: string,
  publicationId: string,
  query: string,
  page: number | null,
  position: number | null,
): Promise<Result> {
  await requireUser();
  if (!(await target(accountSlug, publicationId))) return NOT_FOUND;
  return guard(async () => {
    await savePosition(prisma, { publicationId, query: String(query), page, position, source: 'MANUAL' });
    return done(accountSlug);
  });
}

export async function readPositionAction(accountSlug: string, publicationId: string, query: string): Promise<Result> {
  await requireUser();
  const t = await target(accountSlug, publicationId);
  if (!t) return NOT_FOUND;
  if (!t.pub.externalId) return { ok: false, error: 'La publicación no tiene código del canal.' };
  const r = await readPosition(prisma, {
    channel: t.channel,
    storeId: t.storeId,
    publicationId,
    externalId: t.pub.externalId,
    query: String(query),
  });
  if (!r.ok) return { ok: false, error: `${r.error} Podés cargarla a mano.` };
  return done(accountSlug, r.page ? `Página ${r.page}, posición ${r.position}.` : 'No aparece en las primeras 3 páginas.');
}

export async function decideLockAction(accountSlug: string, publicationId: string, decision: TitleLockDecision | null): Promise<Result> {
  const user = await requireUser();
  if (!(await target(accountSlug, publicationId))) return NOT_FOUND;
  const value = decision === 'KEEP' || decision === 'TRY_IN_COPY' ? decision : null;
  return guard(async () => {
    await prisma.$transaction((tx) => decideLock(tx, { publicationId, decision: value, userId: user.id }));
    return done(accountSlug);
  });
}

/** Aprueba el título y pasa a Imágenes. */
export async function approveTitleAction(
  accountSlug: string,
  publicationId: string,
  title: string,
  aiTitle: string | null,
): Promise<Result> {
  const user = await requireUser();
  const t = await target(accountSlug, publicationId);
  if (!t) return NOT_FOUND;
  const ctx = await loadTitleContext(prisma, t.account.id, publicationId);
  if (!ctx) return NOT_FOUND;
  return guard(async () => {
    const r = await prisma.$transaction((tx) =>
      approveTitle(tx, {
        publicationId,
        title: String(title ?? ''),
        aiTitle: aiTitle ? String(aiTitle) : null,
        locked: ctx.titleLock.locked,
        rules: ctx.rules,
        userId: user.id,
      }),
    );
    return done(accountSlug, r.outcome === 'COPY' ? 'Título guardado para la copia con cuotas.' : 'Título aprobado.');
  });
}
