'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useReadOnly } from '@/components/access/AccessProvider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { Textarea } from '@/components/ui/textarea';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { TRAIN_BOT } from '@/domain/access';
import { answerKindLabel } from '@/domain/answers';
import { formatDateTime, formatUsd, plural } from '@/lib/format';
import type { TryResult } from '@/lib/answers';
import type { QaStepData } from '@/lib/publication-qa';
import { saveQaTextAction, setAutoAnswerAction, tryAnswerAction } from '@/app/a/[cuenta]/pipeline/qa-actions';

// Preguntas y respuestas de una publicación: lo que Claude lee para responder a
// los compradores, cuándo deja la respuesta para una persona, si manda solo las
// que está seguro y una prueba para ver cómo respondería. Es el mismo en el paso
// del Pipeline, en tarjetas sueltas, y en la página de la publicación, en una sola.

type Variant = 'step' | 'publication';

// Un bloque: una tarjeta en el paso, una sección dentro de la tarjeta en la publicación.
function Block({
  variant,
  title,
  description,
  action,
  children,
}: {
  variant: Variant;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (variant === 'step') {
    return (
      <SectionCard title={title} description={description} action={action}>
        <SectionBody>{children}</SectionBody>
      </SectionCard>
    );
  }
  return (
    <section className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TextBlock({
  variant,
  accountSlug,
  publicationId,
  field,
  title,
  description,
  placeholder,
  initial,
  saved,
  value,
  onChange,
  onSaved,
  children,
}: {
  variant: Variant;
  accountSlug: string;
  publicationId: string;
  field: 'faq' | 'rules';
  title: string;
  description: string;
  placeholder: string;
  // Con lo que arranca el editor.
  initial: string;
  // Lo último guardado, tal como lo escribió el editor.
  saved: string;
  value: string;
  onChange: (html: string) => void;
  onSaved: (html: string) => void;
  children?: React.ReactNode;
}) {
  const { run, pending, status } = useStepAction();
  const cannotTrain = useReadOnly(TRAIN_BOT);
  return (
    <Block variant={variant} title={title} description={description}>
      <RichTextEditor initial={initial} onChange={onChange} label={title} placeholder={placeholder} disabled={pending || cannotTrain} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          access={TRAIN_BOT}
          pending={pending}
          disabled={pending || value === saved}
          onClick={() => {
            const html = value;
            run(() => saveQaTextAction(accountSlug, publicationId, field, html), () => onSaved(html));
          }}
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
        <StatusText status={status} />
      </div>
      {children}
    </Block>
  );
}

type Tried = { n: number; question: string; result: TryResult; unsaved: boolean };

// Cuántas pruebas quedan a la vista. No se guardan: se van al salir.
const TRIES_SHOWN = 5;

function TryBlock({
  variant,
  accountSlug,
  publicationId,
  faq,
  rules,
  unsaved,
  real,
  aiReady,
  autoAnswer,
  channelName,
}: {
  variant: Variant;
  accountSlug: string;
  publicationId: string;
  faq: string;
  rules: string;
  unsaved: boolean;
  real: string[];
  aiReady: boolean;
  autoAnswer: boolean;
  channelName: string;
}) {
  const [question, setQuestion] = useState('');
  const cannotTrain = useReadOnly(TRAIN_BOT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState<Tried[]>([]);
  const id = `qa-try-${variant}-${publicationId}`;

  async function test(text: string) {
    const value = text.trim();
    if (!value || pending) return;
    setPending(true);
    setError(null);
    const r = await tryAnswerAction(accountSlug, publicationId, { question: value, faq, rules }).catch(() => null);
    setPending(false);
    if (!r) return setError('Se cortó la conexión con la app. Probá de nuevo.');
    if (!r.ok) return setError(r.error);
    setTries((list) => [{ n: (list[0]?.n ?? 0) + 1, question: value, result: r.result, unsaved }, ...list].slice(0, TRIES_SHOWN));
  }

  return (
    <Block
      variant={variant}
      title="Probar"
      description={`Escribí una pregunta como si fueras un comprador y mirá qué respondería Claude. Usa lo que está escrito arriba, aunque no esté guardado. No se manda nada a ${channelName} y las pruebas no se guardan.`}
    >
      {!aiReady ? (
        <p className="text-sm text-muted-foreground">Claude no puede responder: falta configurar su clave en Vercel.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={id}>Pregunta de prueba</Label>
            <Textarea
              id={id}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  test(question);
                }
              }}
              placeholder="Por ejemplo, ¿le sirve a mi motor 6CTA?"
              disabled={pending || cannotTrain}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button access={TRAIN_BOT} onClick={() => test(question)} pending={pending} disabled={pending || !question.trim()}>
              {pending ? 'Claude está respondiendo…' : 'Probar'}
            </Button>
            {unsaved ? <span className="text-xs text-muted-foreground">Prueba con lo escrito arriba, que todavía no guardaste.</span> : null}
          </div>
          {real.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">O probá con una pregunta que ya llegó:</p>
              <div className="flex flex-wrap gap-2">
                {real.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={pending || cannotTrain}
                    onClick={() => {
                      setQuestion(q);
                      test(q);
                    }}
                    className="max-w-full truncate rounded-full border bg-background px-3 py-1 text-left text-xs hover:bg-muted disabled:opacity-50"
                    title={q}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {error ? <StatusText status={{ kind: 'error', text: error }} /> : null}
          {tries.length > 0 ? (
            <ul className="space-y-3">
              {tries.map((t) => (
                <li key={t.n} className="space-y-2 rounded-md border px-3 py-3 text-sm">
                  <p className="whitespace-pre-line break-words font-medium">{t.question}</p>
                  {t.result.alone ? (
                    <p className="rounded-md bg-muted px-2 py-1.5 text-xs">
                      <span className="font-medium">La mandaría sola.</span>{' '}
                      {autoAnswer ? 'Responder solo está prendido.' : 'Pasaría si prendés Responder solo; hoy la manda una persona.'}
                    </p>
                  ) : (
                    <p className="rounded-md bg-alert/40 px-2 py-1.5 text-xs">
                      <span className="font-medium">La dejaría para una persona.</span> {t.result.reason}
                    </p>
                  )}
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden />
                        Respuesta de Claude
                      </span>
                      <span className="text-muted-foreground">· {answerKindLabel(t.result.kind)}</span>
                    </p>
                    <p className="whitespace-pre-line break-words rounded-md bg-muted/60 px-3 py-2">{t.result.answer}</p>
                  </div>
                  {t.result.usedData.length > 0 ? <p className="text-xs text-muted-foreground">Usó: {t.result.usedData.join(' · ')}</p> : null}
                  {t.result.missing.length > 0 ? <p className="text-xs text-muted-foreground">Le faltó: {t.result.missing.join(' · ')}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {t.unsaved ? 'Con lo escrito sin guardar. ' : ''}Costó {formatUsd(t.result.costUsd)}.
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Block>
  );
}

type Recent = QaStepData['recent'][number];

function answeredBy(q: Recent, channelName: string): string {
  if (q.draft?.outcome === 'SENT_AUTO') return 'Claude la mandó solo';
  if (q.answeredFrom === 'APP') return `Desde la app${q.answeredBy ? ` por ${q.answeredBy.name}` : ''}`;
  return `En ${channelName}`;
}

export function QaPanel({
  variant,
  accountSlug,
  publicationId,
  data,
  aiReady,
  timeZone,
  knowledgeHref,
  stepHref,
}: {
  variant: Variant;
  accountSlug: string;
  publicationId: string;
  data: QaStepData;
  aiReady: boolean;
  timeZone: string;
  // Dónde se edita lo que sabe la tienda del producto.
  knowledgeHref: string;
  // En la publicación, el link a su paso en el Pipeline.
  stepHref?: string;
}) {
  const auto = useStepAction();
  // Que Claude mande solo es de la publicación: pide poder cambiar en la pantalla, no alcanza con entrenar.
  const cannotSwitch = useReadOnly();
  // Lo que se tocó, mientras se guarda.
  const [wanted, setWanted] = useState(data.autoAnswer);
  // Lo guardado se compara con lo que escribe el editor: al guardar se limpia y
  // puede quedar escrito un poco distinto, sin que cambie nada.
  const [savedFaq, setSavedFaq] = useState(data.faq ?? '');
  const [savedRules, setSavedRules] = useState(data.rules ?? '');
  const [faq, setFaq] = useState(savedFaq);
  const [rules, setRules] = useState(savedRules);
  const questionsHref = `/a/${accountSlug}/preguntas?publicacion=${publicationId}`;
  // Por qué todavía no puede responder solo, aunque esté prendido.
  const blocked = !aiReady
    ? 'Claude no puede responder: falta configurar su clave en Vercel.'
    : !data.canAnswer
      ? `Todavía no se pueden responder preguntas de ${data.channelName} desde la app.`
      : !data.published
        ? `Empieza cuando la publicación esté en ${data.channelName}.`
        : null;
  // Las preguntas que ya llegaron, sin repetir, para probar con ellas.
  const real = [...new Set(data.recent.map((q) => q.text.trim()).filter(Boolean))];

  const blocks = (
    <>
      <TextBlock
        variant={variant}
        accountSlug={accountSlug}
        publicationId={publicationId}
        field="faq"
        title="Preguntas frecuentes"
        description="Las preguntas que más hacen los compradores de esta publicación, cada una con la respuesta de la tienda. Claude las lee para responder."
        placeholder="Por ejemplo, ¿trae las juntas? No, las juntas se venden aparte. ¿Sirve para el 1.6 16v? Sí, para el 8v y el 16v."
        initial={data.faq ?? ''}
        saved={savedFaq}
        value={faq}
        onChange={setFaq}
        onSaved={setSavedFaq}
      >
        <p className="text-xs text-muted-foreground">
          Claude también lee la ficha, los datos de catálogo y{' '}
          <Link href={knowledgeHref} className="font-medium text-foreground underline-offset-4 hover:underline">
            lo que sabe la tienda del producto
          </Link>
          {data.hasKnowledge ? '.' : ', que todavía está vacío.'}
        </p>
      </TextBlock>

      <TextBlock
        variant={variant}
        accountSlug={accountSlug}
        publicationId={publicationId}
        field="rules"
        title="Cuándo responde una persona"
        description="Las reglas para Claude, qué preguntas responde y cuáles deja para una persona. Las que deja quedan arriba en Preguntas, marcadas Para una persona, con el motivo."
        placeholder="Por ejemplo, si preguntan por un motor que no está en las compatibilidades, que responda una persona. Si piden factura A, respondé que sí y que la pidan al comprar."
        initial={data.rules ?? ''}
        saved={savedRules}
        value={rules}
        onChange={setRules}
        onSaved={setSavedRules}
      />

      <TryBlock
        variant={variant}
        accountSlug={accountSlug}
        publicationId={publicationId}
        faq={faq}
        rules={rules}
        unsaved={faq !== savedFaq || rules !== savedRules}
        real={real}
        aiReady={aiReady}
        autoAnswer={data.autoAnswer}
        channelName={data.channelName}
      />

      <Block variant={variant} title="Responder solo">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={auto.pending ? wanted : data.autoAnswer}
            disabled={auto.pending || cannotSwitch}
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
      </Block>

      {/* En la publicación, las preguntas recibidas ya tienen su tarjeta. */}
      {variant === 'step' ? (
        <Block
          variant={variant}
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
        </Block>
      ) : null}
    </>
  );

  if (variant === 'step') return blocks;
  return (
    <SectionCard
      title="Preguntas y respuestas"
      description="Lo que Claude lee para responder a los compradores de esta publicación, y una prueba para ver cómo respondería. Es de esta publicación, no del producto."
      action={
        stepHref ? (
          <Link href={stepHref} className="text-xs font-medium underline-offset-4 hover:underline">
            Abrir su paso
          </Link>
        ) : null
      }
    >
      <div className="divide-y">{blocks}</div>
    </SectionCard>
  );
}
