'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, RefreshCw, Undo2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FACE_FIELD_LABEL, type AttributeDiff, type FaceField } from '@/domain/channel-sync';
import { cn } from '@/lib/utils/cn';
import { discardDraftsAction, pushDraftsAction, readOneAction, saveDraftAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { chooseFacesAction } from '@/app/a/[cuenta]/sincronizacion/actions';
import type { PushResult } from '@/lib/channel-push';

// Los botones de la página de una publicación: subir el borrador al canal,
// descartarlo, elegir cuál queda y volver a leer del canal.

type Message = { kind: 'ok' | 'error'; text: string } | null;

function useBusy() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  async function run<T extends { ok: boolean }>(key: string, call: () => Promise<T>, done: (r: T) => Message) {
    setBusy(key);
    setMessage(null);
    const r = await call().catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    setMessage(done(r));
    router.refresh();
  }
  return { busy, message, run };
}

/** Cuenta lo que pasó al subir, en una línea. */
export function pushMessage(r: PushResult, channelName: string): Message {
  const article: Record<FaceField, string> = { title: 'el', description: 'la', attributes: 'los', photos: 'las', price: 'el' };
  const sent = r.sent.map((f) => `${article[f]} ${FACE_FIELD_LABEL[f].toLowerCase()}`);
  const rejected = r.rejected.map((x) => `${FACE_FIELD_LABEL[x.field]}: ${x.message}`);
  if (sent.length === 0) return { kind: 'error', text: rejected.join(' ') || 'No había nada para subir.' };
  const text = `Listo: ${sent.join(' y ')} ya ${sent.length > 1 || r.sent.includes('attributes') || r.sent.includes('photos') ? 'están' : 'está'} en ${channelName}.${r.confirmed ? '' : ' No se pudo volver a leer para confirmar: se confirma en la próxima lectura.'}`;
  return rejected.length > 0 ? { kind: 'error', text: `${text} ${rejected.join(' ')}` } : { kind: 'ok', text };
}

function Note({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
      {message.text}
    </p>
  );
}

/** Subir todo el borrador o descartarlo, arriba de la página. */
export function DraftBar({
  accountSlug,
  publicationId,
  channelName,
  canPush,
  canDiscard,
}: {
  accountSlug: string;
  publicationId: string;
  channelName: string;
  canPush: boolean;
  canDiscard: boolean;
}) {
  const { busy, message, run } = useBusy();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canPush ? (
          <Button
            size="sm"
            disabled={busy !== null}
            pending={busy === 'push'}
            onClick={() => run('push', () => pushDraftsAction(accountSlug, publicationId), (r) => (r.ok ? pushMessage(r, channelName) : { kind: 'error', text: r.error }))}
          >
            <Upload />
            Subir todo a {channelName}
          </Button>
        ) : null}
        {canDiscard ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            pending={busy === 'discard'}
            onClick={() => {
              if (!window.confirm(`¿Descartar los cambios de la app? Vuelve lo que está en ${channelName}.`)) return;
              run('discard', () => discardDraftsAction(accountSlug, publicationId), (r) =>
                r.ok ? { kind: 'ok', text: 'Listo: se descartaron los cambios.' } : { kind: 'error', text: r.error },
              );
            }}
          >
            <Undo2 />
            Descartar los cambios
          </Button>
        ) : null}
      </div>
      <Note message={message} />
    </div>
  );
}

/** Volver a leer la publicación del canal, ahora. */
export function ReadOneButton({ accountSlug, publicationId, channelName }: { accountSlug: string; publicationId: string; channelName: string }) {
  const { busy, message, run } = useBusy();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={busy !== null}
        pending={busy === 'read'}
        onClick={() =>
          run('read', () => readOneAction(accountSlug, publicationId), (r) =>
            !r.ok ? { kind: 'error', text: r.error } : r.found ? null : { kind: 'error', text: `${channelName} no la devolvió: puede estar borrada o ser de otra cuenta.` },
          )
        }
      >
        <RefreshCw />
        Leer de {channelName}
      </Button>
      <Note message={message} />
    </div>
  );
}

/**
 * Un dato de la cara Borrador: se ve, se edita (título y descripción) y,
 * según cómo esté frente al canal, se sube, se descarta o se elige.
 */
