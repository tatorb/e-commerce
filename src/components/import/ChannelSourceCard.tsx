'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ListingStatus } from '@/channels/listings-types';
import type { RowInput } from '@/importers/mapping';
import { plural } from '@/lib/format';
import { countListingsAction, listListingIdsAction, readListingsAction } from '@/app/a/[cuenta]/importar/actions';

export type ChannelStoreInfo = { id: string; name: string; channelName: string };

// Igual que LISTINGS_BATCH: de a cuántas se leen por pedido.
const READ_BATCH = 20;

const STATUS_LABEL: Record<ListingStatus, string> = { active: 'Activas', paused: 'Pausadas', closed: 'Finalizadas' };
const STATUS_ORDER: ListingStatus[] = ['active', 'paused', 'closed'];

type Counts = Record<ListingStatus, number>;

// "Traer de Mercado Libre": lee las publicaciones de la tienda con la cuenta
// conectada y las pasa a la revisión, como si vinieran de una planilla.
export function ChannelSourceCard({
  accountSlug,
  store,
  disabled,
  onRead,
}: {
  accountSlug: string;
  store: ChannelStoreInfo;
  disabled: boolean;
  onRead: (result: { rows: RowInput[]; missing: number }) => void;
}) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<ListingStatus>>(new Set(['active', 'paused']));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    countListingsAction(accountSlug, store.id)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setCounts(r.counts);
        else setCountError(r.error);
      })
      .catch(() => alive && setCountError('Se cortó la conexión con la app.'));
    return () => {
      alive = false;
    };
  }, [accountSlug, store.id]);

  const reading = progress !== null;
  const total = counts ? [...chosen].reduce((n, s) => n + counts[s], 0) : 0;

  function toggle(status: ListingStatus, on: boolean) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(status);
      else next.delete(status);
      return next;
    });
  }

  async function read() {
    setError(null);
    setProgress({ done: 0, total });
    try {
      const list = await listListingIdsAction(accountSlug, store.id, STATUS_ORDER.filter((s) => chosen.has(s)));
      if (!list.ok) throw new Error(list.error);
      const ids = list.ids;
      setProgress({ done: 0, total: ids.length });
      const rows: RowInput[] = [];
      let missing = 0;
      for (let i = 0; i < ids.length; i += READ_BATCH) {
        const batch = ids.slice(i, i + READ_BATCH);
        const r = await readListingsAction(accountSlug, store.id, { ids: batch, firstRow: i + 1 });
        if (!r.ok) throw new Error(r.error);
        rows.push(...r.rows);
        missing += r.missing.length;
        setProgress({ done: Math.min(i + batch.length, ids.length), total: ids.length });
      }
      setProgress(null);
      if (rows.length === 0) {
        setError('No se pudo leer ninguna publicación.');
        return;
      }
      onRead({ rows, missing });
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error && e.message ? e.message : 'Se cortó la conexión con la app.');
    }
  }

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
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={read} disabled={reading || disabled || total === 0}>
                {reading ? 'Leyendo…' : `Leer ${plural(total, 'publicación', 'publicaciones')}`}
              </Button>
              {progress ? (
                <span className="text-sm tabular-nums" role="status">
                  {progress.total > 0 ? `Leyendo ${progress.done} de ${progress.total}…` : 'Buscando las publicaciones…'} No cierres esta pestaña.
                </span>
              ) : null}
              {error ? (
                <span className="text-sm text-destructive" role="alert">
                  {error}
                </span>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
