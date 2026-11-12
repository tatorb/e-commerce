'use client';

import { BAND } from '@/components/ui/band';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { titleOrUntitled } from '@/domain/publication-title';
import type { CompatibilityPushRow } from '@/lib/compatibility-push';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { pushCompatibilitiesAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';

// Por subir, las compatibilidades con vehículos: lo que mostró la última
// auditoría, una fila por producto del canal (las opciones de venta de una
// medida comparten lo cargado). Antes de mandar, la persona ve qué se agrega
// y qué se borra, y confirma.

type Outcome = { kind: 'ok' | 'error'; text: string };

const groups = (n: number) => plural(n, 'grupo de vehículos', 'grupos de vehículos');
const vehicles = (n: number) => plural(n, 'vehículo', 'vehículos');

function outcomeText(r: Awaited<ReturnType<typeof pushCompatibilitiesAction>> | null): Outcome {
  if (!r) return { kind: 'error', text: 'Se cortó la conexión con la app.' };
  if (!r.ok) return { kind: 'error', text: r.error };
  if (!r.outcome) {
    return r.busy
      ? { kind: 'error', text: 'Mercado Libre pidió esperar porque hubo demasiados pedidos. Probá de nuevo en unos minutos.' }
      : { kind: 'error', text: r.later ? 'No hubo tiempo de leer el canal antes de mandar. Probá de nuevo.' : 'Ya no tiene nada por subir.' };
  }
  const o = r.outcome;
  const sent = [
    o.agregados.grupos > 0 ? `agregó ${groups(o.agregados.grupos)}` : null,
    o.borrados.cantidad > 0 ? `borró ${vehicles(o.borrados.cantidad)}` : null,
    o.deshechos ? `sacó ${vehicles(o.deshechos.cantidad)} que metió el canal y no salen de la ficha` : null,
  ]
    .filter(Boolean)
    .join(' y ');
  const after = o.despues
    ? ` Ahora faltan ${o.despues.faltan}${o.despues.incompletos > 0 ? `, quedan ${o.despues.incompletos} incompletos` : ''} y sobran ${o.despues.sobran}.`
    : '';
  const extra = [o.motivo, ...(o.rechazos ?? []), o.aviso].filter(Boolean).join(' ');
  if (o.resultado === 'subido') return { kind: 'ok', text: `Subido: ${sent}.${after}${extra ? ` ${extra}` : ''}` };
  if (o.resultado === 'sin cambios') return { kind: 'ok', text: `${o.motivo ?? 'Ya estaba al día en el canal.'}${after}` };
  if (o.resultado === 'en parte') return { kind: 'error', text: `Subido en parte: ${sent}.${after} ${extra}` };
  return { kind: 'error', text: `${extra || 'No se pudo subir.'}${after}` };
}

export function CompatibilityPushList({ accountSlug, rows }: { accountSlug: string; rows: CompatibilityPushRow[] }) {
  const router = useRouter();
  const key = (r: CompatibilityPushRow) => r.publicationIds[0];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<CompatibilityPushRow[] | null>(null);
  // Solo agregar: lo que sobra queda para otra subida.
  const [addOnly, setAddOnly] = useState(false);
  const ask = (list: CompatibilityPushRow[], only: boolean) => {
    setAddOnly(only);
    setAsking(list);
  };
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const stop = useRef(false);
  const pushable = rows.filter((r) => !r.blocked);

  async function push(list: CompatibilityPushRow[]) {
    setAsking(null);
    stop.current = false;
    setProgress({ done: 0, total: list.length });
    for (let i = 0; i < list.length && !stop.current; i++) {
      const r = await pushCompatibilitiesAction(accountSlug, list[i].publicationIds, addOnly).catch(() => null);
      setOutcomes((prev) => ({ ...prev, [key(list[i])]: outcomeText(r) }));
      setProgress({ done: i + 1, total: list.length });
      if (r && r.ok && r.busy) break;
    }
    setProgress(null);
    setSelected(new Set());
    router.refresh();
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const chosen = pushable.filter((r) => selected.has(key(r)));
  const totalAdd = (asking ?? []).reduce((n, r) => n + r.add.count + r.complete.count, 0);
  const totalRemove = addOnly ? 0 : (asking ?? []).reduce((n, r) => n + r.remove.count, 0);
  const canAdd = (r: CompatibilityPushRow) => r.add.count + r.complete.count > 0;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 text-sm', BAND)}>
        <input
          type="checkbox"
          aria-label="Elegir todas las que se pueden subir"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={pushable.length > 0 && chosen.length === pushable.length}
          disabled={pushable.length === 0 || progress !== null}
          onChange={(e) => setSelected(new Set(e.target.checked ? pushable.map(key) : []))}
        />
        <span className="text-muted-foreground">
          {chosen.length > 0
            ? plural(chosen.length, 'elegida', 'elegidas')
            : `${plural(rows.length, 'publicación', 'publicaciones')} con compatibilidades por subir`}
        </span>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {progress ? (
            <>
              <span className="tabular-nums text-muted-foreground" aria-live="polite">
                Subiendo {progress.done} de {progress.total}
              </span>
              <Button access="subir" size="sm" variant="ghost" onClick={() => (stop.current = true)}>
                Parar
              </Button>
            </>
          ) : null}
          <Button
            access="subir"
            size="sm"
            variant="outline"
            disabled={!chosen.some(canAdd) || progress !== null}
            onClick={() => ask(chosen.filter(canAdd), true)}
          >
            Solo agregar
          </Button>
          <Button access="subir" size="sm" disabled={chosen.length === 0 || progress !== null} pending={progress !== null} onClick={() => ask(chosen, false)}>
            <Upload />
            Subir las elegidas{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </Button>
        </div>
      </div>

      <ul className="divide-y">
        {rows.map((row) => {
          const outcome = outcomes[key(row)];
          return (
            <li key={key(row)} className="flex gap-3 px-4 py-3">
              <input
                type="checkbox"
                aria-label={`Elegir ${titleOrUntitled(row.title)}`}
                className="mt-1 h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-30"
                checked={selected.has(key(row))}
                disabled={row.blocked !== null || progress !== null}
                onChange={(e) => toggle(key(row), e.target.checked)}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="min-w-0">
                  <Link href={`/a/${accountSlug}/publicaciones/${key(row)}`} className="font-medium hover:underline">
                    {titleOrUntitled(row.title)}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row.codes.join(', ')} · {row.storeName}
                    {row.codes.length > 1 ? ' · comparten las compatibilidades' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {row.needed ? <Badge variant="destructive">{row.channelName} pide completarlas</Badge> : null}
                  {row.add.count > 0 ? <Badge variant="secondary">Agregar {groups(row.add.count)}</Badge> : null}
                  {row.complete.count > 0 ? <Badge variant="secondary">Completar {groups(row.complete.count)}</Badge> : null}
                  {row.remove.count > 0 ? <Badge variant="secondary">Borrar {vehicles(row.remove.count)}</Badge> : null}
                  {row.review > 0 ? <Badge variant="outline">{row.review} a revisar, no se tocan</Badge> : null}
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Qué se agrega y qué se borra</summary>
                  <Detail row={row} />
                </details>
                {row.byChannel.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Cargados por {row.channelName} que no salen de la ficha: {row.byChannel.map((b) => `${b.count ?? 'varios'} de ${b.brand}`).join(', ')}. Se
                    borran a mano en {row.channelName}.
                  </p>
                ) : null}
                {row.blocked ? <p className="text-xs text-muted-foreground">{row.blocked}</p> : null}
                {outcome ? <p className={cn('text-sm', outcome.kind === 'error' ? 'text-destructive' : 'text-foreground')}>{outcome.text}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {row.blocked ? null : (
                  <>
                    <Button access="subir" size="sm" variant="outline" disabled={progress !== null} onClick={() => ask([row], false)}>
                      Subir
                    </Button>
                    {canAdd(row) && row.remove.count > 0 ? (
                      <Button access="subir" size="sm" variant="ghost" disabled={progress !== null} onClick={() => ask([row], true)}>
                        Solo agregar
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={asking !== null} onOpenChange={(open) => (open ? null : setAsking(null))}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>¿Subir las compatibilidades a {asking?.[0]?.channelName ?? 'el canal'}?</DialogTitle>
            <DialogDescription>
              Se agregan o completan {groups(totalAdd)}
              {addOnly ? ', sin borrar nada,' : ` y se borran ${vehicles(totalRemove)}`} en {plural(asking?.length ?? 0, 'publicación', 'publicaciones')}.
              Antes de mandar se vuelve a leer el canal: va solo lo que sigue faltando o sobrando. Si la ficha cambió desde la auditoría, esa no se sube.
            </DialogDescription>
          </DialogHeader>
          {asking && asking.length === 1 ? <Detail row={asking[0]} addOnly={addOnly} /> : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setAsking(null)}>
              Cancelar
            </Button>
            <Button access="subir" onClick={() => asking && push(asking)}>
              <Upload />
              Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ row, addOnly = false }: { row: CompatibilityPushRow; addOnly?: boolean }) {
  return (
    <div className="mt-1.5 space-y-2 text-xs">
      {row.add.count > 0 ? (
        <div>
          <p className="font-medium">Se agregan, porque salen de la ficha y faltan:</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {row.add.examples.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          {row.add.count > row.add.examples.length ? <p className="text-muted-foreground">Y {groups(row.add.count - row.add.examples.length)} más.</p> : null}
        </div>
      ) : null}
      {row.complete.count > 0 ? (
        <div>
          <p className="font-medium">Se completan, porque tienen algún vehículo cargado pero no todos los del catálogo:</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {row.complete.examples.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          {row.complete.count > row.complete.examples.length ? (
            <p className="text-muted-foreground">Y {groups(row.complete.count - row.complete.examples.length)} más.</p>
          ) : null}
        </div>
      ) : null}
      {row.remove.count > 0 && !addOnly ? (
        <div>
          <p className="font-medium">Se borran, porque no salen de la ficha:</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {row.remove.examples.map((x) => (
              <li key={x.vehicle}>
                {x.vehicle} <span className="text-muted-foreground">({x.reason.replace(/^No sale de la ficha: /, '').replace(/\.$/, '')})</span>
              </li>
            ))}
          </ul>
          {row.remove.count > row.remove.examples.length ? (
            <p className="text-muted-foreground">Y {vehicles(row.remove.count - row.remove.examples.length)} más.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
