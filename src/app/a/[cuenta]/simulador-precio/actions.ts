'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ConnectError } from '@/channels/connect';
import { act } from '@/lib/auth/guard';
import { requireUser } from '@/lib/auth/session';
import { pushDrafts, PushError } from '@/lib/channel-push';
import { prisma } from '@/lib/db';
import { getAccountBySlug } from '@/lib/queries/accounts';

// Subir al canal el precio, las cuotas, el descuento y las campañas pedidas
// que quedaron en Por subir, desde el simulador de precio o el paso Precio.

export type PushPriceResult =
  | { ok: true; results: { code: string; sent: string[]; rejected: string[]; confirmed: boolean; error: string | null }[] }
  | { ok: false; error: string };

const FIELDS = ['price', 'installments', 'discount'] as const;
const LABEL: Record<string, string> = { price: 'precio', installments: 'cuotas', discount: 'descuento' };

export async function pushPriceAction(accountSlug: string, publicationIds: string[]): Promise<PushPriceResult> {
  return act(accountSlug, { section: 'subir', does: 'Subió el precio al canal', publicationId: publicationIds[0] }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const parsed = z.array(z.string().min(1).max(64)).min(1).max(20).safeParse(publicationIds);
    if (!parsed.success) return { ok: false, error: 'Elegí qué subir.' };
    const pubs = await prisma.publication.findMany({
      where: { id: { in: parsed.data }, product: { accountId: account.id } },
      select: { id: true, externalId: true },
    });
    const results: Extract<PushPriceResult, { ok: true }>['results'] = [];
    for (const p of pubs) {
      const code = p.externalId ?? 'Sin publicar';
      if (!p.externalId) {
        results.push({ code, sent: [], rejected: [], confirmed: false, error: 'Todavía no está publicada: el precio va al crearla en el canal.' });
        continue;
      }
      try {
        const r = await pushDrafts(prisma, { accountId: account.id, publicationId: p.id, fields: [...FIELDS], campaigns: true, userId: user.id });
        results.push({
          code,
          sent: [...r.sent.map((f) => LABEL[f] ?? f), ...r.campaigns.filter((c) => c.ok).map((c) => `${c.action === 'join' ? 'sumarse a' : 'salir de'} ${c.name}`)],
          rejected: [...r.rejected.map((x) => `${LABEL[x.field] ?? x.field}: ${x.message}`), ...r.campaigns.filter((c) => !c.ok).map((c) => `${c.name}: ${c.message ?? 'no se pudo.'}`)],
          confirmed: r.confirmed,
          error: null,
        });
      } catch (e) {
        if (!(e instanceof PushError || e instanceof ConnectError)) throw e;
        results.push({ code, sent: [], rejected: [], confirmed: false, error: e.message });
      }
      revalidatePath(`/a/${accountSlug}/publicaciones/${p.id}`);
    }
    revalidatePath(`/a/${accountSlug}/simulador-precio`);
    revalidatePath(`/a/${accountSlug}/pipeline`);
    return { ok: true, results };
  });
}
