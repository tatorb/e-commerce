'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HardDriveUpload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BrandMark } from '@/components/ui/brand-loader';
import { plural } from '@/lib/format';
import { deleteVercelFilesAction, moveToDriveAction } from '@/app/equipo/actions';

// Lo que quedó guardado en el depósito de Vercel de antes: primero se pasa al
// Drive, de a tandas, y cuando está todo, se borra de Vercel. La pantalla
// pide tandas mientras esté abierta.

type Message = { kind: 'ok' | 'error'; text: string } | null;

export function VercelFilesCard({ left: initialLeft, driveReady, storeConnected }: { left: number; driveReady: boolean; storeConnected: boolean }) {
  const router = useRouter();
  const [left, setLeft] = useState(initialLeft);
  const [busy, setBusy] = useState<'move' | 'delete' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function move() {
    setBusy('move');
    setMessage(null);
    setProblems([]);
    let total = 0;
    const seen = new Set<string>();
    for (;;) {
      setProgress(`Pasando al Drive… ${total > 0 ? `${plural(total, 'archivo pasado', 'archivos pasados')}. ` : ''}No cierres la página.`);
      const r = await moveToDriveAction().catch(() => null);
      if (!r) {
        setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Tocá de nuevo para seguir: lo pasado ya quedó.' });
        break;
      }
      if (!r.ok) {
        setMessage({ kind: 'error', text: r.error });
        break;
      }
      total += r.moved;
      setLeft(r.left);
      for (const p of r.problems) seen.add(p);
      setProblems([...seen]);
      // Terminó, o lo que queda no se puede pasar.
      if (r.left === 0 || r.moved === 0) break;
    }
    setProgress(null);
    setBusy(null);
    if (total > 0) setMessage({ kind: 'ok', text: `Se ${total === 1 ? 'pasó' : 'pasaron'} ${plural(total, 'archivo')} al Drive.` });
    router.refresh();
  }

  async function remove() {
    setConfirming(false);
    setBusy('delete');
    setMessage(null);
    let total = 0;
    for (;;) {
      setProgress(`Borrando de Vercel… ${total > 0 ? `${plural(total, 'archivo borrado', 'archivos borrados')}.` : ''}`);
      const r = await deleteVercelFilesAction().catch(() => null);
      if (!r || !r.ok) {
        setMessage({ kind: 'error', text: r ? r.error : 'Se cortó la conexión con la app. Tocá de nuevo para seguir.' });
        break;
      }
      total += r.deleted;
      if (!r.more) {
        setDeleted(true);
        break;
      }
    }
    setProgress(null);
    setBusy(null);
    router.refresh();
  }

  if (deleted) {
    return (
      <div className="space-y-2 text-sm">
        <p>Listo: el depósito de Vercel quedó vacío. Para dejar de pagarlo, dalo de baja:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>En Vercel, entrá al proyecto y abrí la pestaña Storage.</li>
          <li>Elegí el depósito de archivos, entrá en Settings y tocá Delete.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {left > 0 ? (
        <>
          <p>
            Quedan <strong>{plural(left, 'archivo')}</strong> guardados en Vercel: originales, vistas y fotos corregidas de la línea de imágenes, y
            archivos del fabricante. Se pasan a las carpetas de cada producto en el Drive. No se borra nada de Vercel.
          </p>
          {!driveReady ? <p className="text-muted-foreground">Primero conectá el Drive del estudio.</p> : null}
          <Button onClick={move} pending={busy === 'move'} disabled={busy !== null || !driveReady}>
            <HardDriveUpload />
            Pasar al Drive
          </Button>
        </>
      ) : (
        <>
          <p>Todo está en el Drive. Antes de borrar, revisá en algunas publicaciones que las fotos y los archivos del fabricante se vean bien.</p>
          <Popover open={confirming} onOpenChange={setConfirming}>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={busy !== null || !storeConnected}>
                <Trash2 />
                Borrar de Vercel
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4">
              <p className="text-sm">Se borran todos los archivos del depósito de Vercel. No se puede deshacer. Lo que está en el Drive no se toca.</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="destructive" onClick={remove}>
                  Borrar de Vercel
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
      {progress ? (
        <p className="flex items-center gap-2" role="status">
          <BrandMark className="h-5 w-5 rounded" />
          {progress}
        </p>
      ) : null}
      {problems.length > 0 ? (
        <div className="space-y-1">
          <p className="font-medium">No se pudieron pasar:</p>
          <ul className="list-disc space-y-0.5 pl-5 text-destructive">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {message ? (
        <p role="status" className={message.kind === 'error' ? 'text-destructive' : undefined}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
