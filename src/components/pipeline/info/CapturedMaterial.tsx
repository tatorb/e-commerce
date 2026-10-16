import type { Capture } from '@/lib/queries/title-step';
import { formatDateTime } from '@/lib/format';

// Lo que se juntó en el paso Título: sugerencias del buscador y posiciones,
// cada cosa con su fecha. Solo para mirar.

type Position = { id: string; query: string; page: number | null; position: number | null; source: 'AUTO' | 'MANUAL'; checkedAt: Date };

const SOURCE = { AUTO: 'leídas por la app', MANUAL: 'cargadas a mano' } as const;

export function CapturedMaterial({ captures, positions, timeZone }: { captures: Capture[]; positions: Position[]; timeZone: string }) {
  if (captures.length === 0 && positions.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay nada. Se junta en el paso Título.</p>;
  }
  return (
    <div className="space-y-4">
      {captures.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Sugerencias del buscador</p>
          <ul className="divide-y rounded-md border">
            {captures.map((c) => (
              <li key={c.id} className="space-y-1 px-4 py-2.5 text-sm">
                <p>
                  <span className="font-medium">«{c.query}»</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {c.suggestions.length === 1 ? '1 sugerencia' : `${c.suggestions.length} sugerencias`} {SOURCE[c.source]} el{' '}
                    {formatDateTime(c.capturedAt, timeZone)}
                  </span>
                </p>
                {c.suggestions.length > 0 ? <p className="text-muted-foreground">{c.suggestions.join(' · ')}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {positions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Posiciones en la búsqueda</p>
          <ul className="divide-y rounded-md border">
            {positions.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-medium">«{p.query}»</span>
                <span className="tabular-nums">
                  {p.page ? `Página ${p.page}, posición ${p.position}` : 'No aparece en las primeras 3 páginas'}
                </span>
                <span className="text-muted-foreground">
                  {p.source === 'AUTO' ? 'Leída por la app' : 'Cargada a mano'} el {formatDateTime(p.checkedAt, timeZone)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
