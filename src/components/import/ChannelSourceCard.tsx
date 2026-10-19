'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ListingStatus } from '@/channels/listings-types';
import type { RowInput } from '@/importers/mapping';
import { plural } from '@/lib/format';
import { countListingsAction, listListingIdsAction, readListingsAction, type Result } from '@/app/a/[cuenta]/importar/actions';

export type ChannelStoreInfo = { id: string; name: string; channelName: string };

/** Cuánto se espera entre tandas y cuando el canal pide esperar, en segundos. */
export type ReadPacing = { pauseSeconds: number; waitSeconds: number };

// Igual que LISTINGS_BATCH: de a cuántas se leen por pedido.
const READ_BATCH = 20;
// Cada tantas, una pausa, para no pasarse del límite de pedidos del canal.
const ROUND = 100;
// Si el canal sigue pidiendo esperar después de esto, se corta y se puede seguir más tarde.
const MAX_WAITS = 5;

const STATUS_LABEL: Record<ListingStatus, string> = { active: 'Activas', paused: 'Pausadas', closed: 'Finalizadas' };
const STATUS_ORDER: ListingStatus[] = ['active', 'paused', 'closed'];

type Counts = Record<ListingStatus, number>;

type Status =
  | { kind: 'reading'; done: number; total: number }
  | { kind: 'pause' | 'busy'; left: number; done: number; total: number };

