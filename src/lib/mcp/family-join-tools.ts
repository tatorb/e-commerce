import { z } from 'zod';
import { FamilyError, joinMeasures } from '@/lib/families';
import { titleOrUntitled } from '@/domain/publication-title';
import { McpToolError, accountArg, defineTool, findPublication, resolveAccount } from './tool';

// Juntar en una familia de la app medidas que en el canal ya son de la misma
// familia, como la pantalla Familias de Importar.

const joinTool = defineTool({
  name: 'join_family_measures',
  section: 'importar',
  title: 'Juntar medidas en una familia',
  description:
    'Como la pantalla Familias de Importar: junta en una familia de la app publicaciones del mismo producto y de la misma tienda que en el canal ya son medidas de la misma familia (por ejemplo la -0,30 y la -0,60). Si una ya está en una familia de la app, suma las otras a esa. Lo de la familia queda igual en todas, tomado de la principal: el título, la descripción, los datos de catálogo, las preguntas frecuentes y las reglas del bot (si eran distintas, se juntan) y el paso del pipeline; cada una conserva su precio si era distinto. Cada una tiene que saber qué medida vende: si no se sabe por el SKU, pasala en medidas, con el nombre de la medida de la ficha. Con solo_mostrar (así viene) dice qué haría y qué lo frena; se aplica cuando la persona confirma. No cambia nada en el canal.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(2).max(30).describe('Las medidas a juntar: su código del canal, link o id.'),
    medidas: z
      .array(z.object({ publicacion: z.string().min(1), medida: z.string().min(1).describe('La medida de la ficha, por ejemplo "-0,30" o "STD".') }))
      .optional()
      .describe('La medida que vende cada publicación, para las que no se sabe por el SKU.'),
    solo_mostrar: z.boolean().default(true),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const ids: string[] = [];
    for (const ref of args.publicaciones) ids.push(await findPublication(ctx.db, account.id, ref));
    const measures: Record<string, string> = {};
    const keyOf = (label: string, options: { key: string; label: string }[]) => {
      const norm = (s: string) => s.replace(/\s+/g, '').replace(',', '.').toLowerCase();
      return options.find((o) => norm(o.label) === norm(label) || norm(o.key) === norm(label))?.key ?? label;
    };
    // Primero sin aplicar: para conocer las medidas de la ficha.
    let plan = await joinMeasures(ctx.db, { accountId: account.id, publicationIds: ids, apply: false, userId: ctx.userId });
    for (const m of args.medidas ?? []) measures[await findPublication(ctx.db, account.id, m.publicacion)] = keyOf(m.medida, plan.measures);
    try {
      plan = await joinMeasures(ctx.db, { accountId: account.id, publicationIds: ids, measures, apply: !args.solo_mostrar, userId: ctx.userId });
    } catch (e) {
      if (e instanceof FamilyError) throw new McpToolError(e.message);
      throw e;
    }
    const blocking = plan.problems.filter((p) => !p.startsWith('Todavía no se leyó'));
    const applied = 'familyId' in plan && plan.familyId;
    if (applied) ctx.touched = { ...ctx.touched, publicationId: ids[0] };
    return {
      producto: plan.productName,
      familia_en_el_canal: plan.channelFamilyId ?? 'sin leer',
      medidas: plan.members.map((m) => ({ publicacion: m.externalId ?? m.id, titulo: titleOrUntitled(m.title), medida: m.measure ?? 'sin elegir', ya_en_una_familia: m.family !== null })),
      medidas_de_la_ficha: plan.measures.map((m) => m.label),
      ...(plan.problems.length > 0 ? { avisos: plan.problems } : {}),
      resultado: applied
        ? `Juntadas en la familia: se sumaron ${'joined' in plan ? plan.joined : 0}.`
        : blocking.length > 0
          ? 'No se puede juntar todavía: mirá avisos.'
          : args.solo_mostrar
            ? 'Se pueden juntar. Mostrale a la persona las medidas y, si confirma, llamá con solo_mostrar false.'
            : 'No se juntaron.',
    };
  },
});

export const FAMILY_JOIN_TOOLS = [joinTool];
