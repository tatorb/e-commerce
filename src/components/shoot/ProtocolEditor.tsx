'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Textarea } from '@/components/ui/textarea';
import { useReadOnly } from '@/components/access/AccessProvider';
import { uploadToDrive } from '@/components/drive/upload';
import { ILLUSTRATION_TYPES, SHOOT_KIND_LABEL, illustrationType, type ShootKind } from '@/domain/shoot';
import type { ProtocolView, StepView } from '@/lib/shoot';
import { ShootKindIcon } from './ShootKindIcon';
import {
  addStepAction,
  archiveProtocolAction,
  createProtocolAction,
  moveProtocolAction,
  moveStepAction,
  removeIllustrationAction,
  removeStepAction,
  setIllustrationAction,
  startIllustrationUploadAction,
  updateProtocolAction,
  updateStepAction,
  type Result,
} from '@/app/a/[cuenta]/protocolos/actions';

// Armar los protocolos de Registro de productos: cada uno con sus pasos en
// orden, foto, video o sin registro, la explicación y una ilustración de ejemplo.

const ACCEPT = Object.keys(ILLUSTRATION_TYPES)
  .map((e) => `.${e}`)
  .join(',');

type Message = { kind: 'ok' | 'error'; text: string } | null;

/** Corre una acción y dice cómo salió. */
function useRun() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  async function run<T extends object>(action: () => Promise<Result<T>>, ok?: string): Promise<(T & { ok: true }) | null> {
    setPending(true);
    setMessage(null);
    const r = await action().catch(() => null);
    setPending(false);
    if (!r) {
      setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
      return null;
    }
    if (!r.ok) {
      setMessage({ kind: 'error', text: r.error });
      return null;
    }
    if (ok) setMessage({ kind: 'ok', text: ok });
    router.refresh();
    return r;
  }
  return { pending, message, setMessage, run };
}

