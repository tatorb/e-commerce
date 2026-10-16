'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, WandSparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatUsd, plural } from '@/lib/format';
import { generateProposalAction } from '@/app/a/[cuenta]/publicaciones/proposal-actions';
import type { GenerateOutcome } from '@/lib/proposals';

type Item = { id: string; title: string };
type Phase = 'idle' | 'running' | 'done';

// De a dos por vez: alcanza para avanzar rápido sin chocar con el límite de
// pedidos de la API.
const CONCURRENCY = 2;
const ESTIMATED_COST = 0.1;
const RETRY_WAIT_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Genera propuestas para una tanda de publicaciones, una por pedido. */
export function BulkProposalDialog({
  accountSlug,
  items,
  readyTotal,
  viewing,
  disabledReason,
}: {
  accountSlug: string;
  // Las primeras de la tanda, en el orden de la lista.
  items: Item[];
  // Cuántas de las que se ven están listas para una propuesta nueva.
  readyTotal: number;
  viewing: number;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [done, setDone] = useState(0);
  const [ok, setOk] = useState(0);
  const [spent, setSpent] = useState(0);
  const [failures, setFailures] = useState<{ title: string; error: string }[]>([]);
  const [stopping, setStopping] = useState(false);
  const stop = useRef(false);

  function reset() {
    setPhase('idle');
    setDone(0);
    setOk(0);
    setSpent(0);
    setFailures([]);
    setStopping(false);
    stop.current = false;
  }

  async function call(item: Item): Promise<GenerateOutcome> {
    try {
      return await generateProposalAction(accountSlug, item.id);
    } catch {
      return { ok: false, error: 'Se cortó la conexión con la app.', costUsd: 0 };
    }
  }

  async function run() {
    reset();
    setPhase('running');
    let next = 0;
    const worker = async () => {
      while (!stop.current && next < items.length) {
        const item = items[next++];
        let r = await call(item);
        // Límite de pedidos o Claude saturado: se espera y se reintenta una vez.
        if (!r.ok && r.retryable && !stop.current) {
          setSpent((s) => s + r.costUsd);
          await sleep(RETRY_WAIT_MS);
          r = await call(item);
        }
        setSpent((s) => s + r.costUsd);
        setDone((d) => d + 1);
        if (r.ok) setOk((n) => n + 1);
        else {
          const error = r.error;
          setFailures((f) => [...f, { title: item.title, error }]);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setPhase('done');
    router.refresh();
  }

  const total = items.length;
  const skipped = viewing - readyTotal;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Mientras corre no se cierra: hay que detenerla primero.
        if (phase === 'running') return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <WandSparkles className="h-4 w-4" />
        Generar propuestas
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar propuestas con IA</DialogTitle>
          <DialogDescription>
            La IA arma una propuesta para cada publicación según el estándar. No cambia nada hasta que se apruebe.
          </DialogDescription>
        </DialogHeader>

        {phase === 'idle' ? (
          <div className="space-y-2 text-sm">
            {disabledReason ? (
              <p>{disabledReason}</p>
            ) : total === 0 ? (
              <p>
                Ninguna de las publicaciones que estás viendo está lista para una propuesta nueva. Se generan para las que
                están en Importado o Medido.
              </p>
            ) : (
              <>
                <p>
                  Se van a generar <strong>{plural(total, 'propuesta')}</strong> para las publicaciones que estás viendo,
                  de a dos por vez.
                  {readyTotal > total ? ` Hay ${readyTotal} listas: se toman las primeras ${total}, en el orden de la lista.` : ''}
                </p>
                {skipped > 0 ? (
                  <p className="text-muted-foreground">
                    {skipped === 1
                      ? 'Se saltea 1 que ya tiene propuesta o está en otra etapa.'
                      : `Se saltean ${skipped} que ya tienen propuesta o están en otra etapa.`}
                  </p>
                ) : null}
                <p className="text-muted-foreground">
                  Costo estimado: unos {formatUsd(total * ESTIMATED_COST)}. Mientras se generan, dejá esta pestaña
                  abierta.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
              />
            </div>
            <p className="tabular-nums">
              {phase === 'running' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Van {done} de {total} · {ok} {ok === 1 ? 'lista' : 'listas'} · gastado {formatUsd(spent)}
                </span>
              ) : (
                <>
                  Listo. {plural(ok, 'propuesta generada', 'propuestas generadas')}
                  {failures.length > 0 ? `, ${failures.length} con error` : ''}
                  {done < total ? `, ${total - done} sin hacer porque la detuviste` : ''}. Gastado {formatUsd(spent)}.
                </>
              )}
            </p>
            {failures.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto divide-y rounded-md border">
                {failures.map((f, i) => (
                  <li key={i} className="px-3 py-2">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-destructive"> · {f.error}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {phase === 'idle' ? (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={run} disabled={disabledReason !== null || total === 0}>
                Generar {plural(total, 'propuesta')}
              </Button>
            </>
          ) : phase === 'running' ? (
            <Button
              type="button"
              variant="outline"
              disabled={stopping}
              onClick={() => {
                stop.current = true;
                setStopping(true);
              }}
            >
              {stopping ? 'Deteniendo…' : 'Detener'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
