'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { formatDateTime, plural } from '@/lib/format';
import type { QaStepData } from '@/lib/publication-qa';
import { saveQaTextAction, setAutoAnswerAction } from '@/app/a/[cuenta]/pipeline/qa-actions';

// El paso Preguntas y respuestas: lo que Claude lee para responder a los
// compradores de esta publicación, cuándo deja la respuesta para una persona y
// si manda solo las que está seguro.

function TextCard({
  accountSlug,
  publicationId,
  field,
  title,
  description,
  placeholder,
  initial,
  children,
}: {
  accountSlug: string;
  publicationId: string;
  field: 'faq' | 'rules';
  title: string;
  description: string;
  placeholder: string;
  initial: string;
  children?: React.ReactNode;
}) {
  const [html, setHtml] = useState(initial);
  const { run, pending, status } = useStepAction();
  return (
    <SectionCard title={title} description={description}>
      <SectionBody>
        <RichTextEditor initial={initial} onChange={setHtml} label={title} placeholder={placeholder} disabled={pending} />
        <div className="flex flex-wrap items-center gap-3">
          <Button pending={pending} disabled={pending || html === initial} onClick={() => run(() => saveQaTextAction(accountSlug, publicationId, field, html))}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          <StatusText status={status} />
        </div>
        {children}
      </SectionBody>
    </SectionCard>
  );
}

type Recent = QaStepData['recent'][number];

function answeredBy(q: Recent, channelName: string): string {
  if (q.draft?.outcome === 'SENT_AUTO') return 'Claude la mandó solo';
  if (q.answeredFrom === 'APP') return `Desde la app${q.answeredBy ? ` por ${q.answeredBy.name}` : ''}`;
  return `En ${channelName}`;
}

export function QaStep({
  accountSlug,
  publicationId,
  data,
  aiReady,
  timeZone,
}: {
  accountSlug: string;
  publicationId: string;
  data: QaStepData;
  aiReady: boolean;
  timeZone: string;
}) {
  const auto = useStepAction();
  // Lo que se tocó, mientras se guarda.
  const [wanted, setWanted] = useState(data.autoAnswer);
  const questionsHref = `/a/${accountSlug}/preguntas?publicacion=${publicationId}`;
  const infoHref = `/a/${accountSlug}/pipeline/${publicationId}?paso=informacion`;
  // Por qué todavía no puede responder solo, aunque esté prendido.
  const blocked = !aiReady
    ? 'Claude no puede responder: falta configurar su clave en Vercel.'
    : !data.canAnswer
      ? `Todavía no se pueden responder preguntas de ${data.channelName} desde la app.`
      : !data.published
        ? `Empieza cuando la publicación esté en ${data.channelName}.`
        : null;

  return (
    <>
      <TextCard
        accountSlug={accountSlug}
        publicationId={publicationId}
        field="faq"
        title="Preguntas frecuentes"
        description="Las preguntas que más hacen los compradores de esta publicación, cada una con la respuesta de la tienda. Claude las lee para responder."
        placeholder="Por ejemplo, ¿trae las juntas? No, las juntas se venden aparte. ¿Sirve para el 1.6 16v? Sí, para el 8v y el 16v."
        initial={data.faq ?? ''}
      >
        <p className="text-xs text-muted-foreground">
          Claude también lee la ficha, los datos de catálogo y{' '}
          <Link href={infoHref} className="font-medium text-foreground underline-offset-4 hover:underline">
            lo que sabe la tienda del producto
          </Link>
          {data.hasKnowledge ? '.' : ', que todavía está vacío.'}
        </p>
      </TextCard>

      <TextCard
        accountSlug={accountSlug}
        publicationId={publicationId}
        field="rules"
        title="Cuándo responde una persona"
        description="Las reglas para Claude, qué preguntas responde y cuáles deja para una persona. Las que deja quedan arriba en Preguntas, marcadas Para una persona, con el motivo."
        placeholder="Por ejemplo, si preguntan por un motor que no está en las compatibilidades, que responda una persona. Si piden factura A, respondé que sí y que la pidan al comprar."
        initial={data.rules ?? ''}
      />

      <SectionCard title="Responder solo">
        <SectionBody>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={auto.pending ? wanted : data.autoAnswer}
              disabled={auto.pending}
              onChange={(e) => {
                const on = e.target.checked;
                setWanted(on);
                auto.run(() => setAutoAnswerAction(accountSlug, publicationId, on));
              }}
            />
            <span>
              <span className="font-medium">Claude manda solo las respuestas de esta publicación cuando está seguro.</span>{' '}
              <span className="text-muted-foreground">
                Si no está seguro, si le falta un dato o si una regla pide una persona, la deja en Preguntas para que la mande alguien. Todo lo que manda
                queda en el Registro.
              </span>
            </span>
          </label>
          {data.autoAnswer && blocked ? <p className="text-sm text-amber-700">{blocked}</p> : null}
          {data.autoAnswer && !data.autoDraft && !blocked ? (
            <p className="text-sm text-muted-foreground">
              La cuenta no propone las respuestas solas, pero en esta publicación Claude las prepara igual para poder mandarlas.
            </p>
          ) : null}
          <StatusText status={auto.status} />
        </SectionBody>
      </SectionCard>

      <SectionCard
        title="Últimas preguntas"
        description={
          data.counts.waiting > 0
            ? `${plural(data.counts.waiting, 'espera respuesta', 'esperan respuesta')}${data.counts.forPerson > 0 ? `, ${data.counts.forPerson} para una persona` : ''}.`
            : 'Ninguna espera respuesta.'
        }
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={questionsHref}>Ver en Preguntas</Link>
          </Button>
        }
      >
        <SectionBody>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no llegaron preguntas a esta publicación.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {data.recent.map((q) => (
                <li key={q.id} className="space-y-1 px-3 py-2 text-sm">
                  <p className="tabular-nums text-xs text-muted-foreground">{formatDateTime(q.askedAt, timeZone)}</p>
                  <p className="whitespace-pre-line break-words font-medium">{q.text}</p>
                  {q.answer ? (
                    <p className="whitespace-pre-line break-words text-muted-foreground">
                      <span className="text-xs font-medium uppercase tracking-wide">{answeredBy(q, data.channelName)}.</span> {q.answer}
                    </p>
                  ) : q.status === 'UNANSWERED' ? (
                    <p className={q.draft?.needsPerson && !q.draft.outcome ? 'text-amber-700' : 'text-muted-foreground'}>
                      {q.draft?.needsPerson && !q.draft.outcome ? `Para una persona${q.draft.reason ? `. ${q.draft.reason}` : '.'}` : 'Sin responder.'}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionBody>
      </SectionCard>
    </>
  );
}
