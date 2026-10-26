import { Info } from 'lucide-react';
import type { MediaSources } from '@/lib/media';

// Lo que conviene saber antes de subir las fotos: si la publicación vende una
// sola medida del producto, y qué otras publicaciones las comparten en el canal.
export function SharedPhotosNote({ sources }: { sources: Pick<MediaSources, 'channelName' | 'soleMeasure' | 'sharedWith'> }) {
  const { channelName, soleMeasure, sharedWith } = sources;
  if (!soleMeasure && sharedWith.length === 0) return null;
  const list = sharedWith.length > 1 ? `${sharedWith.slice(0, -1).join(', ')} y ${sharedWith[sharedWith.length - 1]}` : sharedWith[0];
  return (
    <div role="note" className="space-y-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      {soleMeasure ? (
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Vende solo la medida {soleMeasure.label}
            {soleMeasure.sku && soleMeasure.sku !== soleMeasure.label ? `, por su SKU ${soleMeasure.sku}` : ''}: todas las fotos van a esta
            publicación. Las de las otras medidas van en sus propias publicaciones.
          </span>
        </p>
      ) : null}
      {sharedWith.length > 0 ? (
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            En {channelName} las fotos son del producto, y las comparten sus publicaciones: al subirlas acá, cambian también en {list}.
          </span>
        </p>
      ) : null}
    </div>
  );
}
