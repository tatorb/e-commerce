'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EditableList, type EditableItem } from '@/components/ui/editable-list';
import { SectionBody, SectionCard, SubHeader } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { withSharedNote } from './SharedNote';
import {
  addInsightAction,
  deleteInsightAction,
  moveInsightAction,
  saveQuestionsAction,
  updateInsightAction,
} from '@/app/a/[cuenta]/pipeline/research-actions';

type Kind = 'PAIN' | 'OBJECTION';

const LISTS: Record<Kind, { title: string; empty: string; placeholder: string }> = {
  PAIN: {
    title: 'Dolores',
    empty: 'Todavía no hay dolores.',
    placeholder: 'Por ejemplo: no sabe si le sirve para su motor.',
  },
  OBJECTION: {
    title: 'Objeciones',
    empty: 'Todavía no hay objeciones.',
    placeholder: 'Por ejemplo: duda de que sea original.',
  },
};

// Dolores del comprador: las preguntas que llegaron del canal, las pegadas y
// las listas de dolores y objeciones. Es del producto, salvo las preguntas de
// la publicación propia, que son de cada publicación.
export function BuyerPainsCard({
  accountSlug,
  publicationId,
  sharedWith,
  questions,
  received = [],
  channelName,
  pains,
  objections,
}: {
  accountSlug: string;
  publicationId: string;
  sharedWith: number;
  questions: { own: string; competitors: string };
  // Las que llegaron solas del canal, lo más nuevo primero.
  received?: { id: string; text: string; answer: string | null }[];
  channelName: string;
  pains: EditableItem[];
  objections: EditableItem[];
}) {
  const [values, setValues] = useState(questions);
  const { run, pending, status } = useStepAction();
  const changed = values.own !== questions.own || values.competitors !== questions.competitors;
  return (
    <SectionCard
      title="Dolores del comprador"
      count={pains.length + objections.length}
      description={withSharedNote(
        'Las preguntas de los compradores, y los dolores y objeciones que salen de ellas.',
        sharedWith,
        'las preguntas de esta publicación',
      )}
    >
      <SectionBody>
        {received.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <SubHeader title={`Recibidas en ${channelName}`} count={received.length} />
            <ul className="max-h-72 divide-y overflow-y-auto text-sm">
              {received.map((q) => (
                <li key={q.id} className="space-y-0.5 px-3 py-2">
                  <p className="whitespace-pre-line break-words">{q.text}</p>
                  {q.answer ? <p className="whitespace-pre-line break-words text-muted-foreground">{q.answer}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="q-own">{received.length > 0 ? 'Otras preguntas de esta publicación' : 'Preguntas de esta publicación'}</Label>
            <Textarea
              id="q-own"
              rows={8}
              value={values.own}
              onChange={(e) => setValues((v) => ({ ...v, own: e.target.value }))}
              placeholder={`Pegá acá las preguntas que no llegaron solas de ${channelName}, como vienen.`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-comp">Preguntas de la competencia</Label>
            <Textarea
              id="q-comp"
              rows={8}
              value={values.competitors}
              onChange={(e) => setValues((v) => ({ ...v, competitors: e.target.value }))}
              placeholder="Pegá acá las preguntas de las publicaciones de la competencia."
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button pending={pending} disabled={pending || !changed} onClick={() => run(() => saveQuestionsAction(accountSlug, publicationId, values))}>
            {pending ? 'Guardando…' : 'Guardar preguntas'}
          </Button>
          <StatusText status={status} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <InsightList accountSlug={accountSlug} publicationId={publicationId} kind="PAIN" items={pains} />
          <InsightList accountSlug={accountSlug} publicationId={publicationId} kind="OBJECTION" items={objections} />
        </div>
      </SectionBody>
    </SectionCard>
  );
}

function InsightList({
  accountSlug,
  publicationId,
  kind,
  items,
}: {
  accountSlug: string;
  publicationId: string;
  kind: Kind;
  items: EditableItem[];
}) {
  const [adding, setAdding] = useState(false);
  const meta = LISTS[kind];
  return (
    <div className="overflow-hidden rounded-lg border">
      <SubHeader
        title={meta.title}
        count={items.length}
        action={
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        }
      />
      <EditableList
        items={items}
        adding={adding}
        onAddClosed={() => setAdding(false)}
        emptyText={meta.empty}
        placeholder={meta.placeholder}
        onAdd={(text) => addInsightAction(accountSlug, publicationId, kind, text)}
        onSave={(id, text) => updateInsightAction(accountSlug, publicationId, id, text)}
        onDelete={(id) => deleteInsightAction(accountSlug, publicationId, id)}
        onMove={(id, direction) => moveInsightAction(accountSlug, publicationId, id, direction)}
      />
    </div>
  );
}
