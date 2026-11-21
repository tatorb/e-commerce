import { Badge } from '@/components/ui/badge';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { formatDateTime } from '@/lib/format';
import type { InsurProductRow } from '@/lib/insur';

// "Datos de Insur", en el paso Información: lo que dice la ficha del sistema
// de Insur de cada medida del producto. Solo se lee: no se copia a la ficha, a
// la ficha técnica, a las compatibilidades ni a ningún texto que vaya al
// canal. Sin precios.

const FIELD = { detail: 'Detalle', observations: 'Observaciones', vehicles: 'Vehículos' } as const;

function Datum({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid gap-x-3 sm:grid-cols-[9rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{value}</dd>
    </div>
  );
}

export function InsurDataCard({ data, timeZone, compatibilities }: { data: { rows: InsurProductRow[]; warnings: string[] }; timeZone: string; compatibilities: string[] }) {
  return (
    <SectionCard title="Datos de Insur" count={data.rows.length} description="Lo que dice el sistema de Insur de cada medida. Es solo de referencia: no cambia la ficha ni va al canal." collapsible defaultOpen={data.warnings.length > 0}>
      <SectionBody>
        {data.warnings.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        {data.rows.map((r) => (
          <div key={r.linkId} className="space-y-2 rounded-md border p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {r.measure ? <span>Medida {r.measure}</span> : null}
              <span className={r.measure ? 'font-normal text-muted-foreground' : undefined}>{r.code}</span>
              <Badge variant={r.status === 'DOUBTFUL' ? 'outline' : 'secondary'}>Cruce {r.statusLabel}</Badge>
            </p>
            {r.ficha ? (
              <dl className="space-y-1">
                <Datum label="Precodigo" value={r.ficha.precode} />
                <Datum label="Línea" value={r.ficha.line} />
                <Datum label="Detalle" value={r.ficha.detail} />
                <Datum label="Bocas" value={r.ficha.bocas} />
                <Datum label="Observaciones" value={r.ficha.observations} />
                <Datum label="Vehículos de Insur" value={r.ficha.vehicles} />
                <Datum label="Medidas de Insur" value={r.ficha.measures} />
                <Datum label="Stock en Insur" value={`Córdoba ${r.stockCordoba ?? 0} · Santa Fe ${r.stockSantaFe ?? 0}`} />
                <Datum label="Leído" value={formatDateTime(r.ficha.readAt, timeZone)} />
              </dl>
            ) : (
              <p className="text-muted-foreground">Todavía no se leyó su ficha de Insur. Stock en Insur: Córdoba {r.stockCordoba ?? 0} · Santa Fe {r.stockSantaFe ?? 0}.</p>
            )}
            {r.ficha && r.ficha.changes.length > 0 ? (
              <div className="space-y-1 rounded-md bg-muted/50 p-2">
                <p className="font-medium">Cambió{r.ficha.changedAt ? ` el ${formatDateTime(r.ficha.changedAt, timeZone)}` : ''}</p>
                {r.ficha.changes.map((c) => (
                  <div key={c.field} className="grid gap-x-3 sm:grid-cols-[9rem_1fr]">
                    <span className="text-muted-foreground">{FIELD[c.field]}</span>
                    <span>
                      <span className="block whitespace-pre-wrap text-muted-foreground line-through">{c.before ?? 'vacío'}</span>
                      <span className="block whitespace-pre-wrap">{c.after ?? 'vacío'}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {data.rows.some((r) => r.ficha?.vehicles) ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Compatibilidades de la ficha, para comparar a ojo con los vehículos de Insur</p>
            {compatibilities.length > 0 ? (
              <ul className="list-inside list-disc text-muted-foreground">
                {compatibilities.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">La ficha no tiene compatibilidades cargadas.</p>
            )}
          </div>
        ) : null}
      </SectionBody>
    </SectionCard>
  );
}
