'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/domain/money';
import { COMPETITIONS, COMPETITION_LABEL, LIFECYCLES, LIFECYCLE_LABEL, OBJECTIVE_LABEL, PRIORITIES, PRIORITY_LABEL, tagsText } from '@/domain/promo/tags';
import type { AppliedAction, DueAction } from '@/lib/promo/apply';
import type { OverviewFilter, OverviewRow } from '@/lib/promo/overview';
import { cn } from '@/lib/utils/cn';
import { applyAction, filteredProductsAction, generatePlansAction, previewApplyAction, setTagsAction, type TagInput } from '@/app/a/[cuenta]/promociones/actions';
import { pct, shortDate } from './format';

// La lista de Promociones: cada producto con sus etiquetas y cómo están sus
// ofertas. Eligiendo varios, se les pone una etiqueta, se rearma su almanaque
// o se manda lo que toca hoy, con la vista previa antes.

const SELECT = 'h-8 rounded-md border border-input bg-card px-2 text-xs shadow-sm';

export function PromoList({ accountSlug, timeZone, rows, total, filter }: { accountSlug: string; timeZone: string; rows: OverviewRow[]; total: number; filter: OverviewFilter }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<DueAction[] | null>(null);
  const [results, setResults] = useState<AppliedAction[] | null>(null);
  const ids = [...selected];
  const fail = (text?: string) => setNotice({ kind: 'error', text: text ?? 'Se cortó la conexión con la app.' });

  const tag = (change: TagInput, what: string) =>
    start(async () => {
      const r = await setTagsAction(accountSlug, ids, change).catch(() => null);
      if (!r || !r.ok) return fail(r?.error);
      setNotice({ kind: 'ok', text: `${what} en ${r.changed} ${r.changed === 1 ? 'producto' : 'productos'}. Almanaque rearmado en ${r.replanned}${r.replanned < r.changed ? '; los demás se rearman con el botón Rearmar' : ''}.` });
      router.refresh();
    });

  // Rearma de a tandas, hasta terminar.
  const replan = () =>
    start(async () => {
      let left = ids;
      let done = 0;
      const skipped: string[] = [];
      while (left.length > 0) {
        const r = await generatePlansAction(accountSlug, left).catch(() => null);
        if (!r || !r.ok) return fail(r?.error);
        done += r.done;
        skipped.push(...r.skipped);
        left = r.left;
        setNotice({ kind: 'ok', text: `Rearmando: ${done} de ${ids.length}.` });
      }
      setNotice({ kind: 'ok', text: `Almanaque rearmado en ${done} ${done === 1 ? 'producto' : 'productos'}.${skipped.length > 0 ? ` Sin armar: ${skipped.slice(0, 5).join(' ')}${skipped.length > 5 ? ` y ${skipped.length - 5} más.` : ''}` : ''}` });
      router.refresh();
    });

  const askPreview = () =>
    start(async () => {
      setResults(null);
      const r = await previewApplyAction(accountSlug, { productIds: ids }).catch(() => null);
      if (!r || !r.ok) return fail(r?.error);
      if (r.actions.length === 0) return setNotice({ kind: 'ok', text: 'En los elegidos no hay nada para prender ni apagar hoy.' });
      setNotice(null);
      setPreview(r.actions);
    });

  const apply = () =>
    start(async () => {
      setPreview(null);
      const all: AppliedAction[] = [];
      for (let i = 0; i < 20; i++) {
        const r = await applyAction(accountSlug, { productIds: ids }).catch(() => null);
        if (!r || !r.ok) return fail(r?.error);
        all.push(...r.done);
        setNotice({ kind: 'ok', text: `Mandando al canal: ${all.length} hechos.` });
        if (r.pending === 0 || r.done.length === 0) break;
      }
      const failed = all.filter((a) => !a.ok).length;
      setResults(all);
      setNotice({ kind: failed > 0 ? 'error' : 'ok', text: `${all.length - failed} hechos${failed > 0 ? `, ${failed} no se pudieron: se reintentan solos y quedan en la bitácora` : ''}.` });
      router.refresh();
    });

  const pickAll = () =>
    start(async () => {
      const r = await filteredProductsAction(accountSlug, filter).catch(() => null);
      if (!r || !r.ok) return fail(r?.error);
      setSelected(new Set(r.productIds));
    });

  return (
    <div className="overflow-clip rounded-2xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/40 px-4 py-3 text-sm">
        <input
          type="checkbox"
          aria-label="Elegir todos los de esta página"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={rows.length > 0 && rows.every((r) => selected.has(r.productId))}
          disabled={rows.length === 0 || busy}
          onChange={(e) => setSelected(new Set(e.target.checked ? rows.map((r) => r.productId) : []))}
        />
        <span className="text-muted-foreground">{ids.length > 0 ? `${ids.length} elegidos` : `${total} ${total === 1 ? 'producto' : 'productos'}`}</span>
        {total > rows.length ? (
          <Button size="sm" variant="ghost" access="view" disabled={busy} onClick={pickAll}>
            Elegir los {total}
          </Button>
        ) : null}
        {ids.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <select className={SELECT} value="" disabled={busy} aria-label="Poner ciclo de vida" onChange={(e) => e.target.value && tag({ lifecycle: e.target.value as (typeof LIFECYCLES)[number] }, 'Ciclo de vida puesto')}>
              <option value="">Ciclo de vida…</option>
              {LIFECYCLES.map((l) => (
                <option key={l} value={l}>
                  {LIFECYCLE_LABEL[l]}
                </option>
              ))}
            </select>
            <select
              className={SELECT}
              value=""
              disabled={busy}
              aria-label="Poner competencia"
              onChange={(e) => e.target.value && tag({ competition: e.target.value === 'none' ? null : (e.target.value as (typeof COMPETITIONS)[number]) }, 'Competencia puesta')}
            >
              <option value="">Competencia…</option>
              {COMPETITIONS.map((c) => (
                <option key={c} value={c}>
                  {COMPETITION_LABEL[c]}
                </option>
              ))}
              <option value="none">Sin etiqueta</option>
            </select>
            <select
              className={SELECT}
              value=""
              disabled={busy}
              aria-label="Poner prioridad"
              onChange={(e) => e.target.value && tag({ priority: e.target.value === 'none' ? null : (e.target.value as (typeof PRIORITIES)[number]) }, 'Prioridad puesta')}
            >
              <option value="">Prioridad…</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
              <option value="none">Sin prioridad</option>
            </select>
            <select className={SELECT} value="" disabled={busy} aria-label="Control de stock" onChange={(e) => e.target.value && tag({ stockControl: e.target.value === 'on' }, 'Control de stock cambiado')}>
              <option value="">Control de stock…</option>
              <option value="on">Activar</option>
              <option value="off">Desactivar</option>
            </select>
            <Button size="sm" variant="outline" disabled={busy} onClick={replan}>
              Rearmar almanaque
            </Button>
            <Button size="sm" access="subir" disabled={busy} pending={busy} onClick={askPreview}>
              Ver qué toca hoy
            </Button>
          </div>
        ) : null}
      </div>

      {notice ? <p className={cn('border-b px-4 py-2 text-sm', notice.kind === 'error' ? 'bg-alert/10' : 'bg-primary/5')}>{notice.text}</p> : null}

      {preview ? (
        <div className="border-b p-4">
          <p className="font-medium">
            Vista previa: {preview.filter((a) => a.action === 'ON').length} para prender y {preview.filter((a) => a.action === 'OFF').length} para apagar
          </p>
          <Actions actions={preview} />
          <div className="mt-3 flex gap-2">
            <Button size="sm" access="subir" disabled={busy} onClick={apply}>
              Confirmar y mandar al canal
            </Button>
            <Button size="sm" variant="ghost" access="view" onClick={() => setPreview(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      {results && results.length > 0 ? (
        <div className="border-b p-4">
          <p className="font-medium">Lo que se mandó</p>
          <Actions actions={results} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Ningún producto cumple lo que se pide.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.productId} className="flex gap-3 px-4 py-3">
              <input
                type="checkbox"
                aria-label={`Elegir ${r.name}`}
                className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                checked={selected.has(r.productId)}
                disabled={busy}
                onChange={(e) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(r.productId);
                    else next.delete(r.productId);
                    return next;
                  })
                }
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <Link href={`/a/${accountSlug}/promociones/${r.productId}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {r.brand ? `${r.brand} · ` : ''}
                    {r.options} {r.options === 1 ? 'publicación' : 'publicaciones'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {tagsText(r.tags).map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                  {r.tags.lifecycle === null ? <Badge variant="outline">Sin ciclo de vida</Badge> : null}
                  {r.objective ? <span className="self-center text-muted-foreground">Objetivo: {OBJECTIVE_LABEL[r.objective]}</span> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.on} adentro · {r.planned} por entrar · {r.out} afuera
                  {r.failed > 0 ? <span className="font-medium text-destructive"> · {r.failed} no se pudo</span> : null}
                  {r.next ? ` · Sigue: ${r.next.name}, ${shortDate(r.next.start, timeZone)}` : ''}
                  {r.tags.lifecycle !== null && r.plannedAt === null ? ' · Todavía sin almanaque' : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Actions({ actions }: { actions: (DueAction | AppliedAction)[] }) {
  return (
    <ul className="mt-2 max-h-80 divide-y overflow-y-auto rounded-lg border text-sm">
      {actions.map((a) => (
        <li key={`${a.itemId}:${a.action}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5">
          <Badge variant={a.action === 'ON' ? 'success' : 'secondary'}>{a.action === 'ON' ? 'Prender' : 'Apagar'}</Badge>
          <span className="font-mono text-xs">{a.externalId ?? ''}</span>
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground">{a.productName}: </span>
            {a.kind === 'OWN_DISCOUNT' ? `descuento propio${a.action === 'ON' ? ` de ${pct(a.discountPct)}` : ''}` : a.name}
            {a.action === 'ON' && a.price !== null ? `, el comprador paga ${formatPrice(a.price)}` : ''}
            {a.action === 'ON' && a.marginPct !== null ? `, deja ${pct(a.marginPct)}` : ''}
            {a.action === 'ON' && a.capped ? ', al tope' : ''}
          </span>
          {'ok' in a ? <span className={cn('text-xs', a.ok ? 'text-muted-foreground' : 'text-destructive')}>{a.ok ? 'Hecho' : a.message}</span> : null}
        </li>
      ))}
    </ul>
  );
}
