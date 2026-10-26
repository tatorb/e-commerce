import { z } from 'zod';
import { can, SECTIONS } from '@/domain/access';
import {
  dueDay,
  formatDay,
  parseTaskInput,
  parseTaskSearch,
  TASK_STATUS_LABEL,
  TASK_VIEWS,
  taskFlags,
  toLocalInput,
  type TaskView,
} from '@/domain/tasks';
import type { TaskStatus } from '@/generated/prisma/enums';
import { assignablePeople, createTask, getTask, listTasks, rightsOn, setTaskStatus, tasksOfPublication, updateTask, type TaskItem, type Viewer } from '@/lib/tasks';
import { notifyAssigned } from '@/lib/task-mail';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication, when, type AccountRef, type McpContext } from './tool';

// Las tareas desde Claude: verlas, crearlas y cambiarlas, con los mismos
// permisos que en la app. Cada persona ve y mueve las suyas aunque no tenga el
// permiso de Tareas.

const STATUS_ARG: Record<string, TaskStatus> = { pendiente: 'PENDING', en_proceso: 'IN_PROGRESS', finalizada: 'DONE', suspendida: 'SUSPENDED' };

const viewerOf = (ctx: McpContext): Viewer => ({ id: ctx.userId, access: ctx.access });

const noWrite = () =>
  new McpToolError(`El usuario de la persona no puede hacer cambios en ${SECTIONS.tareas.label}. Decile que le pida el permiso a un administrador.`);

function taskOut(ctx: McpContext, account: AccountRef, t: TaskItem, now: Date) {
  const f = taskFlags(t, now, account.timezone);
  return {
    id: t.id,
    titulo: t.title,
    estado: TASK_STATUS_LABEL[t.status],
    personas: t.people.map((p) => p.name),
    publicaciones: t.publications.map((p) => ({ titulo: p.title, codigo: p.externalId ?? 'sin publicar' })),
    aviso: when(t.remindAt, account),
    finalizacion: t.dueOn ? formatDay(dueDay(t.dueOn)) : null,
    vencida: f.overdue,
    llego_el_aviso: f.reminding,
    descripcion: t.description || null,
    puede_editarla: t.rights.edit,
    link_app: `${ctx.baseUrl}/a/${account.slug}/tareas/${t.id}`,
  };
}

/** Las personas por nombre o email, entre las que pueden tener tareas en la cuenta. "yo" es quien conectó a Claude. */
async function resolvePeople(ctx: McpContext, accountId: string, refs: string[]): Promise<string[]> {
  const people = await assignablePeople(ctx.db, accountId);
  const names = () => people.map((p) => `${p.name} (${p.email})`).join(', ') || 'ninguna';
  return refs.map((ref) => {
    const wanted = ref.trim().toLowerCase();
    if (wanted === 'yo') {
      if (!people.some((p) => p.id === ctx.userId)) throw new McpToolError('La persona no puede tener tareas en esta cuenta.');
      return ctx.userId;
    }
    const exact = people.filter((p) => p.email.toLowerCase() === wanted || p.name.toLowerCase() === wanted);
    const found = exact.length > 0 ? exact : people.filter((p) => p.name.toLowerCase().includes(wanted));
    if (found.length === 1) return found[0].id;
    if (found.length > 1) throw new McpToolError(`"${ref}" puede ser ${found.map((p) => `${p.name} (${p.email})`).join(' o ')}. Usá el email.`);
    throw new McpToolError(`No hay nadie "${ref}" que pueda tener tareas en la cuenta. Personas: ${names()}.`);
  });
}

async function resolvePublications(ctx: McpContext, accountId: string, refs: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const ref of refs) ids.push(await resolvePublication(ctx, accountId, ref));
  // La actividad se anota en la publicación solo si es una.
  ctx.touched = { ...ctx.touched, publicationId: ids.length === 1 ? ids[0] : undefined };
  return ids;
}

