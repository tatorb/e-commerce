import Papa from 'papaparse';
import type { SyncChangeKind, SyncStatus, SyncTrigger } from '@/generated/prisma/enums';
import { attributeDiff, FACE_FIELD_LABEL, isFaceField, SYNC_CHANGE_LABEL } from './channel-sync';
import { parseMedia, type PhotoRef } from './media';
import { parseNameValueList, type NameValue } from './name-value';

// El Registro: todo lo que pasó entre la app y el canal, publicación por
// publicación y dato por dato, con el antes y el después y, si no se pudo, el
// motivo. También las lecturas del canal. Los filtros y cómo se cuenta cada
// cosa, sin la base de datos, para poder probarlos solos.

export type LogSearch = {
  q?: string;
  publicacion?: string;
  tipo?: string;
  persona?: string;
  desde?: string;
  hasta?: string;
  page?: string;
};

export const LOG_TYPES = [
  { value: 'bajadas', label: 'Llegó del canal', kinds: ['TAKEN'] },
  { value: 'subidas', label: 'Se subió', kinds: ['SENT'] },
  { value: 'creadas', label: 'Se creó en el canal', kinds: ['CREATED'] },
  { value: 'fallidas', label: 'No se pudo', kinds: ['REJECTED', 'CREATE_FAILED'] },
  { value: 'elecciones', label: 'Se eligió', kinds: ['CHOSE_CHANNEL', 'CHOSE_APP'] },
  { value: 'descartes', label: 'Se descartó', kinds: ['DISCARDED'] },
  { value: 'lecturas', label: 'Lecturas del canal', kinds: [] },
] as const satisfies readonly { value: string; label: string; kinds: readonly SyncChangeKind[] }[];

export type LogType = (typeof LOG_TYPES)[number]['value'];

// Lo que hizo la app sola: lo que llegó del canal y las lecturas programadas.
export const AUTOMATIC = 'auto';

export const LOG_PAGE_SIZE = 50;
export const LOG_MAX_PAGE = 100;

export type LogFilters = {
  q: string;
  publicationId: string | null;
  types: LogType[];
  people: string[];
  // Días en la zona horaria de la cuenta, como 2026-10-21.
  from: string | null;
  to: string | null;
  page: number;
};

