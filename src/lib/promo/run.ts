import type { PrismaClient } from '@/generated/prisma/client';
import { applyDue } from './apply';
import { classifyAccount } from './classify';
import { measureDue } from './measure';
import { evaluateProduct, generatePlan } from './plan';
import { loadProductPromo } from './product';
import { loadPromoSettings } from './settings';
import { sweepInvitations } from './sweep';

// La pasada automática de promociones, con la lectura de cada hora: lee las
// invitaciones del canal, reclasifica y rearma el almanaque cuando toca, y,
// si la cuenta lo tiene prendido, prende y apaga las ofertas del día y mide
// las que cumplieron su plazo. Cada parte usa su tiempo y sigue en la vuelta
// siguiente. Solo corre en las cuentas que ya usan Promociones.

type Db = PrismaClient;

const DAY = 86_400_000;
const HOUR = 3_600_000;
// Las invitaciones se releen enteras cada tantas horas.
const SWEEP_EVERY_MS = 6 * HOUR;

export type PromotionsPass = { pending: boolean; accounts: number; swept: number; planned: number; applied: number; failed: number; measured: number };

export async function promotionsPass(db: Db, args: { budgetMs: number; now?: Date }): Promise<PromotionsPass> {
  const now = args.now ?? new Date();
  const started = Date.now();
  const left = () => Math.max(0, args.budgetMs - (Date.now() - started));
  const out: PromotionsPass = { pending: false, accounts: 0, swept: 0, planned: 0, applied: 0, failed: 0, measured: 0 };
  const accounts = await db.promotionSettings.findMany({ select: { accountId: true, sweep: true, sweptAt: true } });
  for (const a of accounts) {
    if (left() <= 0) {
      out.pending = true;
      break;
    }
    out.accounts++;
    const settings = await loadPromoSettings(db, a.accountId);
    // 1. Las invitaciones del canal: una lectura a medias sigue; una completa se repite cada tantas horas.
    const midway = !!a.sweep && typeof a.sweep === 'object' && !Array.isArray(a.sweep) && 'promotions' in a.sweep;
    if (midway || !a.sweptAt || now.getTime() - a.sweptAt.getTime() > SWEEP_EVERY_MS) {
      // Una lectura a medias usa todo el tiempo: el canal vence el "seguir desde acá" a los pocos minutos.
      const r = await sweepInvitations(db, { accountId: a.accountId, budgetMs: midway ? left() : Math.min(left(), args.budgetMs / 2), now: () => now }).catch((e) => {
        console.error('Promociones: no se pudieron leer las invitaciones.', e instanceof Error ? e.message : e);
        return null;
      });
      if (r) {
        out.swept += r.items;
        // Con un error del canal no se insiste en la misma vuelta.
        if (r.pending && !r.error) out.pending = true;
      }
    }
    // 2. Reclasificar y rearmar el almanaque, cada tantos días: de a los productos que entran en el tiempo.
    const every = settings.rules.timing.reclassifyDays * DAY;
    if (left() > 0 && (!settings.classifiedAt || now.getTime() - settings.classifiedAt.getTime() > every)) {
      await classifyAccount(db, { accountId: a.accountId, apply: true, now }).catch((e) => console.error('Promociones: no se pudo reclasificar.', e instanceof Error ? e.message : e));
    }
    const stale = await db.productPromotion.findMany({
      where: { mode: 'AUTO', lifecycle: { not: null }, product: { accountId: a.accountId }, OR: [{ plannedAt: null }, { plannedAt: { lt: new Date(now.getTime() - every) } }] },
      orderBy: { plannedAt: { sort: 'asc', nulls: 'first' } },
      select: { productId: true },
      take: 200,
    });
    for (const p of stale) {
      if (left() <= 0) {
        out.pending = true;
        break;
      }
      await generatePlan(db, { accountId: a.accountId, productId: p.productId, now }).catch((e) => console.error('Promociones: no se pudo armar el almanaque.', e instanceof Error ? e.message : e));
      out.planned++;
    }
    // Las reservas que esperan la invitación del canal: se miran con las invitaciones recién leídas.
    const reserved = await db.promotionSlot.findMany({ where: { accountId: a.accountId, kind: 'CAMPAIGN', group: null, eventId: { not: null }, cancelled: false, finish: { gt: now } }, distinct: ['productId'], select: { productId: true }, take: 50 });
    for (const r of reserved) {
      if (left() <= 0) break;
      const promo = await loadProductPromo(db, a.accountId, r.productId);
      if (promo) await evaluateProduct(db, { promo, settings, now }).catch((e) => console.error('Promociones: no se pudo mirar una reserva.', e instanceof Error ? e.message : e));
    }
    // 3. Prender y apagar lo que toca, en Manual y en Automático, salvo con el freno de emergencia puesto.
    if (!settings.paused && left() > 0) {
      const r = await applyDue(db, { accountId: a.accountId, auto: true, userId: null, budgetMs: left(), now });
      out.applied += r.done.filter((d) => d.ok).length;
      out.failed += r.done.filter((d) => !d.ok).length;
      if (r.pending > 0) out.pending = true;
    }
    // 4. Medir las que cumplieron su plazo.
    if (left() > 0) {
      const m = await measureDue(db, { accountId: a.accountId, budgetMs: left(), now });
      out.measured += m.measured.length;
      if (m.pending) out.pending = true;
    }
  }
  return out;
}
