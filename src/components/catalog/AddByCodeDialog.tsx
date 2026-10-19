'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addByCodeAction } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';
import { cn } from '@/lib/utils/cn';
import { useAddToPipeline } from './useAddToPipeline';

// Agregar al pipeline pegando links o códigos. Cada canal los limpia a su
// manera: acá solo se pegan.
export function AddByCodeDialog({ accountSlug, example }: { accountSlug: string; example: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const add = useAddToPipeline(() => setText(''));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) add.clearMessage();
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Link2 className="h-4 w-4" />
        Agregar por link o código
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar al pipeline por link o código</DialogTitle>
          <DialogDescription>
            Pegá uno o varios, uno por línea. Sirve el link entero o el código, por ejemplo {example}. Tienen que estar
            en el Catálogo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="add-by-code">Links o códigos</Label>
          <Textarea
            id="add-by-code"
            rows={5}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              add.clearMessage();
            }}
            placeholder={example}
          />
        </div>
        {add.message ? (
          <p className={cn('text-sm', add.message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
            {add.message.text}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={add.pending}>
            Cerrar
          </Button>
          <Button onClick={() => add.run(() => addByCodeAction(accountSlug, text))} disabled={add.pending || !text.trim()}>
            {add.pending ? 'Agregando…' : 'Agregar al pipeline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
