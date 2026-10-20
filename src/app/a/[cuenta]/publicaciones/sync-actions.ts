'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { ConnectError } from '@/channels/connect';
import { FACE_FIELDS } from '@/domain/channel-sync';
import { DraftError, pushDrafts, PushError, saveDraft, type PushResult } from '@/lib/channel-push';
import { discardDrafts, readOne, SyncError } from '@/lib/channel-sync';

// Lo que se hace desde la página de una publicación y desde Por subir: cambiar
// el borrador, subirlo al canal, descartarlo y volver a leer del canal.

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function refresh(accountSlug: string, publicationId: string) {
  revalidatePath(`/a/${accountSlug}/publicaciones/${publicationId}`);
  revalidatePath(`/a/${accountSlug}/publicaciones`);
  revalidatePath(`/a/${accountSlug}/pipeline`);
  revalidatePath(`/a/${accountSlug}/sincronizacion`);
}

function failure(e: unknown): { ok: false; error: string } {
  if (e instanceof PushError || e instanceof DraftError || e instanceof SyncError || e instanceof ConnectError) return { ok: false, error: e.message };
  console.error('Error al sincronizar una publicación', e instanceof Error ? e.message : e);
  return { ok: false, error: 'No se pudo hacer. Probá de nuevo.' };
}

const idSchema = z.string().min(1).max(40);
const fieldsSchema = z.array(z.enum(FACE_FIELDS)).min(1).max(FACE_FIELDS.length).optional();

/** Guarda el título o la descripción en la app, como borrador. */
export async function saveDraftAction(
  accountSlug: string,
  publicationId: string,
  field: 'title' | 'description',
  value: string,
): Promise<Result<{ warnings: string[] }>> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const parsed = z.object({ id: idSchema, field: z.enum(['title', 'description']), value: z.string().max(60000) }).safeParse({ id: publicationId, field, value });
  if (!parsed.success) return { ok: false, error: 'Revisá el texto.' };
  try {
    const { warnings } = await saveDraft(prisma, { accountId: account.id, publicationId: parsed.data.id, field: parsed.data.field, value: parsed.data.value });
    refresh(accountSlug, parsed.data.id);
    return { ok: true, warnings };
  } catch (e) {
    return failure(e);
  }
}

/** Sube al canal el borrador de esos datos, o de todos. */
export async function pushDraftsAction(accountSlug: string, publicationId: string, fields?: string[]): Promise<Result<PushResult>> {
  const user = await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const parsed = z.object({ id: idSchema, fields: fieldsSchema }).safeParse({ id: publicationId, fields });
  if (!parsed.success) return { ok: false, error: 'Elegí qué subir.' };
  try {
    const result = await pushDrafts(prisma, { accountId: account.id, publicationId: parsed.data.id, fields: parsed.data.fields, userId: user.id });
    refresh(accountSlug, parsed.data.id);
    return { ok: true, ...result };
  } catch (e) {
    refresh(accountSlug, parsed.data.id);
    return failure(e);
  }
}

/** Descarta el borrador: la app vuelve a tener lo que está en el canal. */
export async function discardDraftsAction(accountSlug: string, publicationId: string, fields?: string[]): Promise<Result<{ fields: string[] }>> {
  const user = await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const parsed = z.object({ id: idSchema, fields: fieldsSchema }).safeParse({ id: publicationId, fields });
  if (!parsed.success) return { ok: false, error: 'Elegí qué descartar.' };
  const done = await discardDrafts(prisma, { accountId: account.id, publicationId: parsed.data.id, fields: parsed.data.fields, userId: user.id });
  refresh(accountSlug, parsed.data.id);
  return { ok: true, fields: done };
}

/** Vuelve a leer la publicación del canal, ahora. */
export async function readOneAction(accountSlug: string, publicationId: string): Promise<Result<{ found: boolean }>> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const id = idSchema.safeParse(publicationId);
  if (!id.success) return { ok: false, error: 'La publicación no existe.' };
  try {
    const taken = await readOne(prisma, { accountId: account.id, publicationId: id.data });
    refresh(accountSlug, id.data);
    return { ok: true, found: taken !== null };
  } catch (e) {
    return failure(e);
  }
}