async function mailNew(ctx: McpContext, taskId: string) {
  await notifyAssigned(ctx.db, taskId, ctx.baseUrl).catch(() => console.warn('[tareas] no salieron los mails de asignación'));
}

const peopleArg = z
  .array(z.string().min(1).max(200))
  .min(1)
  .max(20)
  .describe('Las personas de la tarea, por nombre o email. "yo" es la persona que conectó a Claude.');
const publicationsArg = z.array(publicationArg).max(50).describe('Las publicaciones de la tarea: id, código del canal o link. Puede no tener ninguna.');
const remindArg = z
  .string()
  .max(40)
  .describe('Fecha y hora de aviso en la zona horaria de la cuenta, "AAAA-MM-DD HH:MM". Vacío para sacarla.');
const dueArg = z.string().max(20).describe('Fecha de finalización, "AAAA-MM-DD". Vence si al terminar ese día sigue abierta. Vacío para sacarla.');

const listTasksTool = defineTool({
  name: 'list_tasks',
  section: 'tareas',
  own: true,
  title: 'Ver las tareas',
  description:
    'Las tareas de la cuenta, o las de una publicación, con su estado, personas, publicaciones, fecha de aviso y de finalización. Primero las vencidas y las que ya llegaron al aviso. Sin el permiso de Tareas, la persona ve solo las suyas.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg.optional().describe('Solo las de esta publicación: id, código del canal o link.'),
    estado: z
      .enum(TASK_VIEWS.map((v) => v.value) as [TaskView, ...TaskView[]])
      .optional()
      .describe('abiertas (pendientes y en proceso, la opción por defecto), finalizadas, suspendidas o todas.'),
    solo_mias: z.boolean().optional().describe('Solo las de la persona que conectó a Claude.'),
  }),
  readOnly: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const viewer = viewerOf(ctx);
    const now = new Date();
    const filters = parseTaskSearch({ ver: args.estado, mias: args.solo_mias ? '1' : undefined });
    if (args.publicacion) {
      const publicationId = await resolvePublication(ctx, account.id, args.publicacion);
      const all = await tasksOfPublication(ctx.db, { publicationId, viewer, timeZone: account.timezone, now });
      const tasks = all.filter((t) => filters.statuses.includes(t.status) && (!filters.mine || t.people.some((p) => p.id === ctx.userId)));
      return { cuenta: account.slug, tareas: tasks.map((t) => taskOut(ctx, account, t, now)) };
    }
    const list = await listTasks(ctx.db, { accountId: account.id, viewer, filters, timeZone: account.timezone, now });
    return {
      cuenta: account.slug,
      ve_todas: can(ctx.access, 'tareas', 'read'),
      tareas: list.tasks.map((t) => taskOut(ctx, account, t, now)),
      ...(list.truncated ? { aviso: 'Hay más tareas: se muestran las más nuevas.' } : {}),
    };
  },
});

const createTaskTool = defineTool({
  name: 'create_task',
  section: 'tareas',
  title: 'Crear una tarea',
  description:
    'Crea una tarea en la cuenta, con una o varias personas y ninguna o varias publicaciones. Las personas reciben un mail. Antes de crearla, mostrale a la persona qué vas a crear y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    titulo: z.string().min(1).max(200).describe('Qué hay que hacer, en una frase.'),
    descripcion: z.string().max(5000).optional().describe('Los detalles.'),
    personas: peopleArg.optional().describe('Las personas de la tarea, por nombre o email. Sin esto, es de la persona que conectó a Claude.'),
    publicaciones: publicationsArg.optional(),
    aviso: remindArg.optional(),
    finalizacion: dueArg.optional(),
  }),
  readOnly: false,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const assigneeIds = await resolvePeople(ctx, account.id, args.personas ?? ['yo']);
    const publicationIds = await resolvePublications(ctx, account.id, args.publicaciones ?? []);
    const input = parseTaskInput(
      { title: args.titulo, description: args.descripcion ?? '', remindAt: args.aviso ?? '', dueOn: args.finalizacion ?? '', assigneeIds, publicationIds },
      account.timezone,
    );
    const task = await createTask(ctx.db, { accountId: account.id, actorId: ctx.userId, input });
    await mailNew(ctx, task.id);
    const item = await getTask(ctx.db, { accountId: account.id, taskId: task.id, viewer: viewerOf(ctx) });
    return { creada: true, tarea: item ? taskOut(ctx, account, item, new Date()) : { id: task.id } };
  },
});

