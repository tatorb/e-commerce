'use client';

import { useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Texto listo para pegarle a una IA junto con la planilla de contenido.
export function ContentSheetInstructions({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar. Seleccioná el texto y copialo a mano.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setCopied(false);
          setError(null);
        }
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" />
        Instrucciones para la IA
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Instrucciones para la IA</DialogTitle>
          <DialogDescription>
            Copiá este texto y pegalo en Claude o ChatGPT junto con la planilla. Revisá lo que te devuelva antes de
            importarlo.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          readOnly
          rows={16}
          className="text-sm"
          aria-label="Instrucciones para la IA"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button type="button" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
