import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { auditAccountCompatibilities } from '@/lib/compatibilities';
import { pushCompatibilities } from '@/lib/compatibility-push';
import { accountArg, defineTool, findPublication, McpToolError, resolveAccount } from './tool';

// Las compatibilidades con vehículos, para Claude: auditar contra la ficha sin
// subir nada, y subir lo que mostró la auditoría.

// Hasta cuándo se empiezan pedidos al canal: lo que ya salió termina, y la respuesta llega antes del minuto.
const AUDIT_BUDGET_MS = 30_000;
// Sin lista, lo auditado en estas horas no se repite: cada llamada sigue donde quedó la anterior.
const SKIP_HOURS = 12;

const auditTool = defineTool({
  name: 'audit_compatibilities',
  section: 'publicaciones',
  title: 'Auditar las compatibilidades con vehículos',
  description:
    'Compara las compatibilidades con vehículos que cada publicación tiene cargadas en el canal con las que salen de la ficha, que es la única fuente de verdad. Traduce cada línea de la ficha a vehículos del catálogo del canal como los filtros de su pantalla: marca, modelo, años (los de la ficha; sin años, todos), combustible (siempre), cilindrada, potencia y las versiones que no van. Lo que no se puede traducir con seguridad queda a revisar, con el motivo. Por publicación dice cuántos vehículos cargados salen de la ficha, qué falta (grupos de vehículos por año), qué grupos están incompletos (con algún vehículo cargado pero menos de los que tiene el catálogo), qué sobra con el motivo (los cargados por la tienda se pueden borrar desde la app; los que cargó el canal solo muestran la marca y se borran a mano en el canal), qué queda a revisar (cuando son más que los ejemplos, sobran_por_modelo y a_revisar_por_modelo los muestran todos por marca y modelo, con años y motivos), si el canal avisa que faltan y si tiene sugerencias pendientes. Las fichas sin compatibilidades van aparte: no se pueden corregir sin datos. En publicaciones pasá ids o códigos del canal, hasta 100: se suman las otras medidas de su familia y las otras opciones de venta de cada medida; si no entran todas, devuelve en quedan las que faltan y hay que volver a llamar con esa lista. Sin la lista, todas las publicaciones vivas de la cuenta, o solo las de una marca del repuesto con marca (por ejemplo Persan): cada llamada saltea las auditadas en las últimas 12 horas (o las que digas en saltear_horas), así que para recorrerlas todas se vuelve a llamar igual hasta que no queden. No sube nada al canal: guarda en la app lo leído y el resultado.',
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

// Hasta cuándo se empieza a subir otra publicación: cada una relee el canal antes y después de mandar.
const PUSH_BUDGET_MS = 30_000;

const pushTool = defineTool({
  name: 'push_compatibilities',
  section: 'subir',
  title: 'Subir las compatibilidades con vehículos al canal',
  description:
    'Manda al canal lo que mostró audit_compatibilities, en la misma subida: agrega los grupos de vehículos que salen de la ficha y faltan, completa los incompletos, y borra los que cargó la tienda y no salen de la ficha. Manda solo lo que mostró la última auditoría hecha con audit_compatibilities y que, al releer el canal justo antes, sigue faltando o sobrando; si la ficha cambió después de esa auditoría, no manda nada y pide mirarla de nuevo. Lo ya mandado no se vuelve a mandar sin una auditoría nueva: si una publicación ya se subió, queda salteada y hay que auditarla otra vez para ver cómo quedó y mostrar lo que queda. Si al agregar un grupo el canal mete vehículos que no salen de la ficha (por ejemplo un 1.2 que el catálogo tiene con motor 1.6), los saca en la misma subida, los devuelve en deshechos y quedan anotados para que la auditoría no los cuente como faltantes. Si el canal no carga todo lo que su catálogo cuenta en un grupo recién mandado, lo devuelve en no_cargados y queda anotado: la auditoría no lo muestra más como pendiente. Lo que cargó el canal no se puede borrar desde la app: queda para borrarlo a mano en el canal. Las fichas sin compatibilidades no se tocan, y lo que está a revisar tampoco. Va una vez por producto del canal, porque las opciones de venta de una medida comparten lo cargado, y en una familia va a todas sus medidas aunque pases una sola. En publicaciones pasá ids o códigos del canal, hasta 100; sin la lista, todo lo que hay por subir en la cuenta, o solo lo de una marca del repuesto con marca. Por cada una devuelve lo agregado y lo borrado, el motivo exacto si el canal rechaza algo y cómo quedó al volver a auditar. Si son muchas, sube las que entran y devuelve en quedan las que faltan: volvé a llamar con esa lista. Cambia la publicación en el canal de verdad: antes de subir, mostrale a la persona qué se va a agregar y qué se va a borrar, y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z
      .array(z.string().min(1))
      .min(1)
      .max(100)
      .optional()
      .describe('Las publicaciones: su id en la app o su código en el canal, hasta 100. Sin la lista, todas las que tienen compatibilidades por subir.'),
    marca: z.string().min(1).max(80).optional().describe('Solo las publicaciones de productos con esa marca del repuesto en la ficha, por ejemplo Persan.'),
    solo_agregar: z
      .boolean()
      .default(false)
      .describe('Solo agrega lo que falta y completa los incompletos, sin borrar nada: lo que sobra queda para otra subida, que lo puede borrar sin volver a auditar. Las que solo tienen para borrar quedan salteadas.'),
  }),
  readOnly: false,
  destructive: true,
  logsItself: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const ids: string[] = [];
    const salteadas: { publicacion: string; motivo: string }[] = [];
    for (const ref of args.publicaciones ?? []) {
      try {
        ids.push(await findPublication(ctx.db, account.id, ref));
      } catch (e) {
        if (!(e instanceof McpToolError)) throw e;
        salteadas.push({ publicacion: ref, motivo: e.message });
      }
    }
    if (args.publicaciones && ids.length === 0) throw new McpToolError(salteadas[0]?.motivo ?? 'No se encontró ninguna publicación.');
    const r = await pushCompatibilities(ctx.db, {
      accountId: account.id,
      publicationIds: args.publicaciones ? ids : undefined,
      brand: args.marca ?? null,
      addOnly: args.solo_agregar,
      budgetMs: PUSH_BUDGET_MS,
    });
    // Como el botón de Por subir: queda en la actividad de la persona, hecho por Claude.
    for (const x of r.subidas) {
      if (x.resultado === 'salteada' || x.resultado === 'sin cambios') continue;
      await logActivity(ctx.db, {
        userId: ctx.userId,
        accountId: account.id,
        section: 'subir',
        summary: 'Subió cambios al canal',
        publicationId: x.publicationIds[0],
        detail:
          x.resultado === 'error'
            ? (x.motivo ?? null)
            : `Compatibilidades: agregó o completó ${x.agregados.grupos} grupos de vehículos y borró ${x.borrados.cantidad} vehículos.${x.deshechos ? ` Sacó ${x.deshechos.cantidad} que metió el canal y no salen de la ficha.` : ''}${x.rechazos ? ` ${x.rechazos.join(' ')}` : ''}`,
        via: 'CLAUDE',
      });
    }
    return {
      // Los ids de la app son para la actividad: se muestran los códigos del canal.
      subidas: r.subidas.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'publicationIds'))),
      ...(salteadas.length > 0 ? { salteadas } : {}),
      ...(r.quedan.length > 0
        ? {
            quedan: r.quedan,
            aviso: r.busy
              ? 'El canal pidió esperar porque hubo demasiados pedidos: volvé a llamar en unos minutos con la lista de quedan.'
              : 'No entraron todas en esta vuelta: volvé a llamar con la lista de quedan.',
          }
        : {}),
      ...(r.subidas.length === 0 && r.quedan.length === 0
        ? { aviso: 'No hay compatibilidades por subir: o ya está todo al día, o falta auditar con audit_compatibilities.' }
        : {}),
    };
  },
});

export const COMPATIBILITY_TOOLS = [auditTool, pushTool];
