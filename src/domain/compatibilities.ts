import { parseEngine } from './engine';

// Las compatibilidades de la ficha llevadas al catálogo de vehículos del canal,
// y la comparación con lo que el canal tiene cargado. Acá van solo las reglas:
// las listas del catálogo (marcas, modelos, años...) las trae cada canal.
//
// Las reglas:
// - Se respetan los años desde y hasta de la ficha. Sin años, todos los del modelo.
// - Siempre se filtra por combustible: hay versiones diésel con la misma
//   cilindrada y potencia que la nafta.
// - Con potencia (por ejemplo "115 cv") se filtra por potencia, y las versiones
//   que no van (por ejemplo "THP") se dejan afuera.
// - Lo que no se puede traducir con seguridad queda "a revisar": no se inventa.

/** Una compatibilidad de la ficha, como está guardada. */
export type FichaCompatibility = {
  vehicleBrand: string | null;
  model: string | null;
  engine: string | null;
  displacement: string | null;
  fuel: string | null;
  power: string | null;
  excludedVersions: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  note: string | null;
};

export type Fuel = 'diesel' | 'nafta' | 'gnc' | 'hibrido' | 'electrico';

export const FUEL_LABEL: Record<Fuel, string> = { diesel: 'diésel', nafta: 'nafta', gnc: 'GNC', hibrido: 'híbrido', electrico: 'eléctrico' };

/** Una línea de la ficha lista para buscarla en el catálogo. */
export type LineRule = {
  index: number;
  // Cómo se lee la línea, por ejemplo "Peugeot 308 1.6 HDi diésel 115 cv 2012 a 2019".
  label: string;
  brand: string | null;
  models: string[];
  fuel: Fuel | null;
  displacement: string | null;
  power: number | null;
  exclude: string[];
  from: number | null;
  to: number | null;
  note: string | null;
};

