import type { PrismaClient } from '@/generated/prisma/client';

// Lo que la app sabe de quien pregunta: su perfil público en el canal, cuántas
// preguntas hizo en la tienda y si ya compró. Sirve para la pantalla
// Preguntas y para Claude.

type Db = PrismaClient;

export type BuyerFacts = {
  buyerId: string;
  nickname: string | null;
  city: string | null;
  state: string | null;
  registeredAt: Date | null;
  profileUrl: string | null;
  // Todavía no se leyó su perfil del canal.
  unread: boolean;
  questions: number;
  answered: number;
  purchases: number;
  lastPurchase: { id: string; orderedAt: Date } | null;
};

export const buyerKey = (storeId: string, buyerId: string) => `${storeId}:${buyerId}`;

// Hasta cuántas ventas mira por comprador, para contar y encontrar la última.
const SALES_MAX = 2000;

/** Lo que se sabe de cada comprador, por tienda y código. */
export async function loadBuyerFacts(db: Db, pairs: { storeId: string; buyerId: string | null }[]): Promise<Map<string, BuyerFacts>> {
  const byStore = new Map<string, Set<string>>();
  for (const p of pairs) {
    if (!p.buyerId) continue;
    const set = byStore.get(p.storeId) ?? new Set<string>();
    set.add(p.buyerId);
    byStore.set(p.storeId, set);
  }
  const out = new Map<string, BuyerFacts>();
  if (byStore.size === 0) return out;
  const where = [...byStore].map(([storeId, ids]) => ({ storeId, buyerId: { in: [...ids] } }));
  const [profiles, questions, sales] = await Promise.all([
    db.channelBuyer.findMany({ where: { OR: where } }),
    db.buyerQuestion.groupBy({ by: ['storeId', 'buyerId', 'status'], where: { OR: where }, _count: { _all: true } }),
    db.sale.findMany({
      where: { OR: where, state: { not: 'CANCELLED' } },
      orderBy: { orderedAt: 'desc' },
      take: SALES_MAX,
      select: { id: true, storeId: true, buyerId: true, orderedAt: true, buyerNickname: true },
    }),
  ]);
  for (const [storeId, ids] of byStore) {
    for (const buyerId of ids) {
      out.set(buyerKey(storeId, buyerId), {
        buyerId,
        nickname: null,
        city: null,
        state: null,
        registeredAt: null,
        profileUrl: null,
        unread: true,
        questions: 0,
        answered: 0,
        purchases: 0,
        lastPurchase: null,
      });
    }
  }
  for (const p of profiles) {
    const f = out.get(buyerKey(p.storeId, p.buyerId));
    if (!f) continue;
    // Si falló la última vez, igual sirve lo que se había leído antes.
    Object.assign(f, { nickname: p.nickname, city: p.city, state: p.state, registeredAt: p.registeredAt, profileUrl: p.profileUrl, unread: p.failedAt !== null && !p.nickname });
  }
  for (const q of questions) {
    const f = q.buyerId ? out.get(buyerKey(q.storeId, q.buyerId)) : undefined;
    if (!f) continue;
    f.questions += q._count._all;
    if (q.status === 'ANSWERED') f.answered += q._count._all;
  }
  for (const s of sales) {
    const f = s.buyerId ? out.get(buyerKey(s.storeId, s.buyerId)) : undefined;
    if (!f) continue;
    f.purchases++;
    f.lastPurchase ??= { id: s.id, orderedAt: s.orderedAt };
    // Si el canal todavía no devolvió su perfil, el nombre de usuario de la venta.
    f.nickname ??= s.buyerNickname;
  }
  return out;
}

/** "Córdoba, Córdoba" o lo que haya. */
export function placeText(f: Pick<BuyerFacts, 'city' | 'state'>): string | null {
  const parts = [f.city, f.state].filter((s): s is string => !!s);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) return parts[0];
  return parts.join(', ') || null;
}

/** Lo que ve Claude de quien preguntó. */
export function buyerForClaude(b: BuyerFacts | undefined) {
  if (!b) return {};
  const place = placeText(b);
  return {
    comprador: {
      usuario: b.nickname,
      ...(place ? { de: place } : {}),
      ...(b.registeredAt ? { cuenta_desde: b.registeredAt.toISOString().slice(0, 10) } : {}),
      preguntas_en_la_tienda: b.questions,
      compras: b.purchases,
      ...(b.lastPurchase ? { ultima_compra: b.lastPurchase.orderedAt.toISOString().slice(0, 10) } : {}),
    },
  };
}
