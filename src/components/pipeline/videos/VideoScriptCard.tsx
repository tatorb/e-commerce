'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { withSharedNote } from '@/components/pipeline/info/SharedNote';
import { countWords, SCRIPT_LINE_MAX, SCRIPT_LINES_MAX, scriptSeconds } from '@/domain/video-edit';
import { proposeVideoScriptAction, saveVideoScriptAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import type { VideoScriptView } from '@/lib/video-script';

// El guión de la voz en off de los clips del producto. Se escribe antes de
// editar: Claude lo propone con la información de la publicación y la persona
// lo corrige. El editor acomoda después el video a lo que dura.

export function VideoScriptCard({
  accountSlug,
  publicationId,
  productId,
  script,
  targetSeconds,
  maxSeconds,
  voiceOn,
  sharedWith,
}: {
  accountSlug: string;
  publicationId: string;
  productId: string;
  script: VideoScriptView | null;
  // Cuánto dura el clip de la cuenta, y lo más que acepta el canal.
  targetSeconds: number;
  maxSeconds: number;
  // Si la cuenta tiene prendida la voz en off: sin ella el guión no se dice.
  voiceOn: boolean;
  // Cuántas publicaciones tiene el producto: el guión es de todas.
  sharedWith: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [which, setWhich] = useState<'save' | 'propose' | null>(null);
  const [lines, setLines] = useState<string[]>(script?.lines ?? []);
  const [saved, setSaved] = useState<string[]>(script?.lines ?? []);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Si el guión cambió en el servidor, por ejemplo porque lo propuso Claude, se muestra el nuevo.
  const fromServer = script?.lines ?? [];
  if (JSON.stringify(fromServer) !== JSON.stringify(saved)) {
    setSaved(fromServer);
    setLines(fromServer);
  }

  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const seconds = scriptSeconds(clean);
  const words = clean.reduce((sum, l) => sum + countWords(l), 0);
  const changed = JSON.stringify(clean) !== JSON.stringify(saved);
  const tooLong = seconds > maxSeconds;
  const set = (i: number, text: string) => setLines((old) => old.map((l, j) => (j === i ? text : l)));
  const move = (i: number, by: number) =>
    setLines((old) => {
      const next = [...old];
      const [l] = next.splice(i, 1);
      next.splice(i + by, 0, l);
      return next;
    });

  function save() {
    setStatus(null);
    setWhich('save');
    startTransition(async () => {
      const r = await saveVideoScriptAction(accountSlug, productId, clean).catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
      setStatus(r.ok ? { kind: 'ok', text: clean.length > 0 ? 'Guión guardado.' : 'Guión borrado.' } : { kind: 'error', text: r.error });
      router.refresh();
    });
  }

  function propose() {
    setStatus(null);
    setWhich('propose');
    setConfirming(false);
    startTransition(async () => {
      const r = await proposeVideoScriptAction(accountSlug, publicationId, true).catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
      setStatus(r.ok ? { kind: 'ok', text: `Claude escribió el guión. Revisalo antes de editar el video.${r.costUsd > 0 ? ` Costó US$ ${r.costUsd.toFixed(3).replace('.', ',')}.` : ''}` } : { kind: 'error', text: r.error });
      router.refresh();
    });
  }

  const length =
    clean.length === 0
      ? null
      : `${words} palabras, unos ${Math.round(seconds)} segundos. ${
          tooLong
            ? `El clip puede durar hasta ${maxSeconds}: acortalo.`
            : seconds > targetSeconds
              ? `El clip se pide de ${targetSeconds}: el editor lo va a hacer más largo para que entre.`
              : `Entra en el clip de ${targetSeconds}.`
        }`;

  return (
    <SectionCard
      title="Guión del clip"
      description={withSharedNote(
        'Lo que dice la voz en off mientras se ve el unboxing. No relata el video: aprovecha ese tiempo para dar las compatibilidades y resolver las dudas, como la imagen con texto. Se escribe antes de editar, y el editor acomoda el video a lo que dura.',
        sharedWith,
      )}
    >
      <div className="space-y-4 p-4">
        {!voiceOn ? (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            La voz en off está apagada en esta cuenta: el guión se puede escribir, pero no se dice. Se prende en Ajustes, Protocolos de fotos, Edición de videos.
          </p>
        ) : null}
        {lines.length > 0 ? (
          <ol className="space-y-2">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-5 pt-2 text-right text-sm text-muted-foreground">{i + 1}.</span>
                <textarea
                  aria-label={`Frase ${i + 1}`}
                  value={line}
                  rows={2}
                  maxLength={SCRIPT_LINE_MAX}
                  onChange={(e) => set(i, e.target.value)}
                  disabled={pending}
                  className="min-h-[2.75rem] flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                />
                <div className="flex gap-0.5">
                  <Button type="button" variant="ghost" size="icon" title="Subir" disabled={pending || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" title="Bajar" disabled={pending || i === lines.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" title="Sacar la frase" disabled={pending} onClick={() => setLines((old) => old.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no hay guión. Pedíselo a Claude o escribilo frase por frase.</p>
        )}
        {length ? <p className={`text-xs ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>{length}</p> : null}
        {script && !changed ? (
          <p className="text-xs text-muted-foreground">
            {script.source === 'claude' ? 'Lo escribió Claude y todavía nadie lo corrigió.' : `Corregido a mano${script.updatedBy ? ` por ${script.updatedBy}` : ''}.`} Los clips que ya se
            editaron no cambian: para que digan el guión nuevo, pedilos de nuevo.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending || lines.length >= SCRIPT_LINES_MAX} onClick={() => setLines((old) => [...old, ''])}>
            <Plus />
            Agregar frase
          </Button>
          {clean.length > 0 || saved.length > 0 ? (
            <Popover open={confirming} onOpenChange={setConfirming}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={pending} pending={pending && which === 'propose'}>
                  <Sparkles />
                  Pedir otro a Claude
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4">
                <p className="text-sm">Claude escribe el guión de nuevo y reemplaza el que está, con lo que hayas corregido.</p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                    Volver
                  </Button>
                  <Button size="sm" onClick={propose}>
                    Reemplazar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Button type="button" size="sm" disabled={pending} pending={pending && which === 'propose'} onClick={propose}>
              <Sparkles />
              Pedir el guión a Claude
            </Button>
          )}
          <Button type="button" size="sm" disabled={pending || !changed || tooLong} pending={pending && which === 'save'} onClick={save}>
            Guardar
          </Button>
          <StatusText status={status} />
        </div>
      </div>
    </SectionCard>
  );
}
