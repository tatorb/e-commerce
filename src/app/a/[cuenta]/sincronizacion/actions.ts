'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { FACE_FIELDS } from '@/domain/channel-sync';
import { chooseFaces, runSyncStep, startSync, syncableStores, type SyncProgress } from '@/lib/channel-sync';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Lo que lee cada pedido desde la pantalla: corto, así la pantalla muestra el avance.
const STEP_BUDGET_MS = 6_000;

function refresh(accountSlug: string) {
  revalidatePath(`/a/${accountSlug}/sincronizacion`);
  revalidatePath(`/a/${accountSlug}/publicaciones`);
}

/** Empieza una lectura de la tienda, o sigue la que está en curso. */
export async function startSyncAction(accountSlug: string, storeId: string): Promise<Result<{ runId: string }>> {
  const user = await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const store = (await syncableStores(prisma, account.id)).find((s) => s.id === String(storeId));
  if (!store) return { ok: false, error: 'La tienda no está conectada o su canal todavía no se puede leer.' };
  const run = await startSync(prisma, { storeId: store.id, trigger: 'MANUAL', userId: user.id });
  if (!run) return { ok: false, error: 'No se pudo empezar la lectura. Probá de nuevo.' };
  return { ok: true, runId: run.id };
}

/** Lee una tanda de la lectura en curso. */
export async function syncStepAction(accountSlug: string, runId: string): Promise<Result<{ progress: SyncProgress }>> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const run = await prisma.channelSync.findFirst({ where: { id: String(runId), store: { accountId: account.id } }, select: { id: true } });
  if (!run) return { ok: false, error: 'La lectura no es de esta cuenta.' };
  const progress = await runSyncStep(prisma, run.id, { budgetMs: STEP_BUDGET_MS });
  if (progress.status !== 'RUNNING') refresh(accountSlug);
  return { ok: true, progress };
}

const chooseSchema = z.object({
  publicationIds: z.array(z.string().min(1).max(40)).min(1).max(2000),
  side: z.enum(['channel', 'app']),
  field: z.enum(FACE_FIELDS).optional(),
});

/** Elige, en los datos que estaban para elegir, lo del canal o lo de la app. */
export async function chooseFacesAction(
  accountSlug: string,
  input: z.input<typeof chooseSchema>,
): Promise<Result<{ publications: number; fields: number }>> {
  const user = await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const parsed = chooseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Elegí qué publicaciones y qué lado.' };
  const done = await chooseFaces(prisma, {
    accountId: account.id,
    publicationIds: parsed.data.publicationIds,
    side: parsed.data.side,
    fields: parsed.data.field ? [parsed.data.field] : undefined,
    userId: user.id,
  });
  refresh(accountSlug);
  return { ok: true, ...done };
}
