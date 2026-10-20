'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KindBadge } from '@/components/products/KindBadge';
import { productDetail, ProductSearch, type ProductCandidate } from '@/components/products/ProductSearch';
import { PRODUCT_KIND_LABEL, PRODUCT_KINDS } from '@/domain/combos';
import { PIPELINE_STEP_SLUG } from '@/domain/pipeline';
import type { ProductKind } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils/cn';
import { createPipelinePublicationAction, searchProductsAction } from '@/app/a/[cuenta]/pipeline/actions';

export type StoreChoice = { id: string; name: string; channelName: string };

type Mode = 'existing' | 'new';

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-3 py-1 text-sm transition-colors',
            value === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// "Nueva publicación" desde el tablero: elige el producto, o carga una ficha
// corta, y la tienda. La publicación se crea sin publicar, entra en
// Información y se abre su pantalla.
export function NewPipelinePublicationDialog({ accountSlug, stores }: { accountSlug: string; stores: StoreChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('existing');
  const [product, setProduct] = useState<ProductCandidate | null>(null);
  const [name, setName] = useState('');
  const [productType, setProductType] = useState('');
  const [kind, setKind] = useState<ProductKind>('INDIVIDUAL');
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const store = stores.find((s) => s.id === storeId);

  if (stores.length === 0) return null;

  function reset() {
    setMode('existing');
    setProduct(null);
    setName('');
    setProductType('');
    setKind('INDIVIDUAL');
    setError(null);
  }

  const ready = mode === 'existing' ? product !== null : name.trim() !== '';

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createPipelinePublicationAction(accountSlug, {
        storeId,
        productId: mode === 'existing' ? (product?.id ?? null) : null,
        newProduct: mode === 'new' ? { name, productType, kind } : null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/a/${accountSlug}/pipeline/${r.id}?paso=${PIPELINE_STEP_SLUG.INFO}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nueva publicación
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva publicación</DialogTitle>
          <DialogDescription>
            Se crea sin publicar y entra al pipeline en Información. El ID de {store?.channelName ?? 'la tienda'} se carga al final,
            en el paso Publicación.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Producto</p>
            <Segmented
              label="Producto"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              disabled={pending}
              options={[
                { value: 'existing', label: 'Ya está cargado' },
                { value: 'new', label: 'Es nuevo' },
              ]}
            />
          </div>

          {mode === 'existing' ? (
            product ? (
              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                    <span className="min-w-0 truncate">{product.name}</span>
                    {product.kind ? <KindBadge kind={product.kind} /> : null}
                  </p>
                  {productDetail(product) ? <p className="truncate text-xs text-muted-foreground">{productDetail(product)}</p> : null}
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setProduct(null)} disabled={pending}>
                  <X className="h-4 w-4" />
                  Cambiar
                </Button>
              </div>
            ) : (
              <ProductSearch
                id="new-pub-product"
                label="Buscá el producto"
                search={(q) => searchProductsAction(accountSlug, q)}
                pickLabel="Elegir"
                emptyText="No hay productos que coincidan. Si es nuevo, elegí «Es nuevo»."
                disabled={pending}
                onPick={setProduct}
              />
            )
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-pub-name">Nombre</Label>
                <Input
                  id="new-pub-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Subconjunto Ford 1.6 8v Zetec Rocam…"
                  maxLength={300}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pub-type">Tipo de producto</Label>
                <Input
                  id="new-pub-type"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="Kit de embrague, subconjunto…"
                  maxLength={200}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Individual o combo</p>
                <Segmented
                  label="Individual o combo"
                  value={kind}
                  onChange={setKind}
                  disabled={pending}
                  options={PRODUCT_KINDS.map((k) => ({ value: k, label: PRODUCT_KIND_LABEL[k] }))}
                />
                <p className="text-xs text-muted-foreground">
                  {kind === 'COMBO'
                    ? 'Los productos del combo se eligen después, en el paso Información.'
                    : 'Lo demás de la ficha se completa en el paso Información.'}
                </p>
              </div>
            </div>
          )}

          {stores.length > 1 ? (
            <div className="space-y-1.5">
              <Label htmlFor="new-pub-store">Tienda</Label>
              <Select value={storeId} onValueChange={setStoreId} disabled={pending}>
                <SelectTrigger id="new-pub-store">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.channelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button pending={pending} type="button" onClick={submit} disabled={pending || !ready}>
            {pending ? 'Creando…' : 'Crear y abrir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
