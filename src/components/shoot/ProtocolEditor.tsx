'use client';

import { cn } from '@/lib/utils/cn';
import { BAND } from '@/components/ui/band';
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
import { MOMENT_LEVEL_HELP, MOMENT_LEVEL_LABEL, MOMENT_LEVELS, MOMENTS_MAX, type VideoMoment } from '@/domain/video-edit';
import { ShootKindIcon } from './ShootKindIcon';
import {
  addStepAction,
  archiveProtocolAction,
  createProtocolAction,
  moveProtocolAction,
  moveStepAction,
  moveStepInMediaAction,
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

export function ProtocolEditor({ accountSlug, protocols, types }: { accountSlug: string; protocols: ProtocolView[]; types: string[] }) {
  const active = protocols.filter((p) => !p.archived);
  const archived = protocols.filter((p) => p.archived);
  return (
    <div className="space-y-6">
      <NewProtocol accountSlug={accountSlug} first={active.length === 0} types={types.filter((t) => !active.some((p) => p.productType === t))} />
      {active.map((p, i) => (
        <ProtocolCard key={p.id} accountSlug={accountSlug} protocol={p} index={i} total={active.length} types={types.filter((t) => t === p.productType || !active.some((o) => o.productType === t))} />
      ))}
      {archived.length > 0 ? (
        <details className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <summary className={cn('flex cursor-pointer items-center px-4 py-3 text-sm font-medium', BAND)}>Archivados ({archived.length})</summary>
          <div className="space-y-4 border-t p-4">
            {archived.map((p, i) => (
              <ProtocolCard key={p.id} accountSlug={accountSlug} protocol={p} index={i} total={archived.length} types={types} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

// El tipo de producto del protocolo: de la lista de Tipos y marcas, los que todavía no tienen uno.
function TypeSelect({ id, value, types, onChange }: { id: string; value: string; types: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Tipo de producto</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full max-w-md rounded-md border bg-background px-2 text-sm">
        <option value="">Elegí el tipo</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Cada tipo tiene un solo protocolo. Un video copiado al Drive se edita con el paso de video del protocolo del tipo de su producto.
      </p>
    </div>
  );
}

function NewProtocol({ accountSlug, first, types }: { accountSlug: string; first: boolean; types: string[] }) {
  const [open, setOpen] = useState(first);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState('');
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
    const r = await run(() => createProtocolAction(accountSlug, { name, description, productType: productType || null }), 'Listo. Ahora agregale los pasos abajo.');
    if (r) {
      setName('');
      setDescription('');
      setProductType('');
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
        <TypeSelect id="np-type" value={productType} types={types} onChange={setProductType} />
        <div className="space-y-1.5">
          <Label htmlFor="np-desc">Para qué productos es</Label>
          <Textarea id="np-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Una línea que ayude al operario a elegirlo." />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} pending={pending} disabled={pending || !name.trim() || !productType}>
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

function ProtocolCard({ accountSlug, protocol, index, total, types }: { accountSlug: string; protocol: ProtocolView; index: number; total: number; types: string[] }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(protocol.name);
  const [description, setDescription] = useState(protocol.description);
  const [productType, setProductType] = useState(protocol.productType ?? '');
  const videoSteps = protocol.steps.filter((st) => st.kind === 'VIDEO').length;
  const { pending, message, run } = useRun();

  async function saveInfo() {
    if (await run(() => updateProtocolAction(accountSlug, protocol.id, { name, description, productType: productType || null }), 'Guardado.')) setEditing(false);
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
            Nombre y tipo
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
      description={`${protocol.productType ? `Para: ${protocol.productType}.` : 'Sin tipo de producto: no se usa para los videos copiados al Drive.'} ${protocol.description || (protocol.archived ? 'Archivado: el operario no lo ve.' : '')}`.trim()}
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
          <TypeSelect id={`p-type-${protocol.id}`} value={productType} types={types} onChange={setProductType} />
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
            <StepRow key={s.id} accountSlug={accountSlug} step={s} n={i + 1} total={protocol.steps.length} archived={protocol.archived} videoSteps={videoSteps} />
          ))}
        </ol>
      )}
      {protocol.mediaOrder.length > 0 ? <MediaOrder accountSlug={accountSlug} protocol={protocol} /> : null}
      {!protocol.archived ? (
        <div className="space-y-3 border-t px-4 py-3">
          {adding ? (
            <StepForm
              idPrefix={`new-${protocol.id}`}
              initial={{ title: '', kind: 'PHOTO', explanation: '', editorNotes: '', moments: [], driveDefault: false }}
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

/** El orden de las fotos de cada paso en Organización de multimedia, aparte del orden en que se sacan. */
function MediaOrder({ accountSlug, protocol }: { accountSlug: string; protocol: ProtocolView }) {
  const { pending, message, run } = useRun();
  const steps = protocol.mediaOrder.flatMap((id) => protocol.steps.filter((s) => s.id === id));
  return (
    <div className="space-y-2 border-t px-4 py-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Orden en Organización de multimedia</p>
        <p className="text-xs text-muted-foreground">
          Cómo quedan ordenadas las fotos de cada paso en la publicación. La primera es la portada. Puede ser distinto del orden en que se sacan.
        </p>
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
            <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {s.title}
              {i === 0 ? <span className="text-xs text-muted-foreground"> · portada</span> : null}
            </span>
            {!protocol.archived ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Antes"
                  aria-label={`${s.title} antes`}
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveStepInMediaAction(accountSlug, s.id, -1))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Después"
                  aria-label={`${s.title} después`}
                  disabled={pending || i === steps.length - 1}
                  onClick={() => run(() => moveStepInMediaAction(accountSlug, s.id, 1))}
                >
                  <ArrowDown />
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ol>
      <Status message={message} />
    </div>
  );
}

type StepValues = { title: string; kind: ShootKind; explanation: string; editorNotes: string; moments: VideoMoment[]; driveDefault: boolean };

/** Los momentos de un paso de video, en orden: qué pasa en cada uno y qué tan importante es. */
function MomentsField({ idPrefix, moments, onChange }: { idPrefix: string; moments: VideoMoment[]; onChange: (m: VideoMoment[]) => void }) {
  const set = (i: number, patch: Partial<VideoMoment>) => onChange(moments.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const move = (i: number, by: number) => {
    const next = [...moments];
    const [m] = next.splice(i, 1);
    next.splice(i + by, 0, m);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">Momentos del video</p>
        <p className="text-xs text-muted-foreground">
          Contá, en orden, lo que pasa en el video y qué tan importante es cada cosa. El editor muestra lo importante a velocidad normal, acelera lo normal y pasa lo
          más rápido lo repetido, que es lo mismo que ya se mostró antes.
        </p>
      </div>
      {moments.length > 0 ? (
        <ol className="space-y-2">
          {moments.map((m, i) => (
            <li key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1.5rem_1fr_auto_auto] sm:items-center">
              <span className="text-sm text-muted-foreground">{i + 1}.</span>
              <Input
                aria-label={`Momento ${i + 1}`}
                value={m.texto}
                maxLength={300}
                onChange={(e) => set(i, { texto: e.target.value })}
                placeholder="Por ejemplo: sacar la primera pieza y mostrarla en detalle"
              />
              <select
                aria-label={`Importancia del momento ${i + 1}`}
                id={`${idPrefix}-moment-${i}`}
                value={m.importancia}
                onChange={(e) => set(i, { importancia: e.target.value as VideoMoment['importancia'] })}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {MOMENT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {MOMENT_LEVEL_LABEL[level]}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" title="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon" title="Bajar" disabled={i === moments.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon" title="Sacar" onClick={() => onChange(moments.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={moments.length >= MOMENTS_MAX} onClick={() => onChange([...moments, { texto: '', importancia: 'NORMAL' }])}>
          <Plus />
          Agregar momento
        </Button>
        <span className="text-xs text-muted-foreground">
          {MOMENT_LEVELS.map((level) => `${MOMENT_LEVEL_LABEL[level]}: ${MOMENT_LEVEL_HELP[level].toLowerCase()}`).join(' ')}
        </span>
      </div>
    </div>
  );
}

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
      {values.kind === 'PHOTO' ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-editor-notes`}>Indicaciones para el editor</Label>
          <Textarea
            id={`${idPrefix}-editor-notes`}
            rows={3}
            value={values.editorNotes}
            onChange={(e) => setValues((v) => ({ ...v, editorNotes: e.target.value }))}
            placeholder={'Lo que Claude tiene que tener en cuenta al corregir las fotos de este paso.\nPor ejemplo: la caja tiene una cuadrícula blanca; los cuadrados azules son parte de la caja, no agujeros.'}
          />
          <p className="text-xs text-muted-foreground">Claude las recibe en cada foto de este paso, también al procesarla de cero.</p>
        </div>
      ) : null}
      {values.kind === 'VIDEO' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-editor-notes`}>Indicaciones para el editor</Label>
            <Textarea
              id={`${idPrefix}-editor-notes`}
              rows={3}
              value={values.editorNotes}
              onChange={(e) => setValues((v) => ({ ...v, editorNotes: e.target.value }))}
              placeholder={'Lo que Claude tiene que tener en cuenta al editar los videos de este paso.\nPor ejemplo: la etiqueta de la caja tiene que leerse entera.'}
            />
          </div>
          <MomentsField idPrefix={idPrefix} moments={values.moments} onChange={(moments) => setValues((v) => ({ ...v, moments }))} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={values.driveDefault} onChange={(e) => setValues((v) => ({ ...v, driveDefault: e.target.checked }))} />
            <span>
              Usar este paso para los videos copiados al Drive
              <span className="block text-xs text-muted-foreground">
                Hace falta marcar uno cuando el protocolo tiene más de un paso de video. Con uno solo, se usa ese. Al marcar este, se desmarca el otro.
              </span>
            </span>
          </label>
        </>
      ) : null}
      <div className="flex gap-2">
        <Button
          pending={pending}
          disabled={pending || !values.title.trim()}
          onClick={async () => {
            setPending(true);
            await onSave({ ...values, moments: values.kind === 'VIDEO' ? values.moments.filter((m) => m.texto.trim()) : [], driveDefault: values.kind === 'VIDEO' && values.driveDefault });
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

function StepRow({ accountSlug, step, n, total, archived, videoSteps }: { accountSlug: string; step: StepView; n: number; total: number; archived: boolean; videoSteps: number }) {
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
          initial={{ title: step.title, kind: step.kind, explanation: step.explanation, editorNotes: step.editorNotes, moments: step.moments, driveDefault: step.driveDefault }}
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
        {step.kind === 'VIDEO' && videoSteps > 1 ? (
          <p className="text-xs text-muted-foreground">{step.driveDefault ? 'Se usa para los videos copiados al Drive.' : 'No se usa para los videos copiados al Drive.'}</p>
        ) : null}
        {step.explanation ? <p className="whitespace-pre-line text-sm text-muted-foreground">{step.explanation}</p> : null}
        {step.kind === 'VIDEO' && step.moments.length > 0 ? (
          <ol className="space-y-0.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">
            <li className="font-medium">Momentos del video, para el editor</li>
            {step.moments.map((m, i) => (
              <li key={i}>
                {i + 1}. {m.texto} <span className="text-muted-foreground">· {MOMENT_LEVEL_LABEL[m.importancia]}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {step.kind !== 'CHECK' && step.editorNotes ? (
          <p className="whitespace-pre-line rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">
            <span className="font-medium">Para el editor: </span>
            {step.editorNotes}
          </p>
        ) : null}
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
