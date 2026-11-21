import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { DEFAULT_THRESHOLDS, patchRules, readRules, rulesPatchSchema, thresholdsProblem, type PromoRules, type RulesPatch, type Thresholds } from '@/domain/promo/rules';

// Los ajustes de promociones de la cuenta: la rentabilidad saludable y el
// piso, si la app prende y apaga sola, y las reglas. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;

export class PromoError extends Error {}

export type PromoSettings = {
  thresholds: Thresholds;
  // El freno de emergencia: mientras está puesto, la app no prende ni apaga nada en el canal. No borra nada.
  paused: boolean;
  rules: PromoRules;
  // Cuándo terminó la última lectura completa de las invitaciones del canal, y la última reclasificación.
  sweptAt: Date | null;
  classifiedAt: Date | null;
  updatedAt: Date | null;
};

export async function loadPromoSettings(db: Db, accountId: string): Promise<PromoSettings> {
  const row = await db.promotionSettings.findUnique({ where: { accountId } });
  return {
    thresholds: row ? { healthyMarginPct: Number(row.healthyMarginPct), floorMarginPct: Number(row.floorMarginPct) } : DEFAULT_THRESHOLDS,
    paused: row?.paused ?? false,
    rules: readRules(row?.rules),
    sweptAt: row?.sweptAt ?? null,
    classifiedAt: row?.classifiedAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

/** Cambia lo que viene: la rentabilidad saludable, el piso, el freno de emergencia o parte de las reglas. */
export async function savePromoSettings(
  db: Db,
  args: { accountId: string; userId: string | null; healthyMarginPct?: number; floorMarginPct?: number; paused?: boolean; rules?: RulesPatch },
): Promise<PromoSettings> {
  const current = await loadPromoSettings(db, args.accountId);
  const thresholds: Thresholds = {
    healthyMarginPct: args.healthyMarginPct ?? current.thresholds.healthyMarginPct,
    floorMarginPct: args.floorMarginPct ?? current.thresholds.floorMarginPct,
  };
  const problem = thresholdsProblem(thresholds);
  if (problem) throw new PromoError(problem);
  let rules = current.rules;
  if (args.rules) {
    const parsed = rulesPatchSchema.safeParse(args.rules);
    if (!parsed.success) throw new PromoError(`Revisá las reglas: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    rules = patchRules(current.rules, parsed.data);
  }
  const data = {
    healthyMarginPct: thresholds.healthyMarginPct,
    floorMarginPct: thresholds.floorMarginPct,
    paused: args.paused ?? current.paused,
    rules: rules as unknown as Prisma.InputJsonValue,
    updatedById: args.userId,
  };
  await db.promotionSettings.upsert({ where: { accountId: args.accountId }, create: { accountId: args.accountId, ...data }, update: data });
  return loadPromoSettings(db, args.accountId);
}
