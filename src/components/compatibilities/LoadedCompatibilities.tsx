'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ModelGroup, VehicleMark } from '@/domain/compatibilities';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { auditCompatibilitiesAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';

// Lo que tiene cargado una publicación en el canal, según la última revisión:
// un resumen, y cada marca y modelo con sus vehículos marcados como "va",
// "sobra" o "a revisar". Se usa en el paso Compatibilidades del pipeline y en
// la página de la publicación.

export type LoadedCompatibilitiesData = {
  publicationId: string;
  channelName: string;
  fichaLines: number;
  published: boolean;
  // La fecha de la última revisión, ya escrita, o null si nunca se revisó.
  readAtText: string | null;
  needed: boolean;
  loaded: number;
  covered: number;
  extra: number;
  review: number;
  models: ModelGroup[];
  byChannel: { brand: string; count: number | null; extra: boolean }[];
  missing: string[];
  incomplete: string[];
  lines: { line: string; ok: boolean; reason: string | null; groups: number }[];
};

type Filter = 'all' | VehicleMark;

const MARK_LABEL: Record<VehicleMark, string> = { covered: 'Va', extra: 'Sobra', review: 'A revisar' };
const MARK_CLASS: Record<VehicleMark, string> = {
  covered: 'bg-primary/10 text-primary',
  extra: 'bg-alert text-alert-foreground',
  review: 'bg-muted text-foreground',
};

const years = (g: Pick<ModelGroup, 'from' | 'to'>) => (g.from === null ? 'sin año' : g.from === g.to ? `${g.from}` : `${g.from} a ${g.to}`);

