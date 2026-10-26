import { z } from 'zod';
import { CHANNEL_STATUS_LABEL, STATUS_ACTIONS } from '@/domain/channel-status';
import { changeStatus } from '@/lib/channel-status';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication } from './tool';

// Pausar y reactivar una publicación en el canal desde Claude, con las mismas
// reglas y el mismo permiso que en la app. Finalizar y eliminar quedan en la
// app: eliminar no tiene vuelta atrás y republicar le da otro código.

const ACTION = { pausar: 'pause', reactivar: 'activate' } as const;

const setPublicationStatusTool = defineTool({
  name: 'set_publication_status',
  section: 'subir',
  title: 'Pausar o reactivar una publicación en el canal',
  description:
    'Pausa una publicación activa, o reactiva una pausada o inactiva, en el canal. Pausada no se ve ni se vende. Una que se quedó sin stock conviene reactivarla después de cargar el stock del producto: si el canal no deja, devuelve el motivo. Si el canal guarda cada medida como una publicación aparte, el cambio va a todas. Finalizar y eliminar se hacen en la app. Antes de cambiarlo, mostrale a la persona qué publicación vas a pausar o reactivar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    accion: z.enum(['pausar', 'reactivar']).describe('pausar = deja de verse y de venderse; reactivar = vuelve a la venta.'),
  }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const publicationId = await resolvePublication(ctx, account.id, args.publicacion);
    const action = ACTION[args.accion];
    const r = await changeStatus(ctx.db, { accountId: account.id, publicationIds: [publicationId], action, userId: ctx.userId });
    const failed = r.failed[0];
    if (failed) throw new McpToolError(`No se pudo ${STATUS_ACTIONS[action].label.toLowerCase()}: ${failed.message}`);
    return { listo: true, estado: CHANNEL_STATUS_LABEL[STATUS_ACTIONS[action].to], publicacion: r.done[0]?.title ?? null };
  },
});

export const STATUS_TOOLS = [setPublicationStatusTool];
