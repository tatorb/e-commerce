'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Camera, Check, ChevronRight, CircleDashed, Images, KanbanSquare, Redo2, RotateCcw, SkipForward, Trash2, Undo2, Upload, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useReadOnly } from '@/components/access/AccessProvider';
import { measureVideo } from '@/components/drive/upload';
import { cn } from '@/lib/utils/cn';
import { LOW_QUALITY_HELP, qualityOf, SHOOT_KIND_LABEL, shotCounts, shotsPerStep, type MediaKind, type Quality } from '@/domain/shoot';
import { plural } from '@/lib/format';
import type { BrowserMeasure } from '@/lib/videos';
import type { ProtocolView, ShootPick, StepView } from '@/lib/shoot';
import { markShotCheckAction, undoShotCheckAction } from '@/app/a/[cuenta]/registro-productos/actions';
import { ShootKindIcon } from './ShootKindIcon';
import { shotByline, ShotThumb, ShotViewer, type SessionShot } from './ShotViewer';
import { blocksCamera, discardShotUpload, releaseShotUpload, retryShotUpload, startShotUpload, useShotUpload, type ShotUpload } from './shot-upload';

// Lo que hace el operario con el celular: sigue los pasos del protocolo, o
// ninguno, saca la foto o graba el video con la cámara del teléfono, lo revisa
// y lo sube. El archivo va directo al Drive, tal como sale de la cámara. Mientras
// sube se puede pasar al paso siguiente, pero no sacar otra (shot-upload.ts). Lo
// subido queda a la vista en su paso para revisarlo, y los pasos sin registro
// se marcan Listo.

type Capture = {
  file: File;
  url: string;
  kind: MediaKind;
  measuring: boolean;
  quality: Quality | null;
  video: BrowserMeasure | null;
};

const PHOTO_EXT = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'tif', 'tiff'];
const TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
};

/** El nombre con que se guarda: el código, la medida, el paso y la hora. La cámara del celular les pone a todas el mismo. */
function fileNameFor(file: File, parts: (string | null | undefined)[]): string {
  const own = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  const ext = file.type.startsWith('image/') ? (PHOTO_EXT.includes(own) ? own : (TYPE_EXT[file.type] ?? own)) : own || TYPE_EXT[file.type] || 'mp4';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  const base = [...parts, stamp]
    .filter(Boolean)
    .join(' · ')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 150);
  return ext ? `${base}.${ext}` : base;
}

/** El ancho y el alto de la foto como la ve el navegador. Null si no la puede abrir, como una HEIC en una computadora. */
function measurePhoto(url: string, timeoutMs = 10_000): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

