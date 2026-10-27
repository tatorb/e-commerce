import type { PrismaClient } from '@/generated/prisma/client';
import { readOne } from '@/lib/channel-sync';
import { FamilyError, joinFamily, planFamilies, splitFamily } from '@/lib/families';

// Aplicar la pantalla Familias en una tienda: juntar las medidas de cada
// familia del canal y separar las que creó la app. Cada familia va en su
// propia transacción: si una no se puede, las demás siguen. Después lee del
// canal las publicaciones nuevas, para que tengan su cara del canal.

// Cuántas publicaciones nuevas se leen enseguida; las demás, en la pasada de cada hora.
const READ_NOW = 20;

export type ApplyFamiliesResult = {
  // Familias armadas o completadas, y publicaciones que quedaron en ellas.
  families: number;
  joined: number;
  // Familias que creó la app que se separaron, y publicaciones nuevas.
  split: number;
  created: number;
  // Las que no se pudieron, con el motivo.
  skipped: { code: string | null; reason: string }[];
};

export async function applyFamilies(
  db: PrismaClient,
  args: { accountId: string; storeId: string; userId: string | null; now?: () => Date },
): Promise<ApplyFamiliesResult> {
  const clock = args.now ?? (() => new Date());
  const plan = (await planFamilies(db, args.accountId)).find((p) => p.storeId === args.storeId);
  const out: ApplyFamiliesResult = { families: 0, joined: 0, split: 0, created: 0, skipped: [] };
  if (!plan) return out;
  const toRead: string[] = [];

  for (const f of plan.families) {
    if (f.state === 'conflict' || f.state === 'done') continue;
    try {
      if (f.kind === 'split') {
        const headId = f.members.find((m) => m.lead)?.id;
        if (!headId) continue;
        const created = await db.$transaction((tx) => splitFamily(tx, { publicationId: headId, userId: args.userId, now: clock() }));
        out.split++;
        out.created += created.length;
        toRead.push(headId, ...created);
        continue;
      }
      if (f.unknownMeasures > 0) {
        out.skipped.push({ code: f.code, reason: 'Falta elegir qué medida vende alguna publicación.' });
        continue;
      }
      const ids = f.members.flatMap((m) => (m.id ? [m.id] : []));
      const r = await db.$transaction((tx) =>
        joinFamily(tx, { storeId: args.storeId, productId: f.productId!, channelFamilyId: f.key, publicationIds: ids, userId: args.userId, now: clock() }),
      );
      out.families++;
      out.joined += r.joined;
    } catch (e) {
      if (!(e instanceof FamilyError)) throw e;
      out.skipped.push({ code: f.code, reason: e.message });
    }
  }

  // Las nuevas todavía no tienen su cara del canal: se leen ahora, si se puede.
  for (const id of toRead.slice(0, READ_NOW)) {
    try {
      await readOne(db, { accountId: args.accountId, publicationId: id });
    } catch (e) {
      console.error('No se pudo leer del canal una medida separada', id, e instanceof Error ? e.message : e);
    }
  }
  return out;
}
