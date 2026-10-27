'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { publicAppUrl } from '@/lib/public-url';
import {
  addStep,
  archiveProtocol,
  createProtocol,
  moveProtocol,
  moveStep,
  removeIllustration,
  removeStep,
  setIllustration,
  ShootError,
  startIllustrationUpload,
  updateProtocol,
  updateStep,
} from '@/lib/shoot';
import { storageError } from '@/lib/stored-files';

// Armar los protocolos de Registro de productos: el protocolo, sus pasos y la
// ilustración de cada paso. Las ilustraciones las sube el navegador directo al Drive.

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard<T extends object>(accountSlug: string, run: () => Promise<T>): Promise<Result<T>> {
  try {
    const r = await run();
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ShootError) return { ok: false, error: e.message };
    const storage = storageError(e);
    if (storage) return { ok: false, error: storage };
    throw e;
  }
}

const section = 'protocolos' as const;

export async function createProtocolAction(accountSlug: string, input: { name: string; description: string }): Promise<Result<{ id: string }>> {
  return act(accountSlug, { section, does: 'Creó un protocolo de fotos', targetLabel: String(input?.name ?? '').slice(0, 120) }, ({ user, account }) =>
    guard(accountSlug, async () => ({ id: await createProtocol(prisma, { accountId: account.id, input, userId: user.id }) })),
  );
}

export async function updateProtocolAction(accountSlug: string, protocolId: string, input: { name: string; description: string }): Promise<Result> {
  return act(accountSlug, { section, does: 'Cambió un protocolo de fotos', targetLabel: String(input?.name ?? '').slice(0, 120) }, ({ account }) =>
    guard(accountSlug, async () => {
      await updateProtocol(prisma, { accountId: account.id, protocolId: String(protocolId), input });
      return {};
    }),
  );
}

export async function archiveProtocolAction(accountSlug: string, protocolId: string, archived: boolean): Promise<Result> {
  return act(accountSlug, { section, does: archived ? 'Archivó un protocolo de fotos' : 'Volvió a usar un protocolo de fotos' }, ({ account }) =>
    guard(accountSlug, async () => {
      await archiveProtocol(prisma, { accountId: account.id, protocolId: String(protocolId), archived: archived === true });
      return {};
    }),
  );
}

export async function moveProtocolAction(accountSlug: string, protocolId: string, by: number): Promise<Result> {
  return act(accountSlug, { section }, ({ account }) =>
    guard(accountSlug, async () => {
      await moveProtocol(prisma, { accountId: account.id, protocolId: String(protocolId), by: Number(by) });
      return {};
    }),
  );
}

export async function addStepAction(accountSlug: string, protocolId: string, input: { title: string; kind: string; explanation: string }): Promise<Result<{ id: string }>> {
  return act(accountSlug, { section, does: 'Agregó un paso a un protocolo de fotos', targetLabel: String(input?.title ?? '').slice(0, 120) }, ({ account }) =>
    guard(accountSlug, async () => ({ id: await addStep(prisma, { accountId: account.id, protocolId: String(protocolId), input }) })),
  );
}

export async function updateStepAction(accountSlug: string, stepId: string, input: { title: string; kind: string; explanation: string }): Promise<Result> {
  return act(accountSlug, { section, does: 'Cambió un paso de un protocolo de fotos', targetLabel: String(input?.title ?? '').slice(0, 120) }, ({ account }) =>
    guard(accountSlug, async () => {
      await updateStep(prisma, { accountId: account.id, stepId: String(stepId), input });
      return {};
    }),
  );
}

export async function removeStepAction(accountSlug: string, stepId: string): Promise<Result> {
  return act(accountSlug, { section, does: 'Sacó un paso de un protocolo de fotos' }, ({ account }) =>
    guard(accountSlug, async () => {
      await removeStep(prisma, { accountId: account.id, stepId: String(stepId) });
      return {};
    }),
  );
}

export async function moveStepAction(accountSlug: string, stepId: string, by: number): Promise<Result> {
  return act(accountSlug, { section }, ({ account }) =>
    guard(accountSlug, async () => {
      await moveStep(prisma, { accountId: account.id, stepId: String(stepId), by: Number(by) });
      return {};
    }),
  );
}

/** Abre la subida de la ilustración. La subida se abre con el origen de la página, así el navegador puede usarla. */
export async function startIllustrationUploadAction(accountSlug: string, stepId: string, file: { name: string; size: number }): Promise<Result<{ uploadUrl: string }>> {
  return act(accountSlug, { section }, async ({ account }) => {
    const origin = (await headers()).get('origin') ?? publicAppUrl();
    return guard(accountSlug, async () => ({
      uploadUrl: await startIllustrationUpload(prisma, { accountId: account.id, stepId: String(stepId), file, origin }),
    }));
  });
}

export async function setIllustrationAction(accountSlug: string, stepId: string, fileId: string): Promise<Result> {
  return act(accountSlug, { section, does: 'Puso una ilustración en un paso de un protocolo de fotos' }, ({ account }) =>
    guard(accountSlug, async () => {
      await setIllustration(prisma, { accountId: account.id, stepId: String(stepId), fileId: String(fileId) });
      return {};
    }),
  );
}

export async function removeIllustrationAction(accountSlug: string, stepId: string): Promise<Result> {
  return act(accountSlug, { section, does: 'Sacó la ilustración de un paso de un protocolo de fotos' }, ({ account }) =>
    guard(accountSlug, async () => {
      await removeIllustration(prisma, { accountId: account.id, stepId: String(stepId) });
      return {};
    }),
  );
}
