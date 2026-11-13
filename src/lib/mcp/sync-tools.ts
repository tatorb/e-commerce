import { z } from 'zod';
import { FACE_FIELD_LABEL, FACE_FIELDS, SYNC_CHANGE_LABEL, type FaceField } from '@/domain/channel-sync';
import { fieldLabel } from '@/domain/sync-log';
import { titleOrUntitled } from '@/domain/publication-title';
import { chooseFaces, runSyncStep, startSync, syncableStores } from '@/lib/channel-sync';
import { loadSyncOverview } from '@/lib/queries/sync';
import { McpToolError, accountArg, defineTool, findPublication, resolveAccount, when, type AccountRef, type McpContext } from './tool';

// La sección Sincronización desde Claude: cómo va la lectura del canal, lo que
// hay para elegir entre la app y el canal, elegir y pedir una lectura ahora.

// El nombre de cada dato para Claude, y al revés.
const FIELD_ARG = Object.fromEntries(FACE_FIELDS.map((f) => [FACE_FIELD_LABEL[f].toLowerCase(), f])) as Record<string, FaceField>;
const FIELD_NAMES = Object.keys(FIELD_ARG) as [string, ...string[]];
const clip = (s: string, n = 600) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const link = (ctx: McpContext, account: AccountRef, id: string) => `${ctx.baseUrl}/a/${account.slug}/publicaciones/${id}`;

type Overview = Awaited<ReturnType<typeof loadSyncOverview>>;

function runOut(run: Overview['runs'][number] | null, account: AccountRef) {
  if (!run) return null;
  const errors = Array.isArray(run.errors) ? (run.errors as { message?: string }[]) : [];
  return {
    empezo: when(run.startedAt, account),
    termino: when(run.finishedAt, account),
    como: run.trigger === 'SCHEDULE' ? 'automática' : `pedida por ${run.user?.name ?? 'alguien del equipo'}`,
    estado: run.status === 'RUNNING' ? 'en curso' : run.status === 'DONE' ? 'terminó' : 'no terminó',
    leyo: `${run.read} de ${run.total}`,
    con_cambios_traidos: run.updated,
    ...(run.newInChannel ? { en_el_canal_y_no_en_la_app: run.newInChannel } : {}),
    ...(errors.length > 0 ? { avisos: errors.slice(-8).map((e) => e.message ?? '') } : {}),
  };
}

const statusTool = defineTool({
  name: 'get_sync_status',
  section: 'sincronizacion',
  title: 'Ver cómo va la sincronización con el canal',
  description:
    'La sección Sincronización: la app lee las publicaciones del canal cada hora y trae sola lo que cambió allá si en la app no se tocó. Muestra, por tienda, la última lectura (cuándo, si fue automática o pedida, cuántas leyó, cuántas trajeron cambios y sus avisos) y si hay una en curso; cuántas publicaciones están al día, cuántas tienen cambios de la app sin subir (borrador) y cuántas tienen datos para elegir (distintos en la app y en el canal: se ven con list_sync_choices); las que la lectura ya no encuentra en el canal (pueden estar borradas allá) y los últimos cambios. Las publicaciones del canal que no están en la app se traen desde Importar.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const o = await loadSyncOverview(account.id, ctx.db);
    return {
      cuenta: account.slug,
      tiendas: o.stores.map((s) => ({
        tienda: `${s.channelName} · ${s.name}`,
        conectada: s.connected,
        ...(s.connected ? {} : { aviso: 'Hay que volver a conectar la tienda en Conexión.' }),
        leyendo_ahora: s.running ? `${s.running.position} de ${s.running.total}` : null,
        ultima_lectura: runOut(s.last, account),
      })),
      al_dia: o.upToDate,
      con_borrador_sin_subir: o.drafts,
      para_elegir: o.toChoose.length,
      ya_no_estan_en_el_canal: o.missing.slice(0, 50).map((m) => ({
        titulo: titleOrUntitled(m.title),
        codigo: m.externalId,
        desde: when(m.since, account),
        link_app: link(ctx, account, m.id),
      })),
      ...(o.missing.length > 50 ? { ya_no_estan_en_el_canal_en_total: o.missing.length } : {}),
      ultimos_cambios: o.changes.slice(0, 15).map((c) => ({
        cuando: when(c.createdAt, account),
        publicacion: `${titleOrUntitled(c.publication.title)} · ${c.publication.externalId ?? 'sin código'}`,
        dato: fieldLabel(c.field),
        que_paso: SYNC_CHANGE_LABEL[c.kind],
        quien: c.user?.name ?? 'automático',
      })),
    };
  },
});

const PAGE = 20;

const choicesTool = defineTool({
  name: 'list_sync_choices',
  section: 'sincronizacion',
  title: 'Ver los datos para elegir entre la app y el canal',
  description:
    'Las publicaciones con datos distintos en la app y en el canal, cuando cambiaron en los dos lados: la app no pisa ninguno hasta que alguien elige. Por cada dato, lo que dice la app y lo que dice el canal, uno al lado del otro (los textos largos, recortados). De a 20, con pagina. Para elegir, choose_sync_side. Las que pasaron por el pipeline se marcan: ahí lo de la app suele ser lo trabajado.',
  input: z.object({ cuenta: accountArg, pagina: z.number().int().min(1).default(1) }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const o = await loadSyncOverview(account.id, ctx.db);
    const from = (args.pagina - 1) * PAGE;
    return {
      total: o.toChoose.length,
      pagina: args.pagina,
      ...(from + PAGE < o.toChoose.length ? { hay_mas: `Pedí la página ${args.pagina + 1}.` } : {}),
      publicaciones: o.toChoose.slice(from, from + PAGE).map((r) => ({
        titulo: titleOrUntitled(r.title),
        codigo: r.externalId,
        tienda: `${r.channelName} · ${r.storeName}`,
        paso_por_el_pipeline: r.worked,
        link_app: link(ctx, account, r.id),
        datos: r.fields.map((f) => ({ dato: FACE_FIELD_LABEL[f.field].toLowerCase(), en_la_app: clip(f.app) || '(vacío)', en_el_canal: clip(f.channel) || '(vacío)' })),
      })),
    };
  },
});

