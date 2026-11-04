'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { plural } from '@/lib/format';
import { addOption, OptionError, removeOption, renameOption } from '@/lib/product-options';
import type { OptionKind } from '@/domain/product-options';

// Agregar, renombrar y borrar tipos de producto y marcas de la cuenta.

type Result = { ok: true; message: string } | { ok: false; error: string };

const kindOf = (k: unknown): OptionKind | null => (k === 'TYPE' || k === 'BRAND' ? k : null);
const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 300) : '');

/** Lo hace y devuelve el aviso, o el motivo si no se pudo. */
async function attempt(accountSlug: string, work: () => Promise<string>): Promise<Result> {
  try {
    const message = await work();
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof OptionError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function addOptionAction(accountSlug: string, kind: unknown, name: unknown): Promise<Result> {
  const k = kindOf(kind);
  if (!k) return { ok: false, error: 'No se entendió qué lista.' };
  return act(accountSlug, { section: 'productos', does: k === 'TYPE' ? 'Agregó un tipo de producto' : 'Agregó una marca' }, ({ account }) =>
    attempt(accountSlug, async () => `Se agregó «${await addOption(prisma, account.id, k, text(name))}».`),
  );
}

export async function renameOptionAction(accountSlug: string, kind: unknown, from: unknown, to: unknown): Promise<Result> {
  const k = kindOf(kind);
  if (!k) return { ok: false, error: 'No se entendió qué lista.' };
  return act(accountSlug, { section: 'productos', does: k === 'TYPE' ? 'Renombró un tipo de producto' : 'Renombró una marca' }, ({ account }) =>
    attempt(accountSlug, async () => {
      const n = await renameOption(prisma, account.id, k, text(from), text(to));
      return n > 0 ? `Listo. Cambió en ${plural(n, 'producto', 'productos')}.` : 'Listo.';
    }),
  );
}

export async function removeOptionAction(accountSlug: string, kind: unknown, name: unknown): Promise<Result> {
  const k = kindOf(kind);
  if (!k) return { ok: false, error: 'No se entendió qué lista.' };
  return act(accountSlug, { section: 'productos', does: k === 'TYPE' ? 'Borró un tipo de producto' : 'Borró una marca' }, ({ account }) =>
    attempt(accountSlug, async () => {
      const n = await removeOption(prisma, account.id, k, text(name));
      return n > 0 ? `Se borró. ${plural(n, 'producto quedó', 'productos quedaron')} sin ${k === 'TYPE' ? 'tipo' : 'marca'}.` : 'Se borró.';
    }),
  );
}
