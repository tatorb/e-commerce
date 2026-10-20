'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardPaste, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sameText } from '@/domain/titles';
import { formatDateTime } from '@/lib/format';
import type { Capture } from '@/lib/queries/title-step';
import { deleteCaptureAction, pasteSuggestionsAction, readSuggestionsAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';
import { BrandMark } from '@/components/ui/brand-loader';

// Lo que sugiere el buscador del canal para cada semilla: leído por la app o
// pegado a mano. Todo queda guardado con fecha.

function SeedRow({
  accountSlug,
  publicationId,
  seed,
  captures,
  auto,
  channelName,
  timeZone,
}: {
  accountSlug: string;
  publicationId: string;
  seed: string;
  captures: Capture[];
  auto: boolean;
  channelName: string;
  timeZone: string;
}) {
  const [pasting, setPasting] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const action = useStepAction();
  const total = new Set(captures.flatMap((c) => c.suggestions)).size;
  const last = captures.reduce<Date | null>((d, c) => (!d || c.capturedAt > d ? c.capturedAt : d), null);

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 text-left text-sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          disabled={captures.length === 0}
        >
          {captures.length > 0 ? (
            open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <span className="w-4" />
          )}
          <span className="font-medium">«{seed}»</span>
          <span className="text-muted-foreground">
            {captures.length === 0
              ? 'sin sugerencias todavía'
              : `${total === 1 ? '1 sugerencia' : `${total} sugerencias`}, la última del ${last ? formatDateTime(last, timeZone) : ''}`}
          </span>
        </button>
        <div className="flex flex-wrap gap-1.5">
          {auto ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => action.run(() => readSuggestionsAction(accountSlug, publicationId, seed, false), undefined, 'read')}
                pending={action.running('read')}
                disabled={action.pending}
              >
                <Search className="h-3.5 w-3.5" />
                Leer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => action.run(() => readSuggestionsAction(accountSlug, publicationId, seed, true), undefined, 'expand')}
                pending={action.running('expand')}
                disabled={action.pending}
                title="Suma la semilla con cada letra de la a a la z"
              >
                Ampliar con letras
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setPasting((p) => !p)} disabled={action.pending}>
            <ClipboardPaste className="h-3.5 w-3.5" />
            Pegar a mano
          </Button>
        </div>
      </div>
      {action.running('read') || action.running('expand') ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <BrandMark />
          Leyendo… puede tardar unos segundos.
        </p>
      ) : null}
      <StatusText status={action.status} className="block" />
      {pasting ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Escribí «{seed}» en el buscador de {channelName} y copiá lo que te sugiere, una sugerencia por línea.
          </p>
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={`${seed} …`} aria-label={`Sugerencias para ${seed}`} />
          <Button
            size="sm"
            onClick={() =>
              action.run(
                () => pasteSuggestionsAction(accountSlug, publicationId, seed, text),
                () => {
                  setText('');
                  setPasting(false);
                  setOpen(true);
                },
                'paste',
              )
            }
            pending={action.running('paste')}
            disabled={action.pending || !text.trim()}
          >
            Guardar sugerencias
          </Button>
        </div>
      ) : null}
      {open && captures.length > 0 ? (
        <ul className="space-y-1.5 pl-6">
          {captures.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">«{c.query}»</span>
                <span className="text-xs text-muted-foreground">
                  {c.source === 'AUTO' ? 'leídas' : 'a mano'} el {formatDateTime(c.capturedAt, timeZone)}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => action.run(() => deleteCaptureAction(accountSlug, c.id))}
                  aria-label={`Borrar las sugerencias de ${c.query}`}
                  title="Borrar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-muted-foreground">{c.suggestions.length > 0 ? c.suggestions.join(' · ') : 'Sin sugerencias.'}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SuggestionsPanel({
  accountSlug,
  publicationId,
  seeds,
  captures,
  auto,
  channelName,
  timeZone,
}: {
  accountSlug: string;
  publicationId: string;
  seeds: string[];
  captures: Capture[];
  auto: boolean;
  channelName: string;
  timeZone: string;
}) {
  if (seeds.length === 0) return <p className="text-sm text-muted-foreground">Primero guardá al menos una semilla.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {auto
          ? `La app puede leer sola las sugerencias de ${channelName}. Si un día no anda, pegalas a mano.`
          : `La app no puede leer sola las sugerencias de ${channelName}: pegalas a mano. Podés volver a probar en Ajustes, Conexión.`}
      </p>
      <ul className="divide-y rounded-md border">
        {seeds.map((seed) => (
          <SeedRow
            key={seed}
            accountSlug={accountSlug}
            publicationId={publicationId}
            seed={seed}
            captures={captures.filter((c) => sameText(c.seed, seed))}
            auto={auto}
            channelName={channelName}
            timeZone={timeZone}
          />
        ))}
      </ul>
    </div>
  );
}