const chooseTool = defineTool({
  name: 'choose_sync_side',
  section: ['sincronizacion', 'publicaciones', 'pipeline'],
  title: 'Elegir entre lo de la app y lo del canal',
  description:
    'En los datos para elegir de una o varias publicaciones (list_sync_choices), elige con qué queda: canal = se trae a la app lo del canal, y lo de la app se pierde; app = queda lo de la app como borrador para subir después (no se sube solo). Con dato, solo ese dato; sin dato, todos los que estén para elegir. Lo que no está para elegir no se toca. Antes, mostrale a la persona qué publicaciones, qué datos y qué lado, y esperá que confirme: elegir el canal pisa lo trabajado en la app.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(200).describe('Las publicaciones: su código del canal, link o id.'),
    lado: z.enum(['canal', 'app']),
    dato: z.enum(FIELD_NAMES).optional().describe('Solo este dato. Sin esto, todos los que estén para elegir.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const ids: string[] = [];
    for (const ref of args.publicaciones) ids.push(await findPublication(ctx.db, account.id, ref));
    if (ids.length === 1) ctx.touched = { ...ctx.touched, publicationId: ids[0] };
    const r = await chooseFaces(ctx.db, {
      accountId: account.id,
      publicationIds: ids,
      side: args.lado === 'canal' ? 'channel' : 'app',
      fields: args.dato ? [FIELD_ARG[args.dato]] : undefined,
      userId: ctx.userId,
    });
    if (r.publications === 0) return { cambio: false, motivo: 'Ninguna de esas publicaciones tenía ese dato para elegir.' };
    return {
      cambio: true,
      publicaciones: r.publications,
      datos: r.fields,
      quedo: args.lado === 'canal' ? 'con lo del canal, ya en la app' : 'con lo de la app, como borrador para subir (push_titles, push_descriptions, push_prices, etc.)',
    };
  },
});

// Lo más que lee en una llamada: la conexión con Claude corta al minuto.
const READ_BUDGET_MS = 40_000;

const syncNowTool = defineTool({
  name: 'sync_now',
  section: 'sincronizacion',
  title: 'Leer ahora las publicaciones del canal',
  description:
    'Como el botón Leer ahora de Sincronización: empieza una lectura de las publicaciones de la tienda en el canal, o sigue la que está en curso, y lee lo que alcanza en unos 40 segundos. Si no terminó, dice cuánto falta: volvé a llamarla para seguir, o dejala, que sigue sola con la lectura de cada hora. Solo lee: no sube nada al canal. Con varias tiendas, pasá la tienda.',
  input: z.object({ cuenta: accountArg, tienda: z.string().optional().describe('El nombre de la tienda, si la cuenta tiene más de una.') }),
  readOnly: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const stores = await syncableStores(ctx.db, account.id);
    if (stores.length === 0) throw new McpToolError('La cuenta no tiene una tienda conectada que se pueda leer. Se conecta en Conexión.');
    const wanted = args.tienda?.trim().toLowerCase();
    const store = wanted ? stores.find((s) => s.name.toLowerCase().includes(wanted)) : stores.length === 1 ? stores[0] : null;
    if (!store) throw new McpToolError(`Decí qué tienda: ${stores.map((s) => s.name).join(', ')}.`);
    const run = await startSync(ctx.db, { storeId: store.id, trigger: 'MANUAL', userId: ctx.userId });
    if (!run) throw new McpToolError('No se pudo empezar la lectura. Probá de nuevo en un rato.');
    const progress = await runSyncStep(ctx.db, run.id, { budgetMs: READ_BUDGET_MS });
    if (progress.busy) return { estado: 'ya se está leyendo desde otro lado', leidas: `${progress.position} de ${progress.total}` };
    if (progress.status === 'RUNNING') return { estado: 'en curso', leidas: `${progress.position} de ${progress.total}`, siguiente: 'Llamá de nuevo a sync_now para seguir, o dejala: sigue sola.' };
    const done = await ctx.db.channelSync.findUnique({ where: { id: run.id }, select: { read: true, updated: true, toChoose: true, newInChannel: true, status: true, errors: true } });
    const errors = Array.isArray(done?.errors) ? (done.errors as { message?: string }[]) : [];
    return {
      estado: progress.status === 'DONE' ? 'terminó' : 'no terminó',
      leidas: done?.read ?? progress.position,
      con_cambios_traidos: done?.updated ?? 0,
      para_elegir: done?.toChoose ?? null,
      en_el_canal_y_no_en_la_app: done?.newInChannel ?? null,
      ...(errors.length > 0 ? { avisos: errors.slice(-8).map((e) => e.message ?? '') } : {}),
    };
  },
});

export const SYNC_TOOLS = [statusTool, choicesTool, chooseTool, syncNowTool];
