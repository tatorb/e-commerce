import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Users } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Button } from '@/components/ui/button';
import { StageBadge } from '@/components/stages/StageBadge';
import { ToConfirm } from '@/components/proposals/ProposalView';
import { ReviewForm, type AiFieldInfo } from '@/components/proposals/ReviewForm';
import { StartReviewButton } from '@/components/proposals/StartReviewButton';
import { getChannelAdapter } from '@/channels';
import { codeOrUnpublished } from '@/domain/channel-status';
import { loadContent, sameValue, type ContentField, type ContentSnapshot } from '@/domain/content';
import { parseNotes, parseProposalFields, parseReview } from '@/domain/proposals';
import { initialReviewValue, type ReviewField } from '@/domain/review';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Revisión · ${account.name}` : 'Revisión' };
}

export default async function ReviewPage({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const { account } = await requireAccount(cuenta);

  const publication = await prisma.publication.findFirst({
    where: { id, product: { accountId: account.id } },
    include: {
      product: { select: { id: true, name: true } },
      store: { include: { channel: true } },
      proposals: { where: { status: 'ACTIVE' }, take: 1 },
    },
  });
  if (!publication) notFound();

  const productUrl = `/a/${account.slug}/productos/${publication.product.id}`;
  const adapter = getChannelAdapter(publication.store.channel.kind, publication.store.channel.name);
  const proposal = publication.proposals[0] ?? null;
  const title = publication.title ?? publication.product.name;

  const header = (
    <PageHeader staticOnMobile className="max-w-5xl">
      <div className="space-y-2">
        <Breadcrumb
          items={[
            { label: account.name, href: `/a/${account.slug}/pipeline` },
            { label: 'Publicaciones', href: `/a/${account.slug}/publicaciones` },
            { label: title, href: productUrl },
            { label: 'Revisión' },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Revisión de la propuesta</h1>
            <p className="text-sm text-muted-foreground">
              {title} · {publication.store.name} · {publication.externalId ?? 'sin ID'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={publication.stage} />
            {publication.url ? (
              <Button size="sm" variant="outline" asChild>
                <a href={publication.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ver en {adapter.name}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </PageHeader>
  );

  if (!proposal) {
    return (
      <>
        {header}
        <PageBody className="max-w-5xl">
          <p className="text-sm text-muted-foreground">
            Esta publicación no tiene una propuesta para revisar. Puede que ya se haya aprobado o rechazado.
          </p>
          <Button variant="outline" asChild className="w-fit">
            <Link href={productUrl}>Volver a la ficha</Link>
          </Button>
        </PageBody>
      </>
    );
  }

  const current = await loadContent(prisma, publication.product.id, publication.id);
  const baseline = proposal.baseline as unknown as ContentSnapshot;
  const aiFields = parseProposalFields(proposal.fields);
  const ai: Partial<Record<ContentField, AiFieldInfo>> = Object.fromEntries(
    aiFields.map((f) => [f.field, { value: f.after, reason: f.reason, toConfirm: f.toConfirm }]),
  );
  // Campos que cambiaron en la app después de generar la propuesta.
  const drift = aiFields
    .map((f) => f.field)
    .filter((f) => baseline && f in baseline && !sameValue(baseline[f], current[f]));

  const review = parseReview(proposal.review);
  const initialFields: ReviewField[] =
    review?.kind === 'draft'
      ? review.fields
      : aiFields.map((f) => ({
          field: f.field,
          value: initialReviewValue(f.field, current[f.field], f.after),
          included: true,
          fromAi: true,
        }));
  const savedText =
    review?.kind === 'draft' && review.savedAt
      ? `Borrador guardado el ${formatDateTime(new Date(review.savedAt), account.timezone)}.`
      : null;
  const canEdit = publication.stage === 'IN_REVIEW';
  const notes = parseNotes(proposal.notes);
  // Las otras publicaciones del producto ven los cambios a la ficha.
  const siblings = await prisma.publication.findMany({
    where: { productId: publication.product.id, id: { not: publication.id } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, externalId: true, store: { select: { name: true } } },
  });

  return (
    <>
      {header}
      <PageBody className="max-w-5xl">
        <div className="space-y-2">
          <p className="text-sm">{proposal.summary}</p>
          <p className="text-xs text-muted-foreground">
            Revisá cada campo. Lo que dejes marcado con &quot;Usar este cambio&quot; se escribe al aprobar: el título y la
            descripción en esta publicación, y lo marcado &quot;De la ficha&quot; en el producto. En las listas elegís fila por
            fila. {adapter.name} no cambia hasta que lo apliques.
          </p>
          {notes.length > 0 ? <ToConfirm items={notes} prefix={false} /> : null}
        </div>

        {siblings.length > 0 ? (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
            <p className="flex items-start gap-2 font-medium">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              {siblings.length === 1
                ? 'Este producto tiene otra publicación. Lo que apruebes "De la ficha" cambia también en ella:'
                : `Este producto tiene ${siblings.length} publicaciones más. Lo que apruebes "De la ficha" cambia también en ellas:`}
            </p>
            <ul className="space-y-0.5 pl-6 text-muted-foreground">
              {siblings.map((s) => (
                <li key={s.id} className="break-words">
                  {s.title ?? publication.product.name} · {s.store.name} · {codeOrUnpublished(s.externalId)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!canEdit ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3">
            <p className="text-sm">Para editar y decidir, empezá la revisión. La publicación pasa a En revisión.</p>
            <StartReviewButton
              accountSlug={account.slug}
              proposalId={proposal.id}
              href={`/a/${account.slug}/publicaciones/${publication.id}/revision`}
            />
          </div>
        ) : null}

        <ReviewForm
          key={proposal.id}
          accountSlug={account.slug}
          proposalId={proposal.id}
          productUrl={productUrl}
          reviewBase={`/a/${account.slug}/publicaciones`}
          titleMaxLength={adapter.titleMaxLength}
          canEdit={canEdit}
          initialFields={initialFields}
          current={current}
          ai={ai}
          drift={drift}
          savedText={savedText}
        />
      </PageBody>
    </>
  );
}
