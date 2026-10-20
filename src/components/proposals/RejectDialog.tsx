'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { rejectProposalAction } from '@/app/a/[cuenta]/publicaciones/review-actions';

// Rechazar una propuesta, con un motivo opcional que queda registrado.
export function RejectDialog({
  accountSlug,
  proposalId,
  productUrl,
  disabled,
}: {
  accountSlug: string;
  proposalId: string;
  productUrl: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await rejectProposalAction(accountSlug, proposalId, reason);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(productUrl);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <X className="h-4 w-4" />
        Rechazar
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rechazar propuesta</DialogTitle>
          <DialogDescription>
            No cambia nada en la ficha. La publicación vuelve a la etapa en la que estaba antes de la propuesta y se
            puede generar otra.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Motivo, si querés dejarlo</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Por ejemplo, inventó la medida o cambió el sentido del título."
            disabled={pending}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button pending={pending} type="button" variant="destructive" onClick={submit} disabled={pending}>
            {pending ? 'Rechazando…' : 'Rechazar propuesta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
