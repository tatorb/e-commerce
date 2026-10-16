import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { listBoard } from '@/lib/queries/pipeline';
import { plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  return { title: account ? `Pipeline · ${account.name}` : 'Pipeline' };
}

export default async function PipelinePage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();

  const items = await listBoard(account.id);
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
          <Button size="sm" variant="outline" asChild>
            <Link href={catalogHref}>
              <ListChecks className="h-4 w-4" />
              Agregar desde el Catálogo
            </Link>
          </Button>
        </div>
      </PageHeader>
      <PageBody className="max-w-none">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Todavía no hay publicaciones en el pipeline. Elegilas en el{' '}
            <Link href={catalogHref} className="text-primary underline-offset-4 hover:underline">
              Catálogo
            </Link>{' '}
            y tocá Agregar al pipeline.
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {plural(items.length, 'publicación', 'publicaciones')} en el pipeline. En cada paso, las que esperan hace
              más tiempo van primero.
            </p>
            <PipelineBoard accountSlug={account.slug} items={items} />
          </>
        )}
      </PageBody>
    </>
  );
}
