import Link from 'next/link';
import { ChevronRight, Clock, Plus, Search } from 'lucide-react';
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
import { PipelineBadge } from '@/components/stages/StageBadge';
import { KindBadge } from '@/components/products/KindBadge';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import { KIND_OPTIONS, parseKinds } from '@/lib/queries/catalog-filters';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { listProducts, productCovers, type ProductListItem } from '@/lib/queries/products';
import { Thumb } from '@/components/ui/thumb';
import { formatRelativeDate, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Productos · ${account.name}` : 'Productos' };
}

// Dónde está cada publicación del producto en el pipeline. Con una sola tienda es una sola.
function Stages({ item }: { item: ProductListItem }) {
  if (item.publications.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {item.publications.map((p) => (
        <PipelineBadge key={p.id} state={p} />
      ))}
    </div>
  );
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string }>;
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const [{ cuenta }, { q, tipo }] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta, 'productos');

  const kinds = parseKinds(tipo);
  const products = await listProducts(account.id, q, kinds);
  const covers = await productCovers(products.map((p) => p.id));
  const base = `/a/${account.slug}/productos`;

  return (
    <>
      <PageHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
            <p className="text-sm text-muted-foreground">
              Fichas maestras de <strong>{account.name}</strong>. Cada producto se muestra en los
              canales a través de sus publicaciones.
            </p>
          </div>
          <Button size="sm" asChild>
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
            <form className="flex flex-wrap items-end gap-3" action="" method="get">
              {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
              <div className="flex w-full gap-2 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-80 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id="q" name="q" defaultValue={q} placeholder="nombre, marca, número de pieza, SKU o ID…" aria-label="Buscar productos" className="pl-9" />
                </div>
                <Button access="view" type="submit">
                  Buscar
                </Button>
              </div>
              <UrlFilterDropdown
                label="Tipo"
                paramKey="tipo"
                options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                selected={KIND_OPTIONS.filter((o) => kinds.includes(o.kind)).map((o) => o.value)}
              />
              {q || tipo ? (
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
            q || kinds.length > 0 ? (
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
              <ul className="md:hidden divide-y overflow-y-auto flex-1 min-h-0">
                {products.map((p) => (
                  <li key={p.id}>
                    <Link href={`${base}/${p.id}`} className="flex items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/50">
                      <Thumb src={covers.get(p.id) ?? null} alt={p.name} />
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 font-semibold leading-snug">{p.name}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-xs tabular-nums text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatRelativeDate(p.updatedAt, account.timezone)}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          <KindBadge kind={p.kind} />
                          <Stages item={p} />
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.brand, p.productType, p.partNumber].filter(Boolean).join(' · ') || '—'}
                        </span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          <strong className="text-foreground">{p._count.variants}</strong> {p._count.variants === 1 ? 'medida' : 'medidas'}
                        </span>
                      </span>
                      <ChevronRight className="mt-5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
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
                          <span className="flex items-center gap-3">
                            <Thumb src={covers.get(p.id) ?? null} alt={p.name} size="sm" />
                            <Link href={`${base}/${p.id}`} className="font-medium hover:underline">
                              {p.name}
                            </Link>
                            <KindBadge kind={p.kind} />
                          </span>
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
