'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { readAllVisits } from '@/lib/visits';

// Rendimiento: leer las visitas por día ahora, sin esperar a la lectura de cada hora.

// Lo que dura cada vuelta: el botón pide la siguiente hasta terminar.
const ROUND_MS = 20_000;
// Cuántos motivos distintos se muestran.
const SHOWN_ERRORS = 5;

type Result = { ok: true; read: number; left: number; failed: number; errors: { externalId: string; message: string }[] } | { ok: false; error: string };

/** Lee una vuelta de visitas de la cuenta. Dice cuántas leyó, cuántas faltan y por qué fallaron las que fallaron. */
export async function readVisitsNowAction(accountSlug: string): Promise<Result> {
  return act(accountSlug, { section: 'publicaciones', level: 'read' }, async ({ account }) => {
    const r = await readAllVisits(prisma, { budgetMs: ROUND_MS, accountId: account.id });
    // Un motivo por error distinto, con la primera publicación que lo tuvo.
    const seen = new Set<string>();
    const errors = r.failed.filter((f) => !seen.has(f.message) && seen.add(f.message)).slice(0, SHOWN_ERRORS);
    if (r.read > 0) revalidatePath(`/a/${accountSlug}/rendimiento`);
    return { ok: true, read: r.read, left: r.left, failed: r.failed.length, errors };
  });
}
