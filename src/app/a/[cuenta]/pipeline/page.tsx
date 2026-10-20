import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { NewPipelinePublicationDialog } from '@/components/pipeline/NewPipelinePublicationDialog';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import { KIND_OPTIONS, parseKinds } from '@/lib/queries/catalog-filters';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { listBoard } from '@/lib/queries/pipeline';
import { listStores } from '@/lib/queries/products';
import { plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Pipeline · ${account.name}` : 'Pipeline' };
}

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const [{ cuenta }, { tipo }] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta);

  const kinds = parseKinds(tipo);
  const [all, stores] = await Promise.all([listBoard(account.id), listStores(account.id)]);
  const items = kinds.length > 0 ? all.filter((i) => kinds.includes(i.kind)) : all;
  const catalogHref = `/a/${account.slug}/publicaciones?pipeline=UNTOUCHED,DISCARDED`;

  return (
    <>
      <PageHeader className="max-w-none">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Las publicaciones de <strong>{account.name}</strong> que se están corrigiendo, paso por paso. Tocá una
              para abrir su paso.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={catalogHref}>
                <ListChecks className="h-4 w-4" />
                Agregar desde el Catálogo
              </Link>
            </Button>
            <NewPipelinePublicationDialog
              accountSlug={account.slug}
              stores={stores.map((s) => ({ id: s.id, name: s.name, channelName: s.channel.name }))}
            />
          </div>
        </div>
      </PageHeader>
      <PageBody className="max-w-none">
        {all.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Todavía no hay publicaciones en el pipeline. Elegilas en el{' '}
            <Link href={catalogHref} className="text-primary underline-offset-4 hover:underline">
              Catálogo
            </Link>{' '}
            y tocá Agregar al pipeline, o creá una con Nueva publicación.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <UrlFilterDropdown
                label="Tipo"
                paramKey="tipo"
                options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                selected={KIND_OPTIONS.filter((o) => kinds.includes(o.kind)).map((o) => o.value)}
              />
              <p className="text-sm text-muted-foreground">
                {kinds.length > 0
                  ? `${items.length} de ${plural(all.length, 'publicación', 'publicaciones')} en el pipeline.`
                  : `${plural(items.length, 'publicación', 'publicaciones')} en el pipeline.`}{' '}
                En cada paso, las que esperan hace más tiempo van primero.
              </p>
            </div>
            <PipelineBoard accountSlug={account.slug} items={items} showStore={stores.length > 1} />
          </>
        )}
      </PageBody>
    </>
  );
}
