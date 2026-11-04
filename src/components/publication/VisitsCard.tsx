import { Eye } from 'lucide-react';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { changeText, COMPARE_DAYS, type VisitsSummary } from '@/domain/visits';
import { formatDateTime } from '@/lib/format';

// Las visitas de la publicación por semana, los últimos 30 días contra los 30
// anteriores, y antes y después de corregirla.

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const num = (n: number) => n.toLocaleString('es-AR');

function Compare({ label, before, after, unit }: { label: string; before: number | null; after: number | null; unit?: string }) {
  const change = changeText(before, after);
  const up = before !== null && after !== null && after > before;
  const down = before !== null && after !== null && after < before;
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm tabular-nums">
        {before === null ? 'sin dato' : num(before)} → <strong>{after === null ? 'sin dato' : num(after)}</strong>
        {unit ? <span className="text-muted-foreground"> {unit}</span> : null}
      </p>
      {change ? <p className={up ? 'text-xs font-medium text-emerald-700' : down ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>{change}</p> : null}
    </div>
  );
}

export function VisitsCard({
  visits,
  channelName,
  timeZone,
  // Si se pidieron recién y el canal las rechazó, lo que respondió.
  error = null,
}: {
  visits: (VisitsSummary & { readAt: Date | null }) | null;
  channelName: string;
  timeZone: string;
  error?: string | null;
}) {
  if (!visits) {
    return (
      <SectionCard title="Visitas" icon={<Eye />} description={`Las de cada día, como las cuenta ${channelName}.`}>
        <SectionBody>
          <p className="text-sm text-muted-foreground">Todavía no se leyeron. Se leen solas una vez por día.</p>
          {error ? <p className="text-sm text-destructive">{`${channelName} no las devolvió: ${error}`}</p> : null}
        </SectionBody>
      </SectionCard>
    );
  }
  const max = Math.max(1, ...visits.weeks.map((w) => w.visits));
  const c = visits.correction;
  return (
    <SectionCard
      title="Visitas"
      icon={<Eye />}
      description={`Por semana, como las cuenta ${channelName}.${visits.readAt ? ` Leídas el ${formatDateTime(visits.readAt, timeZone)}.` : ''}`}
    >
      <div className="grid grid-cols-1 gap-px border-b bg-border sm:grid-cols-2">
        <Compare label={`Últimos ${COMPARE_DAYS} días contra los ${COMPARE_DAYS} anteriores`} before={visits.previous30} after={visits.last30} unit="visitas" />
        {c ? (
          <Compare
            label={`Por día, ${COMPARE_DAYS} días antes y después de corregirla el ${shortDay(c.on)}${c.afterDays < COMPARE_DAYS ? ` (van ${c.afterDays} días)` : ''}`}
            before={c.beforePerDay}
            after={c.afterPerDay}
          />
        ) : (
          <div className="bg-card px-4 py-3 text-xs text-muted-foreground">Cuando se termine de corregir en el pipeline, acá se ven las visitas de antes y de después.</div>
        )}
      </div>
      <SectionBody>
        <div className="flex h-28 items-end gap-1" role="img" aria-label="Visitas por semana">
          {visits.weeks.map((w) => {
            const hasCorrection = c ? inWeek(c.on, w.from) : false;
            return (
              <div key={w.from} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`Semana del ${shortDay(w.from)}: ${num(w.visits)} visitas`}>
                <span className="text-[10px] tabular-nums text-muted-foreground">{w.visits}</span>
                <div
                  className={hasCorrection ? 'w-full rounded-t bg-emerald-500' : 'w-full rounded-t bg-primary/70'}
                  style={{ height: `${Math.max(2, Math.round((w.visits / max) * 80))}px` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{visits.weeks[0] ? shortDay(visits.weeks[0].from) : ''}</span>
          {c ? <span className="text-emerald-700">En verde, la semana en que se corrigió</span> : null}
          <span>hoy</span>
        </div>
      </SectionBody>
    </SectionCard>
  );
}

/** Si el día cae en la semana que empieza ese día. */
function inWeek(day: string, from: string): boolean {
  const start = Date.parse(`${from}T00:00:00Z`);
  const d = Date.parse(`${day}T00:00:00Z`);
  return d >= start && d < start + 7 * 24 * 60 * 60 * 1000;
}
