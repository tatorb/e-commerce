'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Duplicate } from '@/domain/pipeline';

// Aviso antes de agregar publicaciones del mismo producto que otra que ya está
// en el pipeline. Deja elegir: agregarlas igual, o agregar solo las otras.
export function DuplicatesDialog({
  duplicates,
  total,
  pending,
  onForce,
  onSkip,
  onCancel,
}: {
  duplicates: Duplicate[];
  // Cuántas se querían agregar en total.
  total: number;
  pending: boolean;
  onForce: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const others = total - duplicates.length;
  return (
    <Dialog open onOpenChange={(open) => (!open && !pending ? onCancel() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {duplicates.length === 1 ? 'Hay una repetida' : `Hay ${duplicates.length} repetidas`}
          </DialogTitle>
          <DialogDescription>Todavía no se agregó ninguna. Elegí qué hacer.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
          {duplicates.map((d) => (
            <li key={d.id} className="rounded-md border px-3 py-2">
              <p className="font-medium">
                {d.title || 'Sin título'}
                {d.externalId ? <span className="font-normal text-muted-foreground"> · {d.externalId}</span> : null}
              </p>
              <p className="text-muted-foreground">
                {d.reason === 'product' ? 'Es del mismo producto que' : 'Tiene el mismo título que'}{' '}
                {d.other.externalId ?? `«${d.other.title || 'Sin título'}»`},{' '}
                {d.other.inPipeline ? 'que ya está en el pipeline.' : 'que también estás agregando.'}
              </p>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          {others > 0 ? (
            <Button variant="outline" onClick={onSkip} disabled={pending}>
              {others === 1 ? 'Agregar solo la otra' : `Agregar solo las otras ${others}`}
            </Button>
          ) : null}
          <Button onClick={onForce} disabled={pending}>
            {pending ? 'Agregando…' : 'Agregar igual'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
