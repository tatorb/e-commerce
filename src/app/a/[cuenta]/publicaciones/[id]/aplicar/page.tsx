import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Button } from '@/components/ui/button';
import { StageBadge } from '@/components/stages/StageBadge';
import { ApplyGuideView } from '@/components/apply/ApplyGuideView';
import { getChannelAdapter } from '@/channels';
import { approvedAt, approvedFields, todayIn } from '@/domain/applications';
import { loadContent } from '@/domain/content';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  return { title: account ? `Aplicar · ${account.name}` : 'Aplicar' };
}

export default async function ApplyPage({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();

  const publication = await prisma.publication.findFirst({
    where: { id, product: { accountId: account.id } },
    include: {
      product: { select: { id: true, name: true } },
      store: { include: { channel: true } },
      proposals: { where: { status: 'APPROVED' }, orderBy: { decidedAt: 'desc' }, take: 1 },
      applications: { orderBy: { appliedAt: 'desc' }, take: 1, include: { createdBy: { select: { name: true } } } },
    },
  });
  if (!publication) notFound();

  const adapter = getChannelAdapter(publication.store.channel.kind, publication.store.channel.name);
  const productUrl = `/a/${account.slug}/productos/${publication.product.id}`;
  const title = publication.title ?? publication.product.name;
  const proposal = publication.proposals[0] ?? null;
  const application = publication.applications[0] ?? null;
  const isApproved = publication.stage === 'APPROVED';
  const isApplied = publication.stage === 'APPLIED' || publication.stage === 'MEASURED';
  const manual = publication.store.applyMethod === 'MANUAL';

  const content = await loadContent(prisma, publication.product.id, publication.id);
  const sections = adapter.applyGuide(content, new Set(proposal ? approvedFields(proposal.review) : []));
  const since = await approvedAt(prisma, publication.id);

  return (
    <>
      <PageHeader staticOnMobile className="max-w-4xl">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: account.name, href: `/a/${account.slug}/pipeline` },
              { label: 'Publicaciones', href: `/a/${account.slug}/publicaciones` },
              { label: title, href: productUrl },
              { label: `Aplicar en ${adapter.name}` },
            ]}
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Aplicar en {adapter.name}</h1>
              <p className="text-sm text-muted-foreground">
                {title} · {publication.store.name} · {publication.externalId ?? 'sin ID'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={publication.stage} />
              {publication.url ? (
                <Button size="sm" asChild>
                  <a href={publication.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir la publicación en {adapter.name}
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </PageHeader>
      <PageBody className="max-w-4xl">
        {!isApproved && !isApplied ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta publicación todavía no tiene cambios aprobados para aplicar. Primero hay que revisar y aprobar una
              propuesta.
            </p>
            <Button variant="outline" asChild className="w-fit">
              <Link href={productUrl}>Volver a la ficha</Link>
            </Button>
          </div>
        ) : !manual ? (
          <p className="text-sm text-muted-foreground">
            Esta tienda está configurada para aplicar por planilla o por API, y esa forma todavía no está disponible.
          </p>
        ) : (
          <>
            {isApplied && application ? (
              <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
                Aplicada el {formatDateTime(application.appliedAt, account.timezone)} por{' '}
                {application.createdBy?.name ?? '—'}. Esto es lo que tiene hoy la ficha.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Abrí la publicación en {adapter.name} al lado y pasá cada dato. Es lo que tiene hoy la ficha, con lo
                que cambió en la revisión marcado. Cuando termines, marcala como aplicada.
              </p>
            )}
            <ApplyGuideView
              accountSlug={account.slug}
              publicationId={publication.id}
              productUrl={productUrl}
              sections={sections}
              canMark={isApproved}
              today={todayIn(account.timezone)}
              minDay={since ? todayIn(account.timezone, since) : todayIn(account.timezone)}
            />
          </>
        )}
      </PageBody>
    </>
  );
}
