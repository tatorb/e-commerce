'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { videoUploadType } from '@/domain/videos';
import { finishVideoUploadAction, startVideoUploadAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import { BrandMark } from '@/components/ui/brand-loader';
import { measureVideo, uploadToDrive } from './upload';

// Sube los videos directo a la carpeta del producto en el Drive. Antes de
// subirlo, el navegador lo mide para saber si sirve como clip.

const ACCEPT = 'video/*,.mp4,.m4v,.mov,.mpg,.mpeg,.avi,.webm';

export function VideoUploader({ accountSlug, productId }: { accountSlug: string; productId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const busy = progress !== null;

  // Mientras sube, avisa antes de cerrar o cambiar de página.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  async function send(list: FileList | File[]) {
    const all = [...list];
    if (all.length === 0 || busy) return;
    setErrors([]);
    const problems: string[] = [];
    let done = 0;
    for (const [i, file] of all.entries()) {
      const check = videoUploadType(file);
      if (!check.ok) {
        problems.push(check.error);
        continue;
      }
      const label = all.length === 1 ? file.name : `${i + 1} de ${all.length}, ${file.name}`;
      try {
        setProgress(`Midiendo ${label}…`);
        const measure = await measureVideo(file);
        setProgress(`Preparando ${label}…`);
        const start = await startVideoUploadAction(accountSlug, productId, { name: file.name, size: file.size, type: check.type });
        if (!start.ok) {
          problems.push(`${file.name}: ${start.error}`);
          continue;
        }
        const fileId = await uploadToDrive(file, start.uploadUrl, (sent) =>
          setProgress(`Subiendo ${label}, ${Math.floor((sent / file.size) * 100)} %`),
        );
        setProgress(`Guardando ${label}…`);
        const finish = await finishVideoUploadAction(accountSlug, productId, fileId, file.size, measure);
        if (!finish.ok) problems.push(`${file.name}: ${finish.error}`);
        else done++;
      } catch (e) {
        problems.push(`${file.name}: ${e instanceof Error ? e.message : 'no se pudo subir.'}`);
      }
    }
    setProgress(null);
    setErrors(problems);
    if (done > 0) router.refresh();
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
          void send(e.dataTransfer.files);
        }}
        disabled={busy}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          dragging ? 'border-foreground bg-muted/40' : 'border-border hover:border-foreground/40',
        )}
      >
        {progress ? <BrandMark className="h-7 w-7 rounded" /> : <Film className="h-7 w-7 text-muted-foreground" aria-hidden />}
        <span className="text-sm" aria-live="polite">
          {progress ?? 'Arrastrá los videos o tocá para elegirlos'}
        </span>
        <span className="text-xs text-muted-foreground">
          Van a la carpeta del producto en el Drive. MP4 o MOV, hasta 2 GB cada uno. No cierres la página mientras sube.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        aria-label="Elegir videos"
        onChange={(e) => {
          if (e.target.files) void send(e.target.files);
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
