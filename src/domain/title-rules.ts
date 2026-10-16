import { z } from 'zod';

// Reglas de título por cuenta y canal: largo máximo, signos y palabras no
// permitidas, y la estructura sugerida por familia de producto. Los valores
// iniciales son de cada canal (src/channels/<canal>/); acá solo se leen,
// validan y combinan.

export type TitleStructure = { family: string; structure: string };

export type TitleRules = {
  maxLength: number | null;
  forbiddenChars: string;
  forbiddenWords: string[];
  structures: TitleStructure[];
};

export const EMPTY_TITLE_RULES: TitleRules = { maxLength: null, forbiddenChars: '', forbiddenWords: [], structures: [] };

/** Los signos sin repetir ni espacios: "! ¡ !*" da "!¡*". */
export function cleanChars(raw: string): string {
  return [...new Set([...raw.replace(/\s+/g, '')])].join('');
}

export const titleRulesInputSchema = z.object({
  maxLength: z
    .union([z.number(), z.string(), z.null()])
    .transform((v, ctx) => {
      if (v === null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isInteger(n) || n < 10 || n > 500) {
        ctx.addIssue({ code: 'custom', message: 'El largo máximo tiene que ser un número entre 10 y 500.' });
        return z.NEVER;
      }
      return n;
    }),
  forbiddenChars: z.string().max(200).transform(cleanChars),
  forbiddenWords: z
    .array(z.string())
    .max(300)
    .transform((list) => [...new Set(list.map((w) => w.trim().replace(/\s+/g, ' ')).filter(Boolean))]),
  structures: z
    .array(z.object({ family: z.string().max(200), structure: z.string().max(500) }))
    .max(100)
    .transform((list) =>
      list
        .map((s) => ({ family: s.family.trim(), structure: s.structure.trim() }))
        .filter((s) => s.structure !== ''),
    ),
});

export type TitleRulesInput = z.input<typeof titleRulesInputSchema>;

function strings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

/** Lee lo guardado en la base, descartando lo que no se reconoce. */
export function parseTitleRules(row: {
  maxLength: number | null;
  forbiddenChars: string;
  forbiddenWords: unknown;
  structures: unknown;
}): TitleRules {
  const structures = Array.isArray(row.structures)
    ? row.structures.flatMap((s) =>
        s && typeof s === 'object' && typeof (s as TitleStructure).structure === 'string'
          ? [{ family: String((s as TitleStructure).family ?? ''), structure: (s as TitleStructure).structure }]
          : [],
      )
    : [];
  return { maxLength: row.maxLength, forbiddenChars: row.forbiddenChars, forbiddenWords: strings(row.forbiddenWords), structures };
}

/** La estructura para una familia: la suya, o la que vale para todas. */
export function structureFor(rules: TitleRules, family: string | null): string | null {
  const f = (family ?? '').trim().toLowerCase();
  const own = f ? rules.structures.find((s) => s.family.trim().toLowerCase() === f) : undefined;
  return (own ?? rules.structures.find((s) => s.family.trim() === ''))?.structure ?? null;
}
