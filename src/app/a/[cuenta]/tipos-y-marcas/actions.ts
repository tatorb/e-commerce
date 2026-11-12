'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { plural } from '@/lib/format';
import { addOption, OptionError, removeOption, renameOption } from '@/lib/product-options';
import type { OptionKind } from '@/domain/product-options';
import type { CompetitorScope } from '@/generated/prisma/enums';
import { changeScope, previewScopeChange, type ScopeChangePreview } from '@/lib/competitors';

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

// ───────────────────────────── Competencia por tipo ─────────────────────────────

const scopeOf = (v: unknown): CompetitorScope | null => (v === 'PRODUCT' || v === 'PUBLICATION' ? v : null);

/** Cuántos productos y competidores se mueven si el tipo cambia de ajuste. No cambia nada. */
export async function previewCompetitorScopeAction(
  accountSlug: string,
  type: unknown,
  to: unknown,
): Promise<{ ok: true; preview: ScopeChangePreview } | { ok: false; error: string }> {
  const scope = scopeOf(to);
  if (!scope) return { ok: false, error: 'No se entendió el ajuste.' };
  return act(accountSlug, { section: 'productos' }, async ({ account }) => ({ ok: true as const, preview: await previewScopeChange(prisma, account.id, text(type), scope) }));
}

/** Cambia dónde se guarda la competencia de los productos de un tipo, y la mueve sin perder nada. */
export async function changeCompetitorScopeAction(accountSlug: string, type: unknown, to: unknown): Promise<Result> {
  const scope = scopeOf(to);
  if (!scope) return { ok: false, error: 'No se entendió el ajuste.' };
  return act(accountSlug, { section: 'productos', does: 'Cambió dónde se guarda la competencia de un tipo de producto', targetLabel: text(type) }, async ({ account }) => {
    try {
      const done = await changeScope(prisma, account.id, text(type), scope);
      revalidatePath(`/a/${accountSlug}`, 'layout');
      const moved =
        done.competitors === 0
          ? 'No había competencia cargada para mover.'
          : scope === 'PRODUCT'
            ? `Se juntó la competencia de ${plural(done.productsWithCompetitors, 'producto', 'productos')}: ${plural(done.competitors - done.repeated, 'competidor', 'competidores')}${done.repeated > 0 ? `, y ${plural(done.repeated, 'repetido quedó', 'repetidos quedaron')} en uno` : ''}.`
            : `Se copió la competencia de ${plural(done.productsWithCompetitors, 'producto', 'productos')} a sus ${plural(done.publications, 'publicación', 'publicaciones')}.`;
      return { ok: true, message: `«${done.type}» ahora tiene la competencia ${scope === 'PRODUCT' ? 'por producto' : 'por publicación'}. ${moved}` };
    } catch (e) {
      if (e instanceof Error && e.message.includes('ya no está en la lista')) return { ok: false, error: e.message };
      throw e;
    }
  });
}
