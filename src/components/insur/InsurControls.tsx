'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { approveInsurAction, saveInsurSettingsAction, setInsurLinkAction } from '@/app/a/[cuenta]/sistema-insur/actions';
import type { DoubtfulLink } from '@/lib/insur';

// Lo que se toca en la pantalla Sistema de Insur: pedirle a la extensión que
// lea ahora, aprobar la primera corrida, mover la fecha de corte y resolver
// los cruces dudosos.

type Status = { kind: 'ok' | 'error'; text: string } | null;
type ExtensionState = {
  version: string | null;
  hora?: string;
  corriendo?: { desde: number; etapa: string; detalle: string } | null;
  ultimo?: { cuando: number; ok: boolean; texto: string } | null;
  error?: string;
  // Cuántos minutos lleva la corrida, calculado al recibir el estado.
  minutos?: number;
};

const STAGE: Record<string, string> = { empezando: 'Empezando', listado: 'Leyendo el listado de Insur', fichas: 'Leyendo fichas de Insur', enviando: 'Mandando a la app' };

/** La extensión de este Chrome: si está, cómo va, y el botón para leer ahora. */
export function InsurExtensionCard({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<ExtensionState | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [previewOnly, setPreviewOnly] = useState(false);

  useEffect(() => {
    let wasRunning = false;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== location.origin || e.data?.origen !== 'mrb-insur') return;
      if (e.data.tipo === 'estado') {
        const next = e.data as ExtensionState;
        setState({ ...next, minutos: next.corriendo ? Math.max(0, Math.round((Date.now() - next.corriendo.desde) / 60_000)) : 0 });
        // Terminó una corrida: la pantalla se vuelve a cargar con su resumen.
        if (wasRunning && !e.data.corriendo) router.refresh();
        wasRunning = Boolean(e.data.corriendo);
      }
      if (e.data.tipo === 'pedido') setStatus(e.data.ok ? { kind: 'ok', text: 'La extensión empezó a leer Insur. Tarda entre 7 y 20 minutos.' } : { kind: 'error', text: e.data.error ?? 'La extensión no respondió.' });
    };
    window.addEventListener('message', onMessage);
    const ask = () => window.postMessage({ origen: 'mrb-app-insur', tipo: 'estado' }, location.origin);
    ask();
    const timer = setInterval(ask, 4000);
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
    };
  }, [router]);

  const installed = Boolean(state?.version);
  const running = state?.corriendo ?? null;
  return (
    <SectionCard
      title="La extensión en este Chrome"
      description="La lectura la hace la extensión «Insur → E-commerce», con Chrome abierto y la sesión de Insur y la de la app iniciadas. Corre sola una vez por día, a la hora que se elige en su ventana."
    >
      <SectionBody>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {installed ? <Badge variant="secondary">Instalada, versión {state!.version}</Badge> : <Badge variant="outline">No está en este Chrome</Badge>}
          {installed && state?.hora ? <span className="text-muted-foreground">Lee todos los días a las {state.hora}.</span> : null}
          {state?.error ? <span className="text-destructive">{state.error}</span> : null}
        </p>
        {running ? (
          <p className="text-sm">
            {STAGE[running.etapa] ?? 'Trabajando'}. {running.detalle} Va {state?.minutos ?? 0} min.
          </p>
        ) : null}
        {installed && state?.ultimo && !running ? (
          <p className={state.ultimo.ok ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}>
            Última corrida desde este Chrome, {new Date(state.ultimo.cuando).toLocaleString('es-AR')}: {state.ultimo.texto}
          </p>
        ) : null}
        {installed && canRun ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              access="productos"
              disabled={Boolean(running)}
              onClick={() => {
                setStatus(null);
                window.postMessage({ origen: 'mrb-app-insur', tipo: 'correr', soloMostrar: previewOnly }, location.origin);
              }}
            >
              Leer Insur ahora
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={previewOnly} onChange={(e) => setPreviewOnly(e.target.checked)} />
              Solo mostrar, sin cambiar nada
            </label>
            <StatusText status={status} />
          </div>
        ) : null}
        {!installed ? <p className="text-sm text-muted-foreground">Se instala desde la carpeta extension-insur del proyecto: las instrucciones están en su archivo LEEME.</p> : null}
      </SectionBody>
    </SectionCard>
  );
}

