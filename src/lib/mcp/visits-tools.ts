import { z } from 'zod';
import { readAllVisits } from '@/lib/visits';
import { accountArg, defineTool, findPublication, resolveAccount } from './tool';

// Leer las visitas por día ahora, como el botón Leer visitas ahora de Rendimiento.

const ROUND_MS = 20_000;

const readVisitsTool = defineTool({
  name: 'read_visits',
  section: 'publicaciones',
  title: 'Leer las visitas por día ahora',
  description:
    'Pide al canal las visitas por día de las publicaciones que todavía no las tienen leídas hoy, sin esperar a la lectura de cada hora. Sin publicaciones, lee una vuelta de toda la cuenta y dice cuántas faltan: llamala de nuevo hasta que falten 0. Con publicaciones (ids de la app o códigos del canal), solo esas, aunque ya se hayan leído hoy. Si el canal rechaza alguna, devuelve lo que respondió.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(50).optional().describe('Las publicaciones: su id en la app o su código en el canal. Sin la lista, las de toda la cuenta.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const ids = args.publicaciones ? await Promise.all(args.publicaciones.map((ref) => findPublication(ctx.db, account.id, ref))) : undefined;
    const r = await readAllVisits(ctx.db, { budgetMs: ROUND_MS, accountId: account.id, publicationIds: ids, force: ids !== undefined });
    return {
      leidas: r.read,
      ...(ids ? {} : { faltan: r.left }),
      ...(r.failed.length > 0 ? { rechazadas: r.failed.slice(0, 20).map((f) => ({ publicacion: f.externalId || null, motivo: f.message })) } : {}),
    };
  },
});

export const VISITS_TOOLS = [readVisitsTool];
