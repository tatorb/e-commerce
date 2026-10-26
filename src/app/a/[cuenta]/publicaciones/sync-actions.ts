'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { VideoError } from '@/lib/videos';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { ConnectError } from '@/channels/connect';
import { FACE_FIELDS } from '@/domain/channel-sync';
import { DraftError, pushDrafts, PushError, saveDraft, type PushResult } from '@/lib/channel-push';
import { discardDrafts, readOne, SyncError } from '@/lib/channel-sync';
import { photoRefSchema } from '@/domain/media';
import { MediaError, saveMedia } from '@/lib/media';
import { CreateError, createInChannel } from '@/lib/channel-create';
import { changeStatus, relistInChannel, StatusError, type StatusResult } from '@/lib/channel-status';
import { MAX_QUANTITY } from '@/domain/quantities';
import { saveQuantities, type QuantitiesResult } from '@/lib/quantities';
import { setFollowsStock, syncStock } from '@/lib/stock';
import { StockError } from '@/domain/stock';
import { plannedText } from '@/lib/stock-plan';
import { settleReactivations } from '@/lib/restock';

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
  return act(accountSlug, { section: ['publicaciones', 'pipeline'], does: (field === 'title' ? 'Cambió el título' : 'Cambió la descripción'), publicationId, detail: (field === 'title' ? value : null) }, async () => {
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
  });
}

const quantityValue = z.coerce.number().int('La cantidad tiene que ser un número entero.').min(0, 'La cantidad no puede ser negativa.').max(MAX_QUANTITY);
const quantityChangeSchema = z.union([
  z.object({ all: quantityValue }),
  z.object({ byKey: z.record(z.string().max(300), quantityValue) }),
]);

/** Cambia las cantidades de una o varias publicaciones: quedan como borrador, para subir. */
export async function saveQuantitiesAction(accountSlug: string, publicationIds: string[], change: unknown): Promise<Result<QuantitiesResult>> {
  return act(accountSlug, { section: ['publicaciones', 'pipeline'], does: 'Cambió la cantidad disponible', publicationId: (Array.isArray(publicationIds) && publicationIds.length === 1 ? publicationIds[0] : null), detail: (Array.isArray(publicationIds) && publicationIds.length > 1 ? `${publicationIds.length} publicaciones` : null) }, async () => {
    await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const ids = z.array(idSchema).min(1).max(500).safeParse(publicationIds);
    const parsed = quantityChangeSchema.safeParse(change);
    if (!ids.success) return { ok: false, error: 'Elegí al menos una publicación.' };
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá la cantidad.' };
    try {
      const result = await saveQuantities(prisma, { accountId: account.id, publicationIds: ids.data, change: parsed.data });
      for (const id of result.saved) revalidatePath(`/a/${accountSlug}/publicaciones/${id}`);
      revalidatePath(`/a/${accountSlug}/publicaciones`);
      revalidatePath(`/a/${accountSlug}/pipeline`, 'layout');
      return { ok: true, ...result };
    } catch (e) {
      return failure(e);
    }
  });
}

/** Sube al canal el borrador de esos datos, o de todos. */
export async function pushDraftsAction(accountSlug: string, publicationId: string, fields?: string[]): Promise<Result<PushResult>> {
  return act(accountSlug, { section: 'subir', does: 'Subió cambios al canal', publicationId }, async () => {
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
  });
}

/** Descarta el borrador: la app vuelve a tener lo que está en el canal. */
export async function discardDraftsAction(accountSlug: string, publicationId: string, fields?: string[]): Promise<Result<{ fields: string[] }>> {
  return act(accountSlug, { section: ['publicaciones', 'pipeline'], does: 'Descartó cambios del borrador', publicationId }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const parsed = z.object({ id: idSchema, fields: fieldsSchema }).safeParse({ id: publicationId, fields });
    if (!parsed.success) return { ok: false, error: 'Elegí qué descartar.' };
    const done = await discardDrafts(prisma, { accountId: account.id, publicationId: parsed.data.id, fields: parsed.data.fields, userId: user.id });
    refresh(accountSlug, parsed.data.id);
    return { ok: true, fields: done };
  });
}

