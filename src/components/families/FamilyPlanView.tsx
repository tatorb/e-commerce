import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/apply/CopyButton';
import { SectionBody, SectionCard, SubHeader } from '@/components/ui/section-card';
import { titleOrUntitled } from '@/domain/publication-title';
import type { PlannedFamily, StorePlan } from '@/lib/families';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

// La vista previa de las familias de una tienda: los números, las familias
// con algo para revisar arriba y después las demás. Cada familia se abre para
// ver sus medidas, las que faltan traer y lo que pasa al juntarlas.

const STATE_LABEL: Record<PlannedFamily['state'], string> = {
  new: 'Se arma',
  join: 'Se completa',
  done: 'Ya está',
  conflict: 'No se junta',
};

function Stat({ value, label, hint, alert }: { value: number; label: string; hint?: string; alert?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', alert && value > 0 && 'border-alert/60 bg-alert/10')}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const needsReview = (f: PlannedFamily) => f.state === 'conflict' || f.notes.length > (f.kind === 'split' ? 1 : 0);

function FamilyItem({ f, accountSlug }: { f: PlannedFamily; accountSlug: string }) {
  const measures = f.members.map((m) => m.measure ?? 'medida a elegir');
  return (
    <details className="group border-b last:border-b-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-muted/40">
        <span className="font-medium">{f.code ?? f.productName}</span>
        {f.code ? <span className="text-sm text-muted-foreground">{f.productName}</span> : null}
        <span className="text-xs text-muted-foreground">
          {f.kind === 'split' ? `${f.members.length} códigos en una publicación` : measures.join(' · ')}
          {f.missing.length > 0 ? `, ${plural(f.missing.length, 'medida', 'medidas')} sin traer` : ''}
        </span>
        <Badge variant={f.state === 'conflict' ? 'alert' : f.kind === 'split' ? 'warning' : 'secondary'} className="ml-auto">
          {f.kind === 'split' ? 'Se separa' : STATE_LABEL[f.state]}
        </Badge>
      </summary>
      <div className="space-y-3 px-4 pb-4 pt-1">
        <ul className="divide-y rounded-md border text-sm">
          {f.members.map((m, i) => (
            <li key={m.id ?? m.externalId ?? i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
              <span className={cn('w-32 shrink-0 whitespace-nowrap font-medium', m.measure === null && 'text-amber-700 dark:text-amber-400')}>
                {m.measure ? `Medida ${m.measure}` : 'Medida a elegir'}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{m.externalId ?? 'Sin publicar'}</span>
              {m.id ? (
                <Link href={`/a/${accountSlug}/publicaciones/${m.id}`} className="min-w-0 truncate underline-offset-4 hover:underline">
                  {titleOrUntitled(m.title)}
                </Link>
              ) : (
                <span className="text-muted-foreground">Publicación nueva, con lo que ya tiene la principal</span>
              )}
              <span className="text-xs text-muted-foreground sm:ml-auto">{m.pipeline}</span>
              {m.lead ? <Badge variant="outline">Principal</Badge> : null}
            </li>
          ))}
          {f.missing.map((id) => (
            <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-muted-foreground">
              <span className="w-32 shrink-0">Sin traer</span>
              <span className="text-xs tabular-nums">{id}</span>
              <span>Está en el canal y falta en la app</span>
            </li>
          ))}
        </ul>
        {f.notes.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {f.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

export function FamilyPlanView({ plan, accountSlug }: { plan: StorePlan; accountSlug: string }) {
  const { counts } = plan;
  const review = plan.families.filter(needsReview);
  const rest = plan.families.filter((f) => !needsReview(f));
  const missing = plan.families.filter((f) => f.state !== 'conflict').flatMap((f) => f.missing);
  return (
    <SectionCard title={`${plan.channelName} · ${plan.storeName}`} description="Lo que cambiaría al aplicar. Todavía no cambia nada.">
      <SectionBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat value={counts.families} label="Familias que cambian" hint="Se arman, se completan o se separan" />
          <Stat value={counts.grouped} label="Publicaciones que se juntan" />
          <Stat value={counts.missing} label="Medidas que faltan traer" />
          <Stat value={counts.splits} label="Familias de la app que se separan" hint={counts.splitNew > 0 ? `Salen ${plural(counts.splitNew, 'publicación nueva', 'publicaciones nuevas')}` : undefined} />
          <Stat value={counts.unknown} label="Medidas para elegir" alert />
          <Stat value={counts.decisions + counts.conflicts} label="Para revisar" alert />
        </div>
        {plan.unread > 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía falta leer la familia de {plural(plan.unread, 'publicación', 'publicaciones')}. Se leen solas cada hora, así que estos números
            pueden crecer.
          </p>
        ) : null}
        {counts.done > 0 ? <p className="text-sm text-muted-foreground">{plural(counts.done, 'familia ya está armada', 'familias ya están armadas')} y no cambian.</p> : null}
        {missing.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              Para traer las medidas que faltan, copiá sus códigos y pegalos en{' '}
              <Link href={`/a/${accountSlug}/importar`} className="font-medium underline-offset-4 hover:underline">
                Importar
              </Link>
              , en Traer solo algunas por su código.
            </span>
            <CopyButton value={missing.join('\n')} label="los códigos de las medidas que faltan" />
          </div>
        ) : null}
      </SectionBody>
      {review.length > 0 ? (
        <>
          <SubHeader title="Para revisar" count={review.length} />
          <div>
            {review.map((f) => (
              <FamilyItem key={f.key} f={f} accountSlug={accountSlug} />
            ))}
          </div>
        </>
      ) : null}
      {rest.length > 0 ? (
        <>
          <SubHeader title="Sin nada que decidir" count={rest.length} />
          <div>
            {rest.map((f) => (
              <FamilyItem key={f.key} f={f} accountSlug={accountSlug} />
            ))}
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}
