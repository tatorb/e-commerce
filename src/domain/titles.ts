import { engineCodes } from './engine';
import type { TitleRules } from './title-rules';

// El trabajo del paso Título que no necesita la base: semillas de búsqueda,
// palabras, cobertura de búsquedas y chequeo de reglas. Sirve en el servidor
// y en el navegador, para chequear en vivo mientras se escribe.

const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'para', 'por', 'con', 'sin', 'y', 'e', 'o', 'a', 'en', 'x', 'un', 'una', 'al']);

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Las palabras de un texto, para comparar: sin tildes ni mayúsculas. "1,9" queda "1.9". */
export function tokenize(text: string): string[] {
  return (plain(text).match(/[a-z0-9]+(?:[.,][0-9]+)*/g) ?? []).map((t) => t.replace(/,/g, '.'));
}

/** Las palabras que cuentan: sin conectores ni letras sueltas. */
export function meaningful(tokens: string[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t) && (t.length > 1 || /\d/.test(t)));
}

// Singular y plural cuentan igual: "pistones" y "piston", "aros" y "aro".
function stem(token: string): string {
  if (/\d/.test(token) || token.length <= 4) return token;
  if (token.endsWith('es')) return token.slice(0, -2);
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function sameText(a: string, b: string): boolean {
  return tokenize(a).join(' ') === tokenize(b).join(' ');
}

// ───────────────────────────── Semillas ─────────────────────────────

/** "Subconjunto (pistones + aros)" da "subconjunto"; "Juego de juntas / descarbonización", "juego de juntas". */
export function familyBase(productType: string | null | undefined): string | null {
  const base = (productType ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/[/,]/)[0]
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return base || null;
}

type SeedCompat = { vehicleBrand: string | null; model: string | null; engine: string | null; displacement: string | null };

const MAX_SEEDS = 12;

/**
 * Lo que la gente buscaría, armado con la ficha: el tipo de producto con cada
 * modelo, con cada código de motor y con la marca más la cilindrada. Por
 * ejemplo "subconjunto 405", "subconjunto xud9", "subconjunto peugeot 1.9".
 */
export function buildSeeds(product: { productType: string | null; compatibilities: SeedCompat[] }): string[] {
  const base = familyBase(product.productType);
  if (!base) return [];
  const out: string[] = [];
  const add = (...parts: (string | null | undefined)[]) => {
    const seed = [base, ...parts]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (!out.some((s) => sameText(s, seed))) out.push(seed);
  };
  for (const c of product.compatibilities) if (c.model) add(c.model);
  for (const c of product.compatibilities) for (const code of engineCodes(c.engine)) add(code);
  // La marca con la cilindrada; sin cilindrada, la marca sola.
  for (const c of product.compatibilities) if (c.vehicleBrand) add(c.vehicleBrand, c.displacement);
  if (out.length === 0) add();
  return out.slice(0, MAX_SEEDS);
}

/** Limpia la lista de semillas que escribió la persona. */
export function cleanSeeds(seeds: string[]): string[] {
  const out: string[] = [];
  for (const raw of seeds) {
    const seed = raw.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 100);
    if (seed && !out.some((s) => sameText(s, seed))) out.push(seed);
  }
  return out.slice(0, 20);
}

/** Las sugerencias pegadas a mano: una por línea, sin viñetas ni números de orden. */
export function parsePastedSuggestions(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line
      .replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    if (s && !out.some((o) => sameText(o, s))) out.push(s);
  }
  return out.slice(0, 200);
}

// ───────────────────────────── Mapa de palabras ─────────────────────────────

export type WordStatus = 'use' | 'discard';

export type WordEntry = {
  key: string;
  // Cómo la escribe la gente: la primera vez que aparece.
  word: string;
  inSuggestions: number;
  inCompetitors: number;
  source: 'suggestions' | 'competitors' | 'both';
  // Dónde aparece por primera vez en las sugerencias: sirve para ordenar el título.
  order: number;
  status: WordStatus | null;
};

