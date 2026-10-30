import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import type { PhotoRunStatus } from '@/generated/prisma/enums';
import {
  GUIDANCE_PROTOCOL,
  LIVE_PROTOCOL,
  PART_PROTOCOL,
  productWithGuidance,
  type Job,
  type PhotoGuidance,
  type PhotoProtocol,
  type RecipeEntry,
  type StepPart,
  type StepProposal,
  type StepRequest,
  type Transfer,
  type UploadKind,
  type WorkerDone,
} from '@/domain/photo-contract';
import { getChannelAdapter } from '@/channels';
import { LAST_PHOTO_STEP, LIVE_PARTS, missedByClaude, OPEN_RUN_STATUSES, PHOTO_STEPS, photoProgress } from '@/domain/photo-steps';
import { parsePhotoSettings, type PhotoSettingsValues } from '@/domain/photo-settings';
import { loadPhotoSettings } from './photo-settings';

// La cola de la línea de imágenes. Cada foto avanza de a un paso: el
// trabajador toma un intento, hace sus ajustes de corrido y entrega el
// resultado, y una persona lo aprueba o lo rehace. Recibe la base por parámetro
// para poder probarlo con una base de prueba.
//
// Las reglas que cuidan que nada se pise:
// - Hay un solo intento abierto por foto (openFor, único).
// - Tomar es una sola consulta con FOR UPDATE SKIP LOCKED: dos pedidos a la
//   vez nunca toman el mismo intento.
// - Cada vez que se toma, el turno sube. Un resultado con un turno viejo, de
//   una Mac que se despertó tarde, no se acepta.
// - Si el trabajador no avisa durante 15 minutos, el intento vuelve a la cola.
//   A los 3 intentos queda fallido, con el motivo.

export const LEASE_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
// Cada cuánto vuelve a preguntar el trabajador: sin trabajo y con trabajo.
export const POLL_IDLE_S = 60;
export const POLL_BUSY_S = 5;
// Si alguien está trabajando en la línea, el próximo paso puede llegar en
// cualquier momento: hasta este rato después del último movimiento, el
// trabajador pregunta seguido.
const ACTIVE_MS = 30 * 60 * 1000;

export class PhotoQueueError extends Error {}

type Tx = Prisma.TransactionClient;

async function lockEdit(tx: Tx, editId: string) {
  await tx.$queryRaw`SELECT id FROM photo_edits WHERE id = ${editId} FOR UPDATE`;
}

async function settingsFor(tx: Tx, editId: string): Promise<PhotoSettingsValues> {
  const edit = await tx.photoEdit.findUniqueOrThrow({ where: { id: editId }, select: { product: { select: { accountId: true } } } });
  return loadPhotoSettings(tx, edit.product.accountId);
}

// Lo pedido al rehacer, con las propuestas que había hecho Claude: el
// trabajador no le vuelve a preguntar, y la explicación queda a la vista.
type StoredRequest = StepRequest & { propuestas: Record<string, StepProposal> };

