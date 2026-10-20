'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { saveClarificationsAction } from '@/app/a/[cuenta]/pipeline/research-actions';
import { withSharedNote } from './SharedNote';

// Aclaraciones para las imágenes: texto con formato sobre modelos compatibles,
// confusiones y lo que tiene que quedar claro. Es del producto.
export function ClarificationsCard({
  accountSlug,
  publicationId,
  sharedWith,
  initial,
}: {
  accountSlug: string;
  publicationId: string;
  sharedWith: number;
  initial: string;
}) {
  const [html, setHtml] = useState(initial);
  const { run, pending, status } = useStepAction();
  return (
    <SectionCard
      title="Aclaraciones para las imágenes"
      description={withSharedNote(
        'Modelos compatibles, confusiones habituales y todo lo que tiene que quedar claro en las imágenes.',
        sharedWith,
      )}
    >
      <SectionBody>
        <RichTextEditor
          initial={initial}
          onChange={setHtml}
          label="Aclaraciones para las imágenes"
          placeholder="Por ejemplo: sirve para Gol 1.6 desde 2009. No confundir con el kit de 1.4, que tiene otro diámetro."
          disabled={pending}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button pending={pending} disabled={pending || html === initial} onClick={() => run(() => saveClarificationsAction(accountSlug, publicationId, html))}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          <StatusText status={status} />
        </div>
      </SectionBody>
    </SectionCard>
  );
}
