import { z } from 'zod';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import type { ChannelStatus } from '@/generated/prisma/enums';
import { reconcile } from '@/lib/reconcile';
import { accountArg, defineTool, McpToolError, resolveAccount, resolvePublication } from './tool';

// La reconciliación de las opciones de venta con el canal, para Claude.

const FINDING_LABEL = {
  new_option: 'opción que faltaba en la app',
  switch_main: 'pasar la principal a otro código',
  no_replacement: 'finalizada sin reemplazo',
  duplicate_off: 'apagada por repetida',
  needs_fix: 'inactiva para corregir',
  under_review: 'en revisión',
  same_plan_live: 'misma forma de cobro repetida',
} as const;

const reconcileTool = defineTool({
  name: 'reconcile_publications',
  section: ['pipeline', 'publicaciones'],
  title: 'Reconciliar las opciones de venta con el canal',
  description:
    'Compara las opciones de venta de cada medida con lo que tiene el canal: le pide al canal todas las publicaciones vivas de cada medida conocida y dice qué encuentra. Los casos: una opción que el canal tiene y la app no (se suma); la principal finalizada, en revisión o apagada por repetida con otra opción viva (la principal pasa a esa); la principal finalizada sin otra viva (tarea: ¿volver a publicar?); la principal inactiva para corregir (tarea y vuelve al paso Información); una opción apagada por repetida (se propone finalizarla); dos opciones vivas con la misma forma de cobro (aviso). Sin aplicar, solo muestra y no cambia nada: usalo así primero y mostrale a la persona el resultado. Con aplicar, hace esos cambios en la app; no sube nada al canal: lo que queda distinto aparece en Por subir. Revisa unas 40 medidas por vuelta: si quedan, volvé a llamar con desde.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).max(100).optional().describe('Solo las medidas de estas publicaciones: código del canal, link o id. Sin la lista, todas las de la cuenta.'),
    aplicar: z.boolean().default(false).describe('false (de entrada) = solo mostrar; true = hacer los cambios en la app. Antes de aplicar, la persona tiene que confirmar.'),
    desde: z.number().int().min(0).default(0).describe('Cuántas medidas saltear, para seguir donde quedó la vuelta anterior.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const ids = args.publicaciones ? await Promise.all(args.publicaciones.map((ref) => resolvePublication(ctx, account.id, ref))) : undefined;
    if (args.aplicar && !ctx.userId) throw new McpToolError('Para aplicar hace falta saber quién lo hace.');
    const r = await reconcile(ctx.db, { accountId: account.id, publicationIds: ids, apply: args.aplicar, userId: ctx.userId, from: args.desde });
    return {
      modo: args.aplicar ? 'aplicado' : 'solo mostrar: no se cambió nada',
      medidas_revisadas: r.checked,
      medidas_con_hallazgos: r.measures.length,
      medidas: r.measures.map((m) => ({
        producto: m.product,
        medida: m.measure,
        opciones: m.options.map((o) => ({
          codigo: o.externalId,
          estado: CHANNEL_STATUS_LABEL[o.status as ChannelStatus] ?? o.status,
          ...(o.statusReason ? { motivo_del_estado: o.statusReason } : {}),
          forma_de_cobro: o.plan,
          precio: o.price,
          principal: o.main,
          en_la_app: o.inApp,
        })),
        hallazgos: m.findings.map((f) => ({
          tipo: FINDING_LABEL[f.kind],
          codigos: f.codes,
          ...(f.to ? { pasa_a: f.to } : {}),
          texto: f.text,
          ...(f.done ? { hecho: f.done } : {}),
          ...(f.failed ? { no_se_pudo: f.failed } : {}),
        })),
      })),
      ...(r.unread.length > 0 ? { medidas_que_el_canal_no_devolvio: r.unread } : {}),
      ...(r.remaining > 0 ? { quedan: r.remaining, seguir_desde: (args.desde ?? 0) + r.checked } : {}),
    };
  },
});

export const RECONCILE_TOOLS = [reconcileTool];
