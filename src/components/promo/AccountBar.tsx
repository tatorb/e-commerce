'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OverviewFilter } from '@/lib/promo/overview';
import { cn } from '@/lib/utils/cn';
import { classifyAction, generatePlansAction, sweepAction } from '@/app/a/[cuenta]/promociones/actions';

// Lo de toda la cuenta: leer las invitaciones del canal y que la regla
// proponga las etiquetas de los productos en Automático. Si el freno de
// emergencia está puesto, lo avisa.

export function AccountBar({
  accountSlug,
  paused,
  sweptAt,
  classifiedAt,
  filter,
  filtered,
}: {
  accountSlug: string;
  // El freno de emergencia de la cuenta está puesto.
  paused: boolean;
  sweptAt: string;
  classifiedAt: string;
  // El filtro de la lista: "Proponer etiquetas" mira solo los productos que lo pasan.
  filter: OverviewFilter;
  // Cuántos pasan el filtro, si hay alguno puesto. Null: sin filtro, toda la cuenta.
  filtered: number | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [proposal, setProposal] = useState<{ changed: number; products: number; rows: { name: string; lines: string[] }[] } | null>(null);
  const fail = (text?: string) => setNotice({ kind: 'error', text: text ?? 'Se cortó la conexión con la app.' });
  // Con un filtro puesto en la lista, la regla mira solo esos productos.
  const scope = filtered === null ? undefined : filter;
  const where = filtered === null ? '' : filtered === 1 ? ' del producto filtrado' : ` de los ${filtered} productos filtrados`;

  // Lee de a vueltas hasta terminar: cada vuelta sigue donde quedó la anterior.
  const sweep = () =>
    start(async () => {
      let items = 0;
      for (let i = 0; i < 40; i++) {
        const r = await sweepAction(accountSlug, i === 0).catch(() => null);
        if (!r || !r.ok) return fail(r?.error);
        if (r.error) return fail(r.error);
        items += r.items;
        setNotice({ kind: 'ok', text: `Leyendo las invitaciones: ${items} guardadas.` });
        if (!r.pending) break;
      }
      setNotice({ kind: 'ok', text: `Invitaciones leídas: ${items} publicaciones con campañas.` });
      router.refresh();
    });

  const propose = () =>
    start(async () => {
      const r = await classifyAction(accountSlug, false, scope).catch(() => null);
      if (!r || !r.ok) return fail(r?.error);
      if (r.changed === 0) return setNotice({ kind: 'ok', text: r.products === 0 ? 'No hay productos en Automático para etiquetar: la regla mira solo esos.' : `La regla miró ${r.products} ${r.products === 1 ? 'producto' : 'productos'} en Automático${filtered === null ? '' : ', de los filtrados,'} y no cambia ninguna etiqueta.` });
      setNotice(null);
      setProposal(r);
    });

  const saveProposal = () =>
    start(async () => {
      setProposal(null);
      const r = await classifyAction(accountSlug, true, scope).catch(() => null);
      if (!r || !r.ok) return fail(r?.error);
      let left = r.left;
      while (left.length > 0) {
        const more = await generatePlansAction(accountSlug, left).catch(() => null);
        if (!more || !more.ok) return fail(more?.error);
        left = more.left;
      }
      setNotice({ kind: 'ok', text: `Etiquetas guardadas en ${r.changed} productos, con su almanaque rearmado.` });
      router.refresh();
    });

  return (
    <div className="space-y-2">
      {paused ? (
        <p className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm">
          <strong>Freno de emergencia puesto.</strong> La app no prende ni apaga nada en el canal, en ningún producto, hasta que se suelte en la pestaña Reglas. No se borra nada.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" access="view" disabled={busy} pending={busy} onClick={sweep}>
          <RefreshCw />
          Leer invitaciones del canal
        </Button>
        <Button size="sm" variant="outline" disabled={busy || filtered === 0} title="La regla mira solo los productos en Automático: en Manual el almanaque lo armás vos y no usa etiquetas." onClick={propose}>
          <Sparkles />
          Proponer etiquetas{where}
        </Button>
        <span className="text-xs text-muted-foreground">
          Invitaciones leídas {sweptAt}. Última clasificación {classifiedAt}.
        </span>
      </div>
      {notice ? <p className={cn('rounded-lg border px-3 py-2 text-sm', notice.kind === 'error' ? 'border-alert/40 bg-alert/10' : 'border-primary/30 bg-primary/5')}>{notice.text}</p> : null}
      {proposal ? (
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-medium">
            La regla cambiaría etiquetas en {proposal.changed} de {proposal.products} productos{filtered === null ? '' : ' filtrados'}
          </p>
          <p className="text-sm text-muted-foreground">Lo puesto a mano no se toca. Al guardar, se rearma el almanaque de los que cambian, de hoy en adelante.</p>
          <ul className="mt-2 max-h-80 divide-y overflow-y-auto rounded-lg border text-sm">
            {proposal.rows.map((r) => (
              <li key={r.name} className="px-3 py-2">
                <p className="font-medium">{r.name}</p>
                {r.lines.map((l) => (
                  <p key={l} className="text-muted-foreground">
                    {l}
                  </p>
                ))}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={saveProposal}>
              Guardar las etiquetas propuestas
            </Button>
            <Button size="sm" variant="ghost" access="view" onClick={() => setProposal(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
