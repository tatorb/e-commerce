import { z } from 'zod';
import { CHANNEL_STATUS_LABEL, STATUS_ACTIONS } from '@/domain/channel-status';
import { changeStatus } from '@/lib/channel-status';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication } from './tool';

// Pausar, reactivar y finalizar una publicación en el canal desde Claude, con
// las mismas reglas y el mismo permiso que en la app. Finalizar pide repetir el
// código, porque no tiene vuelta atrás: para volver a vender hay que
// republicarla y le da otro código. Eliminar queda en la app.

const ACTION = { pausar: 'pause', reactivar: 'activate', finalizar: 'close' } as const;

const setPublicationStatusTool = defineTool({
  name: 'set_publication_status',
  section: 'subir',
  title: 'Pausar, reactivar o finalizar una publicación en el canal',
  description:
    'Pausa una publicación activa, reactiva una pausada o inactiva, o finaliza una activa, pausada o inactiva, en el canal. Pausada no se ve ni se vende. Finalizada tampoco, y no tiene vuelta atrás: para volver a venderla hay que republicarla, con otro código, y pierde sus visitas. Para finalizar, repetí el código de la publicación en confirmar_codigo. Una que se quedó sin stock conviene reactivarla después de cargar el stock del producto: si el canal no deja, devuelve el motivo. Si es una publicación vieja con varias medidas adentro, el cambio va a todas. Eliminar se hace en la app. Antes de cambiarlo, mostrale a la persona qué publicación vas a cambiar y esperá que confirme; para finalizar, que confirme el código.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    accion: z.enum(['pausar', 'reactivar', 'finalizar']).describe('pausar = deja de verse y de venderse; reactivar = vuelve a la venta; finalizar = se cierra para siempre.'),
    confirmar_codigo: z.string().optional().describe('Para finalizar: el código de la publicación en el canal, por ejemplo MLA123456789, el mismo que confirmó la persona.'),
  }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const publicationId = await resolvePublication(ctx, account.id, args.publicacion);
    const action = ACTION[args.accion];
    if (action === 'close') {
      const pub = await ctx.db.publication.findUniqueOrThrow({ where: { id: publicationId }, select: { externalId: true } });
      const sent = args.confirmar_codigo?.trim().toUpperCase().replace(/-/g, '');
      if (!pub.externalId || sent !== pub.externalId.toUpperCase()) {
        throw new McpToolError(`Para finalizar, repetí el código de la publicación en confirmar_codigo${pub.externalId ? ` (${pub.externalId})` : ''}, después de que la persona lo confirme.`);
      }
    }
    const r = await changeStatus(ctx.db, { accountId: account.id, publicationIds: [publicationId], action, userId: ctx.userId });
    const failed = r.failed[0];
    if (failed) throw new McpToolError(`No se pudo ${STATUS_ACTIONS[action].label.toLowerCase()}: ${failed.message}`);
    return { listo: true, estado: CHANNEL_STATUS_LABEL[STATUS_ACTIONS[action].to], publicacion: r.done[0]?.title ?? null };
  },
});

export const STATUS_TOOLS = [setPublicationStatusTool];
