'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { saveKnowledgeAction } from '@/app/a/[cuenta]/pipeline/research-actions';
import { withSharedNote } from './SharedNote';

// Lo que sabe la tienda del producto: contexto, preguntas frecuentes,
// condiciones que pueden surgir y sus aclaraciones. Es del producto y lo usan
// las respuestas a los compradores y la descripción.
export function KnowledgeCard({
  accountSlug,
  target,
  sharedWith,
  initial,
}: {
  accountSlug: string;
  // Desde el paso Información, la publicación; desde la ficha, el producto.
  target: { publicationId: string } | { productId: string };
  sharedWith: number;
  initial: string;
}) {
  const [html, setHtml] = useState(initial);
  const { run, pending, status } = useStepAction();
  return (
    <SectionCard
      title="Lo que sabe la tienda"
      description={withSharedNote(
        'Contexto del producto, preguntas frecuentes, condiciones que pueden surgir y sus aclaraciones. Lo usan las respuestas a los compradores y la descripción.',
        sharedWith,
      )}
    >
      <SectionBody>
        <RichTextEditor
          initial={initial}
          onChange={setHtml}
          label="Lo que sabe la tienda"
          placeholder="Por ejemplo: no incluye las juntas, se venden aparte. Si el motor tiene aire acondicionado, va la otra polea. La garantía vale con la factura del taller que lo instaló."
          disabled={pending}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button pending={pending} disabled={pending || html === initial} onClick={() => run(() => saveKnowledgeAction(accountSlug, target, html))}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          <StatusText status={status} />
        </div>
      </SectionBody>
    </SectionCard>
  );
}
