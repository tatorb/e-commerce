'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ORIGINAL_MAX_BYTES, originalTypeFor } from '@/lib/photo-rules';
import { addUploadedPhotosAction, startPhotoUploadAction } from '@/app/a/[cuenta]/pipeline/image-actions';
import { BrandMark } from '@/components/ui/brand-loader';
import { uploadToDrive } from '@/components/drive/upload';

// Sube los originales directo a la carpeta Originales del producto en el
// Drive y después la app los suma a la línea. Acepta las HEIC del iPhone, que
// el navegador no muestra.

const ACCEPT = '.jpg,.jpeg,.png,.heic,.heif,.tif,.tiff,image/jpeg,image/png,image/heic,image/heif,image/tiff';

export function PhotoUploader({ accountSlug, publicationId }: { accountSlug: string; publicationId: string }) {
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
      const done: string[] = [];
      const ok = all.filter((f) => {
        const type = originalTypeFor(f.name);
        if (!type) problems.push(`${f.name}: solo fotos JPG, PNG, HEIC o TIFF.`);
        else if (f.size > ORIGINAL_MAX_BYTES) problems.push(`${f.name}: pesa más de 100 MB.`);
        return Boolean(type) && f.size <= ORIGINAL_MAX_BYTES;
      });
      for (const [i, file] of ok.entries()) {
        const label = ok.length === 1 ? file.name : `${i + 1} de ${ok.length}`;
        setProgress(`Subiendo ${label}…`);
        try {
          const start = await startPhotoUploadAction(accountSlug, publicationId, { name: file.name, size: file.size });
          if (!start.ok) {
            problems.push(`${file.name}: ${start.error}`);
            continue;
          }
          done.push(await uploadToDrive(file, start.uploadUrl, (sent) => setProgress(`Subiendo ${label}, ${Math.floor((sent / file.size) * 100)} %`)));
        } catch (e) {
          problems.push(`${file.name}: ${e instanceof Error ? e.message : 'no se pudo subir.'}`);
        }
      }
      if (done.length > 0) {
        setProgress('Sumando a la línea…');
        const r = await addUploadedPhotosAction(accountSlug, publicationId, done);
        if (!r.ok) problems.push(r.error);
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
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          dragging ? 'border-foreground bg-muted/40' : 'border-border hover:border-foreground/40',
        )}
      >
        {progress ? <BrandMark className="h-7 w-7 rounded" /> : <ImagePlus className="h-7 w-7 text-muted-foreground" aria-hidden />}
        <span className="text-sm">{progress ?? 'Arrastrá los originales o tocá para elegirlos'}</span>
        <span className="text-xs text-muted-foreground">
          Tal como salen de la cámara, sin editar. JPG, PNG, HEIC o TIFF, hasta 100 MB cada una. Van a la carpeta Originales del producto en el Drive.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        aria-label="Elegir fotos originales"
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
