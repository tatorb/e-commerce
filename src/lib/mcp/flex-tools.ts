import { z } from 'zod';
import { flexLabel } from '@/domain/flex';
import { formatDateTime } from '@/lib/format';
import { flexConfiguration, flexToday, setPublicationsFlex, type FlexSale } from '@/lib/flex';
import { flexPlans, setFlexFollowsStock } from '@/lib/branch-flex';
import { McpToolError, accountArg, defineTool, resolveAccount, resolvePublication } from './tool';

// Envíos Flex desde Claude: las ventas Flex del día, la configuración de Flex
// de la cuenta y prender o apagar Flex en publicaciones. Prender o apagar lo
// decide la persona: Claude lo hace solo cuando ella lo confirma.

const flexTodayTool = defineTool({
  name: 'get_flex_today',
  section: 'ventas',
  title: 'Ver las ventas Flex del día',
  description:
    'Las ventas con Envíos Flex de la cuenta para hoy, en la hora de la cuenta: las que hay que preparar y entregar, con su hora límite; las que están en camino; las entregadas hoy y las que no se pudieron entregar o volvieron. Las entregas se marcan con la app de Envíos Flex del canal, no desde acá.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const t = await flexToday(ctx.db, { accountId: account.id, timeZone: account.timezone });
    const row = (s: FlexSale) => ({
      venta: s.orderId,
      que: s.what,
      comprador: s.buyer,
      entregar_antes_de: s.dispatchBy ? formatDateTime(s.dispatchBy, account.timezone) : null,
      detalle: s.shipDetail,
      entregada: s.deliveredAt ? formatDateTime(s.deliveredAt, account.timezone) : null,
    });
    return {
      cuenta: account.slug,
      dia: t.day,
      para_entregar: t.toDeliver.map(row),
      en_camino: t.onTheWay.map(row),
      entregadas_hoy: t.delivered.map(row),
      con_problemas: t.problems.map(row),
    };
  },
});

const DAY_LABEL = { week: 'lunes a viernes', saturday: 'sábado', sunday: 'domingo' } as const;

const flexConfigTool = defineTool({
  name: 'get_flex_config',
  section: 'conexion',
  title: 'Ver la configuración de Envíos Flex',
  description:
    'La configuración de Envíos Flex de cada tienda de la cuenta, leída en el momento del canal: desde dónde sale, las zonas de cobertura con su horario de corte, si entrega en el día o al día siguiente, las franjas de entrega con su capacidad por día y los feriados. Solo para ver: esta configuración se cambia en el canal.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const stores = await flexConfiguration(ctx.db, account.id);
    return {
      cuenta: account.slug,
      tiendas: stores.map((s) => ({
        tienda: s.store,
        canal: s.channel,
        ...(s.error ? { error: s.error } : {}),
        flex: s.services
          ? s.services.length === 0
            ? 'La cuenta no tiene Envíos Flex.'
            : s.services.map((v) => ({
                estado: v.status,
                sale_desde: v.origin,
                cobertura: v.coverage,
                zonas: v.zones?.map((z) => ({ zona: z.id, ...(z.cutoff ? { corte_por_dia: z.cutoff } : {}) })) ?? null,
                entrega: v.deliveryWindow === 'same_day' ? 'en el día' : v.deliveryWindow === 'next_day' ? 'al día siguiente' : v.deliveryWindow,
                franjas: v.ranges.map((r) => ({
                  dias: DAY_LABEL[r.day],
                  de: r.from,
                  a: r.to,
                  corte: r.cutoff,
                  capacidad: r.capacity,
                })),
                rango_extendido: v.extendedRange,
                moderado_por_el_canal: v.moderated,
                feriados: v.holidays.map((h) => ({ fecha: h.date, feriado: h.description, marcado: h.selected })),
                ...(v.warnings.length > 0 ? { avisos: v.warnings } : {}),
              }))
          : null,
      })),
    };
  },
});

const setFlexTool = defineTool({
  name: 'set_publication_flex',
  section: 'subir',
  title: 'Prender o apagar Envíos Flex en publicaciones',
  description:
    'Prende o apaga Envíos Flex en una o varias publicaciones, en el canal. Con Flex, las ventas que entran por Flex las entrega la tienda, en el día o al día siguiente según su configuración. En una familia, el cambio va a todas sus medidas. El canal pide que lo decida el vendedor: antes de cambiarlo, mostrale a la persona qué publicaciones vas a cambiar y si las prendés o apagás, y esperá que confirme. En una cuenta con sucursales (get_branches), Flex se prende y se apaga solo según el stock de las sucursales con Flex; prenderlo o apagarlo a mano deja esa publicación fuera de eso, hasta volver a seguir_stock. Devuelve cuáles cambiaron y cuáles no, con el motivo. get_publication dice si cada una tiene Flex y, con sucursales, qué le toca (flex_por_stock).',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(100).describe('Las publicaciones: su id en la app, su código en el canal o su link.'),
    flex: z
      .enum(['prender', 'apagar', 'seguir_stock'])
      .describe('prender o apagar a mano; seguir_stock: en una cuenta con sucursales, vuelve a prenderse y apagarse solo según el stock de las sucursales con Flex.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const ids: string[] = [];
    for (const ref of args.publicaciones) ids.push(await resolvePublication(ctx, account.id, ref));
    if (args.flex === 'seguir_stock') {
      if ((await ctx.db.branch.count({ where: { accountId: account.id } })) === 0) throw new McpToolError('La cuenta no tiene sucursales: Flex se cambia a mano. Las sucursales se crean con save_branch.');
      const f = await setFlexFollowsStock(ctx.db, { accountId: account.id, publicationIds: ids, on: true, userId: ctx.userId });
      const plans = await flexPlans(ctx.db, ids);
      return {
        siguen_al_stock: [...plans].map(([id, p]) => ({ publicacion_id: id, ...(p.follows ? { le_toca: flexLabel(p.on), motivo: p.reason } : { sigue: false, motivo: p.reason }) })),
        cambiadas_en_el_canal: f.changed.length,
        ...(f.failed.length > 0 ? { no_se_pudieron: f.failed.map((x) => ({ publicacion_id: x.publicationId, motivo: x.message })) } : {}),
      };
    }
    const on = args.flex === 'prender';
    const r = await setPublicationsFlex(ctx.db, { accountId: account.id, publicationIds: ids, on, userId: ctx.userId });
    if (r.done.length === 0 && r.failed.length > 0) {
      throw new McpToolError(`No cambió ninguna. ${r.failed.map((f) => `${f.externalId ?? f.title ?? f.id}: ${f.message}`).join(' ')}`);
    }
    return {
      quedaron: flexLabel(on),
      cambiaron: r.done.map((d) => ({ codigo: d.externalId, titulo: d.title })),
      no_se_pudieron: r.failed.map((f) => ({ codigo: f.externalId, titulo: f.title, motivo: f.message })),
    };
  },
});

export const FLEX_TOOLS = [flexTodayTool, flexConfigTool, setFlexTool];
