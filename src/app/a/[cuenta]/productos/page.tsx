import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { StageBadge } from '@/components/stages/StageBadge';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { listProducts, type ProductListItem } from '@/lib/queries/products';
import { formatRelativeDate, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  return { title: account ? `Productos · ${account.name}` : 'Productos' };
}

// Etapa de cada publicación del producto. Con una sola tienda es una sola.
function Stages({ item }: { item: ProductListItem }) {
  if (item.publications.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {item.publications.map((p) => (
        <StageBadge key={p.id} stage={p.stage} />
      ))}
    </div>
  );
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ cuenta }, { q }] = await Promise.all([params, searchParams]);
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();

  const products = await listProducts(account.id, q);
  const base = `/a/${account.slug}/productos`;

  return (
    <>
      <PageHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
            <p className="text-sm text-muted-foreground">
              Fichas maestras de <strong>{account.name}</strong>. Cada producto se muestra en los
              canales a través de sus publicaciones.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`${base}/nuevo`}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Link>
          </Button>
        </div>
      </PageHeader>
      <PageBody>
        <Card>
          <div className="p-4">
            <form className="flex flex-wrap gap-3 items-end" action="" method="get">
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="nombre, marca, número de pieza, SKU o ID…"
                className="w-full sm:w-80"
              />
              <Button type="submit">Buscar</Button>
              {q ? (
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="?">Limpiar</Link>
                </Button>
              ) : null}
            </form>
          </div>
        </Card>

        <p className="text-muted-foreground text-sm">{plural(products.length, 'producto')}</p>

        <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {products.length === 0 ? (
            q ? (
              <div className="flex-1 flex items-center justify-center p-10 text-center text-muted-foreground text-sm">
                No hay productos que coincidan.
              </div>
            ) : (
              <div className="m-4 rounded-lg border border-dashed p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">Todavía no hay productos.</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`${base}/nuevo`}>
                    <Plus className="h-4 w-4" />
                    Cargar el primero
                  </Link>
                </Button>
              </div>
            )
          ) : (
            <>
              <div className="md:hidden divide-y overflow-y-auto flex-1 min-h-0">
                {products.map((p) => (
                  <div key={p.id} className="px-3 py-3 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`${base}/${p.id}`} className="font-medium hover:underline min-w-0 truncate">
                        {p.name}
                      </Link>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeDate(p.updatedAt, account.timezone)}
                      </span>
                    </div>
                    <Stages item={p} />
                    <div className="text-xs text-muted-foreground truncate">
                      {[p.brand, p.productType, p.partNumber].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      <strong className="text-foreground">{p._count.variants}</strong>{' '}
                      {p._count.variants === 1 ? 'medida' : 'medidas'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:flex md:flex-1 md:min-h-0 md:flex-col">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Número de pieza</TableHead>
                      <TableHead className="text-right">Medidas</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-right">Actualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link href={`${base}/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.brand ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.productType ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.partNumber ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{p._count.variants}</TableCell>
                        <TableCell>
                          <Stages item={p} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 justify-end">
                            <Clock className="h-3 w-3" />
                            {formatRelativeDate(p.updatedAt, account.timezone)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      </PageBody>
    </>
  );
}
