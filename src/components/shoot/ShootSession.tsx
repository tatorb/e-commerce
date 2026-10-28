'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Check, ChevronRight, CircleDashed, Images, Redo2, RotateCcw, SkipForward, Upload, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useReadOnly } from '@/components/access/AccessProvider';
import { measureVideo, uploadToDrive } from '@/components/drive/upload';
import { cn } from '@/lib/utils/cn';
import { LOW_QUALITY_HELP, qualityOf, SHOOT_KIND_LABEL, shotsPerStep, type Quality, type ShootKind } from '@/domain/shoot';
import type { BrowserMeasure } from '@/lib/videos';
import type { ProtocolView, ShootPick } from '@/lib/shoot';
import { finishShotPhotoAction, finishShotVideoAction, startShotUploadAction } from '@/app/a/[cuenta]/registro-productos/actions';

// Lo que hace el operario con el celular: sigue los pasos del protocolo, o
// ninguno, saca la foto o graba el video con la cámara del teléfono, lo revisa
// y lo sube. El archivo va directo al Drive, tal como sale de la cámara.

export type SessionShot = { kind: ShootKind; stepId: string | null; variantKey: string | null };

type Capture = {
  file: File;
  url: string;
  kind: ShootKind;
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
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const steps = useMemo(() => protocol?.steps ?? [], [protocol]);
  const variantKey = measure?.key ?? null;
  const done = shotsPerStep(shots, variantKey);
  const [index, setIndex] = useState(() => Math.max(0, steps.findIndex((s) => !done[s.id])));
  const [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [uploaded, setUploaded] = useState<{ kind: ShootKind; title: string | null }[]>([]);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; back: number | null } | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const inputs = {
    PHOTO: { camera: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null) },
    VIDEO: { camera: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null) },
  };
  const step = protocol && !finished ? (steps[index] ?? null) : null;
  const uploading = progress !== null;

  // Mientras sube, avisa antes de cerrar o cambiar de página.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

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

  async function onFile(file: File | undefined, kind: ShootKind) {
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
    setEnlarged(false);
    setFinished(false);
    setIndex(i);
  }

  function next() {
    if (index + 1 < steps.length) goTo(index + 1);
    else {
      clearCapture();
      setFinished(true);
    }
  }

  async function send() {
    if (!capture || uploading) return;
    const c = capture;
    const stepId = step?.id ?? null;
    const name = fileNameFor(c.file, [product.code ?? product.name, measure?.label, step?.title]);
    setError(null);
    setProgress('Preparando la subida…');
    try {
      const start = await startShotUploadAction(accountSlug, product.id, c.kind, { name, size: c.file.size, type: c.file.type });
      if (!start.ok) throw new Error(start.error);
      const fileId = await uploadToDrive(c.file, start.uploadUrl, (sent) => setProgress(`Subiendo, ${Math.floor((sent / c.file.size) * 100)} %`));
      setProgress('Guardando…');
      const r =
        c.kind === 'PHOTO'
          ? await finishShotPhotoAction(accountSlug, { productId: product.id, fileId, stepId, variantKey })
          : await finishShotVideoAction(accountSlug, { productId: product.id, fileId, size: c.file.size, measure: c.video, stepId, variantKey });
      if (!r.ok) throw new Error(r.error);
      setProgress(null);
      setCapture(null);
      setUploaded((list) => [...list, { kind: c.kind, title: step?.title ?? null }]);
      const what = c.kind === 'PHOTO' ? 'la foto' : 'el video';
      setNotice({ text: step ? `Se subió ${what} de “${step.title}”.` : `Se subió ${what}.`, back: step ? index : null });
      if (step) next();
      router.refresh();
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error && e.message ? e.message : 'No se pudo subir. Revisá la conexión y probá de nuevo.');
    }
  }

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

  /** Los botones para sacar, o la revisión de lo que se sacó. */
  function captureArea(kinds: readonly ShootKind[]) {
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
          {progress ? <p className="text-sm font-medium" role="status">{progress}</p> : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className="px-4" onClick={send} pending={uploading} disabled={uploading || capture.measuring || Boolean(low)}>
              <Upload />
              {error ? 'Reintentar' : 'Subir'}
            </Button>
            <Button size="lg" variant="outline" className="px-4" onClick={clearCapture} disabled={uploading} access="view">
              <RotateCcw />
              Repetir
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className={cn('grid gap-2', kinds.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {kinds.map((kind) => (
            <Button key={kind} size="lg" className="h-14 px-4 text-base" onClick={() => inputs[kind].camera.current?.click()}>
              {kind === 'PHOTO' ? <Camera /> : <Video />}
              {kind === 'PHOTO' ? 'Sacar foto' : 'Grabar video'}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-x-4">
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={readOnly}
                onClick={() => inputs[kind].gallery.current?.click()}
                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
              >
                <Images className="h-4 w-4" />
                {kinds.length > 1 ? (kind === 'PHOTO' ? 'Foto de la galería' : 'Video de la galería') : 'Elegir de la galería'}
              </button>
            ))}
          </div>
          {step ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSkipped((s) => new Set(s).add(step.id));
                setNotice(null);
                next();
              }}
              access="view"
            >
              <SkipForward />
              Saltear
            </Button>
          ) : null}
        </div>
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
        </div>
      </div>
      <Link href={`${base}?producto=${product.id}`} className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline">
        Cambiar
      </Link>
    </div>
  );

  const noticeBar = notice ? (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="status">
      <span className="inline-flex items-center gap-1.5">
        <Check className="h-4 w-4 text-primary" />
        {notice.text}
      </span>
      {notice.back !== null ? (
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => goTo(notice.back!)}>
          <Redo2 className="h-3.5 w-3.5" />
          Sacar otra de ese paso
        </button>
      ) : null}
    </div>
  ) : null;

  // ── Sin protocolo: foto o video, uno tras otro ──
  if (!protocol) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        {header}
        {noticeBar}
        <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
          <h2 className="text-base font-semibold">Sacá lo que necesites</h2>
          <p className="text-sm text-muted-foreground">Cada foto o video se sube y queda listo para la próxima.</p>
          {captureArea(capture ? [capture.kind] : ['PHOTO', 'VIDEO'])}
        </section>
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

  const stateOf = (id: string) => (done[id] ? 'done' : skipped.has(id) ? 'skipped' : 'pending');

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
              disabled={uploading}
              className={cn(
                'flex max-w-[11rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs',
                current ? 'border-foreground bg-foreground text-background' : 'bg-background hover:bg-muted',
              )}
              aria-current={current ? 'step' : undefined}
            >
              {state === 'done' ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
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
        {noticeBar}
        <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
          <h2 className="text-lg font-semibold">Terminaste</h2>
          <p className="text-sm text-muted-foreground">
            {counts.done} de {steps.length} pasos hechos{counts.skipped > 0 ? `, ${counts.skipped} ${counts.skipped === 1 ? 'salteado' : 'salteados'}` : ''}. En esta tanda subiste {uploaded.length}{' '}
            {uploaded.length === 1 ? 'archivo' : 'archivos'}.
          </p>
          <ul className="divide-y rounded-md border">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => goTo(i)}>
                  {stateOf(s.id) === 'done' ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : stateOf(s.id) === 'skipped' ? (
                    <SkipForward className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {i + 1}. {s.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {done[s.id] ? `${done[s.id]} ${s.kind === 'PHOTO' ? (done[s.id] === 1 ? 'foto' : 'fotos') : done[s.id] === 1 ? 'video' : 'videos'}` : stateOf(s.id) === 'skipped' ? 'Salteado' : 'Pendiente'}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>
        <EndLinks base={base} productId={product.id} hasMeasures={measureText !== null} />
      </div>
    );
  }

  // ── Un paso ──
  const count = done[step.id] ?? 0;
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {header}
      {stepList}
      {noticeBar}
      <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Paso {index + 1} de {steps.length}
          </span>
          <Badge variant="outline" className="gap-1">
            {step.kind === 'PHOTO' ? <Camera className="h-3 w-3" /> : <Video className="h-3 w-3" />}
            {SHOOT_KIND_LABEL[step.kind]}
          </Badge>
          {count > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              Ya tiene {count === 1 ? (step.kind === 'PHOTO' ? 'una foto' : 'un video') : `${count} ${step.kind === 'PHOTO' ? 'fotos' : 'videos'}`}
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
        {captureArea([step.kind])}
      </section>
      {fileInputs}
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
