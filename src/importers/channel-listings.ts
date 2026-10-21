import type { ChannelListing } from '@/channels/listings-types';
import type { ChannelAdapter } from '@/channels/types';
import type { ChannelStatus } from '@/generated/prisma/enums';
import { CatalogError, cleanCatalogValue, normalizeText } from '@/domain/catalog-data';
import type { NameValue } from '@/domain/name-value';
import { parseSpecs } from './cells';
import type { FieldKey } from './fields';
import type { RowInput } from './mapping';
import type { Cell } from './spreadsheet';

// Convierte lo que se leyó del canal en filas, como las de una planilla. Así
// la revisión, la importación y deshacer son los mismos para los dos orígenes.

const STATUS_WORD: Record<ChannelStatus, string> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  INACTIVE: 'inactive',
  UNPUBLISHED: 'sin publicar',
};

// Las celdas con varios datos se separan por línea o por punto y coma.
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/;/g, ',').trim();

type AttributeEntry = { id: string; name: string; value: string; multiple: boolean };

/** Los datos de catálogo, con el nombre del campo de la categoría cuando la app lo conoce. */
function attributeEntries(listing: ChannelListing, adapter: ChannelAdapter): AttributeEntry[] {
  const category = listing.categoryId ? (adapter.catalog?.category(listing.categoryId) ?? null) : null;
  const entries: AttributeEntry[] = [];
  for (const a of listing.attributes) {
    const field = category?.fields.find((f) => f.id === a.id && !f.fromProduct) ?? null;
    let value = a.value;
    if (field) {
      try {
        value = cleanCatalogValue(field, a.value) ?? a.value;
      } catch (e) {
        // Un valor que la app no reconoce queda como vino.
        if (!(e instanceof CatalogError)) throw e;
      }
    }
    const name = oneLine((field?.label ?? a.name).replace(/:/g, ' '));
    const clean = oneLine(value);
    if (name && clean) entries.push({ id: a.id, name, value: clean, multiple: Boolean(field?.multiple ?? a.multiple) });
  }
  return entries;
}

function attributeLines(listing: ChannelListing, adapter: ChannelAdapter): string[] {
  return attributeEntries(listing, adapter).map((e) => `${e.name}: ${e.value}`);
}

/** Los datos de catálogo como los guarda la app, igual que al importarlos. */
export function listingAttributes(listing: ChannelListing, adapter: ChannelAdapter): NameValue[] {
  return parseSpecs(attributeLines(listing, adapter).join('\n')).items;
}

/** El código de cada dato de catálogo en el canal, por su nombre en la app, para poder subirlos. */
export function listingAttributeIds(listing: ChannelListing, adapter: ChannelAdapter): Record<string, { id: string; multiple: boolean }> {
  const out: Record<string, { id: string; multiple: boolean }> = {};
  for (const e of attributeEntries(listing, adapter)) out[normalizeText(e.name)] = { id: e.id, multiple: e.multiple };
  return out;
}

/** El tipo de producto: la familia de la app si la categoría tiene una, o el nombre de la categoría. */
function productTypeOf(listing: ChannelListing, adapter: ChannelAdapter): string | null {
  const family = listing.categoryId ? (adapter.catalog?.familyForCategory(listing.categoryId, listing.title) ?? null) : null;
  return family ?? listing.categoryName;
}

export function listingToRow(listing: ChannelListing, rowNumber: number, adapter: ChannelAdapter): RowInput {
  const values: Partial<Record<FieldKey, Cell>> = {
    'pub.externalId': listing.externalId,
    'pub.url': listing.url,
    'pub.title': listing.title,
    'pub.description': listing.description,
    'pub.price': listing.price,
    'pub.channelStatus': STATUS_WORD[listing.status],
    'pub.attributes': attributeLines(listing, adapter).join('\n') || null,
    'product.brand': listing.brand,
    'product.partNumber': listing.partNumber,
    'product.origin': listing.origin,
    'product.productType': productTypeOf(listing, adapter),
    'product.skus': listing.skus.map(oneLine).join('\n') || null,
    'product.measures': listing.measures.map((m) => `${oneLine(m.sku).replace(/:/g, ' ')}: ${oneLine(m.measure)}`).join('\n') || null,
    'asset.photos': listing.photos.join('\n') || null,
    'metric.sold_visible': listing.sold,
    'metric.visits_90d': listing.visits90d,
    'metric.photo_count': listing.photos.length,
    'metric.has_video': listing.hasVideo,
    'metric.attribute_count': listing.attributeCount,
    'metric.channel_quality': listing.quality,
  };
  // Lo que el canal no informó no se manda: así no pisa nada.
  for (const key of Object.keys(values) as FieldKey[]) if (values[key] === null || values[key] === undefined) delete values[key];
  return { rowNumber, values };
}
