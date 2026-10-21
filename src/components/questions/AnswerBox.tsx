'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ANSWER_MAX, answerKindLabel, checkAnswer } from '@/domain/answers';
import { cn } from '@/lib/utils/cn';
import { discardDraftAction, draftAnswerAction, sendAnswerAction } from '@/app/a/[cuenta]/preguntas/answer-actions';

// La respuesta a una pregunta que espera: la propuesta de Claude para mandar
// como está o corregir, o el texto que escribe la persona.

// Cuánto se ve el "Listo" antes de que la pregunta pase a Respondidas.
const DONE_MS = 2500;

export type DraftView = {
  text: string;
  kind: string;
  usedData: string[];
  missing: string[];
  needsPerson: boolean;
  reason: string | null;
};

export function AnswerBox({
  accountSlug,
  questionId,
  channelName,
  draft,
  discarded,
  canDraft,
}: {
  accountSlug: string;
  questionId: string;
  channelName: string;
  draft: DraftView | null;
  // Se descartó la propuesta de Claude: se escribe a mano o se pide otra.
  discarded: boolean;
  canDraft: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(draft?.text ?? '');
  const [busy, setBusy] = useState<'send' | 'draft' | 'discard' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const problems = text.trim() ? checkAnswer(text) : [];
  const edited = draft !== null && text.trim() !== draft.text.trim();

  async function run<T>(key: 'send' | 'draft' | 'discard', action: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    setMessage(null);
    const r = await action().catch(() => null);
    setBusy(null);
    if (!r) setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    return r;
  }

  async function send() {
    const r = await run('send', () => sendAnswerAction(accountSlug, questionId, text));
    if (!r) return;
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setDone(
      r.sent
        ? `Listo: la respuesta ya está en ${channelName}.`
        : `Ya la habían respondido en ${channelName}${r.answer ? `: «${r.answer}»` : '.'} No se mandó nada.`,
    );
    setTimeout(() => router.refresh(), DONE_MS);
  }

  async function redraft() {
    const r = await run('draft', () => draftAnswerAction(accountSlug, questionId));
    if (!r) return;
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    router.refresh();
  }

  async function discard() {
    const r = await run('discard', () => discardDraftAction(accountSlug, questionId));
    if (!r) return;
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setText('');
    router.refresh();
  }

  if (done) {
    return (
      <p className="flex items-start gap-2 rounded-md border px-3 py-3 text-sm" role="status">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {done} <span className="text-muted-foreground">Pasa a Respondidas.</span>
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border px-3 py-3">
      {draft ? (
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className="inline-flex items-center gap-1 font-medium">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Propuesta de Claude
            </span>
            <span className="text-muted-foreground">· {answerKindLabel(draft.kind)}</span>
            {edited ? <span className="text-muted-foreground">· corregida</span> : null}
          </p>
          {draft.needsPerson ? (
            <p className="rounded-md bg-alert/10 px-2 py-1.5 text-xs">
              <span className="font-medium">Tiene que revisarla una persona.</span> {draft.reason}
            </p>
          ) : null}
          {draft.usedData.length > 0 ? <p className="text-xs text-muted-foreground">Usó: {draft.usedData.join(' · ')}</p> : null}
          {draft.missing.length > 0 ? <p className="text-xs text-muted-foreground">Le faltó: {draft.missing.join(' · ')}</p> : null}
        </div>
      ) : discarded ? (
        <p className="text-xs text-muted-foreground">Descartaste la propuesta de Claude. Escribí la respuesta o pedí otra.</p>
      ) : null}

      <Textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={draft ? undefined : 'Escribí la respuesta.'}
        aria-label="Respuesta"
        disabled={busy !== null}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={cn('tabular-nums', text.length > ANSWER_MAX ? 'text-destructive' : 'text-muted-foreground')}>
          {text.length} de {ANSWER_MAX}
        </span>
        {problems.length > 0 ? <span className="text-destructive">{problems.join(' ')}</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={send} pending={busy === 'send'} disabled={busy !== null || !text.trim() || problems.length > 0}>
          <Send />
          Mandar a {channelName}
        </Button>
        {canDraft ? (
          <Button size="sm" variant="outline" onClick={redraft} pending={busy === 'draft'} disabled={busy !== null}>
            <Sparkles />
            {draft ? 'Otra propuesta' : 'Proponer con Claude'}
          </Button>
        ) : null}
        {draft ? (
          <Button size="sm" variant="ghost" onClick={discard} pending={busy === 'discard'} disabled={busy !== null}>
            <X />
            Descartar propuesta
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
