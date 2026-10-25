import Papa from 'papaparse';
import type { ActivityKind, ActivitySource } from '@/generated/prisma/enums';
import { isSection, sectionLabel, TEAM_SECTION } from './access';
import { dayStartIn } from './sync-log';

// La actividad de cada persona: los filtros de la pantalla y la planilla. Sin
// la base de datos, para poder probarlo solo.

export type ActivitySearch = { persona?: string; cuenta?: string; seccion?: string; tipo?: string; desde?: string; hasta?: string; page?: string };

export const ACTIVITY_TYPES = [
  { value: 'cambios', label: 'Cambios', kinds: ['CHANGE'] },
  { value: 'ingresos', label: 'Entradas y salidas', kinds: ['SIGN_IN', 'SIGN_OUT'] },
  { value: 'fallidos', label: 'Entradas fallidas', kinds: ['SIGN_IN_FAILED'] },
] as const satisfies readonly { value: string; label: string; kinds: readonly ActivityKind[] }[];

export type ActivityType = (typeof ACTIVITY_TYPES)[number]['value'];

export const ACTIVITY_PAGE_SIZE = 50;
const MAX_PAGE = 200;

const list = (raw: string | undefined) => (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const isId = (s: string) => /^[\w-]{1,40}$/.test(s);
const isDay = (raw: string | undefined): raw is string => /^\d{4}-\d{2}-\d{2}$/.test(raw ?? '') && dayStartIn(raw!, 'UTC') !== null;

export function parseActivitySearch(search: ActivitySearch) {
  const page = Number.parseInt(search.page ?? '', 10);
  const types = new Set<string>(ACTIVITY_TYPES.map((t) => t.value));
  return {
    people: list(search.persona).filter(isId).slice(0, 50),
    accounts: list(search.cuenta).filter(isId).slice(0, 50),
    sections: list(search.seccion).filter((s) => isSection(s) || s === TEAM_SECTION),
    types: list(search.tipo).filter((t): t is ActivityType => types.has(t)),
    from: isDay(search.desde) ? search.desde : null,
    to: isDay(search.hasta) ? search.hasta : null,
    page: Number.isFinite(page) && page > 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

export type ActivityFilters = ReturnType<typeof parseActivitySearch>;

export function isActivityFiltered(f: ActivityFilters): boolean {
  return Boolean(f.people.length || f.accounts.length || f.sections.length || f.types.length || f.from || f.to);
}

/** Los tipos de entrada que piden los filtros. Vacío: todos. */
export function kindsOf(types: ActivityType[]): ActivityKind[] {
  return ACTIVITY_TYPES.filter((t) => types.includes(t.value)).flatMap((t) => [...t.kinds]);
}

export const VIA_LABEL: Record<ActivitySource, string> = { APP: 'La app', CLAUDE: 'Claude' };

export type ActivityRow = {
  createdAt: Date;
  kind: ActivityKind;
  summary: string;
  section: string | null;
  person: string;
  account: string | null;
  target: string | null;
  detail: string | null;
  via: ActivitySource;
};

// ───────────────────────────── Planilla ─────────────────────────────

export const ACTIVITY_COLUMNS = ['Fecha', 'Persona', 'Qué hizo', 'Sección', 'Cuenta', 'Sobre qué', 'Dato', 'Desde'];

function stamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** El CSV, con la marca de UTF-8 para que Excel y Google Sheets muestren bien los acentos. */
export function buildActivitySheet(rows: ActivityRow[], timeZone: string): string {
  const data = rows.map((r) => [
    stamp(r.createdAt, timeZone),
    r.person,
    r.summary,
    sectionLabel(r.section),
    r.account ?? '',
    r.target ?? '',
    r.detail ?? '',
    VIA_LABEL[r.via],
  ]);
  const csv = Papa.unparse({ fields: ACTIVITY_COLUMNS, data }, { newline: '\r\n', quotes: true });
  return `﻿${csv}\r\n`;
}

export function activitySheetFileName(date: string): string {
  return `actividad-${date}.csv`;
}
