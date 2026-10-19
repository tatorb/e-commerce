'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { ExternalLink, FileText, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IconButton, SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { deleteFileAction, registerFileAction, saveManufacturerAction } from '@/app/a/[cuenta]/pipeline/research-actions';
import { extensionOf, FILE_TYPES, filesPrefix, MAX_FILES, safeFileName } from '@/lib/file-rules';
import { cn } from '@/lib/utils/cn';
import { BlobSetup } from './BlobSetup';

export type ManufacturerFile = { id: string; kind: 'IMAGE' | 'PDF'; name: string; size: number; url: string };

const ACCEPT = Object.keys(FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
}

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

// Información del fabricante: links, archivos y texto pegado. Es del producto.
export function ManufacturerCard({
  accountSlug,
  publicationId,
  productId,
  initial,
  files,
  blobReady,
}: {
  accountSlug: string;
  publicationId: string;
  productId: string;
  initial: { site: string; productUrl: string; text: string };
  files: ManufacturerFile[];
  blobReady: boolean;
}) {
  const [values, setValues] = useState(initial);
  const { run, pending, status } = useStepAction();
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const changed = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <SectionCard
      title="Información del fabricante"
      count={files.length}
      description="Lo que dice el fabricante de la pieza: su sitio, la página del producto, catálogos e imágenes. No subas listas de precios ni costos del proveedor."
    >
      <SectionBody>
        <div className="grid gap-4 md:grid-cols-2">
          <LinkField id="mf-site" label="Sitio del fabricante" value={values.site} onChange={set('site')} />
          <LinkField id="mf-product" label="Página del producto" value={values.productUrl} onChange={set('productUrl')} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Archivos</p>
          {blobReady ? (
            <Uploader accountSlug={accountSlug} publicationId={publicationId} productId={productId} count={files.length} />
          ) : (
            <BlobSetup />
          )}
          <FileList accountSlug={accountSlug} publicationId={publicationId} files={files} canDelete={blobReady} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mf-text">Texto del fabricante</Label>
          <Textarea
            id="mf-text"
            rows={8}
            value={values.text}
            onChange={set('text')}
            placeholder="Pegá acá la descripción, la ficha técnica o lo que tenga el fabricante sobre la pieza."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={pending || !changed}
            onClick={() => run(() => saveManufacturerAction(accountSlug, publicationId, values))}
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          <StatusText status={status} />
        </div>
      </SectionBody>
    </SectionCard>
  );
}

function LinkField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const valid = isHttpUrl(value.trim());
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} type="url" inputMode="url" placeholder="https://" value={value} onChange={onChange} />
        <Button asChild variant="outline" size="icon" className={cn('shrink-0', !valid && 'pointer-events-none opacity-40')}>
          <a href={valid ? value.trim() : undefined} target="_blank" rel="noreferrer" aria-label={`Abrir ${label.toLowerCase()}`}>
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}

// Sube directo al depósito de Vercel y después la app anota cada archivo.
function Uploader({
  accountSlug,
  publicationId,
  productId,
  count,
}: {
  accountSlug: string;
  publicationId: string;
  productId: string;
  count: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, startTransition] = useTransition();

  function send(list: FileList | File[]) {
    const all = [...list];
    if (all.length === 0) return;
    setErrors([]);
    startTransition(async () => {
      const problems: string[] = [];
      const ok = all.filter((f) => {
        const type = FILE_TYPES[extensionOf(f.name)];
        if (!type) problems.push(`${f.name}: solo imágenes JPG, PNG, WEBP o GIF, y PDF.`);
        else if (f.size > type.maxBytes) problems.push(`${f.name}: pesa más de ${formatSize(type.maxBytes)}.`);
        return Boolean(type) && f.size <= type.maxBytes;
      });
      const room = Math.max(0, MAX_FILES - count);
      if (ok.length > room) problems.push(`Hasta ${MAX_FILES} archivos por producto: se suben los primeros ${room}.`);
      const queue = ok.slice(0, room);
      for (const [i, file] of queue.entries()) {
        setProgress(queue.length === 1 ? `Subiendo ${file.name}…` : `Subiendo ${i + 1} de ${queue.length}…`);
        try {
          const blob = await upload(`${filesPrefix(productId)}${safeFileName(file.name)}`, file, {
            access: 'public',
            handleUploadUrl: '/api/archivos',
            contentType: FILE_TYPES[extensionOf(file.name)].contentType,
            multipart: file.size > 8 * 1024 * 1024,
          });
          const r = await registerFileAction(accountSlug, publicationId, blob.url, file.name);
          if (!r.ok) problems.push(`${file.name}: ${r.error}`);
        } catch (e) {
          problems.push(`${file.name}: ${e instanceof Error ? e.message : 'no se pudo subir.'}`);
        }
      }
      setProgress(null);
      setErrors(problems);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          send(e.dataTransfer.files);
        }}
        disabled={busy}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          dragging ? 'border-foreground bg-muted/40' : 'border-border hover:border-foreground/40',
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
        <span className="text-sm">{progress ?? 'Arrastrá imágenes o PDF, o tocá para elegirlos'}</span>
        <span className="text-xs text-muted-foreground">Imágenes de hasta 10 MB y PDF de hasta 50 MB.</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        aria-label="Elegir archivos del fabricante"
        onChange={(e) => {
          if (e.target.files) send(e.target.files);
          e.target.value = '';
        }}
      />
      {errors.length > 0 ? (
        <ul role="status" className="space-y-0.5 text-sm text-destructive">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FileList({
  accountSlug,
  publicationId,
  files,
  canDelete,
}: {
  accountSlug: string;
  publicationId: string;
  files: ManufacturerFile[];
  canDelete: boolean;
}) {
  const { run, pending, status } = useStepAction();
  if (files.length === 0) return null;
  const images = files.filter((f) => f.kind === 'IMAGE');
  const pdfs = files.filter((f) => f.kind === 'PDF');
  const remove = (f: ManufacturerFile) => {
    if (window.confirm(`¿Borrar ${f.name}?`)) run(() => deleteFileAction(accountSlug, publicationId, f.id));
  };
  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((f) => (
            <li key={f.id} className="group relative overflow-hidden rounded-md border bg-background">
              <a href={f.url} target="_blank" rel="noreferrer" title={f.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del depósito, sin optimizar */}
                <img src={f.url} alt={f.name} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
              <p className="truncate px-2 py-1 text-[11px] text-muted-foreground">{f.name}</p>
              {canDelete ? (
                <IconButton
                  label={`Borrar ${f.name}`}
                  disabled={pending}
                  onClick={() => remove(f)}
                  className="absolute right-1 top-1 bg-background/90 shadow-sm"
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {pdfs.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {pdfs.map((f) => (
            <li key={f.id} className="inline-flex max-w-full items-center gap-1.5 rounded border bg-muted/40 py-1 pl-2 pr-1 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <a href={f.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                {f.name}
              </a>
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatSize(f.size)}</span>
              {canDelete ? (
                <IconButton label={`Borrar ${f.name}`} disabled={pending} onClick={() => remove(f)} className="p-1">
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <StatusText status={status} className="block" />
    </div>
  );
}