export function ShootSession({
  accountSlug,
  base,
  product,
  measure,
  measureText,
  protocol,
  shots,
  pipeline,
}: {
  accountSlug: string;
  base: string;
  product: ShootPick;
  // La medida elegida; null es todas, o el producto no tiene medidas.
  measure: { key: string; label: string } | null;
  // Cómo se dice la medida elegida, o null si el producto no tiene medidas.
  measureText: string | null;
  protocol: ProtocolView | null;
  shots: SessionShot[];
  // Si el producto está en el pipeline, con el link si la persona lo puede abrir.
  pipeline: { href: string | null } | null;
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const steps = useMemo(() => protocol?.steps ?? [], [protocol]);
  const variantKey = measure?.key ?? null;
  const done = shotsPerStep(shots, variantKey);
  const withMeasure = measureText !== null;
  const upload = useShotUpload();
  // Mientras la anterior no subió bien, no se saca otra.
  const busy = blocksCamera(upload);
  // Lo que se está subiendo de este producto, a la vista en su paso hasta que la pantalla tiene la guardada.
  const pending: SessionShot | null =
    upload && upload.productId === product.id && shotCounts(upload, variantKey) && !shots.some((s) => s.id === upload.savedId)
      ? {
          id: `subida-${upload.key}`,
          kind: upload.kind,
          stepId: upload.stepId,
          variantKey: upload.variantKey,
          variantLabel: upload.variantKey ? (measure?.label ?? null) : null,
          thumb: upload.url,
          src: upload.url,
          by: null,
          when: 'recién',
          pending: {
            text: upload.status === 'failed' ? 'No se pudo subir' : upload.status === 'done' ? 'Subida' : upload.saving ? 'Guardando…' : `Subiendo ${upload.percent} %`,
            failed: upload.status === 'failed',
          },
        }
      : null;
  // Lo de un paso que vale para la medida elegida, lo último primero.
  const mediaOf = (stepId: string | null) => [
    ...(pending && pending.stepId === stepId ? [pending] : []),
    ...shots.filter((s) => s.kind !== 'CHECK' && s.stepId === stepId && shotCounts(s, variantKey)),
  ];
  const checksOf = (stepId: string) => shots.filter((s) => s.kind === 'CHECK' && s.stepId === stepId && shotCounts(s, variantKey));
  const [index, setIndex] = useState(() => Math.max(0, steps.findIndex((s) => !done[s.id])));
  const [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [uploaded, setUploaded] = useState<{ kind: MediaKind; title: string | null }[]>([]);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; back: number | null } | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  // Mientras se guarda un Listo o se deshace.
  const [checking, setChecking] = useState(false);
  const inputs = {
    PHOTO: { camera: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null) },
    VIDEO: { camera: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null) },
  };
  const step = protocol && !finished ? (steps[index] ?? null) : null;

  // Cuando termina de subir, pide lo guardado una vez y suelta la vista previa
  // apenas la pantalla lo tiene. La de otro producto se suelta enseguida.
  const refreshed = useRef<string | null>(null);
  useEffect(() => {
    const id = upload?.status === 'done' ? upload.savedId : null;
    if (!upload || !id) return;
    if (upload.productId !== product.id || shots.some((s) => s.id === id) || refreshed.current === id) {
      releaseShotUpload(id);
      return;
    }
    refreshed.current = id;
    router.refresh();
  }, [upload, shots, product.id, router]);

  // La vista previa ocupa memoria: se suelta al cambiar de archivo o al salir.
  const previewUrl = capture?.url ?? null;
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function clearCapture() {
    setCapture(null);
    setError(null);
  }

  async function onFile(file: File | undefined, kind: MediaKind) {
    if (!file) return;
    setError(null);
    setNotice(null);
    const url = URL.createObjectURL(file);
    setCapture({ file, url, kind, measuring: true, quality: null, video: null });
    const video = kind === 'VIDEO' ? await measureVideo(file) : null;
    const dims = kind === 'VIDEO' ? video : await measurePhoto(url);
    setCapture((c) => (c && c.url === url ? { ...c, measuring: false, video, quality: qualityOf(kind, dims) } : c));
  }

  function goTo(i: number) {
    clearCapture();
    setNotice(null);
    setEnlarged(false);
    setFinished(false);
    setIndex(i);
  }

  function next() {
    if (index + 1 < steps.length) goTo(index + 1);
    else {
      clearCapture();
      setNotice(null);
      setFinished(true);
    }
  }

  /** Empieza a subir y deja la pantalla libre: se queda en el paso, con lo que sube a la vista. */
  function send() {
    if (!capture || busy) return;
    const c = capture;
    const started = startShotUpload({
      accountSlug,
      productId: product.id,
      productLabel: product.code ?? product.name,
      stepId: step?.id ?? null,
      stepTitle: step?.title ?? null,
      variantKey,
      kind: c.kind,
      file: c.file,
      name: fileNameFor(c.file, [product.code ?? product.name, measure?.label, step?.title]),
      video: c.video,
    });
    if (!started) return setError('Esperá a que termine de subir la anterior.');
    clearCapture();
    setNotice(null);
    setUploaded((list) => [...list, { kind: c.kind, title: step?.title ?? null }]);
  }

  /** Marca Listo el paso sin registro y pasa al siguiente. */
  async function markDone(s: StepView, at: number) {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const r = await markShotCheckAction(accountSlug, { productId: product.id, stepId: s.id, variantKey });
      if (!r.ok) throw new Error(r.error);
      next();
      setNotice({ text: `“${s.title}” quedó hecho.`, back: at });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo guardar. Revisá la conexión y probá de nuevo.');
    } finally {
      setChecking(false);
    }
  }

  async function undoDone(s: StepView) {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const r = await undoShotCheckAction(accountSlug, { productId: product.id, stepId: s.id, variantKey });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo deshacer. Revisá la conexión y probá de nuevo.');
    } finally {
      setChecking(false);
    }
  }

  const isLast = index + 1 >= steps.length;
  const nextButton = (
    <Button size="lg" className="h-14 px-4 text-base" onClick={next} disabled={checking} access="view">
      <ChevronRight />
      {isLast ? 'Terminar' : 'Siguiente paso'}
    </Button>
  );

  const fileInputs = (['PHOTO', 'VIDEO'] as const).map((kind) => (
    <span key={kind} className="hidden">
      <input
        ref={inputs[kind].camera}
        type="file"
        accept={kind === 'PHOTO' ? 'image/*' : 'video/*'}
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          onFile(f, kind);
        }}
      />
      <input
        ref={inputs[kind].gallery}
        type="file"
        accept={kind === 'PHOTO' ? 'image/*,.heic,.heif' : 'video/*'}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          onFile(f, kind);
        }}
      />
    </span>
  ));

  /** Los botones para sacar, o la revisión de lo que se sacó. Si el paso ya tiene algo, primero seguir. */
  function captureArea(kinds: readonly MediaKind[], hasSome = false) {
    if (capture) {
      const low = capture.quality && !capture.quality.enough;
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border bg-black">
            {capture.kind === 'PHOTO' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capture.url} alt="Lo que sacaste" className="mx-auto max-h-[60vh] w-full object-contain" />
            ) : (
              <video src={capture.url} controls playsInline className="mx-auto max-h-[60vh] w-full" />
            )}
          </div>
          <p className="text-sm">
            {capture.measuring ? (
              <span className="text-muted-foreground">Midiendo la calidad…</span>
            ) : capture.quality ? (
              <>
                <span className="font-medium">Calidad: {capture.quality.text}.</span>
                {low ? <span className="mt-1 block text-destructive">{LOW_QUALITY_HELP}</span> : null}
              </>
            ) : (
              <span className="text-muted-foreground">No se pudo medir la calidad en este navegador. Se sube igual, tal como salió.</span>
            )}
          </p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className="px-4" onClick={send} disabled={busy || capture.measuring || Boolean(low)}>
              <Upload />
              {error ? 'Reintentar' : 'Subir'}
            </Button>
            <Button size="lg" variant="outline" className="px-4" onClick={clearCapture} access="view">
              <RotateCcw />
              Repetir
            </Button>
          </div>
        </div>
      );
    }
    const more = step && hasSome;
    return (
      <div className="space-y-2">
        <div className={cn('grid gap-2', more ? 'sm:grid-cols-2' : kinds.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {more ? nextButton : null}
          {kinds.map((kind) => (
            <Button
              key={kind}
              size="lg"
              variant={more ? 'outline' : 'default'}
              className="h-14 px-4 text-base"
              onClick={() => inputs[kind].camera.current?.click()}
              disabled={busy}
            >
              {kind === 'PHOTO' ? <Camera /> : <Video />}
              {more ? (kind === 'PHOTO' ? 'Sacar otra foto' : 'Grabar otro video') : kind === 'PHOTO' ? 'Sacar foto' : 'Grabar video'}
            </Button>
          ))}
        </div>
        {upload && busy ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm" role="status">
            <Upload className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            {upload.status === 'failed'
              ? `Para sacar otra, reintentá o descartá ${upload.kind === 'PHOTO' ? 'la foto' : 'el video'} que no se pudo subir.`
              : `Esperá a que termine de subir ${upload.kind === 'PHOTO' ? 'la foto anterior' : 'el video anterior'} para sacar otra.`}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-x-4">
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={readOnly || busy}
                onClick={() => inputs[kind].gallery.current?.click()}
                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
              >
                <Images className="h-4 w-4" />
                {kinds.length > 1 ? (kind === 'PHOTO' ? 'Foto de la galería' : 'Video de la galería') : 'Elegir de la galería'}
              </button>
            ))}
          </div>
          {step && !hasSome ? skipButton(step) : null}
        </div>
      </div>
    );
  }

  function skipButton(s: StepView) {
    return (
      <Button
        variant="ghost"
        onClick={() => {
          setSkipped((list) => new Set(list).add(s.id));
          next();
        }}
        disabled={checking}
        access="view"
      >
        <SkipForward />
        Saltear
      </Button>
    );
  }

  /** Un paso sin registro: Listo, o lo que ya quedó hecho con Siguiente paso y Deshacer. */
  function checkArea(s: StepView) {
    const marks = checksOf(s.id);
    const latest = marks[0] ?? null;
    // Se deshace solo el Listo de esta misma elección: el de Todas las medidas se deshace desde Todas.
    const own = marks.some((m) => m.variantKey === variantKey);
    return (
      <div className="space-y-2">
        {latest ? (
          <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Hecho · {shotByline(latest, withMeasure)}</span>
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {latest ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {nextButton}
            {own ? (
              <Button size="lg" variant="outline" className="h-14 px-4 text-base" onClick={() => undoDone(s)} pending={checking} disabled={checking}>
                <Undo2 />
                Deshacer
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <Button size="lg" className="h-14 w-full px-4 text-base" onClick={() => markDone(s, index)} pending={checking} disabled={checking}>
              <Check />
              Listo
            </Button>
            <div className="flex justify-end">{skipButton(s)}</div>
          </>
        )}
      </div>
    );
  }

  const header = (
    <div className="flex items-center gap-3 rounded-2xl border bg-card shadow-card p-3">
      {product.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.thumb} alt="" className="h-12 w-12 shrink-0 rounded border bg-white object-contain" />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded border bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
          {product.code ? <Badge variant="outline">{product.code}</Badge> : null}
          {measureText ? <Badge variant="secondary">{measureText}</Badge> : null}
          <Badge variant="secondary">{protocol ? protocol.name : 'Sin protocolo'}</Badge>
          {pipeline ? (
            pipeline.href ? (
              <Link href={pipeline.href}>
                <Badge variant="outline" className="gap-1 hover:bg-muted">
                  <KanbanSquare className="h-3 w-3" />
                  En el pipeline
                </Badge>
              </Link>
            ) : (
              <Badge variant="outline" className="gap-1">
                <KanbanSquare className="h-3 w-3" />
                En el pipeline
              </Badge>
            )
          ) : null}
        </div>
      </div>
      <Link href={`${base}?producto=${product.id}`} className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline">
        Cambiar
      </Link>
    </div>
  );

  const uploadBar = upload && upload.status !== 'done' ? <UploadBar upload={upload} productId={product.id} /> : null;

  const noticeBar = notice ? (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="status">
      <span className="inline-flex items-center gap-1.5">
        <Check className="h-4 w-4 text-primary" />
        {notice.text}
      </span>
      {notice.back !== null ? (
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => goTo(notice.back!)}>
          <Redo2 className="h-3.5 w-3.5" />
          Volver a ese paso
        </button>
      ) : null}
    </div>
  ) : null;

  // ── Sin protocolo: foto o video, uno tras otro ──
  if (!protocol) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        {header}
        {uploadBar}
        {noticeBar}
        <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
          <h2 className="text-base font-semibold">Sacá lo que necesites</h2>
          <p className="text-sm text-muted-foreground">Cada foto o video se sube y queda a la vista abajo, para revisarlo.</p>
          {captureArea(capture ? [capture.kind] : ['PHOTO', 'VIDEO'])}
        </section>
        {mediaOf(null).length > 0 ? (
          <div className="rounded-2xl border bg-card shadow-card p-4">
            <ShotViewer title="Lo que ya registraste sin protocolo" items={mediaOf(null)} withMeasure={withMeasure} />
          </div>
        ) : null}
        {uploaded.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            En esta tanda: {uploaded.filter((u) => u.kind === 'PHOTO').length} fotos y {uploaded.filter((u) => u.kind === 'VIDEO').length} videos.
          </p>
        ) : null}
        <EndLinks base={base} productId={product.id} hasMeasures={measureText !== null} />
        {fileInputs}
      </div>
    );
  }

  const stateOf = (id: string) => (done[id] ? 'done' : pending?.stepId === id ? 'uploading' : skipped.has(id) ? 'skipped' : 'pending');

  const stepList = (
    <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {steps.map((s, i) => {
        const state = stateOf(s.id);
        const current = !finished && i === index;
        return (
          <li key={s.id} className="shrink-0">
            <button
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                'flex max-w-[11rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs',
                current ? 'border-foreground bg-foreground text-background' : 'bg-background hover:bg-muted',
              )}
              aria-current={current ? 'step' : undefined}
            >
              {state === 'done' ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : state === 'uploading' ? (
                <Upload className="h-3.5 w-3.5 shrink-0" />
              ) : state === 'skipped' ? (
                <SkipForward className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">
                {i + 1}. {s.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  if (steps.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        {header}
        <p className="rounded-2xl border bg-card shadow-card p-4 text-sm text-muted-foreground">Este protocolo todavía no tiene pasos. Elegí otro o seguí sin protocolo.</p>
        <EndLinks base={base} productId={product.id} hasMeasures={measureText !== null} />
      </div>
    );
  }

  // ── Terminó: el resumen ──
  if (finished || !step) {
    const counts = { done: steps.filter((s) => stateOf(s.id) === 'done').length, skipped: steps.filter((s) => stateOf(s.id) === 'skipped').length };
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        {header}
        {uploadBar}
        {noticeBar}
        <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
          <h2 className="text-lg font-semibold">Terminaste</h2>
          <p className="text-sm text-muted-foreground">
            {counts.done} de {steps.length} pasos hechos{counts.skipped > 0 ? `, ${counts.skipped} ${counts.skipped === 1 ? 'salteado' : 'salteados'}` : ''}. En esta tanda subiste {uploaded.length}{' '}
            {uploaded.length === 1 ? 'archivo' : 'archivos'}.
          </p>
          <ul className="divide-y rounded-md border">
            {steps.map((s, i) => {
              const media = mediaOf(s.id);
              return (
                <li key={s.id}>
                  <button type="button" className="block w-full space-y-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => goTo(i)}>
                    <span className="flex items-center gap-2">
                      {stateOf(s.id) === 'done' ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : stateOf(s.id) === 'uploading' ? (
                        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : stateOf(s.id) === 'skipped' ? (
                        <SkipForward className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {i + 1}. {s.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{stepNote(s, media.length, stateOf(s.id))}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </span>
                    {media.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5 pl-6">
                        {media.slice(0, 6).map((m) => (
                          <ShotThumb key={m.id} shot={m} className="h-11 w-11" />
                        ))}
                        {media.length > 6 ? <span className="flex h-11 items-center px-1 text-xs text-muted-foreground">y {media.length - 6} más</span> : null}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <EndLinks base={base} productId={product.id} hasMeasures={measureText !== null} />
      </div>
    );
  }

  // ── Un paso ──
  const count = done[step.id] ?? 0;
  const media = mediaOf(step.id);
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {header}
      {stepList}
      {uploadBar}
      {noticeBar}
      <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Paso {index + 1} de {steps.length}
          </span>
          <Badge variant="outline" className="gap-1">
            <ShootKindIcon kind={step.kind} className="h-3 w-3" />
            {SHOOT_KIND_LABEL[step.kind]}
          </Badge>
          {count > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              Hecho
            </Badge>
          ) : null}
        </div>
        <h2 className="text-lg font-semibold leading-tight">{step.title}</h2>
        {step.illustration ? (
          <button type="button" onClick={() => setEnlarged((v) => !v)} className="block min-h-32 w-full overflow-hidden rounded-md border bg-muted" title={enlarged ? 'Achicar' : 'Agrandar'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={step.illustration.href} alt={`Ejemplo de ${step.title}`} className={cn('mx-auto w-full object-contain', enlarged ? 'max-h-[80vh]' : 'max-h-56')} />
          </button>
        ) : null}
        {step.explanation ? <p className="whitespace-pre-line text-sm">{step.explanation}</p> : null}
        {step.kind === 'CHECK' ? (
          checkArea(step)
        ) : (
          <>
            {!capture ? <ShotViewer title="Lo que ya registraste en este paso" items={media} withMeasure={withMeasure} /> : null}
            {captureArea([step.kind], media.length > 0)}
          </>
        )}
      </section>
      {fileInputs}
    </div>
  );
}

/** Lo que tiene cada paso en el resumen: sus fotos o videos, Hecho, Subiendo, Salteado o Pendiente. */
function stepNote(s: StepView, media: number, state: 'done' | 'uploading' | 'skipped' | 'pending'): string {
  if (state === 'uploading') return 'Subiendo';
  if (state === 'skipped') return 'Salteado';
  if (state === 'pending') return 'Pendiente';
  if (s.kind === 'CHECK' || media === 0) return 'Hecho';
  return s.kind === 'PHOTO' ? plural(media, 'foto') : plural(media, 'video');
}

/** La subida en curso o la que falló, arriba de todo, con su avance o con Reintentar y Descartar. */
function UploadBar({ upload, productId }: { upload: ShotUpload; productId: string }) {
  const failed = upload.status === 'failed';
  const what = `${upload.kind === 'PHOTO' ? 'la foto' : 'el video'}${upload.stepTitle ? ` de “${upload.stepTitle}”` : ''}${upload.productId !== productId ? ` de ${upload.productLabel}` : ''}`;
  return (
    <div className={cn('space-y-2 rounded-lg border px-3 py-2 text-sm', failed ? 'border-destructive/40 bg-destructive/5' : 'border-primary/30 bg-primary/5')} role="status">
      <p className="flex items-start gap-2">
        {failed ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <Upload className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-primary" />}
        <span>
          {failed
            ? `No se pudo subir ${what}. ${upload.error ?? ''}`
            : upload.saving
              ? `Guardando ${what}…`
              : `Subiendo ${what}, ${upload.percent} %. Podés seguir con el paso siguiente.`}
        </span>
      </p>
      {failed ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={retryShotUpload}>
            <RotateCcw />
            Reintentar
          </Button>
          <Button size="sm" variant="outline" onClick={discardShotUpload}>
            <Trash2 />
            Descartar
          </Button>
        </div>
      ) : (
        <div className="h-1.5 overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${upload.percent}%` }} />
        </div>
      )}
    </div>
  );
}

function EndLinks({ base, productId, hasMeasures }: { base: string; productId: string; hasMeasures: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {hasMeasures ? (
        <Button asChild variant="outline" size="lg" className="px-4">
          <Link href={`${base}?producto=${productId}`}>Otra medida de este producto</Link>
        </Button>
      ) : null}
      <Button asChild variant="outline" size="lg" className="px-4">
        <Link href={base}>Otro producto</Link>
      </Button>
    </div>
  );
}
