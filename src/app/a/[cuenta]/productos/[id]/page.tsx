import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ProductForm, type ProductFormValues } from '@/components/products/ProductForm';
import { DeleteProductButton } from '@/components/products/DeleteProductButton';
import { PublicationForm } from '@/components/publications/PublicationForm';
import { NewPublicationDialog } from '@/components/publications/NewPublicationDialog';
import { ChannelStatusBadge, StageBadge } from '@/components/stages/StageBadge';
import { ScoreBadge, ScoreDot } from '@/components/stages/ScoreBadge';
import { scorePublication } from '@/domain/standard';
import { loadRulesByChannel, toScoreInput } from '@/lib/queries/scoring';
import { channelInfo } from '@/channels';
import { parseNameValueList } from '@/domain/name-value';
import { METRICS, METRIC_KEYS, formatMetric, parseMetrics } from '@/domain/measurements';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { getProduct, listStores, type ProductDetail } from '@/lib/queries/products';
import { formatDateTime, formatDuration } from '@/lib/format';
import { PublicationProposal } from '@/components/proposals/PublicationProposal';
import { isAiConfigured } from '@/ai/claude';

export const dynamic = 'force-dynamic';
// Generar una propuesta con IA puede tardar más de un minuto.
export const maxDuration = 300;


export async function generateMetadata({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const account = await getAccountBySlug(cuenta);
  const product = account ? await getProduct(account.id, id) : null;
  return { title: product ? `${product.name} · ${account!.name}` : 'Producto' };
}

function toFormValues(p: ProductDetail): ProductFormValues {
  const s = (v: string | null) => v ?? '';
  return {
    name: p.name,
    brand: s(p.brand),
    partNumber: s(p.partNumber),
    productType: s(p.productType),
    engineSystem: s(p.engineSystem),
    line: s(p.line),
    origin: s(p.origin),
    warranty: s(p.warranty),
    kitContents: s(p.kitContents),
    notes: s(p.notes),
    specs: parseNameValueList(p.specs),
    variants: p.variants.map((v) => ({ measure: s(v.measure), sku: s(v.sku) })),
    compatibilities: p.compatibilities.map((c) => ({
      vehicleBrand: s(c.vehicleBrand),
      model: s(c.model),
      engine: s(c.engine),
      yearFrom: c.yearFrom?.toString() ?? '',
      yearTo: c.yearTo?.toString() ?? '',
      note: s(c.note),
    })),
    assets: p.assets.map((a) => ({ kind: a.kind, url: a.url })),
  };
}

// Precio guardado → texto con la costumbre argentina, para editarlo.
function priceToInput(price: { toString(): string } | null): string {
  if (price === null) return '';
  const n = Number(price.toString());
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n);
}

