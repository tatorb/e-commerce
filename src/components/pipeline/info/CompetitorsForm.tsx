'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OpenLinkButton } from '@/components/ui/open-link-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INSTALLMENT_OPTIONS, offerPrices } from '@/domain/competitors';
import { formatPrice, parsePercent, parsePrice } from '@/domain/money';
import { saveCompetitorsAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';

// Las publicaciones de la competencia que más venden, cargadas a mano, con su
// precio. Conviene cargar al menos 3. Cada una es una tarjetita: el título
// suma palabras al paso Título y el precio sirve para comparar. Lo calculado
// se ve abajo de cada una mientras se carga.

export type CompetitorRow = {
  url: string;
  title: string;
  soldQuantity: string;
  sellerName: string;
  listPrice: string;
  discountPct: string;
  // "0" es sin cuotas.
  installments: string;
  freeShipping: boolean;
  // El día, como 2026-10-23.
  surveyedAt: string;
  notes: string;
};

export const EMPTY_COMPETITOR: CompetitorRow = {
  url: '',
  title: '',
  soldQuantity: '',
  sellerName: '',
  listPrice: '',
  discountPct: '',
  installments: '0',
  freeShipping: false,
  surveyedAt: '',
  notes: '',
};

const MIN = 3;

// Al cambiar el precio, el descuento, las cuotas o el envío, el relevamiento es de hoy.
const PRICE_FIELDS: (keyof CompetitorRow)[] = ['listPrice', 'discountPct', 'installments', 'freeShipping'];

export const installmentsLabel = (n: number) => (n === 0 ? 'Sin cuotas' : `${n} cuotas`);

const isFilled = (r: CompetitorRow) => [r.url, r.title, r.soldQuantity, r.sellerName, r.listPrice, r.notes].some((v) => v.trim() !== '');

/** Lo calculado de una fila mientras se carga; null si falta el precio o no se entiende. */
function calculated(row: CompetitorRow, shippingCost: number) {
  const listPrice = parsePrice(row.listPrice);
  const discount = parsePercent(row.discountPct);
  if (typeof listPrice !== 'number' || listPrice <= 0 || discount === 'invalid' || (discount ?? 0) >= 100) return null;
  return offerPrices({ listPrice, discountPct: discount ?? 0, installments: Number(row.installments), freeShipping: row.freeShipping }, shippingCost);
}

export function CompetitorsForm({
  accountSlug,
  publicationId,
  initial,
  today,
  shippingCost,
}: {
  accountSlug: string;
  publicationId: string;
  initial: CompetitorRow[];
  today: string;
  // El envío que se suma al precio efectivo cuando no es gratis.
  shippingCost: number;
}) {
  const [rows, setRows] = useState<CompetitorRow[]>(initial.length > 0 ? initial : [{ ...EMPTY_COMPETITOR }]);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const action = useStepAction();
  const filled = rows.filter(isFilled);
  const dirty = useMemo(() => JSON.stringify(filled) !== saved, [filled, saved]);
  const disabled = action.pending;

  function update<K extends keyof CompetitorRow>(index: number, key: K, value: CompetitorRow[K]) {
    setRows(rows.map((r, i) => (i === index ? { ...r, [key]: value, ...(PRICE_FIELDS.includes(key) ? { surveyedAt: today } : {}) } : r)));
    action.clear();
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Sin publicaciones de la competencia.</p> : null}
      {rows.map((row, index) => {
        const id = (key: string) => `competitor-${index}-${key}`;
        const prices = calculated(row, shippingCost);
        const field = (key: 'url' | 'title' | 'sellerName' | 'soldQuantity' | 'listPrice' | 'discountPct' | 'notes', label: string, extra: { placeholder?: string; numeric?: boolean; className?: string } = {}) => (
          <div className={extra.className ?? 'col-span-1'}>
            <Label htmlFor={id(key)} className="mb-1 block text-xs text-muted-foreground">
              {label}
            </Label>
            <Input
              id={id(key)}
              value={row[key]}
              placeholder={extra.placeholder}
              inputMode={extra.numeric ? 'decimal' : undefined}
              onChange={(e) => update(index, key, e.target.value)}
              disabled={disabled}
            />
          </div>
        );
        return (
          <div key={index} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Competidor {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Quitar el competidor ${index + 1}`}
                title="Quitar"
                onClick={() => {
                  setRows(rows.filter((_, i) => i !== index));
                  action.clear();
                }}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
              <div className="col-span-2 sm:col-span-5">
                <Label htmlFor={id('url')} className="mb-1 block text-xs text-muted-foreground">
                  Link
                </Label>
                <div className="flex min-w-0 items-center gap-2">
                  <Input
                    id={id('url')}
                    type="url"
                    value={row.url}
                    placeholder="https://articulo.mercadolibre.com.ar/…"
                    onChange={(e) => update(index, 'url', e.target.value)}
                    disabled={disabled}
                  />
                  <OpenLinkButton url={row.url} label="Abrir el link en una pestaña nueva" />
                </div>
              </div>
              {field('title', 'Título', { placeholder: 'Como aparece en la publicación', className: 'col-span-2 sm:col-span-7' })}
              {field('sellerName', 'Vendedor', { placeholder: 'Nombre del vendedor', className: 'col-span-2 sm:col-span-4' })}
              {field('soldQuantity', 'Vendidos', { placeholder: '150', numeric: true, className: 'col-span-1 sm:col-span-2' })}
              {field('listPrice', 'Precio de lista', { placeholder: '125.000', numeric: true, className: 'col-span-1 sm:col-span-3' })}
              {field('discountPct', 'Descuento %', { placeholder: '0', numeric: true, className: 'col-span-1 sm:col-span-3' })}
              <div className="col-span-1 sm:col-span-3">
                <Label htmlFor={id('installments')} className="mb-1 block text-xs text-muted-foreground">
                  Cuotas sin interés
                </Label>
                <Select value={row.installments} onValueChange={(v) => update(index, 'installments', v)} disabled={disabled}>
                  <SelectTrigger id={id('installments')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTALLMENT_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {installmentsLabel(n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 sm:col-span-3">
                <Label htmlFor={id('freeShipping')} className="mb-1 block text-xs text-muted-foreground">
                  Envío gratis
                </Label>
                <Select value={row.freeShipping ? 'si' : 'no'} onValueChange={(v) => update(index, 'freeShipping', v === 'si')} disabled={disabled}>
                  <SelectTrigger id={id('freeShipping')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 sm:col-span-3">
                <Label htmlFor={id('surveyedAt')} className="mb-1 block text-xs text-muted-foreground">
                  Relevado el
                </Label>
                <Input
                  id={id('surveyedAt')}
                  type="date"
                  value={row.surveyedAt}
                  max={today}
                  onChange={(e) => update(index, 'surveyedAt', e.target.value)}
                  disabled={disabled}
                />
              </div>
              {field('notes', 'Notas', { placeholder: 'Otras promociones, combos…', className: 'col-span-2 sm:col-span-12' })}
            </div>
            {prices ? (
              <dl className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Precio final</dt>
                  <dd className="font-medium tabular-nums">{formatPrice(Math.round(prices.finalPrice))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Cada cuota</dt>
                  <dd className="tabular-nums">{prices.installmentValue === null ? 'Sin cuotas' : formatPrice(Math.round(prices.installmentValue))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Precio efectivo</dt>
                  <dd className="tabular-nums" title={row.freeShipping ? 'Con envío gratis' : `Con un envío de ${formatPrice(shippingCost)}`}>
                    {formatPrice(Math.round(prices.effectivePrice))}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setRows([...rows, { ...EMPTY_COMPETITOR }]);
          action.clear();
        }}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
        Agregar competidor
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          pending={action.pending}
          onClick={() => action.run(() => saveCompetitorsAction(accountSlug, publicationId, filled), () => setSaved(JSON.stringify(filled)))}
          disabled={action.pending || !dirty}
        >
          {action.pending ? 'Guardando…' : 'Guardar competencia'}
        </Button>
        {filled.length < MIN ? (
          <span className="text-sm text-muted-foreground">
            Conviene cargar al menos {MIN}: {filled.length === 0 ? 'todavía no hay ninguna' : `hay ${filled.length}`}.
          </span>
        ) : null}
        <StatusText status={action.status} />
      </div>
    </div>
  );
}
