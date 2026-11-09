import { z } from 'zod';
import { auditAccountCompatibilities } from '@/lib/compatibilities';
import { accountArg, defineTool, findPublication, McpToolError, resolveAccount } from './tool';

// Las compatibilidades con vehículos, para Claude: auditar contra la ficha sin subir nada.

// Hasta cuándo se empiezan pedidos al canal: lo que ya salió termina, y la respuesta llega antes del minuto.
const AUDIT_BUDGET_MS = 30_000;
// Sin lista, lo auditado en estas horas no se repite: cada llamada sigue donde quedó la anterior.
const SKIP_HOURS = 12;

const auditTool = defineTool({
  name: 'audit_compatibilities',
  section: 'publicaciones',
  title: 'Auditar las compatibilidades con vehículos',
  description:
    'Compara las compatibilidades con vehículos que cada publicación tiene cargadas en el canal con las que salen de la ficha, que es la única fuente de verdad. Traduce cada línea de la ficha a vehículos del catálogo del canal como los filtros de su pantalla: marca, modelo, años (los de la ficha; sin años, todos), combustible (siempre), cilindrada, potencia y las versiones que no van. Lo que no se puede traducir con seguridad queda a revisar, con el motivo. Por publicación dice cuántos vehículos cargados salen de la ficha, qué falta (grupos de vehículos por año), qué sobra con el motivo (los cargados por la tienda se pueden borrar desde la app; los que cargó el canal solo muestran la marca y se borran a mano en el canal), qué queda a revisar, si el canal avisa que faltan y si tiene sugerencias pendientes. Las fichas sin compatibilidades van aparte: no se pueden corregir sin datos. En publicaciones pasá ids o códigos del canal, hasta 100: se suman las otras medidas de su familia y las otras opciones de venta de cada medida; si no entran todas, devuelve en quedan las que faltan y hay que volver a llamar con esa lista. Sin la lista, todas las publicaciones vivas de la cuenta, o solo las de una marca del repuesto con marca (por ejemplo Persan): cada llamada saltea las auditadas en las últimas 12 horas (o las que digas en saltear_horas), así que para recorrerlas todas se vuelve a llamar igual hasta que no queden. No sube nada al canal: guarda en la app lo leído y el resultado.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z
      .array(z.string().min(1))
      .min(1)
      .max(100)
      .optional()
      .describe('Las publicaciones: su id en la app o su código en el canal, hasta 100. Sin la lista, todas las vivas de la cuenta.'),
    marca: z.string().min(1).max(80).optional().describe('Solo las publicaciones de productos con esa marca del repuesto en la ficha, por ejemplo Persan.'),
    saltear_horas: z
      .number()
      .min(0)
      .max(720)
      .default(SKIP_HOURS)
      .describe(
        'Sin lista: se saltean las publicaciones auditadas en estas últimas horas, para seguir donde quedó la llamada anterior. Para empezar otra vuelta después de corregir fichas o subir cambios, pasá menos horas que las que pasaron desde la vuelta anterior.',
      ),
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
    const listed = Boolean(args.publicaciones);
    const r = await auditAccountCompatibilities(ctx.db, {
      accountId: account.id,
      publicationIds: listed ? ids : undefined,
      brand: args.marca ?? null,
      freshSince: listed ? null : new Date(Date.now() - args.saltear_horas * 3_600_000),
      raw: args.mostrar_respuesta_del_canal,
      budgetMs: AUDIT_BUDGET_MS,
    });
    const salteadas = [...notFound, ...r.salteadas];
    const again = listed ? 'volvé a llamar con la lista de quedan' : 'volvé a llamar igual, sin lista: sigue donde quedó';
    return {
      modo: 'solo mostrar: no se subió nada al canal',
      ...(args.marca ? { marca: args.marca } : {}),
      publicaciones: r.publicaciones,
      fichas: r.fichas,
      ...(r.fichas_sin_compatibilidades.length > 0 ? { fichas_sin_compatibilidades: r.fichas_sin_compatibilidades } : {}),
      ...(salteadas.length > 0 ? { salteadas } : {}),
      ...(r.quedan.length > 0
        ? {
            ...(listed ? { quedan: r.quedan } : { quedan_cantidad: r.quedan.length }),
            aviso: r.busy ? `El canal pidió esperar porque hubo demasiados pedidos: en unos minutos ${again}.` : `No entraron todas en esta llamada: ${again}.`,
          }
        : {}),
      ...(r.catalogo ? { catalogo: r.catalogo } : {}),
      ...(r.publicaciones.length === 0 && salteadas.length === 0 && r.quedan.length === 0
        ? {
            aviso: listed
              ? 'No hay publicaciones publicadas para auditar.'
              : `No queda ninguna publicación${args.marca ? ` de ${args.marca}` : ''} sin auditar en las últimas ${args.saltear_horas} horas.`,
          }
        : {}),
    };
  },
});

export const COMPATIBILITY_TOOLS = [auditTool];