const updateTaskTool = defineTool({
  name: 'update_task',
  section: 'tareas',
  own: true,
  title: 'Cambiar una tarea',
  description:
    'Cambia el estado de una tarea (pendiente, en proceso, finalizada o suspendida) o lo demás: título, descripción, personas, publicaciones y fechas. Lo que no se pasa queda como está. El estado lo cambian sus personas y quien puede cambiar en Tareas; lo demás, solo quien puede cambiar en Tareas. Antes de cambiar personas, publicaciones o fechas, mostrale a la persona qué vas a hacer y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    tarea: z.string().min(1).max(40).describe('El id de la tarea, de list_tasks.'),
    estado: z.enum(['pendiente', 'en_proceso', 'finalizada', 'suspendida']).optional(),
    titulo: z.string().min(1).max(200).optional(),
    descripcion: z.string().max(5000).optional(),
    personas: peopleArg.optional().describe('Todas las personas que quedan, por nombre o email. Reemplaza a las de antes.'),
    publicaciones: publicationsArg.optional().describe('Todas las publicaciones que quedan. Reemplaza a las de antes; [] la deja sin ninguna.'),
    aviso: remindArg.optional(),
    finalizacion: dueArg.optional(),
  }),
  readOnly: false,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const viewer = viewerOf(ctx);
    const { rights } = await rightsOn(ctx.db, { accountId: account.id, taskId: args.tarea, viewer }).catch(() => {
      throw new McpToolError(`No hay una tarea "${args.tarea}" en la cuenta. Buscala con list_tasks.`);
    });
    if (!rights.see) throw new McpToolError(`No hay una tarea "${args.tarea}" en la cuenta. Buscala con list_tasks.`);
    const edits = [args.titulo, args.descripcion, args.personas, args.publicaciones, args.aviso, args.finalizacion].some((v) => v !== undefined);
    if (edits && !rights.edit) throw noWrite();
    if (args.estado && !rights.move) throw new McpToolError('Solo le cambian el estado sus personas o quien puede cambiar en Tareas.');

    if (edits) {
      const now = (await getTask(ctx.db, { accountId: account.id, taskId: args.tarea, viewer }))!;
      const input = parseTaskInput(
        {
          title: args.titulo ?? now.title,
          description: args.descripcion ?? now.description,
          remindAt: args.aviso ?? toLocalInput(now.remindAt, account.timezone),
          dueOn: args.finalizacion ?? (now.dueOn ? dueDay(now.dueOn) : ''),
          assigneeIds: args.personas ? await resolvePeople(ctx, account.id, args.personas) : now.people.map((p) => p.id),
          publicationIds: args.publicaciones ? await resolvePublications(ctx, account.id, args.publicaciones) : now.publications.map((p) => p.id),
        },
        account.timezone,
      );
      const r = await updateTask(ctx.db, { accountId: account.id, taskId: args.tarea, actorId: ctx.userId, input });
      if (r.added.length > 0) await mailNew(ctx, r.id);
    }
    if (args.estado) await setTaskStatus(ctx.db, { accountId: account.id, taskId: args.tarea, status: STATUS_ARG[args.estado] });
    const item = await getTask(ctx.db, { accountId: account.id, taskId: args.tarea, viewer });
    if (item?.publications.length === 1) ctx.touched = { ...ctx.touched, publicationId: item.publications[0].id };
    return { cambiada: true, tarea: item ? taskOut(ctx, account, item, new Date()) : { id: args.tarea } };
  },
});

export const TASK_TOOLS = [listTasksTool, createTaskTool, updateTaskTool];
