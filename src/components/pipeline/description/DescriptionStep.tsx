'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SectionCard } from '@/components/ui/section-card';
import { BrandMark } from '@/components/ui/brand-loader';
import { CopyButton } from '@/components/apply/CopyButton';
import { cn } from '@/lib/utils/cn';
import { formatDateTime, formatUsd, plural } from '@/lib/format';
import { checkDescription, composeDescription, DESCRIPTION_MAX, toConfirmMarks } from '@/domain/descriptions';
import type { DescriptionStepData } from '@/lib/descriptions';
import { proposeDescriptionAction, saveDescriptionAction } from '@/app/a/[cuenta]/pipeline/description-actions';

// El paso Descripción: el cuerpo de la descripción entre el encabezado y el
// pie fijos de la cuenta, la propuesta de Claude y lo que tiene hoy el canal.
// Lo que se guarda queda en el borrador hasta que se sube al canal.

type Message = { kind: 'ok' | 'error'; text: string } | null;

function FrameBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export function DescriptionStep({
  accountSlug,
  publicationId,
  timeZone,
  data,
  aiDisabledReason,
  publicationHref,
}: {
  accountSlug: string;
  publicationId: string;
  timeZone: string;
  data: DescriptionStepData;
  aiDisabledReason: string | null;
  publicationHref: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(data.body);
  const [withFrame, setWithFrame] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [proposalMessage, setProposalMessage] = useState<Message>(null);
  const settingsHref = `/a/${accountSlug}/descripciones`;
  const hasFrame = Boolean(data.header || data.footer);
  const frame = withFrame || data.framed;

  const full = composeDescription({ header: frame ? data.header : null, body, footer: frame ? data.footer : null });
  const problems = body.trim() ? checkDescription(full) : [];
  const marks = toConfirmMarks(body);
  const dirty = full !== (data.saved ?? '').trim();

  // Con el borrador vacío, la propuesta nueva va directo al editor.
  const lastProposal = useRef(data.proposal?.at.getTime() ?? null);
  useEffect(() => {
    const at = data.proposal?.at.getTime() ?? null;
    if (at !== lastProposal.current && data.proposal && !body.trim()) setBody(data.proposal.text);
    lastProposal.current = at;
  }, [data.proposal, body]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const r = await saveDescriptionAction(accountSlug, publicationId, body, frame).catch(() => null);
    setSaving(false);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({ kind: 'ok', text: `${r.message ?? 'Guardada.'} Se sube a ${data.channelName} desde la publicación o desde Por subir.` });
    router.refresh();
  }

  async function propose() {
    setProposing(true);
    setProposalMessage(null);
    const r = await proposeDescriptionAction(accountSlug, publicationId).catch(() => null);
    setProposing(false);
    if (!r) return setProposalMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setProposalMessage({ kind: 'error', text: r.error });
    router.refresh();
  }

  const proposal = data.proposal;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Descripción"
        description={`Solo texto: sin links, datos de contacto ni HTML, hasta 50.000 caracteres. Lo que guardes queda en el borrador hasta que lo subas a ${data.channelName}.`}
      >
        <div className="space-y-3 p-4">
          {data.header && frame ? <FrameBox label="Encabezado de la cuenta" text={data.header} /> : null}
          <Textarea
            rows={18}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setMessage(null);
            }}
            placeholder={proposal ? 'Escribí la descripción o usá la propuesta de Claude.' : 'Escribí la descripción o pedile una propuesta a Claude.'}
            aria-label="Cuerpo de la descripción"
            disabled={saving}
          />
          {data.footer && frame ? <FrameBox label="Pie de la cuenta" text={data.footer} /> : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className={cn('tabular-nums', full.length > DESCRIPTION_MAX ? 'text-destructive' : 'text-muted-foreground')}>
              {full.length.toLocaleString('es-AR')} de 50.000 caracteres{hasFrame && frame ? ', con el encabezado y el pie' : ''}
            </span>
            {hasFrame ? (
              <Link href={settingsHref} className="text-primary underline-offset-4 hover:underline">
                Cambiar el encabezado y el pie
              </Link>
            ) : (
              <span className="text-muted-foreground">
                La cuenta no tiene encabezado ni pie. Se cargan en{' '}
                <Link href={settingsHref} className="text-primary underline-offset-4 hover:underline">
                  Ajustes, Descripciones
                </Link>
                .
              </span>
            )}
          </div>

          {hasFrame && !data.framed ? (
            <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={withFrame} onChange={(e) => setWithFrame(e.target.checked)} />
              <span>
                <span className="font-medium">Agregar el encabezado y el pie de la cuenta.</span>{' '}
                <span className="text-muted-foreground">La descripción guardada no los tiene.</span>
              </span>
            </label>
          ) : null}

          {marks.length > 0 ? (
            <div className="rounded-md bg-alert/10 px-3 py-2 text-sm">
              <p className="font-medium">Para confirmar antes de guardar</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {marks.map((m) => (
                  <li key={m}>{m.replace(/^\[A CONFIRMAR:?\s*/i, '').replace(/\]$/, '') || 'Un dato marcado'}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {problems.filter((p) => !p.includes('[A CONFIRMAR]')).map((p) => (
            <p key={p} className="text-sm text-destructive">
              {p}
            </p>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} pending={saving} disabled={saving || !dirty || !body.trim() || problems.length > 0}>
              <Save />
              Guardar en el borrador
            </Button>
            {body !== data.body ? (
              <Button variant="ghost" onClick={() => setBody(data.body)} disabled={saving}>
                <Undo2 />
                Deshacer los cambios
              </Button>
            ) : null}
          </div>
          {message ? (
            <p role="status" className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')}>
              {message.text}{' '}
              {message.kind === 'ok' ? (
                <Link href={publicationHref} className="text-primary underline-offset-4 hover:underline">
                  Ir a la publicación
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Propuesta de Claude"
        description={`Con la ficha, la investigación del producto, las preguntas que recibió la publicación y la descripción actual. Lo que no está en los datos lo marca [A CONFIRMAR].${data.hasGuidelines ? '' : ' Lo que Claude tiene que saber de la cuenta se carga en Ajustes, Descripciones.'}`}
        action={
          <Button size="sm" variant="outline" onClick={propose} pending={proposing} disabled={proposing || aiDisabledReason !== null}>
            <Sparkles />
            {proposal ? 'Otra propuesta' : 'Proponer con Claude'}
          </Button>
        }
      >
        <div className="space-y-3 p-4 text-sm">
          {aiDisabledReason ? <p className="text-muted-foreground">{aiDisabledReason}</p> : null}
          {proposing ? (
            <p className="flex items-center gap-2" role="status">
              <BrandMark className="h-5 w-5 rounded" />
              Claude está escribiendo la descripción. Puede tardar un minuto.
            </p>
          ) : null}
          {proposalMessage ? (
            <p role="status" className={proposalMessage.kind === 'error' ? 'text-destructive' : undefined}>
              {proposalMessage.text}
            </p>
          ) : null}
          {proposal ? (
            <>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(proposal.at, timeZone)}
                {proposal.by ? `, la pidió ${proposal.by}` : ''}. Costó {formatUsd(proposal.costUsd)}
                {proposal.attempts > 1 ? ` en ${plural(proposal.attempts, 'pedido')}` : ''}.
              </p>
              <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border px-3 py-2">{proposal.text}</div>
              {proposal.toConfirm.length > 0 ? <p className="text-xs">Para confirmar: {proposal.toConfirm.join(' · ')}</p> : null}
              {proposal.usedData.length > 0 ? <p className="text-xs text-muted-foreground">Usó: {proposal.usedData.join(' · ')}</p> : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBody(proposal.text);
                  setMessage(null);
                }}
                disabled={body === proposal.text}
              >
                Usar la propuesta en el editor
              </Button>
            </>
          ) : !proposing && !aiDisabledReason ? (
            <p className="text-muted-foreground">Todavía no se pidió ninguna.</p>
          ) : null}
        </div>
      </SectionCard>

      {data.inChannel ? (
        <SectionCard
          title={`En ${data.channelName}`}
          description={
            data.inChannel.readAt
              ? `La descripción que tenía en la última lectura, el ${formatDateTime(data.inChannel.readAt, timeZone)}.`
              : 'La descripción que tenía en la última lectura.'
          }
          action={data.inChannel.text ? <CopyButton value={data.inChannel.text} label={`la descripción de ${data.channelName}`} /> : null}
        >
          <div className="space-y-2 p-4 text-sm">
            {data.inChannel.text ? (
              <>
                {data.inChannel.text.trim() === (data.saved ?? '').trim() ? (
                  <p className="text-xs text-muted-foreground">Es igual a la del borrador.</p>
                ) : null}
                <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2">{data.inChannel.text}</div>
              </>
            ) : (
              <p className="text-muted-foreground">No tiene descripción.</p>
            )}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