/** Sin mayúsculas, acentos ni signos, para comparar nombres. */
export function norm(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Si el texto tiene esas palabras juntas, sin cortar otra: "308" está en "peugeot 308 1.6" pero no en "3008". */
export function hasWords(text: string, words: string): boolean {
  const t = ` ${norm(text)} `;
  const w = norm(words);
  return w !== '' && t.includes(` ${w} `);
}

const FUELS: [RegExp, Fuel][] = [
  [/\b(diesel|gasoil|gas oil|td|tdi|tdci|hdi|jtd|jtdm|dci|crdi|cdi|d4d|tddi|bluehdi|multijet)\b/, 'diesel'],
  [/\b(hibrido|hybrid|hibrida)\b/, 'hibrido'],
  [/\b(electrico|electric|electrica)\b/, 'electrico'],
  [/\bgnc\b/, 'gnc'],
  [/\b(nafta|gasolina|naftero)\b/, 'nafta'],
];

/** El combustible de un texto, por ejemplo "Diésel" o "1.6 HDi". Null si no lo dice. */
export function fuelOf(text: string | null | undefined): Fuel | null {
  const t = norm(text);
  return FUELS.find(([re]) => re.test(t))?.[1] ?? null;
}

/** La potencia de un texto, en cv: "115 cv", "115cv", "115 hp". Null si no la dice. */
export function powerOf(text: string | null | undefined): number | null {
  const m = norm(text).match(/\b(\d{2,3})\s?(cv|hp|ps)\b/);
  return m ? Number(m[1]) : null;
}

/** La cilindrada de un texto, por ejemplo "1.6" de "1.6 HDi" o de "1,6". Null si no la dice. */
export function displacementOf(text: string | null | undefined): string | null {
  return parseEngine((text ?? '').replace(/(\d),(\d)/g, '$1.$2')).displacement;
}

/** Las versiones que no van: del campo de la ficha, o de la nota ("no THP", "excepto VTi"). */
export function excludedOf(c: Pick<FichaCompatibility, 'excludedVersions' | 'note'>): string[] {
  const out: string[] = [];
  const add = (v: string) => {
    const w = v.trim();
    if (w && !out.some((x) => norm(x) === norm(w))) out.push(w);
  };
  for (const v of (c.excludedVersions ?? '').split(/[,;/]|\by\b/)) add(v);
  for (const m of (c.note ?? '').matchAll(/\b(?:no|excepto|salvo|menos)\s+([A-Za-z0-9][\w.-]*)/gi)) {
    // "no sirve", "no es": palabras comunes, no versiones.
    const word = m[1].replace(/\.+$/, '');
    if (!/^(sirve|es|va|incluye|trae|tiene|para|el|la|los|las|con|de)$/i.test(word)) add(word);
  }
  return out;
}

const yearsText = (from: number | null, to: number | null) =>
  from && to ? (from === to ? `${from}` : `${from} a ${to}`) : from ? `desde ${from}` : to ? `hasta ${to}` : 'todos los años';

/** Una línea de la ficha lista para buscarla: sus datos ya normalizados. */
export function lineRule(c: FichaCompatibility, index: number): LineRule {
  const engine = parseEngine(c.engine);
  const fuel = fuelOf(c.fuel) ?? fuelOf(c.engine) ?? (engine.fuel ? fuelOf(engine.fuel) : null);
  const displacement = displacementOf(c.displacement) ?? displacementOf(c.engine);
  const power = powerOf(c.power) ?? (c.power && /^\d{2,3}$/.test(c.power.trim()) ? Number(c.power.trim()) : null) ?? powerOf(c.engine) ?? powerOf(c.note);
  const models = (c.model ?? '')
    .split(/\s*[/,]\s*/)
    .map((m) => m.trim())
    .filter(Boolean);
  const exclude = excludedOf(c);
  const label = [
    c.vehicleBrand,
    c.model,
    c.engine,
    fuel ? FUEL_LABEL[fuel] : null,
    power ? `${power} cv` : null,
    yearsText(c.yearFrom, c.yearTo),
    exclude.length > 0 ? `sin ${exclude.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    index,
    label,
    brand: c.vehicleBrand?.trim() || null,
    models,
    fuel,
    displacement,
    power,
    exclude,
    from: c.yearFrom,
    to: c.yearTo,
    note: c.note?.trim() || null,
  };
}

// ───────────────────────────── Elegir de las listas del catálogo ─────────────────────────────

type Named = { id: string; name: string };

// Marcas que se escriben de otra forma.
const BRAND_ALIASES: Record<string, string> = {
  vw: 'volkswagen',
  'mercedes benz': 'mercedes benz',
  mercedes: 'mercedes benz',
  'mb': 'mercedes benz',
  chevy: 'chevrolet',
  gm: 'chevrolet',
};

const compact = (s: string) => norm(s).replace(/[\s.-]+/g, '');

/** El valor de la lista con ese nombre, sin importar mayúsculas, acentos, espacios ni guiones. */
export function pickByName<T extends Named>(list: T[], wanted: string, opts: { brand?: boolean } = {}): T | null {
  const w = norm(wanted);
  const target = opts.brand ? (BRAND_ALIASES[w] ?? w) : w;
  return list.find((v) => norm(v.name) === target) ?? list.find((v) => compact(v.name) === compact(target)) ?? null;
}

/** Los valores de la lista que se parecen, para mostrarlos cuando no hay uno igual. */
export function similar<T extends Named>(list: T[], wanted: string, max = 5): T[] {
  const w = compact(wanted);
  if (!w) return [];
  return list.filter((v) => compact(v.name).includes(w) || w.includes(compact(v.name))).slice(0, max);
}

/** Los combustibles de la lista que son ese combustible. */
export function pickFuel<T extends Named>(list: T[], fuel: Fuel): T[] {
  return list.filter((v) => fuelOf(v.name) === fuel);
}

/** Los motores de la lista con esa cilindrada. */
export function pickDisplacement<T extends Named>(list: T[], displacement: string): T[] {
  return list.filter((v) => displacementOf(v.name) === displacement);
}

/** Las potencias de la lista que son esa potencia. Acepta "115 cv", "115 hp" o "115". */
export function pickPower<T extends Named>(list: T[], power: number): T[] {
  return list.filter((v) => (powerOf(v.name) ?? (/^\d{2,3}$/.test(v.name.trim()) ? Number(v.name.trim()) : null)) === power);
}

/** Los años de la lista dentro de desde y hasta. Sin desde ni hasta, todos. */
export function pickYears<T extends Named>(list: T[], from: number | null, to: number | null): (T & { year: number })[] {
  return list
    .map((v) => ({ ...v, year: Number(v.name.trim()) }))
    .filter((v) => Number.isInteger(v.year) && v.year > 1900 && (from === null || v.year >= from) && (to === null || v.year <= to))
    .sort((a, b) => a.year - b.year);
}

// "S/aa" y "C/aa" son sin y con aire acondicionado: su "s" o su "c" no es una versión.
const AIR = /\b[sc]\s*\/\s*a\.?(?:\s*a\.?)?(?![a-z])/gi;

/** La palabra de las que no van que tiene el nombre, o undefined si no tiene ninguna. */
export function excludedWordIn(name: string, exclude: string[]): string | undefined {
  const text = name.replace(AIR, ' ');
  return exclude.find((w) => hasWords(text, w));
}

/** Si una versión es de las que no van: tiene alguna de esas palabras. */
export function isExcluded(version: string, exclude: string[]): boolean {
  return excludedWordIn(version, exclude) !== undefined;
}

// ───────────────────────────── La traducción ─────────────────────────────

/** Un grupo de vehículos del catálogo que sale de una línea de la ficha: un año, con su motor, combustible y potencia. */
export type TargetGroup = {
  line: number;
  brand: string;
  model: string;
  year: number;
  fuel: Fuel;
  displacement: string | null;
  power: number | null;
  // Las versiones que van, si la línea deja afuera algunas. Null: todas.
  versions: string[] | null;
  // Los valores elegidos en el catálogo, para pedírselos al canal.
  filters: { field: string; id: string }[];
  label: string;
};

/** Una línea de la ficha traducida, o a revisar con el motivo. */
export type TranslatedLine = {
  rule: LineRule;
  status: 'ok' | 'review';
  reason: string | null;
  // Los nombres como los tiene el catálogo, para reconocer lo cargado.
  brandName: string | null;
  modelNames: string[];
  groups: TargetGroup[];
  // Lo que conviene saber aunque se haya traducido, por ejemplo una versión excluida que el catálogo no tiene.
  notes: string[];
};

export function groupLabel(g: Pick<TargetGroup, 'brand' | 'model' | 'year' | 'fuel' | 'displacement' | 'power' | 'versions'>): string {
  return [g.brand, g.model, String(g.year), g.displacement, FUEL_LABEL[g.fuel], g.power ? `${g.power} cv` : null, g.versions ? `(${g.versions.join(', ')})` : null]
    .filter(Boolean)
    .join(' ');
}

// ───────────────────────────── La comparación ─────────────────────────────

/** Un vehículo cargado en el canal, como lo necesita la comparación. */
export type LoadedVehicle = { id: string | null; vehicleId: string | null; name: string; byChannel: boolean; total: number | null };

export type VehicleVerdict =
  | { kind: 'covered'; line: number; year: number | null; displacement: string | null }
  | { kind: 'extra'; reason: string }
  | { kind: 'review'; reason: string };

const YEAR = /^(19[5-9]\d|20[0-4]\d)$/;

/**
 * El año de un nombre de vehículo, por ejemplo 2015 de "Volkswagen Amarok 2015 2.0".
 * El canal nombra marca, modelo y después el año: con el modelo, el año es el
 * primero que sigue. Hay modelos que parecen años (Peugeot 2008): sin el modelo,
 * si hay dos, el primero es el modelo.
 */
export function yearOf(name: string, model?: string | null): number | null {
  const words = norm(name).split(' ');
  let start = 0;
  const m = model ? norm(model).split(' ') : [];
  if (m.length > 0 && m[0] !== '') {
    for (let i = 0; i + m.length <= words.length; i++) {
      if (m.every((w, j) => words[i + j] === w)) {
        start = i + m.length;
        break;
      }
    }
  }
  const years = words
    .slice(start)
    .filter((w) => YEAR.test(w))
    .map(Number);
  if (years.length === 0) return null;
  return start > 0 || years.length === 1 ? years[0] : years[1];
}

/** Si un vehículo cargado sale de la ficha, sobra o hay que revisarlo, y por qué. */
export function judgeVehicle(v: LoadedVehicle, lines: TranslatedLine[]): VehicleVerdict {
  const brandOf = (l: TranslatedLine) => l.brandName ?? l.rule.brand;
  if (v.byChannel) {
    // Llega solo la marca: no se sabe qué vehículos son.
    const sameBrand = lines.some((l) => brandOf(l) && norm(brandOf(l)) === norm(v.name));
    return sameBrand
      ? { kind: 'review', reason: `${v.total ?? 'Varios'} de ${v.name} los cargó el canal: no dice cuáles son, revisalos en el canal.` }
      : { kind: 'extra', reason: `${v.total ?? 'Varios'} de ${v.name} los cargó el canal y la ficha no tiene esa marca: se borran a mano en el canal.` };
  }
  // Una versión GNC de fábrica lleva el motor naftero con el equipo de gas: va en las líneas de nafta,
  // salvo que la ficha la deje afuera con "Gnc" en las versiones que no van.
  const fuel = fuelOf(v.name);
  const displacement = displacementOf(v.name);
  const power = powerOf(v.name);
  let firstReason: string | null = null;
  let reviewReason: string | null = null;
  for (const l of lines) {
    const brand = brandOf(l);
    const models = l.modelNames.length > 0 ? l.modelNames : l.rule.models;
    const model = brand && hasWords(v.name, brand) ? models.find((m) => hasWords(v.name, m)) : undefined;
    if (!model) continue;
    if (l.status === 'review') {
      reviewReason ??= `Coincide con una línea de la ficha que está a revisar: ${l.rule.label}.`;
      continue;
    }
    const r = l.rule;
    const year = yearOf(v.name, model);
    const excluded = excludedWordIn(v.name, r.exclude);
    const why =
      year !== null && ((r.from !== null && year < r.from) || (r.to !== null && year > r.to))
        ? `el año ${year} está fuera de la ficha (${yearsText(r.from, r.to)})`
        : fuel && r.fuel && fuel !== r.fuel && !(fuel === 'gnc' && r.fuel === 'nafta')
          ? `es ${FUEL_LABEL[fuel]} y la ficha dice ${FUEL_LABEL[r.fuel]}`
          : displacement && r.displacement && displacement !== r.displacement
            ? `es ${displacement} y la ficha dice ${r.displacement}`
            : power && r.power && power !== r.power
              ? `tiene ${power} cv y la ficha dice ${r.power} cv`
              : excluded
                ? `es una versión que la ficha deja afuera (${excluded})`
                : null;
    if (!why) return { kind: 'covered', line: r.index, year, displacement };
    firstReason ??= why;
  }
  if (reviewReason) return { kind: 'review', reason: reviewReason };
  return { kind: 'extra', reason: firstReason ? `No sale de la ficha: ${firstReason}.` : 'No sale de la ficha: esa marca y ese modelo no están.' };
}

/** Los grupos que se cuentan juntos: la misma línea de la ficha, el mismo año y la misma cilindrada. */
export const groupKey = (g: Pick<TargetGroup, 'line' | 'year' | 'displacement'>) => `${g.line}|${g.year}|${g.displacement ?? ''}`;

/** Lo que salen de un grupo, sin las versiones, para mostrarlo corto. */
const shortLabel = (g: TargetGroup) => groupLabel({ ...g, versions: null });

/** Un grupo con algunos vehículos cargados pero no todos los del catálogo. */
export type IncompleteGroup = {
  // Los grupos del catálogo que forman la clave: se mandan todos para completarla.
  groups: TargetGroup[];
  loaded: number;
  expected: number;
  label: string;
};

export type CompatibilityAudit = {
  // Los vehículos cargados que salen de la ficha.
  covered: number;
  // Los grupos de vehículos que salen de la ficha y el canal no tiene.
  missing: TargetGroup[];
  // Los grupos con algún vehículo cargado, pero menos de los que tiene el catálogo.
  incomplete: IncompleteGroup[];
  // Lo cargado que no sale de la ficha: se puede borrar desde la app.
  extra: { vehicle: LoadedVehicle; reason: string }[];
  // Lo que cargó el canal y no sale de la ficha: se borra a mano en el canal.
  extraByChannel: { vehicle: LoadedVehicle; reason: string }[];
  // Lo cargado que no se puede juzgar con seguridad.
  review: { vehicle: LoadedVehicle; reason: string }[];
};

/**
 * Compara lo cargado en el canal con lo que sale de la ficha. counts: cuántos
 * vehículos tiene el catálogo en cada grupo (por groupKey), para saber si a un
 * grupo con algo cargado le falta alguno. Sin el número, el grupo no se juzga.
 */
export function auditCompatibilities(lines: TranslatedLine[], loaded: LoadedVehicle[], counts?: Map<string, number>): CompatibilityAudit {
  const out: CompatibilityAudit = { covered: 0, missing: [], incomplete: [], extra: [], extraByChannel: [], review: [] };
  const present: { line: number; year: number | null; displacement: string | null }[] = [];
  for (const v of loaded) {
    const verdict = judgeVehicle(v, lines);
    if (verdict.kind === 'covered') {
      out.covered++;
      present.push(verdict);
    } else if (verdict.kind === 'review') out.review.push({ vehicle: v, reason: verdict.reason });
    else if (v.byChannel) out.extraByChannel.push({ vehicle: v, reason: verdict.reason });
    else out.extra.push({ vehicle: v, reason: verdict.reason });
  }
  const seen = new Set<string>();
  const byKey = new Map<string, TargetGroup[]>();
  for (const l of lines) {
    if (l.status !== 'ok') continue;
    for (const g of l.groups) {
      const key = norm(g.label);
      if (seen.has(key)) continue;
      seen.add(key);
      byKey.set(groupKey(g), [...(byKey.get(groupKey(g)) ?? []), g]);
    }
  }
  for (const [key, groups] of byKey) {
    const g = groups[0];
    const have = present.filter((p) => p.line === g.line && p.year === g.year && (!g.displacement || !p.displacement || p.displacement === g.displacement)).length;
    if (have === 0) {
      // El catálogo no tiene nada que el canal cargue y salga de la ficha: no falta.
      if (counts?.get(key) === 0) continue;
      out.missing.push(...groups);
      continue;
    }
    const expected = counts?.get(key);
    if (expected !== undefined && have < expected) out.incomplete.push({ groups, loaded: have, expected, label: `${shortLabel(g)}: hay ${have} de ${expected}` });
  }
  return out;
}