/** Vuelve a leer la publicación del canal, ahora. */
export async function readOneAction(accountSlug: string, publicationId: string): Promise<Result<{ found: boolean }>> {
  return act(accountSlug, { section: ['publicaciones', 'pipeline'], level: 'read' }, async () => {
    await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const id = idSchema.safeParse(publicationId);
    if (!id.success) return { ok: false, error: 'La publicación no existe.' };
    try {
      const taken = await readOne(prisma, { accountId: account.id, publicationId: id.data });
      // Si sigue al stock del producto y en el canal tiene otra cantidad, se sube
      // ahora, como lo haría la tarea de cada hora: no es un cambio de la persona.
      if (taken !== null) await syncStock(prisma, { publicationIds: [id.data], note: 'Al leerla del canal.' });
      // Si ya está activa, su tarea de reactivar no hace falta.
      await settleReactivations(prisma, { publicationIds: [id.data] });
      refresh(accountSlug, id.data);
      return { ok: true, found: taken !== null };
    } catch (e) {
      return failure(e);
    }
  });
}

/**
 * Guarda lo elegido en Organización de multimedia: las fotos, con sus medidas
 * y su orden en cada una, las medidas de cada video y los clips, en orden.
 * refs null vuelve a las del canal; lo que no se manda queda como está.
 */
export async function saveMediaAction(
  accountSlug: string,
  publicationId: string,
  input: { refs?: unknown; videos?: unknown; clips?: unknown },
): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'publicaciones'], does: 'Ordenó las fotos y los videos', publicationId }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const parsed = z
      .object({
        id: idSchema,
        refs: z.array(photoRefSchema).max(1200).nullable().optional(),
        videos: z.record(z.string().max(40), z.array(z.string().min(1).max(200)).max(100)).optional(),
        clips: z.array(z.string().min(1).max(40)).max(200).optional(),
      })
      .safeParse({ id: publicationId, refs: input?.refs, videos: input?.videos, clips: input?.clips });
    if (!parsed.success) return { ok: false, error: 'Las fotos que llegaron no tienen la forma esperada.' };
    try {
      await saveMedia(prisma, { accountId: account.id, publicationId: parsed.data.id, ...parsed.data, userId: user.id });
    } catch (e) {
      if (e instanceof MediaError || e instanceof VideoError) return { ok: false, error: e.message };
      throw e;
    }
    refresh(accountSlug, parsed.data.id);
    revalidatePath(`/a/${accountSlug}/pipeline/${parsed.data.id}`);
    return { ok: true };
  });
}

const quantitySchema = z.coerce.number().int('La cantidad tiene que ser un número entero.').min(1, 'La cantidad tiene que ser 1 o más.').max(100_000);

const createSchema = z.object({
  price: z.coerce.number().positive('Cargá el precio.').max(1_000_000_000),
  quantity: quantitySchema.optional(),
  // Con varias medidas, la cantidad de cada una por su clave.
  quantities: z.record(z.string().min(1).max(200), quantitySchema).optional(),
  listingType: z.string().min(1).max(40),
});

/** Crea la publicación en el canal, con el precio, la cantidad de cada medida y el tipo que se eligieron. */
export async function createInChannelAction(
  accountSlug: string,
  publicationId: string,
  input: z.input<typeof createSchema>,
): Promise<Result<{ externalId: string; warnings: string[] }>> {
  return act(accountSlug, { section: 'subir', does: 'Creó la publicación en el canal', publicationId }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const id = idSchema.safeParse(publicationId);
    const parsed = createSchema.safeParse(input);
    if (!id.success) return { ok: false, error: 'La publicación no existe.' };
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
    try {
      const created = await createInChannel(prisma, { accountId: account.id, publicationId: id.data, ...parsed.data, userId: user.id });
      // Si el producto lleva stock en la app, queda con ese.
      await syncStock(prisma, { publicationIds: [id.data], userId: user.id, note: 'Al crearla, con el stock del producto.' }).catch((e) =>
        console.error('No se pudo subir el stock', e instanceof Error ? e.message : e),
      );
      refresh(accountSlug, id.data);
      revalidatePath(`/a/${accountSlug}/pipeline/${id.data}`);
      return { ok: true, externalId: created.externalId, warnings: created.warnings };
    } catch (e) {
      if (e instanceof CreateError) return { ok: false, error: e.message };
      return failure(e);
    }
  });
}