// Lo leído hasta que se cortó, para seguir desde ahí.
type ReadSoFar = { key: string; ids: string[]; rows: RowInput[]; missing: number; next: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "Traer de Mercado Libre": lee las publicaciones de la tienda con la cuenta
// conectada y las pasa a la revisión, como si vinieran de una planilla. Lee de
// a 100 con una pausa entre tandas, y si el canal pide esperar, espera y sigue.
export function ChannelSourceCard({
  accountSlug,
  store,
  disabled,
  pacing = { pauseSeconds: 20, waitSeconds: 60 },
  onRead,
}: {
  accountSlug: string;
  store: ChannelStoreInfo;
  disabled: boolean;
  pacing?: ReadPacing;
  onRead: (result: { rows: RowInput[]; missing: number }) => void;
}) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<ListingStatus>>(new Set(['active', 'paused']));
  const [status, setStatus] = useState<Status | null>(null);
  const [partial, setPartial] = useState<ReadSoFar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    countListingsAction(accountSlug, store.id)
      .then((r) => {
        if (!alive.current) return;
        if (r.ok) setCounts(r.counts);
        else setCountError(r.error);
      })
      .catch(() => alive.current && setCountError('Se cortó la conexión con la app.'));
    return () => {
      alive.current = false;
    };
  }, [accountSlug, store.id]);

  const reading = status !== null;
  const total = counts ? [...chosen].reduce((n, s) => n + counts[s], 0) : 0;
  const key = STATUS_ORDER.filter((s) => chosen.has(s)).join(',');
  const resumable = partial && partial.key === key ? partial : null;

  function toggle(s: ListingStatus, on: boolean) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(s);
      else next.delete(s);
      return next;
    });
  }

  async function countdown(seconds: number, show: (left: number) => void) {
    for (let left = seconds; left > 0 && alive.current; left--) {
      show(left);
      await sleep(1000);
    }
  }

  /** Hace el pedido; si el canal pide esperar, espera y lo repite. */
  async function patiently<T extends Result<object>>(call: () => Promise<T>, done: number, of: number): Promise<T> {
    for (let waits = 0; ; waits++) {
      const r = await call();
      if (r.ok || !r.wait || waits >= MAX_WAITS || !alive.current) return r;
      await countdown(pacing.waitSeconds, (left) => setStatus({ kind: 'busy', left, done, total: of }));
      setStatus({ kind: 'reading', done, total: of });
    }
  }

  async function read() {
    setError(null);
    let ids: string[];
    let rows: RowInput[] = [];
    let missing = 0;
    let start = 0;
    if (resumable) {
      ({ ids, rows, missing } = resumable);
      rows = [...rows];
      start = resumable.next;
      setStatus({ kind: 'reading', done: start, total: ids.length });
    } else {
      setStatus({ kind: 'reading', done: 0, total: 0 });
      const list = await patiently(() => listListingIdsAction(accountSlug, store.id, key.split(',')), 0, 0).catch(() => null);
      if (!list || !list.ok) {
        setStatus(null);
        setError(list ? list.error : 'Se cortó la conexión con la app.');
        return;
      }
      ids = list.ids;
    }
    setPartial(null);

    for (let i = start; i < ids.length; i += READ_BATCH) {
      if (!alive.current) return;
      if (i > start && i % ROUND === 0) {
        await countdown(pacing.pauseSeconds, (left) => setStatus({ kind: 'pause', left, done: i, total: ids.length }));
      }
      setStatus({ kind: 'reading', done: i, total: ids.length });
      const batch = ids.slice(i, i + READ_BATCH);
      const r = await patiently(() => readListingsAction(accountSlug, store.id, { ids: batch, firstRow: i + 1 }), i, ids.length).catch(
        () => null,
      );
      if (!r || !r.ok) {
        // Lo leído no se pierde: se puede seguir desde acá.
        if (i > 0) setPartial({ key, ids, rows, missing, next: i });
        setStatus(null);
        setError(r ? r.error : 'Se cortó la conexión con la app.');
        return;
      }
      rows.push(...r.rows);
      missing += r.missing.length;
    }
    setStatus(null);
    if (rows.length === 0) {
      setError('No se pudo leer ninguna publicación.');
      return;
    }
    onRead({ rows, missing });
  }

  const message = (s: Status) => {
    if (s.kind === 'pause') {
      return `Leídas ${s.done} de ${s.total}. Pausa entre tandas para no saturar a ${store.channelName}, sigo en ${s.left} s.`;
    }
    if (s.kind === 'busy') return `${store.channelName} pidió esperar. Sigo en ${s.left} s, con ${s.done} de ${s.total} ya leídas.`;
    return s.total > 0 ? `Leyendo ${s.done} de ${s.total}…` : 'Buscando las publicaciones…';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traer de {store.channelName}</CardTitle>
        <CardDescription>
          Lee las publicaciones de {store.name} con la cuenta conectada, sin planilla. Después revisás qué cambia antes de
          importar, igual que con un archivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {countError ? (
          <div className="space-y-1">
            <p className="text-sm text-destructive">{countError}</p>
            <p className="text-sm">
              <Link className="underline underline-offset-2" href={`/a/${accountSlug}/conexion`}>
                Ir a Conexión
              </Link>
            </p>
          </div>
        ) : !counts ? (
          <p className="text-sm text-muted-foreground">Contando las publicaciones…</p>
        ) : (
          <>
            <fieldset className="space-y-2" disabled={reading || disabled}>
              <legend className="text-sm font-medium">Qué publicaciones traer</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {STATUS_ORDER.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-30"
                      checked={chosen.has(s)}
                      onChange={(e) => toggle(s, e.target.checked)}
                    />
                    {STATUS_LABEL[s]} <span className="tabular-nums text-muted-foreground">({counts[s]})</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Se leen de a {ROUND}, con una pausa entre tandas, porque {store.channelName} corta si recibe demasiados pedidos
                seguidos.
              </p>
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={read} disabled={reading || disabled || total === 0}>
                {reading
                  ? 'Leyendo…'
                  : resumable
                    ? `Seguir leyendo · faltan ${resumable.ids.length - resumable.next}`
                    : `Leer ${plural(total, 'publicación', 'publicaciones')}`}
              </Button>
              {status ? (
                <span className="text-sm tabular-nums" role="status">
                  {message(status)} No cierres esta pestaña.
                </span>
              ) : null}
              {error ? (
                <span className="text-sm text-destructive" role="alert">
                  {error}
                  {resumable ? ` Ya hay ${resumable.next} leídas, podés seguir desde ahí.` : ''}
                </span>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