const list = (raw: string | undefined) => (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const isDay = (raw: string | undefined): raw is string => /^\d{4}-\d{2}-\d{2}$/.test(raw ?? '') && dayStartIn(raw!, 'UTC') !== null;

export function parseLogSearch(search: LogSearch): LogFilters {
  const types = new Set(LOG_TYPES.map((t) => t.value as string));
  const page = Number.parseInt(search.page ?? '', 10);
  return {
    q: (search.q ?? '').trim().slice(0, 100),
    publicationId: search.publicacion && /^[\w-]{1,40}$/.test(search.publicacion) ? search.publicacion : null,
    types: list(search.tipo).filter((t): t is LogType => types.has(t)),
    people: list(search.persona).filter((p) => /^[\w-]{1,40}$/.test(p)).slice(0, 50),
    from: isDay(search.desde) ? search.desde : null,
    to: isDay(search.hasta) ? search.hasta : null,
    page: Number.isFinite(page) && page > 1 ? Math.min(page, LOG_MAX_PAGE) : 1,
  };
}

export function isLogFiltered(f: LogFilters): boolean {
  return Boolean(f.q || f.publicationId || f.types.length || f.people.length || f.from || f.to);
}

/** Qué cambios se muestran. Null: todos. */
export function logKinds(f: LogFilters): SyncChangeKind[] | null {
  if (f.types.length === 0) return null;
  return LOG_TYPES.filter((t) => f.types.includes(t.value)).flatMap((t) => [...t.kinds]);
}

/**
 * Qué lecturas se muestran. Sin elegir tipo, solo las que no terminaron o
 * tuvieron avisos, para que las de cada hora no tapen lo demás. Las lecturas
 * son de la tienda, no de una publicación.
 */
export function logReads(f: LogFilters): 'none' | 'problems' | 'all' {
  if (f.q || f.publicationId) return 'none';
  if (f.types.length === 0) return 'problems';
  if (f.types.includes('lecturas')) return 'all';
  return f.types.includes('fallidas') ? 'problems' : 'none';
}

function offsetMs(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return local - Math.floor(at.getTime() / 1000) * 1000;
}

/** El momento en que empieza ese día en la zona horaria, o null si no es un día. */
export function dayStartIn(day: string, timeZone: string): Date | null {
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const check = new Date(guess);
  if (check.getUTCFullYear() !== +m[1] || check.getUTCMonth() !== +m[2] - 1 || check.getUTCDate() !== +m[3]) return null;
  // Dos vueltas por si ese día cambia la hora.
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** Desde el comienzo de un día hasta el comienzo del siguiente al último. */
export function dayRange(f: Pick<LogFilters, 'from' | 'to'>, timeZone: string): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  if (f.from) range.gte = dayStartIn(f.from, timeZone) ?? undefined;
  if (f.to) {
    const [y, m, d] = f.to.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    range.lt = dayStartIn(next, timeZone) ?? undefined;
  }
  return range;
}

// ───────────────────────────── Cómo se cuenta cada cosa ─────────────────────────────

export function fieldLabel(field: string): string {
  return isFaceField(field) ? FACE_FIELD_LABEL[field] : field === 'publication' ? 'Publicación' : field;
}

export function kindLabel(kind: SyncChangeKind): string {
  const label: string = SYNC_CHANGE_LABEL[kind];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const FAILED_KINDS: readonly SyncChangeKind[] = ['REJECTED', 'CREATE_FAILED'];

// Qué es el antes y qué el después en cada caso.
export const SIDE_LABELS: Record<SyncChangeKind, [string, string]> = {
  TAKEN: ['Tenía la app', 'Llegó del canal'],
  CHOSE_CHANNEL: ['Tenía la app', 'Quedó lo del canal'],
  CHOSE_APP: ['Tenía la app', 'Quedó lo de la app, para subir'],
  SENT: ['Estaba en el canal', 'Se subió'],
  DISCARDED: ['Borrador descartado', 'Volvió lo del canal'],
  CREATED: ['', 'Código en el canal'],
  REJECTED: ['Estaba en el canal', 'Se quiso subir'],
  CREATE_FAILED: ['', ''],
};

function photoSummary(refs: PhotoRef[]): string {
  if (refs.length === 0) return 'Sin fotos';
  const by = (kind: PhotoRef['kind']) => refs.filter((r) => r.kind === kind).length;
  const parts = [
    [by('channel'), 'del canal', 'del canal'],
    [by('edit'), 'corregida', 'corregidas'],
    [by('asset'), 'del producto', 'del producto'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  const total = refs.length === 1 ? '1 foto' : `${refs.length} fotos`;
  return parts.length > 1 ? `${total}: ${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : `${total} ${parts[0].replace(/^\d+ /, '')}`;
}

const lines = (list: NameValue[]) => list.map((a) => `${a.name}: ${a.value}`).join('\n');

/**
 * El antes y el después en texto. De los datos de catálogo, solo los que no
 * coinciden; de las fotos, cuántas y de dónde salen.
 */
export function changeSides(field: string, before: unknown, after: unknown): { before: string; after: string } {
  if (field === 'attributes') {
    const diff = attributeDiff(parseNameValueList(after), parseNameValueList(before));
    return {
      before: lines([...diff.changed.map((c) => ({ name: c.name, value: c.from })), ...diff.removed]),
      after: lines([...diff.changed.map((c) => ({ name: c.name, value: c.to })), ...diff.added]),
    };
  }
  if (field === 'photos') {
    const a = parseMedia(before);
    const b = parseMedia(after);
    return { before: a ? photoSummary(a) : '', after: b ? photoSummary(b) : 'Las del canal' };
  }
  if (field === 'publication') {
    const code = after && typeof after === 'object' && 'externalId' in after ? String((after as { externalId: unknown }).externalId) : '';
    return { before: '', after: code };
  }
  return { before: typeof before === 'string' ? before.trim() : '', after: typeof after === 'string' ? after.trim() : '' };
}

export type LogChange = {
  type: 'change';
  key: string;
  at: Date;
  kind: SyncChangeKind;
  field: string;
  before: unknown;
  after: unknown;
  message: string | null;
  user: string | null;
  publication: { id: string; title: string | null; externalId: string | null; storeName: string };
};

export type LogRead = {
  type: 'read';
  key: string;
  at: Date;
  finishedAt: Date | null;
  status: SyncStatus;
  trigger: SyncTrigger;
  user: string | null;
  storeName: string;
  read: number;
  total: number;
  updated: number;
  missing: number;
  errors: { at: string; message: string }[];
};

export type LogEntry = LogChange | LogRead;

/** Junta los cambios y las lecturas, lo más nuevo primero. */
export function mergeLog(changes: LogChange[], reads: LogRead[]): LogEntry[] {
  return [...changes, ...reads].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function readLabel(r: Pick<LogRead, 'status' | 'errors'>): string {
  if (r.status === 'RUNNING') return 'Lectura en curso';
  if (r.status === 'FAILED') return 'Lectura que no terminó';
  return r.errors.length > 0 ? 'Lectura con avisos' : 'Lectura del canal';
}

export function readSummary(r: LogRead): string {
  const parts = [`Leyó ${r.read} de ${r.total}`];
  if (r.updated > 0) parts.push(`con cambios en ${r.updated}`);
  if (r.missing > 0) parts.push(`${r.missing} no ${r.missing === 1 ? 'apareció' : 'aparecieron'} en el canal`);
  return `${parts.join(', ')}.`;
}

export function personOf(e: LogEntry): string {
  if (e.user) return e.user;
  if (e.type === 'read') return e.trigger === 'SCHEDULE' ? 'Automático' : 'Alguien del equipo';
  return e.kind === 'TAKEN' ? 'Automático' : 'Alguien del equipo';
}

// ───────────────────────────── Planilla ─────────────────────────────

export const LOG_COLUMNS = ['Fecha', 'Qué pasó', 'Publicación', 'Código', 'Tienda', 'Dato', 'Persona', 'Motivo', 'Antes', 'Después'];

function stamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function cellsFor(e: LogEntry, timeZone: string): string[] {
  if (e.type === 'read') {
    return [stamp(e.at, timeZone), readLabel(e), '', '', e.storeName, readSummary(e), personOf(e), e.errors.map((x) => x.message).join('\n'), '', ''];
  }
  const sides = changeSides(e.field, e.before, e.after);
  return [
    stamp(e.at, timeZone),
    kindLabel(e.kind),
    e.publication.title ?? '',
    e.publication.externalId ?? '',
    e.publication.storeName,
    fieldLabel(e.field),
    personOf(e),
    e.message ?? '',
    sides.before,
    sides.after,
  ];
}

/** El CSV, con la marca de UTF-8 para que Excel y Google Sheets muestren bien los acentos. */
export function buildLogSheet(entries: LogEntry[], timeZone: string): string {
  const csv = Papa.unparse({ fields: LOG_COLUMNS, data: entries.map((e) => cellsFor(e, timeZone)) }, { newline: '\r\n', quotes: true });
  return `﻿${csv}\r\n`;
}

export function logSheetFileName(accountSlug: string, date: string): string {
  return `registro-${accountSlug}-${date}.csv`;
}