function Status({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className={`text-sm ${message.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} role="status">
      {message.text}
    </p>
  );
}

export function ProtocolEditor({ accountSlug, protocols }: { accountSlug: string; protocols: ProtocolView[] }) {
  const active = protocols.filter((p) => !p.archived);
  const archived = protocols.filter((p) => p.archived);
  return (
    <div className="space-y-6">
      <NewProtocol accountSlug={accountSlug} first={active.length === 0} />
      {active.map((p, i) => (
        <ProtocolCard key={p.id} accountSlug={accountSlug} protocol={p} index={i} total={active.length} />
      ))}
      {archived.length > 0 ? (
        <details className="rounded-2xl border bg-card shadow-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Archivados ({archived.length})</summary>
          <div className="space-y-4 border-t p-4">
            {archived.map((p, i) => (
              <ProtocolCard key={p.id} accountSlug={accountSlug} protocol={p} index={i} total={archived.length} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function NewProtocol({ accountSlug, first }: { accountSlug: string; first: boolean }) {
  const [open, setOpen] = useState(first);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { pending, message, run } = useRun();
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Nuevo protocolo
        </Button>
        <Status message={message} />
      </div>
    );
  }
  async function save() {
    const r = await run(() => createProtocolAction(accountSlug, { name, description }), 'Listo. Ahora agregale los pasos abajo.');
    if (r) {
      setName('');
      setDescription('');
      setOpen(false);
    }
  }
  return (
    <SectionCard title="Nuevo protocolo" description="Por ejemplo, uno para aros, otro para juntas, otro para kits.">
      <div className="space-y-3 px-4 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="np-name">Nombre</Label>
          <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Por ejemplo: Aros de pistón" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np-desc">Para qué productos es</Label>
          <Textarea id="np-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Una línea que ayude al operario a elegirlo." />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} pending={pending} disabled={pending || !name.trim()}>
            Crear protocolo
          </Button>
          {!first ? (
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending} access="view">
              Cancelar
            </Button>
          ) : null}
          <Status message={message} />
        </div>
      </div>
    </SectionCard>
  );
}

function ProtocolCard({ accountSlug, protocol, index, total }: { accountSlug: string; protocol: ProtocolView; index: number; total: number }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(protocol.name);
  const [description, setDescription] = useState(protocol.description);
  const { pending, message, run } = useRun();

  async function saveInfo() {
    if (await run(() => updateProtocolAction(accountSlug, protocol.id, { name, description }), 'Guardado.')) setEditing(false);
  }

  const action = (
    <div className="flex flex-wrap items-center gap-1">
      {!protocol.archived ? (
        <>
          <Button variant="ghost" size="icon" title="Subir" onClick={() => run(() => moveProtocolAction(accountSlug, protocol.id, -1))} disabled={pending || index === 0}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon" title="Bajar" onClick={() => run(() => moveProtocolAction(accountSlug, protocol.id, 1))} disabled={pending || index === total - 1}>
            <ArrowDown />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)} disabled={pending}>
            <Pencil />
            Nombre
          </Button>
        </>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => run(() => archiveProtocolAction(accountSlug, protocol.id, !protocol.archived), protocol.archived ? 'Se vuelve a ofrecer.' : 'Archivado.')}
        disabled={pending}
      >
        {protocol.archived ? <ArchiveRestore /> : <Archive />}
        {protocol.archived ? 'Volver a usar' : 'Archivar'}
      </Button>
    </div>
  );

  return (
    <SectionCard
      title={protocol.name}
      count={protocol.steps.length}
      description={protocol.description || (protocol.archived ? 'Archivado: el operario no lo ve.' : 'Sin descripción.')}
      action={action}
    >
      {editing ? (
        <div className="space-y-3 border-b px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor={`p-name-${protocol.id}`}>Nombre</Label>
            <Input id={`p-name-${protocol.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`p-desc-${protocol.id}`}>Para qué productos es</Label>
            <Textarea id={`p-desc-${protocol.id}`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveInfo} pending={pending} disabled={pending || !name.trim()}>
              Guardar
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} access="view">
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      {protocol.steps.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Todavía no tiene pasos.</p>
      ) : (
        <ol className="divide-y">
          {protocol.steps.map((s, i) => (
            <StepRow key={s.id} accountSlug={accountSlug} step={s} n={i + 1} total={protocol.steps.length} archived={protocol.archived} />
          ))}
        </ol>
      )}
      {!protocol.archived ? (
        <div className="space-y-3 border-t px-4 py-3">
          {adding ? (
            <StepForm
              idPrefix={`new-${protocol.id}`}
              initial={{ title: '', kind: 'PHOTO', explanation: '' }}
              saveLabel="Agregar paso"
              onCancel={() => setAdding(false)}
              onSave={async (values) => {
                const r = await run(() => addStepAction(accountSlug, protocol.id, values), 'Paso agregado. Podés sumarle una ilustración.');
                if (r) setAdding(false);
                return Boolean(r);
              }}
            />
          ) : (
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus />
              Agregar paso
            </Button>
          )}
          <Status message={message} />
        </div>
      ) : message ? (
        <div className="border-t px-4 py-3">
          <Status message={message} />
        </div>
      ) : null}
    </SectionCard>
  );
}

type StepValues = { title: string; kind: ShootKind; explanation: string };

