'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import type { ScopeChangePreview } from '@/lib/competitors';
import { changeCompetitorScopeAction, previewCompetitorScopeAction } from '@/app/a/[cuenta]/tipos-y-marcas/actions';

// Ajustes, Tipos y marcas: si la competencia de cada tipo es de cada
// publicación o del producto. Antes de cambiar, dice cuántos productos y
// competidores se mueven, y se confirma.

type Scope = 'PUBLICATION' | 'PRODUCT';

const LABEL: Record<Scope, string> = { PUBLICATION: 'Por publicación', PRODUCT: 'Por producto' };

function previewText(p: ScopeChangePreview): string {
  if (p.competitors === 0) return `${plural(p.products, 'producto tiene', 'productos tienen')} este tipo, y ninguno tiene competencia cargada: no se mueve nada.`;
  if (p.to === 'PRODUCT') {
    const kept = p.competitors - p.repeated;
    return `Se junta la competencia de ${plural(p.productsWithCompetitors, 'producto', 'productos')}: ${plural(p.competitors, 'competidor cargado', 'competidores cargados')} en sus publicaciones quedan en ${plural(kept, 'competidor', 'competidores')} del producto${p.repeated > 0 ? `, porque ${plural(p.repeated, 'está repetido', 'están repetidos')} (mismo link: queda el de fecha de relevamiento más nueva)` : ''}. Desde cualquier publicación se va a ver y guardar esa misma lista.`;
  }
  return `La competencia de ${plural(p.productsWithCompetitors, 'producto', 'productos')} (${plural(p.competitors, 'competidor', 'competidores')}) se copia a cada una de sus ${plural(p.publications, 'publicación', 'publicaciones')}. Después, cada publicación tiene su propia lista.`;
}

export function CompetitorScopeEditor({
  accountSlug,
  types,
  canWrite,
}: {
  accountSlug: string;
  types: { name: string; scope: Scope; products: number }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState<ScopeChangePreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function ask(type: string, to: Scope) {
    setBusy(type);
    setMessage(null);
    const r = await previewCompetitorScopeAction(accountSlug, type, to).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setAsking(r.preview);
  }

  async function apply() {
    if (!asking) return;
    const { type, to } = asking;
    setAsking(null);
    setBusy(type);
    const r = await changeCompetitorScopeAction(accountSlug, type, to).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    setMessage(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
    router.refresh();
  }

  if (types.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay tipos de producto.</p>;

  return (
    <div className="space-y-3">
      {message ? (
        <p role="status" className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')}>
          {message.text}
        </p>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {types.map((t) => (
          <li key={t.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">{plural(t.products, 'producto', 'productos')}</p>
            </div>
            <div className="flex gap-1" role="group" aria-label={`Competencia de ${t.name}`}>
              {(['PUBLICATION', 'PRODUCT'] as const).map((s) => (
                <Button
                  key={s}
                  access="productos"
                  size="sm"
                  variant={t.scope === s ? 'default' : 'outline'}
                  aria-pressed={t.scope === s}
                  disabled={!canWrite || busy !== null || t.scope === s}
                  pending={busy === t.name && t.scope !== s}
                  onClick={() => ask(t.name, s)}
                >
                  {LABEL[s]}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={asking !== null} onOpenChange={(open) => (open ? null : setAsking(null))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              ¿Pasar «{asking?.type}» a «{asking ? LABEL[asking.to] : ''}»?
            </DialogTitle>
            <DialogDescription>{asking ? previewText(asking) : null}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">No se borra ninguna competencia: se junta o se copia. La comparación de precios sigue usando el precio y las cuotas de cada publicación.</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setAsking(null)}>
              Cancelar
            </Button>
            <Button access="productos" onClick={apply}>
              Cambiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