export function DraftField({
  accountSlug,
  publicationId,
  field,
  state,
  value,
  channelValue,
  channelName,
  editable,
  pushBlocked,
  rejection,
  editor,
  diff,
  display,
  channelDisplay,
}: {
  accountSlug: string;
  publicationId: string;
  field: FaceField;
  state: 'same' | 'draft' | 'incoming' | 'choose' | 'unread';
  value: string;
  channelValue: string | null;
  channelName: string;
  // Si se puede editar acá, o por qué no.
  editable: true | string;
  // Por qué no se puede subir, si no se puede.
  pushBlocked: string | null;
  rejection: string | null;
  // Un formulario propio para editar, como el de los datos de catálogo.
  editor?: ReactNode;
  // En los datos de catálogo, qué cambia frente al canal.
  diff?: AttributeDiff | null;
  // Cómo se ve el dato, si no es texto, como las fotos; y cómo está en el canal.
  display?: ReactNode;
  channelDisplay?: ReactNode;
}) {
  const { busy, message, run } = useBusy();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const multiline = field === 'description';
  const textField = field === 'title' || field === 'description';
  const canEdit = editable === true && (textField || editor !== undefined);
  const showDiff = diff && (state === 'draft' || state === 'choose') && diff.changed.length + diff.added.length + diff.removed.length > 0;

  async function save() {
    await run(
      'save',
      () => saveDraftAction(accountSlug, publicationId, field as 'title' | 'description', draft),
      (r) => {
        if (!r.ok) return { kind: 'error', text: r.error };
        setEditing(false);
        return r.warnings.length > 0 ? { kind: 'ok', text: `Guardado. ${r.warnings.join(' ')}` } : null;
      },
    );
  }

  return (
    <div className="space-y-3">
      {editing && editor ? (
        <div className="space-y-3">
          {editor}
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cerrar
          </Button>
        </div>
      ) : editing ? (
        <div className="space-y-2">
          {multiline ? (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} aria-label={FACE_FIELD_LABEL[field]} />
          ) : (
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={FACE_FIELD_LABEL[field]} />
          )}
          {field === 'title' ? <p className="text-xs tabular-nums text-muted-foreground">{draft.trim().length} caracteres</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} pending={busy === 'save'} disabled={busy !== null}>
              Guardar en el borrador
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        (display ?? <FaceValue field={field} value={value} />)
      )}

      {showDiff ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Frente a {channelName}</p>
          <ul className="mt-1 space-y-0.5">
            {diff.changed.map((c) => (
              <li key={`c-${c.name}`}>
                <span className="text-muted-foreground">{c.name}:</span> {c.from} → <span className="font-medium">{c.to}</span>
              </li>
            ))}
            {diff.added.map((a) => (
              <li key={`a-${a.name}`}>
                <span className="text-muted-foreground">{a.name}:</span> <span className="font-medium">{a.value}</span> <span className="text-muted-foreground">(nuevo)</span>
              </li>
            ))}
            {diff.removed.map((a) => (
              <li key={`r-${a.name}`} className="text-muted-foreground">
                {a.name}: {a.value} (está en {channelName} y no en la app)
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state === 'choose' && channelValue !== null && field !== 'attributes' ? (
        <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">En {channelName} ahora</p>
          {channelDisplay ?? <FaceValue field={field} value={channelValue} />}
        </div>
      ) : null}
      {rejection ? (
        <p className="text-sm text-destructive">
          <span className="font-medium">No se subió.</span> {rejection}
        </p>
      ) : null}

      {!editing ? (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={busy !== null}>
              <Pencil />
              Editar
            </Button>
          ) : null}
          {state === 'draft' && !pushBlocked ? (
            <Button
              size="sm"
              disabled={busy !== null}
              pending={busy === 'push'}
              onClick={() =>
                run('push', () => pushDraftsAction(accountSlug, publicationId, [field]), (r) => (r.ok ? pushMessage(r, channelName) : { kind: 'error', text: r.error }))
              }
            >
              <Upload />
              Subir a {channelName}
            </Button>
          ) : null}
          {state === 'draft' ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              pending={busy === 'discard'}
              onClick={() =>
                run('discard', () => discardDraftsAction(accountSlug, publicationId, [field]), (r) => (r.ok ? null : { kind: 'error', text: r.error }))
              }
            >
              <Undo2 />
              Descartar
            </Button>
          ) : null}
          {state === 'choose' ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                pending={busy === 'channel'}
                onClick={() =>
                  run('channel', () => chooseFacesAction(accountSlug, { publicationIds: [publicationId], side: 'channel', field }), (r) =>
                    r.ok ? null : { kind: 'error', text: r.error },
                  )
                }
              >
                Usar lo de {channelName}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                pending={busy === 'app'}
                onClick={() =>
                  run('app', () => chooseFacesAction(accountSlug, { publicationIds: [publicationId], side: 'app', field }), (r) =>
                    r.ok ? null : { kind: 'error', text: r.error },
                  )
                }
              >
                Mantener lo de la app
              </Button>
            </>
          ) : null}
          {typeof editable === 'string' ? <p className="text-xs text-muted-foreground">{editable}</p> : null}
          {state === 'draft' && pushBlocked ? <p className="text-xs text-muted-foreground">{pushBlocked}</p> : null}
        </div>
      ) : null}
      <Note message={message} />
    </div>
  );
}

/** Cómo se ve un dato: texto, texto largo o datos de catálogo. */
export function FaceValue({ field, value }: { field: FaceField; value: string }) {
  if (!value.trim()) return <p className="text-sm text-muted-foreground">Vacío</p>;
  if (field === 'description') return <p className="max-h-96 overflow-y-auto whitespace-pre-line break-words text-sm">{value}</p>;
  if (field === 'attributes') {
    return (
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(10rem,auto)_1fr]">
        {value.split('\n').map((line, i) => {
          const at = line.indexOf(':');
          return (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">{at > 0 ? line.slice(0, at) : line}</dt>
              <dd className="break-words">{at > 0 ? line.slice(at + 1).trim() : ''}</dd>
            </div>
          );
        })}
      </dl>
    );
  }
  return <p className="break-words text-base font-medium">{value}</p>;
}