const statusActionSchema = z.enum(['pause', 'activate', 'close', 'delete']);

/** Pausa, reactiva, finaliza o elimina esas publicaciones en el canal. Devuelve cuáles se pudieron y cuáles no, con el motivo. */
export async function changeStatusAction(
  accountSlug: string,
  publicationIds: string[],
  action: z.input<typeof statusActionSchema>,
): Promise<Result<StatusResult>> {
  return act(accountSlug, { section: 'subir', does: 'Cambió el estado en el canal', publicationId: (Array.isArray(publicationIds) && publicationIds.length === 1 ? publicationIds[0] : null), detail: (Array.isArray(publicationIds) && publicationIds.length > 1 ? `${publicationIds.length} publicaciones` : null) }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const ids = z.array(idSchema).min(1).max(200).safeParse(publicationIds);
    const parsed = statusActionSchema.safeParse(action);
    if (!ids.success || !parsed.success) return { ok: false, error: 'El pedido no tiene la forma esperada.' };
    try {
      const result = await changeStatus(prisma, { accountId: account.id, publicationIds: ids.data, action: parsed.data, userId: user.id });
      for (const p of result.done) refresh(accountSlug, p.id);
      return { ok: true, ...result };
    } catch (e) {
      return failure(e);
    }
  });
}

const relistSchema = z.object({
  price: z.coerce.number().positive('Cargá el precio.').max(1_000_000_000),
  quantity: quantitySchema.optional(),
  quantities: z.record(z.string().min(1).max(200), quantitySchema).optional(),
  listingType: z.string().min(1, 'Elegí el tipo de publicación.').max(40),
});

/** Republica una finalizada con ese precio, la cantidad de cada medida y el tipo de publicación. */
export async function relistAction(
  accountSlug: string,
  publicationId: string,
  input: z.input<typeof relistSchema>,
): Promise<Result<{ externalId: string; warnings: string[] }>> {
  return act(accountSlug, { section: 'subir', does: 'Republicó la publicación', publicationId }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const id = idSchema.safeParse(publicationId);
    const parsed = relistSchema.safeParse(input);
    if (!id.success) return { ok: false, error: 'La publicación no existe.' };
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
    try {
      const r = await relistInChannel(prisma, { accountId: account.id, publicationId: id.data, ...parsed.data, userId: user.id });
      refresh(accountSlug, id.data);
      revalidatePath(`/a/${accountSlug}/pipeline/${id.data}`);
      return { ok: true, ...r };
    } catch (e) {
      if (e instanceof StatusError) return { ok: false, error: e.message };
      return failure(e);
    }
  });
}

/**
 * Prende o apaga la cantidad automática: si la cantidad en el canal se
 * actualiza sola con el stock del producto. Al prenderla, se sube enseguida.
 */
export async function setFollowsStockAction(accountSlug: string, publicationId: string, on: boolean): Promise<Result<{ message: string }>> {
  const does = on ? 'Prendió la cantidad automática' : 'Apagó la cantidad automática';
  return act(accountSlug, { section: ['publicaciones', 'pipeline'], does, publicationId }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const id = idSchema.safeParse(publicationId);
    if (!id.success) return { ok: false, error: 'La publicación no existe.' };
    try {
      const r = await setFollowsStock(prisma, { accountId: account.id, publicationId: id.data, on: Boolean(on), userId: user.id });
      refresh(accountSlug, id.data);
      if (!on) return { ok: true, message: 'Apagada: la cantidad se cambia a mano en la publicación.' };
      if (r.sync.failed.length > 0) return { ok: false, error: `Quedó prendida, pero no se pudo subir: ${r.sync.failed[0].error}` };
      if (!r.plan.managed) return { ok: true, message: `Prendida. Todavía no sigue al stock: ${r.plan.reason}` };
      return { ok: true, message: r.sync.sent > 0 ? `Prendida. Se subió ${plannedText(r.plan)}.` : `Prendida. Ya tenía ${plannedText(r.plan)}.` };
    } catch (e) {
      if (e instanceof StockError) return { ok: false, error: e.message };
      return failure(e);
    }
  });
}
