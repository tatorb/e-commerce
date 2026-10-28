'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, ClipboardList, KanbanSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useReadOnly } from '@/components/access/AccessProvider';
import { cn } from '@/lib/utils/cn';
import { shootToPipelineAction } from '@/app/a/[cuenta]/registro-productos/actions';
import { PickLink } from './PickLink';

// Elegir el protocolo, con el interruptor Agregar al pipeline: prendido, al
// elegir deja el producto en el pipeline antes de empezar. Arranca apagado.

export type ProtocolOption = { key: string; href: string; title: string; description?: string | null; note?: string; withProtocol: boolean };

export function ProtocolPicker({
  accountSlug,
  productId,
  options,
  pipeline,
}: {
  accountSlug: string;
  productId: string;
  options: ProtocolOption[];
  pipeline: {
    // Sin publicaciones, con alguna fuera del pipeline, o todas adentro.
    state: 'none' | 'out' | 'in';
    // Dónde se abre en el pipeline, si la persona lo puede ver.
    href: string | null;
    // Las tiendas para elegir, solo si hay que crear la publicación y hay más de una.
    stores: { id: string; label: string }[];
    // Si se crea una publicación por medida.
    byMeasure: boolean;
  };
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [on, setOn] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [going, setGoing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsStore = pipeline.state === 'none' && pipeline.stores.length > 1;

  async function choose(e: React.MouseEvent<HTMLAnchorElement>, option: ProtocolOption) {
    if (!on) return;
    e.preventDefault();
    if (going) return;
    if (needsStore && !storeId) return setError('Elegí en qué tienda va la publicación.');
    setGoing(option.key);
    setError(null);
    try {
      const r = await shootToPipelineAction(accountSlug, { productId, storeId: needsStore ? storeId : null });
      if (!r.ok) throw new Error(r.error);
      router.push(option.href);
    } catch (err) {
      setGoing(null);
      setError(err instanceof Error && err.message ? err.message : 'No se pudo agregar al pipeline. Revisá la conexión y probá de nuevo.');
    }
  }

  return (
    <div className="space-y-3">
      {pipeline.state === 'in' ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <KanbanSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            Este producto ya está en el pipeline.
            {pipeline.href ? (
              <>
                {' '}
                <Link href={pipeline.href} className="font-medium text-primary underline-offset-4 hover:underline">
                  Abrirlo
                </Link>
              </>
            ) : null}
          </span>
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="agregar-al-pipeline" className="text-sm font-medium">
              Agregar al pipeline
            </Label>
            <button
              id="agregar-al-pipeline"
              type="button"
              role="switch"
              aria-checked={on}
              disabled={readOnly || going !== null}
              onClick={() => {
                setOn((v) => !v);
                setError(null);
              }}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                on ? 'bg-primary' : 'bg-input',
              )}
            >
              <span className={cn('inline-block h-5 w-5 rounded-full bg-background shadow transition-transform', on ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {pipeline.state === 'none'
              ? `Prendido, crea una publicación nueva sin publicar${pipeline.byMeasure ? ', una por medida,' : ''} y la deja en el pipeline, en Información.`
              : 'Prendido, agrega al pipeline las publicaciones de este producto.'}{' '}
            Apagado, solo se registran las fotos y los videos.
          </p>
          {on && needsStore ? (
            <div className="space-y-1">
              <Label htmlFor="tienda-pipeline" className="text-xs">
                Tienda
              </Label>
              <select
                id="tienda-pipeline"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-base shadow-sm sm:h-9 sm:text-sm"
              >
                <option value="">Elegí la tienda</option>
                {pipeline.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.key}>
            <PickLink
              href={o.href}
              icon={o.withProtocol ? <ClipboardList className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
              title={o.title}
              description={o.description}
              note={going === o.key ? 'Agregando al pipeline…' : o.note}
              onClick={(e) => choose(e, o)}
              busy={going !== null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