function StepForm({
  idPrefix,
  initial,
  saveLabel,
  onSave,
  onCancel,
}: {
  idPrefix: string;
  initial: StepValues;
  saveLabel: string;
  onSave: (v: StepValues) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-title`}>{values.kind === 'CHECK' ? 'Qué hacer' : 'Qué sacar'}</Label>
          <Input
            id={`${idPrefix}-title`}
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder={values.kind === 'CHECK' ? 'Por ejemplo: Limpiar el lugar' : 'Por ejemplo: Frente, sobre fondo blanco'}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Es</span>
          <div role="radiogroup" aria-label="Foto, video o sin registro" className="flex overflow-hidden rounded-md border">
            {(['PHOTO', 'VIDEO', 'CHECK'] as const).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-1.5 border-l px-3 py-2 text-sm first:border-l-0 ${values.kind === k ? 'bg-foreground text-background' : 'bg-background hover:bg-muted'}`}
              >
                <input type="radio" className="sr-only" name={`${idPrefix}-kind`} checked={values.kind === k} onChange={() => setValues((v) => ({ ...v, kind: k }))} />
                <ShootKindIcon kind={k} className="h-4 w-4" />
                {SHOOT_KIND_LABEL[k]}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-explanation`}>Explicación para el operario</Label>
        <Textarea
          id={`${idPrefix}-explanation`}
          rows={4}
          value={values.explanation}
          onChange={(e) => setValues((v) => ({ ...v, explanation: e.target.value }))}
          placeholder={
            values.kind === 'CHECK'
              ? 'Qué hay que hacer antes de seguir.\nPor ejemplo: pasar un trapo por la mesa y sacar todo lo que no es del producto.'
              : 'Cómo ubicar el producto, la luz, la distancia y qué tiene que verse.\nPor ejemplo: el aro parado, con la marca hacia la cámara, a un palmo.'
          }
        />
      </div>
      <div className="flex gap-2">
        <Button
          pending={pending}
          disabled={pending || !values.title.trim()}
          onClick={async () => {
            setPending(true);
            await onSave(values);
            setPending(false);
          }}
        >
          {saveLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending} access="view">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function StepRow({ accountSlug, step, n, total, archived }: { accountSlug: string; step: StepView; n: number; total: number; archived: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const readOnly = useReadOnly();
  const { pending, message, setMessage, run } = useRun();
  const busy = pending || progress !== null;

  async function sendIllustration(file: File) {
    const check = illustrationType({ name: file.name, size: file.size });
    if (!check.ok) return setMessage({ kind: 'error', text: check.error });
    setMessage(null);
    setProgress('Subiendo la ilustración…');
    try {
      const start = await startIllustrationUploadAction(accountSlug, step.id, { name: file.name, size: file.size });
      if (!start.ok) throw new Error(start.error);
      const fileId = await uploadToDrive(file, start.uploadUrl, (sent) => setProgress(`Subiendo la ilustración, ${Math.floor((sent / file.size) * 100)} %`));
      setProgress(null);
      await run(() => setIllustrationAction(accountSlug, step.id, fileId), 'Ilustración guardada.');
    } catch (e) {
      setProgress(null);
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'No se pudo subir la ilustración.' });
    }
  }

  if (editing) {
    return (
      <li className="px-4 py-4">
        <StepForm
          idPrefix={`step-${step.id}`}
          initial={{ title: step.title, kind: step.kind, explanation: step.explanation }}
          saveLabel="Guardar"
          onCancel={() => setEditing(false)}
          onSave={async (values) => {
            const r = await run(() => updateStepAction(accountSlug, step.id, values), 'Guardado.');
            if (r) setEditing(false);
            return Boolean(r);
          }}
        />
      </li>
    );
  }

  return (
    <li className="grid gap-3 px-4 py-4 sm:grid-cols-[9rem_1fr_auto]">
      <div className="space-y-1.5">
        {step.illustration ? (
          <a href={step.illustration.href} target="_blank" rel="noopener" className="block overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={step.illustration.href} alt={`Ilustración de ${step.title}`} className="aspect-[4/3] w-full object-contain" />
          </a>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed text-center text-xs text-muted-foreground">
            Sin ilustración
          </div>
        )}
        {!archived ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <button type="button" className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50" disabled={busy || readOnly} onClick={() => input.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" />
              {step.illustration ? 'Cambiar' : 'Subir ilustración'}
            </button>
            {step.illustration ? (
              <button type="button" className="text-muted-foreground hover:underline disabled:opacity-50" disabled={busy || readOnly} onClick={() => run(() => removeIllustrationAction(accountSlug, step.id), 'Ilustración sacada.')}>
                Sacar
              </button>
            ) : null}
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) sendIllustration(f);
              }}
            />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Paso {n}</span>
          <Badge variant="outline" className="gap-1">
            <ShootKindIcon kind={step.kind} className="h-3 w-3" />
            {SHOOT_KIND_LABEL[step.kind]}
          </Badge>
        </div>
        <p className="font-medium">{step.title}</p>
        {step.explanation ? <p className="whitespace-pre-line text-sm text-muted-foreground">{step.explanation}</p> : null}
        {progress ? <p className="text-sm text-muted-foreground">{progress}</p> : <Status message={message} />}
      </div>
      {!archived ? (
        <div className="flex flex-wrap items-start gap-1 sm:flex-col sm:items-end">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" title="Subir" disabled={busy || n === 1} onClick={() => run(() => moveStepAction(accountSlug, step.id, -1))}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon" title="Bajar" disabled={busy || n === total} onClick={() => run(() => moveStepAction(accountSlug, step.id, 1))}>
              <ArrowDown />
            </Button>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing(true)}>
            <Pencil />
            Editar
          </Button>
          {confirming ? (
            <div className="flex items-center gap-1">
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => run(() => removeStepAction(accountSlug, step.id))}>
                Sí, sacar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} access="view">
                No
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
              <Trash2 />
              Sacar paso
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
