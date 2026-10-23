'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ProductForm, type ProductFormSection, type ProductFormValues } from '@/components/products/ProductForm';
import { cn } from '@/lib/utils/cn';

// Las partes del producto, en pestañas. Todas quedan armadas aunque no se
// vean, así lo que se está cargando en la ficha no se pierde al cambiar de
// pestaña. La ficha es un solo formulario: cada pestaña muestra sus partes y
// un solo Guardar guarda todo. La pestaña elegida queda en el link.

export type ProductTabKey = 'publicaciones' | 'ficha' | 'compatibilidades' | 'investigacion' | 'fotos' | 'combos';

const FORM_SECTIONS: Partial<Record<ProductTabKey, ProductFormSection[]>> = {
  ficha: ['general', 'variants', 'specs', 'kit', 'notes'],
  compatibilidades: ['compatibilities'],
  fotos: ['assets'],
};

export function ProductTabs({
  tabs,
  initial,
  panels,
  after,
  form,
}: {
  tabs: { key: ProductTabKey; label: string; count?: number | null }[];
  initial: ProductTabKey;
  // Lo de cada pestaña, antes de la ficha si la pestaña tiene una parte de ella.
  panels: Partial<Record<ProductTabKey, ReactNode>>;
  // Lo de cada pestaña después de la ficha, por ejemplo borrar el producto.
  after?: Partial<Record<ProductTabKey, ReactNode>>;
  form: { accountSlug: string; productId: string; initial: ProductFormValues };
}) {
  const [active, setActive] = useState<ProductTabKey>(tabs.some((t) => t.key === initial) ? initial : tabs[0].key);
  const nav = useRef<HTMLElement>(null);

  function choose(key: ProductTabKey) {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set('seccion', key);
    window.history.replaceState(null, '', url);
    // Si se había bajado, la pestaña nueva arranca desde arriba.
    const top = nav.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) nav.current?.scrollIntoView({ block: 'start' });
  }

  const sections = FORM_SECTIONS[active];
  return (
    <>
      <nav ref={nav} aria-label="Partes del producto" className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] md:flex-wrap md:py-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`pestaña-${t.key}`}
              aria-selected={active === t.key}
              aria-controls={`parte-${t.key}`}
              onClick={() => choose(t.key)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors',
                active === t.key ? 'border-foreground bg-foreground text-background' : 'bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.count !== undefined && t.count !== null ? (
                <span className={cn('ml-1.5 tabular-nums', active === t.key ? 'text-background/70' : 'text-muted-foreground')}>{t.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`parte-${t.key}`} aria-labelledby={`pestaña-${t.key}`} hidden={active !== t.key || !panels[t.key]} className="space-y-4 md:space-y-6">
          {panels[t.key]}
        </div>
      ))}
      {/* La ficha queda armada siempre, para no perder lo que se está cargando. */}
      <div hidden={!sections}>
        <ProductForm accountSlug={form.accountSlug} productId={form.productId} initial={form.initial} sections={sections ?? []} />
      </div>
      {tabs.map((t) =>
        after?.[t.key] ? (
          <div key={t.key} hidden={active !== t.key}>
            {after[t.key]}
          </div>
        ) : null,
      )}
    </>
  );
}