export default async function ProductPage({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();
  const [product, stores, rules] = await Promise.all([
    getProduct(account.id, id),
    listStores(account.id),
    loadRulesByChannel(account.id),
  ]);
  if (!product) notFound();
  const aiReady = isAiConfigured();

  const base = `/a/${account.slug}/productos`;
  const storeOptions = stores.map((s) => ({
    id: s.id,
    name: s.name,
    channel: channelInfo(s.channel.kind, s.channel.name),
  }));
  const subtitle = [product.brand, product.productType, product.partNumber].filter(Boolean).join(' · ');
  const now = new Date();

  return (
    <>
      <PageHeader staticOnMobile className="max-w-5xl">
        <div className="space-y-2">
          <Breadcrumb items={[{ label: account.name, href: base }, { label: 'Productos', href: base }, { label: product.name }]} />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            <p className="text-sm text-muted-foreground">{subtitle || 'Ficha maestra del producto.'}</p>
          </div>
        </div>
      </PageHeader>
      <PageBody className="max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Publicaciones</p>
          {product.publications.length > 0 ? (
            <NewPublicationDialog
              accountSlug={account.slug}
              productId={product.id}
              productName={product.name}
              stores={storeOptions}
              label="Agregar otra publicación"
            />
          ) : null}
        </div>

        {product.publications.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Todavía no tiene publicación en {stores.map((s) => s.name).join(' ni en ') || 'ninguna tienda'}.
            </p>
            <NewPublicationDialog
              accountSlug={account.slug}
              productId={product.id}
              productName={product.name}
              stores={storeOptions}
              label="Agregar publicación"
            />
          </div>
        ) : (
          product.publications.map((pub) => {
            const channel = channelInfo(pub.store.channel.kind, pub.store.channel.name);
            const score = scorePublication(rules.get(pub.store.channelId) ?? [], toScoreInput(product, pub));
            return (
              <Card key={pub.id}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <CardTitle>
                        {pub.store.name} · {channel.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{pub.externalId ?? 'Sin ID todavía'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ScoreBadge score={score.score} />
                      <StageBadge stage={pub.stage} />
                      <ChannelStatusBadge status={pub.channelStatus} />
                    </div>
                  </div>
                  {pub.url ? (
                    <a
                      href={pub.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver en {channel.name}
                    </a>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-6">
                  <PublicationForm
                    accountSlug={account.slug}
                    channel={channel}
                    mode={{ kind: 'edit', publicationId: pub.id }}
                    initial={{
                      externalId: pub.externalId ?? '',
                      url: pub.url ?? '',
                      title: pub.title ?? '',
                      description: pub.description ?? '',
                      attributes: parseNameValueList(pub.attributes),
                      price: priceToInput(pub.price),
                      channelStatus: pub.channelStatus,
                    }}
                  />
                  <Separator />
                  {score.results.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Estándar</p>
                        <p className="text-sm text-muted-foreground">
                          {score.score === null
                            ? 'Ninguna regla aplica.'
                            : score.missing.length === 0
                              ? `Puntaje ${score.score}. Cumple todo el estándar.`
                              : `Puntaje ${score.score}. ${score.missing.length === 1 ? 'Le falta 1 cosa' : `Le faltan ${score.missing.length} cosas`}.`}
                        </p>
                      </div>
                      <ul className="divide-y rounded-md border">
                        {[...score.results]
                          .sort((a, b) => {
                            const order = { fail: 0, pass: 1, na: 2 };
                            return order[a.status] - order[b.status] || b.weight - a.weight;
                          })
                          .map((r) => (
                            <li key={r.ruleId} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                              <ScoreDot
                                band={r.status === 'pass' ? 'high' : r.status === 'fail' ? 'low' : 'none'}
                                className="mt-1.5"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{r.name}</span>
                                <span className="text-muted-foreground tabular-nums"> · peso {r.weight}</span>
                                {r.status === 'na' ? <span className="text-muted-foreground"> · no aplica</span> : null}
                                {r.detail ? <p className="text-muted-foreground">{r.detail}</p> : null}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                  <PublicationProposal
                    accountSlug={account.slug}
                    timeZone={account.timezone}
                    publicationId={pub.id}
                    stage={pub.stage}
                    proposal={pub.proposals[0] ?? null}
                    proposalCount={pub._count.proposals}
                    aiReady={aiReady}
                  />
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Historial de etapas</p>
                    <ul className="divide-y rounded-md border">
                      {pub.stageMovements.map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                          <div className="w-40 shrink-0">
                            <StageBadge stage={m.stage} />
                          </div>
                          <span className="tabular-nums text-muted-foreground">
                            {formatDateTime(m.enteredAt, account.timezone)}
                            {' → '}
                            {m.exitedAt ? formatDateTime(m.exitedAt, account.timezone) : 'etapa actual'}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatDuration(m.enteredAt, m.exitedAt ?? now)}
                          </span>
                          <span className="text-muted-foreground sm:ml-auto">{m.user?.name ?? '—'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {pub.measurements.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Mediciones</p>
                      <div className="space-y-3">
                        {pub.measurements.map((m) => {
                          const metrics = parseMetrics(m.metrics);
                          const keys = METRIC_KEYS.filter((k) => metrics[k] !== undefined);
                          return (
                            <div key={m.id} className="rounded-md border px-4 py-3 space-y-2">
                              <p className="text-sm font-medium">
                                Datos del {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' }).format(m.takenAt)}
                                <span className="text-muted-foreground font-normal">
                                  {m.source === 'IMPORT' ? ' · importados' : ''}
                                </span>
                              </p>
                              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                                {keys.map((k) => (
                                  <div key={k} className="flex items-baseline justify-between gap-3">
                                    <dt className="text-muted-foreground">{METRICS[k].label}</dt>
                                    <dd className="tabular-nums">{formatMetric(k, metrics[k]!)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}

        <p className="text-xs uppercase tracking-wide text-muted-foreground pt-2">Ficha maestra</p>
        <ProductForm accountSlug={account.slug} productId={product.id} initial={toFormValues(product)} />

        <Separator />
        <div>
          <DeleteProductButton
            accountSlug={account.slug}
            productId={product.id}
            productName={product.name}
            publicationCount={product.publications.length}
          />
        </div>
      </PageBody>
    </>
  );
}