/** Pone en cola un paso de una foto, con la indicación puntual de la corrida, si hay. Quien llama ya bloqueó la foto. */
async function queueStep(tx: Tx, editId: string, step: number, requested: StoredRequest | null = null, note: string | null = null) {
  return tx.photoStepRun.create({
    data: {
      editId,
      step,
      status: 'QUEUED',
      openFor: editId,
      note,
      requested: requested ? (requested as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      settings: (await settingsFor(tx, editId)) as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Las partes guardadas de un intento: lo que hizo el trabajador en cada ajuste. */
export function partsOf(raw: unknown): StepPart[] {
  return Array.isArray(raw) ? (raw as StepPart[]) : [];
}

function requestOf(raw: unknown): StoredRequest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Partial<StoredRequest>;
  return { valores: r.valores ?? {}, apagados: r.apagados ?? [], propuestas: r.propuestas ?? {} };
}

/** Arranca la línea de una foto nueva: el primer paso en cola. */
export async function startPhoto(tx: Tx, editId: string) {
  return queueStep(tx, editId, 0);
}

// ───────────────────────────── El trabajador ─────────────────────────────

// De qué intento, de qué foto y de qué producto son los archivos.
export type RunFiles = { productId: string; editId: string; runId: string; originalName: string };

export type JobDeps = {
  // Con qué versión de mensajes habla el trabajador: decide qué puede subir.
  protocol: PhotoProtocol;
  download: (edit: { id: string; originalUrl: string }) => Promise<Transfer>;
  uploads: (run: RunFiles, kinds: UploadKind[]) => Promise<Partial<Record<UploadKind, Transfer>>>;
};

/**
 * Le da al trabajador el próximo paso para procesar, o null. Primero lo que
 * ese trabajador ya tenía tomado, por si se reinició, y después lo más viejo
 * de la cola.
 */
export async function claimNext(db: PrismaClient, workerId: string, now = new Date()): Promise<{ runId: string } | null> {
  return db.$transaction(async (tx) => {
    for (;;) {
      const rows = await tx.$queryRaw<{ id: string; attempts: number }[]>`
        SELECT r.id, r.attempts
        FROM photo_step_runs r
        JOIN photo_edits e ON e.id = r."editId"
        WHERE e."archivedAt" IS NULL AND NOT e."asIs"
          AND (r.status = 'QUEUED'
            OR (r.status = 'PROCESSING' AND (r."leaseUntil" < ${now} OR r."workerId" = ${workerId})))
        ORDER BY (r.status = 'PROCESSING' AND r."workerId" = ${workerId}) DESC, r."createdAt" ASC
        LIMIT 1
        FOR UPDATE OF r SKIP LOCKED`;
      const row = rows[0];
      if (!row) return null;
      if (row.attempts >= MAX_ATTEMPTS) {
        await tx.photoStepRun.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            leaseUntil: null,
            workerId: null,
            error: `El trabajador empezó este paso ${MAX_ATTEMPTS} veces y no lo terminó. Puede que la Mac se haya apagado o quedado sin memoria.`,
          },
        });
        continue;
      }
      await tx.photoStepRun.update({
        where: { id: row.id },
        data: {
          status: 'PROCESSING',
          workerId,
          lease: { increment: 1 },
          attempts: { increment: 1 },
          leaseUntil: new Date(now.getTime() + LEASE_MS),
        },
      });
      return { runId: row.id };
    }
  });
}

/** Cuándo volver a preguntar si no hubo trabajo: pronto si alguien está trabajando en la línea. */
export async function idlePollSeconds(db: PrismaClient, now = new Date()): Promise<number> {
  const recent = await db.photoStepRun.count({ where: { updatedAt: { gt: new Date(now.getTime() - ACTIVE_MS) } } });
  return recent > 0 ? POLL_BUSY_S : POLL_IDLE_S;
}

/** Arma el pedido completo para el trabajador: qué hacer, la receta anterior y los permisos para bajar y subir. */
export async function buildJob(db: PrismaClient, runId: string, deps: JobDeps): Promise<Job> {
  const run = await db.photoStepRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      edit: {
        include: {
          product: { select: { id: true, name: true, productType: true } },
          shootStep: { select: { title: true, editorNotes: true } },
          runs: { where: { status: { in: ['APPROVED', 'SKIPPED'] } }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  const { edit } = run;
  // Lo aprobado o salteado antes de este paso: uno por paso, el último. Un
  // paso salteado no aplicó ningún ajuste.
  const byStep = new Map<number, (typeof edit.runs)[number]>();
  for (const r of edit.runs) if (r.step < run.step) byStep.set(r.step, r);
  const receta: RecipeEntry[] = [...byStep.values()]
    .sort((a, b) => a.step - b.step)
    .map((r) => ({
      id: r.id,
      grupo: PHOTO_STEPS[r.step].key,
      indice: r.step,
      partes: r.status === 'SKIPPED' ? [] : partsOf(r.parts).map((p) => ({ paso: p.paso, valores: p.valores, aplicado: p.aplicado })),
      ajustes: parsePhotoSettings(r.settings),
    }));

  const step = PHOTO_STEPS[run.step];
  const kinds: UploadKind[] = ['vista'];
  if (run.step === 0) kinds.push('antes');
  if (step.parts.includes('fondo')) kinds.push('mascara');
  if (step.parts.includes('exportar')) kinds.push('png', 'jpg');
  if (deps.protocol >= LIVE_PROTOCOL && step.parts.some((p) => LIVE_PARTS.includes(p))) kinds.push('vivo');
  const subidas = await deps.uploads({ productId: edit.productId, editId: edit.id, runId: run.id, originalName: edit.originalName }, kinds);
  const product = [edit.product.productType, edit.product.name].filter(Boolean).join(': ') || null;
  const request = requestOf(run.requested);
  // Lo que se le indica a Claude: el paso del protocolo con que se sacó, con sus indicaciones, y lo puntual de esta corrida.
  const guidance: PhotoGuidance = {
    foto_del_protocolo: edit.shootStep ? { titulo: edit.shootStep.title, indicaciones: edit.shootStep.editorNotes.trim() || null } : null,
    indicacion: run.note?.trim() || null,
  };

  return {
    id: run.id,
    turno: run.lease,
    foto: edit.id,
    grupo: step.key,
    indice: run.step,
    // Un trabajador sin actualizar no recibe los ajustes que todavía no sabe hacer.
    pasos: step.parts.filter((p) => (PART_PROTOCOL[p] ?? 2) <= deps.protocol),
    // Un trabajador que no conoce las indicaciones las lee junto a lo que es la pieza.
    producto: deps.protocol >= GUIDANCE_PROTOCOL ? product : productWithGuidance(product, guidance),
    ...guidance,
    ajustes: parsePhotoSettings(run.settings),
    pedidos: request ? { valores: request.valores, apagados: request.apagados } : null,
    original: { nombre: edit.originalName, tipo: edit.originalType, bajar: await deps.download(edit) },
    lado_minimo: await minPhotoSide(db, edit.productId),
    receta,
    subidas,
  };
}

/** El lado más chico que piden los canales donde está el producto, el más exigente; null si ninguno lo pide. */
export async function minPhotoSide(db: PrismaClient, productId: string): Promise<number | null> {
  const pubs = await db.publication.findMany({ where: { productId }, select: { store: { select: { channel: { select: { kind: true, name: true } } } } } });
  const sides = pubs.map((p) => getChannelAdapter(p.store.channel.kind, p.store.channel.name).photos?.minSide ?? null).filter((s): s is number => s !== null);
  return sides.length > 0 ? Math.max(...sides) : null;
}

/** No se pudo armar el trabajo, por ejemplo porque el Drive no respondió: vuelve a la cola sin contar el intento. */
export async function releaseClaim(db: PrismaClient, runId: string, workerId: string): Promise<void> {
  await db.photoStepRun.updateMany({
    where: { id: runId, status: 'PROCESSING', workerId },
    data: { status: 'QUEUED', workerId: null, leaseUntil: null, attempts: { decrement: 1 } },
  });
}

/** El trabajador avisa que sigue con este paso. Si ya no es suyo, se lo dice. */
export async function heartbeat(db: PrismaClient, workerId: string, runId: string, lease: number, now = new Date()): Promise<boolean> {
  const r = await db.photoStepRun.updateMany({
    where: { id: runId, status: 'PROCESSING', workerId, lease },
    data: { leaseUntil: new Date(now.getTime() + LEASE_MS) },
  });
  return r.count > 0;
}

// Los archivos que subió el trabajador para un intento, por tipo.
export type Collect = (run: RunFiles) => Promise<Partial<Record<UploadKind, string>>>;

export type SubmitOutcome = { aceptado: true } | { aceptado: false; motivo: string };

const STALE = 'Este paso ya no es de este intento: se rehízo, se sacó la foto o lo tomó otro intento.';

/** Recibe el resultado del trabajador, comprueba que los archivos estén y deja el paso para revisar. */
export async function submitResult(
  db: PrismaClient,
  workerId: string,
  done: WorkerDone,
  deps: { collect: Collect },
): Promise<SubmitOutcome> {
  const run = await db.photoStepRun.findUnique({ where: { id: done.id }, include: { edit: { select: { productId: true, originalName: true } } } });
  if (!run || run.status !== 'PROCESSING' || run.lease !== done.turno || run.workerId !== workerId) {
    return { aceptado: false, motivo: STALE };
  }
  const step = PHOTO_STEPS[run.step];
  const needed = new Set<UploadKind>(['vista']);
  if (run.step === 0) needed.add('antes');
  if (step.parts.includes('exportar')) {
    needed.add('png');
    needed.add('jpg');
  }
  const found = await deps.collect({ productId: run.edit.productId, editId: run.editId, runId: run.id, originalName: run.edit.originalName });
  const urls: Partial<Record<UploadKind, string>> = {};
  for (const kind of new Set([...needed, ...done.archivos])) {
    const ref = found[kind];
    if (!ref) return { aceptado: false, motivo: `Falta subir el archivo «${kind}».` };
    urls[kind] = ref;
  }

  return db.$transaction(async (tx) => {
    await lockEdit(tx, run.editId);
    const fresh = await tx.photoStepRun.findUniqueOrThrow({ where: { id: run.id } });
    if (fresh.status !== 'PROCESSING' || fresh.lease !== done.turno) return { aceptado: false as const, motivo: STALE };
    // Al rehacer con valores, Claude no vuelve a proponer: queda su propuesta anterior.
    const before = requestOf(fresh.requested)?.propuestas ?? {};
    const parts = done.partes.map((p) => ({ ...p, propuesta: p.propuesta ?? before[p.paso] ?? null }));
    const cost = done.partes.reduce((sum, p) => sum + (typeof p.uso_claude?.costo_usd === 'number' ? p.uso_claude.costo_usd : 0), 0);
    await tx.photoStepRun.update({
      where: { id: run.id },
      data: {
        status: 'REVIEW',
        parts: parts as unknown as Prisma.InputJsonValue,
        previewUrl: urls.vista ?? null,
        maskUrl: urls.mascara ?? null,
        pngUrl: urls.png ?? null,
        jpgUrl: urls.jpg ?? null,
        liveUrl: urls.vivo ?? null,
        aiUsage: cost > 0 ? { costo_usd: Math.round(cost * 100000) / 100000 } : Prisma.DbNull,
        seconds: done.segundos,
        leaseUntil: null,
        error: null,
      },
    });
    if (run.step === 0) {
      await tx.photoEdit.update({
        where: { id: run.editId },
        data: {
          ...(urls.antes ? { previewUrl: urls.antes } : {}),
          ...(done.original
            ? {
                width: done.original.ancho,
                height: done.original.alto,
                camera: done.original.camara ? (done.original.camara as Prisma.InputJsonValue) : Prisma.DbNull,
              }
            : {}),
        },
      });
    }
    return { aceptado: true as const };
  });
}

/** El trabajador no pudo con el paso: vuelve a la cola, o queda fallido al tercer intento. */
export async function submitFailure(
  db: PrismaClient,
  workerId: string,
  args: { id: string; turno: number; error: string; definitivo?: boolean | null },
): Promise<SubmitOutcome> {
  const run = await db.photoStepRun.findUnique({ where: { id: args.id } });
  if (!run || run.status !== 'PROCESSING' || run.lease !== args.turno || run.workerId !== workerId) {
    return { aceptado: false, motivo: STALE };
  }
  // Un fallo definitivo, como un original chico para el canal, no se reintenta.
  const last = args.definitivo === true || run.attempts >= MAX_ATTEMPTS;
  const r = await db.photoStepRun.updateMany({
    where: { id: run.id, status: 'PROCESSING', lease: args.turno },
    data: { status: last ? 'FAILED' : 'QUEUED', workerId: null, leaseUntil: null, error: args.error.slice(0, 4000) },
  });
  return r.count > 0 ? { aceptado: true } : { aceptado: false, motivo: STALE };
}

// ───────────────────────────── Las decisiones de la persona ─────────────────────────────

async function openRun(tx: Tx, runId: string, allowed: PhotoRunStatus[], what: string) {
  const run = await tx.photoStepRun.findUnique({ where: { id: runId } });
  if (!run) throw new PhotoQueueError('Ese paso ya no existe.');
  await lockEdit(tx, run.editId);
  const fresh = await tx.photoStepRun.findUniqueOrThrow({ where: { id: runId }, include: { edit: { select: { archivedAt: true } } } });
  if (fresh.edit.archivedAt) throw new PhotoQueueError('Esa foto se sacó de la lista.');
  if (!allowed.includes(fresh.status)) throw new PhotoQueueError(`Este paso no se puede ${what} ahora: la pantalla estaba desactualizada.`);
  return fresh;
}

/** Aprueba el paso y pone en cola el siguiente. */
export async function approveStep(db: PrismaClient, args: { runId: string; userId: string | null }) {
  return db.$transaction(async (tx) => {
    const run = await openRun(tx, args.runId, ['REVIEW'], 'aprobar');
    await tx.photoStepRun.update({
      where: { id: run.id },
      data: { status: 'APPROVED', openFor: null, decidedById: args.userId, decidedAt: new Date() },
    });
    if (run.step < LAST_PHOTO_STEP) await queueStep(tx, run.editId, run.step + 1);
  });
}

/** Saltea el paso: la foto sigue como estaba. Sirve para un paso que falló. */
export async function skipStep(db: PrismaClient, args: { runId: string; userId: string | null }) {
  return db.$transaction(async (tx) => {
    const run = await openRun(tx, args.runId, ['REVIEW', 'FAILED'], 'saltear');
    await tx.photoStepRun.update({
      where: { id: run.id },
      data: { status: 'SKIPPED', openFor: null, decidedById: args.userId, decidedAt: new Date() },
    });
    if (run.step < LAST_PHOTO_STEP) await queueStep(tx, run.editId, run.step + 1);
  });
}

/** Revisa lo pedido contra los ajustes del paso y lo que acepta cada uno. */
export function checkRequested(step: number, parts: StepPart[], request: StepRequest): StoredRequest {
  const own = PHOTO_STEPS[step].parts;
  const apagados = [...new Set(request.apagados)].filter((k) => own.includes(k));
  // Sin exportar no hay foto final.
  if (apagados.includes('exportar')) throw new PhotoQueueError('Exportar no se puede apagar: es el que arma la foto final.');
  const valores: Record<string, Record<string, number>> = {};
  for (const part of parts) {
    const asked = request.valores[part.paso];
    if (!asked || apagados.includes(part.paso)) continue;
    const out: Record<string, number> = {};
    for (const p of part.parametros) {
      const v = asked[p.clave];
      if (v === undefined) continue;
      if (!Number.isFinite(v)) throw new PhotoQueueError(`${p.etiqueta}: tiene que ser un número.`);
      if (p.tipo === 'si_no') {
        out[p.clave] = v >= 0.5 ? 1 : 0;
        continue;
      }
      if (v < p.minimo || v > p.maximo) throw new PhotoQueueError(`${p.etiqueta}: va de ${p.minimo} a ${p.maximo}${p.unidad}.`);
      out[p.clave] = v;
    }
    if (part.parametros.length > 0) valores[part.paso] = out;
  }
  const propuestas = Object.fromEntries(parts.flatMap((p) => (p.propuesta ? [[p.paso, p.propuesta]] : [])));
  return { valores, apagados, propuestas };
}

/**
 * Rehace un paso, con los valores de la persona o pidiéndole a Claude otra
 * propuesta. Ese paso y los que venían después quedan reemplazados.
 */
export async function redoStep(db: PrismaClient, args: { runId: string; userId: string | null; request: StepRequest | null }) {
  return db.$transaction(async (tx) => {
    const run = await openRun(tx, args.runId, ['REVIEW', 'APPROVED', 'SKIPPED', 'FAILED'], 'rehacer');
    const requested = args.request ? checkRequested(run.step, partsOf(run.parts), args.request) : null;
    await tx.photoStepRun.updateMany({
      where: { editId: run.editId, step: { gte: run.step }, status: { not: 'REPLACED' } },
      data: { status: 'REPLACED', openFor: null },
    });
    return queueStep(tx, run.editId, run.step, requested, run.note);
  });
}

/** Vuelve a intentar un paso fallido, con lo mismo que se había pedido. */
export async function retryStep(db: PrismaClient, args: { runId: string; userId: string | null }) {
  return db.$transaction(async (tx) => {
    const failed = await openRun(tx, args.runId, ['FAILED'], 'reintentar');
    await tx.photoStepRun.update({ where: { id: failed.id }, data: { status: 'REPLACED', openFor: null } });
    return queueStep(tx, failed.editId, failed.step, requestOf(failed.requested), failed.note);
  });
}

/**
 * Procesa una foto de cero, como recién llegada: lo que había queda
 * reemplazado, también lo aprobado y lo que estaba en cola, y la Mac parte del
 * original con Claude proponiendo todos los ajustes. Se pierden los valores
 * cambiados a mano y el giro de 90°. Sirve cuando Claude no respondió o
 * corrigió mal: con note, Claude recibe esa indicación solo en esta corrida.
 */
export async function redoFromScratch(db: PrismaClient, args: { editId: string; note?: string | null }) {
  return db.$transaction(async (tx) => {
    await lockEdit(tx, args.editId);
    const edit = await tx.photoEdit.findUniqueOrThrow({ where: { id: args.editId }, select: { archivedAt: true, asIs: true } });
    if (edit.archivedAt) throw new PhotoQueueError('Esa foto se sacó de la lista.');
    if (edit.asIs) throw new PhotoQueueError('Esa foto se usa tal cual: no pasa por la Mac.');
    await tx.photoStepRun.updateMany({
      where: { editId: args.editId, status: { not: 'REPLACED' } },
      data: { status: 'REPLACED', openFor: null, workerId: null, leaseUntil: null },
    });
    return queueStep(tx, args.editId, 0, null, args.note ?? null);
  });
}

/**
 * Las fotos de un producto en que Claude no respondió en algún ajuste, y que
 * la Mac no está procesando: las que se pueden procesar de cero.
 */
export async function unansweredPhotos(db: PrismaClient | Tx, productId: string): Promise<string[]> {
  const edits = await db.photoEdit.findMany({
    where: { productId, archivedAt: null, asIs: false },
    // En el orden de la lista, así la Mac las hace en ese orden.
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, asIs: true, runs: { select: { step: true, status: true, createdAt: true, parts: true } } },
  });
  return edits.filter(missedByClaude).map((e) => e.id);
}

/**
 * Usa el original tal cual, porque ya viene editado: la Mac no lo procesa y
 * Claude no lo mira. Lo que estaba en la cola o esperando aprobación se corta.
 * Al volver a corregirla, si ya tenía una corrección aprobada vale esa; si no,
 * arranca su línea.
 */
export async function setAsIs(db: PrismaClient, args: { editId: string; asIs: boolean }) {
  return db.$transaction(async (tx) => {
    await lockEdit(tx, args.editId);
    const edit = await tx.photoEdit.findUniqueOrThrow({
      where: { id: args.editId },
      select: { archivedAt: true, asIs: true, runs: { select: { step: true, status: true } } },
    });
    if (edit.archivedAt) throw new PhotoQueueError('Esa foto se sacó de la lista.');
    if (edit.asIs === args.asIs) return;
    if (args.asIs) {
      await tx.photoStepRun.updateMany({
        where: { editId: args.editId, status: { in: OPEN_RUN_STATUSES } },
        data: { status: 'REPLACED', openFor: null, workerId: null, leaseUntil: null },
      });
    } else if (photoProgress(edit.runs).kind === 'empty') {
      await startPhoto(tx, args.editId);
    }
    await tx.photoEdit.update({ where: { id: args.editId }, data: { asIs: args.asIs } });
  });
}

/** Saca la foto de la lista. El original queda guardado. */
export async function archivePhoto(db: PrismaClient, editId: string) {
  return db.$transaction(async (tx) => {
    await lockEdit(tx, editId);
    await tx.photoStepRun.updateMany({
      where: { editId, status: { in: OPEN_RUN_STATUSES } },
      data: { status: 'REPLACED', openFor: null },
    });
    await tx.photoEdit.update({ where: { id: editId }, data: { archivedAt: new Date() } });
  });
}