/** El botón que vuelve a leer el canal y compara con la ficha. */
export function AuditCompatibilitiesButton({ accountSlug, publicationId, channelName }: { accountSlug: string; publicationId: string; channelName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  async function audit() {
    setBusy(true);
    setMessage(null);
    const r = await auditCompatibilitiesAction(accountSlug, publicationId).catch(() => null);
    setBusy(false);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    if (r.busy) setMessage({ kind: 'error', text: `${channelName} pidió esperar porque hubo demasiados pedidos. Probá de nuevo en unos minutos.` });
    else if (r.left > 0) setMessage({ kind: 'error', text: `Quedaron ${plural(r.left, 'publicación', 'publicaciones')} de la familia sin revisar: tocá el botón otra vez.` });
    else setMessage({ kind: 'ok', text: `Revisado en ${channelName}.` });
    router.refresh();
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button access="publicaciones" size="sm" variant="outline" pending={busy} onClick={audit}>
        <RefreshCw />
        Revisar en {channelName}
      </Button>
      {message ? (
        <p role="status" className={cn('max-w-xs text-right text-xs', message.kind === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: 'alert' | 'muted' }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', tone === 'alert' && value > 0 ? 'text-destructive' : '')}>{value}</p>
    </div>
  );
}

/** El resumen y la lista de lo cargado, por marca y modelo. */
export function LoadedCompatibilities({ data, fichaHref }: { data: LoadedCompatibilitiesData; fichaHref: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  if (data.fichaLines === 0 && data.loaded === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        La ficha no tiene compatibilidades con vehículos, así que no hay nada para comparar.{' '}
        <Link href={fichaHref} className="font-medium text-foreground underline-offset-4 hover:underline">
          Cargalas en la ficha
        </Link>{' '}
        si este producto las lleva.
      </p>
    );
  }
  if (!data.published) return <p className="text-sm text-muted-foreground">Todavía no está publicada en {data.channelName}: no hay nada cargado para mirar.</p>;
  if (!data.readAtText) {
    return <p className="text-sm text-muted-foreground">Todavía no se revisó. Tocá «Revisar en {data.channelName}» para leer lo cargado y compararlo con la ficha.</p>;
  }
  const missing = data.missing.length + data.incomplete.length;
  const shown = data.models
    .map((g) => ({ ...g, vehicles: filter === 'all' ? g.vehicles : g.vehicles.filter((v) => v.mark === filter) }))
    .filter((g) => g.vehicles.length > 0);
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: data.loaded },
    { key: 'extra', label: 'Sobran', count: data.extra },
    { key: 'review', label: 'A revisar', count: data.review },
    { key: 'covered', label: 'Van', count: data.covered },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Count label={`Cargados en ${data.channelName}`} value={data.loaded} />
        <Count label="Van según la ficha" value={data.covered} />
        <Count label="Sobran" value={data.extra} tone="alert" />
        <Count label="Faltan (grupos)" value={missing} tone="alert" />
        <Count label="A revisar" value={data.review} />
      </div>
      <p className="text-xs text-muted-foreground">
        Según la revisión del {data.readAtText}. «Va» es que sale de la ficha; «sobra», que no sale, con el motivo; «a revisar», que no se puede juzgar con
        seguridad y la app no lo toca.
        {data.needed ? ` ${data.channelName} avisa que faltan vehículos compatibles.` : ''}
      </p>

      {data.loaded > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Qué mostrar">
            {filters.map((f) => (
              <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)} disabled={f.count === 0 && f.key !== 'all'}>
                {f.label} ({f.count})
              </Button>
            ))}
          </div>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {shown.map((g) => (
              <li key={g.model}>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted/50">
                    <span className="font-medium">{g.model}</span>
                    <span className="text-muted-foreground">{years(g)}</span>
                    <span className="flex flex-wrap gap-1 sm:ml-auto">
                      {g.covered > 0 ? <Badge className={MARK_CLASS.covered}>{g.covered} {g.covered === 1 ? 'va' : 'van'}</Badge> : null}
                      {g.extra > 0 ? <Badge className={MARK_CLASS.extra}>{g.extra} {g.extra === 1 ? 'sobra' : 'sobran'}</Badge> : null}
                      {g.review > 0 ? <Badge className={MARK_CLASS.review}>{g.review} a revisar</Badge> : null}
                    </span>
                  </summary>
                  <div className="space-y-2 border-t bg-muted/20 px-3 py-2">
                    {g.reasons.length > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                        {g.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    ) : null}
                    <table className="w-full text-xs">
                      <tbody>
                        {g.vehicles.map((v, i) => (
                          <tr key={`${v.name}-${i}`} className="align-top">
                            <td className="w-12 py-0.5 pr-2 tabular-nums">{v.year ?? ''}</td>
                            <td className="py-0.5 pr-2">{v.rest || v.name}</td>
                            <td className="w-20 py-0.5 text-right">
                              <span className={cn('rounded px-1.5 py-0.5', MARK_CLASS[v.mark])} title={v.reason ?? undefined}>
                                {MARK_LABEL[v.mark]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No tiene ningún vehículo cargado en {data.channelName}.</p>
      )}

      {data.byChannel.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Cargados por {data.channelName}, que solo dice la marca y el total:{' '}
          {data.byChannel.map((b) => `${b.count ?? 'varios'} de ${b.brand}${b.extra ? ' (no salen de la ficha)' : ''}`).join(', ')}. Esos se borran a mano en{' '}
          {data.channelName}.
        </p>
      ) : null}

      {missing > 0 ? (
        <details className="rounded-lg border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">
            Faltan {plural(missing, 'grupo', 'grupos')} que salen de la ficha
          </summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
            {data.missing.map((m) => (
              <li key={`f-${m}`}>{m}</li>
            ))}
            {data.incomplete.map((m) => (
              <li key={`i-${m}`}>{m}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {data.lines.length > 0 ? (
        <details className="rounded-lg border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Cómo se lee la ficha</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {data.lines.map((l, i) => (
              <li key={i}>
                <span className={l.ok ? '' : 'text-muted-foreground'}>{l.line}</span>
                {l.ok ? <span className="text-muted-foreground"> · {plural(l.groups, 'grupo', 'grupos')}</span> : <span className="text-muted-foreground"> · a revisar: {l.reason}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            <Link href={fichaHref} className="font-medium underline-offset-4 hover:underline">
              Corregir la ficha
            </Link>
          </p>
        </details>
      ) : null}
    </div>
  );
}
