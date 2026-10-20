'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checkTitle, titleCoverage, type TitleCheck } from '@/domain/titles';
import type { TitleRules } from '@/domain/title-rules';
import type { TitleLockDecision } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils/cn';
import { approveTitleAction, generateTitlesAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';
import { BrandLoader } from '@/components/ui/brand-loader';

// Las 3 propuestas de la IA, el título que se está armando con el chequeo en
// vivo y el botón para aprobarlo. El chequeo y la cobertura los hace la app.

type Proposal = { title: string; reason: string };

function Checks({ check, max }: { check: TitleCheck; max: number | null }) {
  return (
    <div className="space-y-1 text-sm">
      <p className={cn('tabular-nums', max !== null && check.length > max ? 'text-destructive' : 'text-muted-foreground')}>
        {check.length}
        {max !== null ? `/${max}` : ''} caracteres
      </p>
      {check.errors.length === 0 ? (
        <p className="flex items-center gap-1.5 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Cumple las reglas.
        </p>
      ) : (
        check.errors.map((e) => (
          <p key={e} className="flex items-start gap-1.5 text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {e}
          </p>
        ))
      )}
      {check.warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
        </p>
      ))}
    </div>
  );
}

function Coverage({ title, searches }: { title: string; searches: string[] }) {
  const { covered, missing } = useMemo(() => titleCoverage(title, searches), [title, searches]);
  if (searches.length === 0) return <p className="text-sm text-muted-foreground">Sin búsquedas sugeridas para comparar.</p>;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        Cubre {covered.length} de {covered.length + missing.length} búsquedas sugeridas
      </summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cubre</p>
          <p>{covered.length > 0 ? covered.join(' · ') : '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">No cubre</p>
          <p className="text-muted-foreground">{missing.length > 0 ? missing.join(' · ') : '—'}</p>
        </div>
      </div>
    </details>
  );
}

export function TitleComposer({
  accountSlug,
  publicationId,
  currentTitle,
  proposals,
  rules,
  suggestions,
  usableWords,
  locked,
  decision,
  aiDisabledReason,
}: {
  accountSlug: string;
  publicationId: string;
  currentTitle: string | null;
  proposals: Proposal[];
  rules: TitleRules;
  suggestions: string[];
  usableWords: string[];
  locked: boolean | null;
  decision: TitleLockDecision | null;
  aiDisabledReason: string | null;
}) {
  const [title, setTitle] = useState(currentTitle ?? '');
  const [aiTitle, setAiTitle] = useState<string | null>(null);
  const ai = useStepAction();
  const approve = useStepAction();
  const check = useMemo(() => checkTitle(title, rules, { usableWords }), [title, rules, usableWords]);
  const blocked = locked === true && decision === null;
  const copy = decision === 'TRY_IN_COPY';

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            pending={ai.pending}
            variant="outline"
            onClick={() => ai.run(() => generateTitlesAction(accountSlug, publicationId))}
            disabled={ai.pending || usableWords.length === 0 || aiDisabledReason !== null}
          >
            <Sparkles className="h-4 w-4" />
            {ai.pending ? 'Pidiendo a la IA…' : proposals.length > 0 ? 'Pedir otras 3' : 'Proponer 3 títulos con IA'}
          </Button>
          <span className="text-sm text-muted-foreground">
            {aiDisabledReason ??
              (usableWords.length === 0
                ? 'Tildá palabras en el mapa para que la IA las use.'
                : `Usa solo las ${usableWords.length === 1 ? 'palabra tildada' : `${usableWords.length} palabras tildadas`}.`)}
          </span>
        </div>
        <StatusText status={ai.status} />
      </div>

      {ai.pending ? (
        <BrandLoader label="La IA está armando 3 títulos…" hint="Puede tardar hasta un minuto." className="rounded-md border py-8" />
      ) : null}

      {proposals.length > 0 ? (
        <ul className="grid gap-3 lg:grid-cols-3">
          {proposals.map((p, i) => {
            const c = checkTitle(p.title, rules, { usableWords });
            return (
              <li key={`${i}-${p.title}`} className={cn('overflow-hidden rounded-md border', aiTitle === p.title && 'border-primary')}>
                <p className="border-b bg-muted/50 px-3 py-2 text-sm font-semibold">Propuesta {i + 1}</p>
                <div className="space-y-2 p-3">
                  <p className="font-medium">{p.title}</p>
                  {p.reason ? <p className="text-sm text-muted-foreground">{p.reason}</p> : null}
                  <Checks check={c} max={rules.maxLength} />
                  <Coverage title={p.title} searches={suggestions} />
                  <Button
                    size="sm"
                    variant={aiTitle === p.title ? 'default' : 'outline'}
                    onClick={() => {
                      setTitle(p.title);
                      setAiTitle(p.title);
                      approve.clear();
                    }}
                  >
                    {aiTitle === p.title ? 'Elegida' : 'Elegir'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <label htmlFor="title-editor" className="block border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">
          {copy ? 'Título para la copia con cuotas' : 'Título'}
        </label>
        <div className="space-y-3 p-4">
          <Input
            id="title-editor"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              approve.clear();
            }}
            placeholder="Elegí una propuesta o escribilo"
          />
          <Checks check={check} max={rules.maxLength} />
          <Coverage title={title} searches={suggestions} />
          {aiTitle && aiTitle !== title ? (
            <p className="text-xs text-muted-foreground">Cambiaste la propuesta de la IA: queda guardado qué propuso y qué quedó.</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              pending={approve.pending}
              onClick={() => approve.run(() => approveTitleAction(accountSlug, publicationId, title, aiTitle))}
              disabled={approve.pending || blocked || check.errors.length > 0}
            >
              {approve.pending ? 'Guardando…' : copy ? 'Guardar para la copia y pasar a Imágenes' : 'Aprobar título y pasar a Imágenes'}
            </Button>
            {blocked ? (
              <span className="text-sm text-amber-700">Primero elegí arriba qué hacer con el título bloqueado.</span>
            ) : null}
            <StatusText status={approve.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
