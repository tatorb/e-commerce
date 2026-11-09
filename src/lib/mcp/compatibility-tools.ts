import { z } from 'zod';
import { auditAccountCompatibilities } from '@/lib/compatibilities';
import { accountArg, defineTool, findPublication, McpToolError, resolveAccount } from './tool';

// Las compatibilidades con vehículos, para Claude: auditar contra la ficha sin subir nada.

// Lo que entra en un pedido: el resto vuelve en quedan.
const AUDIT_BUDGET_MS = 40_000;

const auditTool = defineTool({
  name: 'audit_compatibilities',
  section: 'publicaciones',
  title: 'Auditar las compatibilidades con vehículos',
  description:
    'Compara las compatibilidades con vehículos que cada publicación tiene cargadas en el canal con las que salen de la ficha, que es la única fuente de verdad. Traduce cada línea de la ficha a vehículos del catálogo del canal como los filtros de su pantalla: marca, modelo, años (los de la ficha; sin años, todos), combustible (siempre), cilindrada, potencia y las versiones que no van. Lo que no se puede traducir con seguridad queda a revisar, con el motivo. Por publicación dice cuántos vehículos cargados salen de la ficha, qué falta (grupos de vehículos por año), qué sobra con el motivo (los cargados por la tienda se pueden borrar desde la app; los que cargó el canal solo muestran la marca y se borran a mano en el canal), qué queda a revisar, si el canal avisa que faltan y si tiene sugerencias pendientes. Las fichas sin compatibilidades van aparte: no se pueden corregir sin datos. En publicaciones pasá ids o códigos del canal, hasta 100: se suman las otras medidas de su familia y las otras opciones de venta de cada medida. Sin la lista, todas las publicaciones vivas de la cuenta. Si son muchas, devuelve en quedan las que faltan: volvé a llamar con esa lista. No sube nada al canal: guarda en la app lo leído y el resultado.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z
      .array(z.string().min(1))
      .min(1)
      .max(100)
      .optional()
      .describe('Las publicaciones: su id en la app o su código en el canal, hasta 100. Sin la lista, todas las vivas de la cuenta.'),
    mostrar_respuesta_del_canal: z
      .boolean()
      .default(false)
      .describe('Suma lo que respondió el canal y las listas del catálogo que se recorrieron, para revisar cómo responde.'),
  }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const ids: string[] = [];
    const notFound: { publicacion: string; motivo: string }[] = [];
    for (const ref of args.publicaciones ?? []) {
      try {
        ids.push(await findPublication(ctx.db, account.id, ref));
      } catch (e) {
        if (!(e instanceof McpToolError)) throw e;
        notFound.push({ publicacion: ref, motivo: e.message });
      }
    }
    if (args.publicaciones && ids.length === 0) throw new McpToolError(notFound[0]?.motivo ?? 'No se encontró ninguna publicación.');
    const r = await auditAccountCompatibilities(ctx.db, {
      accountId: account.id,
      publicationIds: args.publicaciones ? ids : undefined,
      raw: args.mostrar_respuesta_del_canal,
      budgetMs: AUDIT_BUDGET_MS,
    });
    const salteadas = [...notFound, ...r.salteadas];
    return {
      modo: 'solo mostrar: no se subió nada al canal',
      publicaciones: r.publicaciones,
      fichas: r.fichas,
      ...(r.fichas_sin_compatibilidades.length > 0 ? { fichas_sin_compatibilidades: r.fichas_sin_compatibilidades } : {}),
      ...(salteadas.length > 0 ? { salteadas } : {}),
      ...(r.quedan.length > 0
        ? {
            quedan: r.quedan,
            aviso: r.busy
              ? 'El canal pidió esperar porque hubo demasiados pedidos: volvé a llamar en unos minutos con la lista de quedan.'
              : 'No entraron todas en esta vuelta: volvé a llamar con la lista de quedan.',
          }
        : {}),
      ...(r.catalogo ? { catalogo: r.catalogo } : {}),
      ...(r.publicaciones.length === 0 && salteadas.length === 0 && r.quedan.length === 0 ? { aviso: 'No hay publicaciones publicadas para auditar.' } : {}),
    };
  },
});

export const COMPATIBILITY_TOOLS = [auditTool];