/** Junta las palabras de las sugerencias y de los títulos de la competencia, con cuántas veces aparece cada una. */
export function buildWordMap(
  suggestions: string[],
  competitorTitles: string[],
  statuses: Record<string, WordStatus> = {},
): WordEntry[] {
  const map = new Map<string, WordEntry>();
  const visit = (text: string, index: number, from: 'suggestions' | 'competitors') => {
    const seen = new Set<string>();
    for (const [at, token] of meaningful(tokenize(text)).entries()) {
      const key = stem(token);
      if (seen.has(key)) continue;
      seen.add(key);
      let e = map.get(key);
      if (!e) {
        e = { key, word: token, inSuggestions: 0, inCompetitors: 0, source: from, order: Infinity, status: null };
        map.set(key, e);
      }
      if (from === 'suggestions') {
        e.inSuggestions++;
        // El orden de lectura: en qué sugerencia y en qué lugar dentro de ella.
        e.order = Math.min(e.order, index * 1000 + at);
      } else e.inCompetitors++;
    }
  };
  suggestions.forEach((s, i) => visit(s, i, 'suggestions'));
  competitorTitles.forEach((t, i) => visit(t, i, 'competitors'));
  for (const e of map.values()) {
    e.source = e.inSuggestions > 0 && e.inCompetitors > 0 ? 'both' : e.inSuggestions > 0 ? 'suggestions' : 'competitors';
    e.status = statuses[e.key] ?? null;
  }
  return [...map.values()].sort(
    (a, b) => b.inSuggestions + b.inCompetitors - (a.inSuggestions + a.inCompetitors) || a.order - b.order || a.key.localeCompare(b.key),
  );
}

/** La clave con la que se guarda si una palabra se usa o se descarta. */
export function wordKey(word: string): string {
  return stem(tokenize(word)[0] ?? '');
}

// ───────────────────────────── Cobertura y reglas ─────────────────────────────

/** Qué búsquedas cubre un título: las que tienen todas sus palabras en el título. */
export function titleCoverage(title: string, searches: string[]): { covered: string[]; missing: string[] } {
  const words = new Set(meaningful(tokenize(title)).map(stem));
  const covered: string[] = [];
  const missing: string[] = [];
  for (const search of searches) {
    const need = meaningful(tokenize(search)).map(stem);
    if (need.length === 0) continue;
    (need.every((w) => words.has(w)) ? covered : missing).push(search);
  }
  return { covered, missing };
}

export type TitleCheck = {
  length: number;
  // Impiden aprobar el título.
  errors: string[];
  // Avisos: se puede aprobar igual.
  warnings: string[];
};

function containsPhrase(title: string, phrase: string): boolean {
  const t = ` ${tokenize(title).join(' ')} `;
  const p = tokenize(phrase).join(' ');
  return p !== '' && t.includes(` ${p} `);
}

/** Chequea un título con las reglas. Lo hace la app, no la IA. */
export function checkTitle(title: string, rules: TitleRules, opts: { usableWords?: string[] } = {}): TitleCheck {
  const text = title.trim();
  const length = [...text].length;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!text) errors.push('El título está vacío.');
  if (rules.maxLength !== null && length > rules.maxLength) {
    errors.push(`Tiene ${length} caracteres y el máximo es ${rules.maxLength}.`);
  }
  const chars = [...new Set([...text].filter((ch) => rules.forbiddenChars.includes(ch)))];
  if (chars.length > 0) errors.push(`Tiene signos no permitidos: ${chars.join(' ')}`);
  const words = rules.forbiddenWords.filter((w) => containsPhrase(text, w));
  if (words.length > 0) errors.push(`Tiene palabras no permitidas: ${words.join(', ')}.`);

  const tokens = meaningful(tokenize(text));
  const repeated = [...new Set(tokens.filter((t, i) => tokens.indexOf(t) !== i))];
  if (repeated.length > 0) warnings.push(`Repite palabras: ${repeated.join(', ')}.`);
  if (/\s{2,}/.test(title.trim())) warnings.push('Tiene espacios dobles.');
  if (opts.usableWords) {
    const allowed = new Set(opts.usableWords.map(wordKey));
    const extra = [...new Set(tokens.filter((t) => !allowed.has(stem(t))))];
    if (extra.length > 0) warnings.push(`Usa palabras que no tildaste: ${extra.join(', ')}.`);
  }
  return { length, errors, warnings };
}