/** Modo prueba: el botón que aprueba la primera corrida. */
export function InsurApproveCard({ accountSlug, hasRun, changes }: { accountSlug: string; hasRun: boolean; changes: { stock: number; cost: number } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  return (
    <SectionCard
      title="Modo prueba"
      description="Hasta que se apruebe, ninguna corrida cambia el stock ni el costo: solo arma el resumen de lo que haría. Al aprobar, las corridas siguientes corrigen solas, sin revisión."
    >
      <SectionBody>
        {!hasRun ? (
          <p className="text-sm text-muted-foreground">Todavía no hubo una corrida terminada para revisar. Corré la extensión y mirá el resumen acá abajo.</p>
        ) : asking ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              ¿Aprobar? Desde la corrida siguiente, el stock y el costo de cada medida cruzada se corrigen con los de Insur y las cantidades suben a Mercado Libre.
              {changes ? ` La última corrida cambiaría ${changes.stock} de stock y ${changes.cost} de costo.` : ''}
            </span>
            <Button
              size="sm"
              access="productos"
              pending={pending}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await approveInsurAction(accountSlug);
                  setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
                  if (r.ok) router.refresh();
                })
              }
            >
              Sí, aplicar
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setAsking(false)}>
              No
            </Button>
          </div>
        ) : (
          <Button access="productos" onClick={() => setAsking(true)}>
            Aplicar
          </Button>
        )}
        <StatusText status={status} />
      </SectionBody>
    </SectionCard>
  );
}

/** La fecha de corte y cada cuánto se vuelve a leer cada ficha. */
export function InsurSettingsForm({ accountSlug, cutoff, fichaEveryDays, canEdit }: { accountSlug: string; cutoff: string; fichaEveryDays: number; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(cutoff);
  const [days, setDays] = useState(String(fichaEveryDays));
  const [status, setStatus] = useState<Status>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setStatus(null);
        start(async () => {
          const r = await saveInsurSettingsAction(accountSlug, { cutoff: value, fichaEveryDays: Number(days) });
          setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Fecha de corte</span>
        <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} disabled={!canEdit || pending} className="w-56" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Leer cada ficha cada (días)</span>
        <Input type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} disabled={!canEdit || pending} className="w-28" />
      </label>
      {canEdit ? (
        <Button type="submit" access="productos" pending={pending} disabled={pending || (value === cutoff && days === String(fichaEveryDays))}>
          Guardar
        </Button>
      ) : null}
      <StatusText status={status} />
    </form>
  );
}

/** Los cruces dudosos: a qué medida va cada uno, o ignorarlo. */
export function InsurDoubtfulList({ accountSlug, links, total, canEdit }: { accountSlug: string; links: DoubtfulLink[]; total: number; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const decide = (linkId: string, choice: { ignore: true } | { productId: string; key: string }) => {
    setStatus(null);
    setBusy(linkId);
    start(async () => {
      const r = await setInsurLinkAction(accountSlug, linkId, choice);
      setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
      setBusy(null);
      if (r.ok) router.refresh();
    });
  };
  if (links.length === 0) return <p className="text-sm text-muted-foreground">No hay cruces dudosos.</p>;
  return (
    <div className="space-y-3">
      <StatusText status={status} />
      <ul className="divide-y rounded-md border text-sm">
        {links.map((l) => (
          <li key={l.id} className="space-y-2 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{l.code}</span>
              {l.brand ? <span className="text-muted-foreground">{l.brand}</span> : null}
              <span className="text-muted-foreground">· {l.stock} en Córdoba y Santa Fe</span>
            </div>
            {l.detail ? <p className="text-muted-foreground">{l.detail}</p> : null}
            {l.reason ? <p>{l.reason}</p> : null}
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                {l.candidates.map((c) => (
                  <Button key={`${c.productId}|${c.key}`} size="sm" variant="outline" access="productos" disabled={pending} pending={pending && busy === l.id} onClick={() => decide(l.id, { productId: c.productId, key: c.key })}>
                    Va con {c.product}
                    {c.measure ? `, ${c.measure}` : ''}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" access="productos" disabled={pending} onClick={() => decide(l.id, { ignore: true })}>
                  Ignorar
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {total > links.length ? <p className="text-xs text-muted-foreground">Se muestran {links.length} de {total}. Al resolver estos aparecen los demás.</p> : null}
    </div>
  );
}
