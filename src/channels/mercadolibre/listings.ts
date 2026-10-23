import type { ChannelStatus } from '@/generated/prisma/enums';
import { BULK_MAX, MercadoLibreRequestError, mlGet, readItems } from './http';
import { mercadolibreCatalog } from './catalog';
import type { ChannelListing, ChannelListings, ListingStatus } from '../listings-types';
import { LOW_INTEREST_PLAN } from '@/domain/pricing';

// Leer las publicaciones propias de la cuenta conectada. Solo lo público de
// cada publicación: no se leen órdenes, compradores ni mensajes.

const PAGE = 100;
// Más allá de este punto Mercado Libre no pagina por posición: hay que recorrer.
const OFFSET_MAX = 1000;
const SCAN_PAGES_MAX = 500;
// Pocos pedidos a la vez: Mercado Libre corta con "demasiados pedidos".
const PARALLEL = 2;
const VISIT_DAYS = 90;

const ITEM_FIELDS = [
  'id',
  'seller_id',
  'title',
  'price',
  'original_price',
  'listing_type_id',
  'tags',
  'status',
  'sub_status',
  'permalink',
  'sold_quantity',
  'category_id',
  'pictures',
  'video_id',
  'attributes',
  'variations',
  'seller_custom_field',
  'health',
  'last_updated',
];

// Los que van a la ficha y no a los datos de catálogo.
const BRAND = 'BRAND';
const PART_NUMBER = 'PART_NUMBER';
const ORIGIN = 'ORIGIN';
const SELLER_SKU = 'SELLER_SKU';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** El valor de un atributo: value_name o, si tiene varios, sus nombres. */
function attributeValue(a: Obj): string | null {
  const name = str(a.value_name);
  if (name) return name;
  const names = arr(a.values)
    .map((v) => (isObj(v) ? str(v.name) : null))
    .filter((v): v is string => v !== null);
  return names.length > 0 ? names.join(', ') : null;
}

/** El estado como lo maneja la app. Una finalizada que se eliminó sigue apareciendo como finalizada, con "deleted". */
function statusOf(raw: unknown, sub: unknown): ChannelStatus {
  if (raw === 'active') return 'ACTIVE';
  if (raw === 'paused') return 'PAUSED';
  if (raw === 'closed') return arr(sub).includes('deleted') ? 'DELETED' : 'CLOSED';
  if (raw === 'under_review') return 'UNDER_REVIEW';
  return 'INACTIVE';
}

/** Las variantes de una publicación: su código, su SKU, su medida y el código de sus fotos. */
export function variationsOf(item: Obj): { id: number | string; sku: string | null; measure: string | null; photoIds: string[] }[] {
  return arr(item.variations).flatMap((v) => {
    if (!isObj(v) || (typeof v.id !== 'number' && typeof v.id !== 'string')) return [];
    const skuAttr = arr(v.attributes).find((a) => isObj(a) && a.id === SELLER_SKU);
    const sku = (isObj(skuAttr) ? attributeValue(skuAttr) : null) ?? str(v.seller_custom_field);
    const measure = arr(v.attribute_combinations)
      .map((c) => (isObj(c) ? attributeValue(c) : null))
      .filter((c): c is string => c !== null)
      .join(' / ');
    const photoIds = arr(v.picture_ids).flatMap((id) => (typeof id === 'string' && id ? [id] : typeof id === 'number' ? [String(id)] : []));
    return [{ id: v.id, sku, measure: measure || null, photoIds }];
  });
}

/**
 * El precio publicado. Con un descuento activo, Mercado Libre muestra el
 * precio con descuento y deja el de antes en original_price.
 */
function listPriceOf(item: Obj): number | null {
  const price = num(item.price);
  const original = num(item.original_price);
  return original !== null && price !== null && original > price ? original : price;
}

// Las cuotas salen del tipo de publicación y de sus etiquetas. La Clásica no
// tiene, salvo la cuota promocionada, con interés bajo. La Premium tiene 6 sin
// interés, o 3, 9 o 12 con la etiqueta de su campaña.
export const PREMIUM = 'gold_pro';
export const CLASSIC = 'gold_special';
export const LOW_INTEREST_TAG = 'pcj-co-funded';
export const CAMPAIGN_TAG: Partial<Record<number, string>> = { 3: '3x_campaign', 9: '9x_campaign', 12: '12x_campaign' };
export const INSTALLMENT_TAGS = [LOW_INTEREST_TAG, ...Object.values(CAMPAIGN_TAG)] as string[];

export const tagsOf = (item: Obj): string[] => arr(item.tags).filter((t): t is string => typeof t === 'string');

/** Las cuotas de la publicación: 0 sin cuotas, 1 la cuota promocionada, o 3, 6, 9 o 12. */
export function installmentsOf(item: Obj): number | null {
  const type = str(item.listing_type_id);
  if (!type) return null;
  const tags = tagsOf(item);
  if (type === PREMIUM || type === 'gold_premium') {
    const campaign = Object.entries(CAMPAIGN_TAG).find(([, tag]) => tags.includes(tag!));
    return campaign ? Number(campaign[0]) : 6;
  }
  return tags.includes(LOW_INTEREST_TAG) ? LOW_INTEREST_PLAN : 0;
}

/** El descuento que ve el comprador, en %: con uno activo, el precio de antes queda en original_price. */
function discountOf(item: Obj): number | null {
  const price = num(item.price);
  const original = num(item.original_price);
  if (price === null) return null;
  return original !== null && original > price ? Math.round((1 - price / original) * 10_000) / 100 : 0;
}

/** Una publicación de Mercado Libre en el formato neutro. Sin la descripción ni las visitas, que se piden aparte. */
export function parseItem(item: Obj): ChannelListing {
  const attributes: ChannelListing['attributes'] = [];
  let brand: string | null = null;
  let partNumber: string | null = null;
  let origin: string | null = null;
  const skus: string[] = [];
  const addSku = (sku: string | null) => {
    if (sku && !skus.includes(sku)) skus.push(sku);
  };

  for (const a of arr(item.attributes)) {
    if (!isObj(a)) continue;
    const id = str(a.id);
    const value = attributeValue(a);
    if (!id || !value) continue;
    if (id === BRAND) brand = value;
    else if (id === PART_NUMBER) partNumber = value;
    else if (id === ORIGIN) origin = value;
    else if (id === SELLER_SKU) addSku(value);
    else attributes.push({ id, name: str(a.name) ?? id, value, ...(str(a.value_name) ? {} : arr(a.values).length > 1 ? { multiple: true } : {}) });
  }
  addSku(str(item.seller_custom_field));

  // Cada variante tiene su SKU y su medida, por ejemplo "STD" o "0.50".
  const measures: ChannelListing['measures'] = [];
  const variations = variationsOf(item);
  for (const v of variations) {
    addSku(v.sku);
    if (v.sku && v.measure) measures.push({ sku: v.sku, measure: v.measure });
  }

  const pictures = arr(item.pictures)
    .map((p) => (isObj(p) ? { id: str(p.id) ?? '', url: str(p.secure_url) ?? str(p.url) } : null))
    .filter((p): p is { id: string; url: string } => p !== null && p.url !== null);
  const photos = pictures.map((p) => p.url);
  const health = num(item.health);
  const skuAttr = arr(item.attributes).some((a) => isObj(a) && a.id === SELLER_SKU && attributeValue(a));

  return {
    externalId: String(item.id),
    url: str(item.permalink),
    title: str(item.title),
    description: null,
    price: listPriceOf(item),
    installments: installmentsOf(item),
    discount: discountOf(item),
    status: statusOf(item.status, item.sub_status),
    sold: num(item.sold_quantity),
    visits90d: null,
    photos,
    photoIds: pictures.map((p) => p.id),
    hasVideo: str(item.video_id) !== null,
    quality: health === null ? null : Math.round(Math.min(Math.max(health, 0), 1) * 100),
    categoryId: str(item.category_id),
    categoryName: null,
    brand,
    partNumber,
    origin,
    skus,
    measures,
    variations: variations.map((v) => ({ sku: v.sku, measure: v.measure, photoIds: v.photoIds })),
    attributes,
    attributeCount: attributes.length + [brand, partNumber, origin].filter(Boolean).length + (skuAttr ? 1 : 0),
    updatedAt: str(item.last_updated),
  };
}

/** Corre las tareas de a pocas a la vez, para no pasarse del límite de Mercado Libre. */
async function inParallel(tasks: (() => Promise<void>)[], limit = PARALLEL): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await tasks[next++]();
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

/** Un dato que puede faltar: si falla, queda vacío. Una llave vencida o "demasiados pedidos" sí cortan. */
async function optional<T>(read: () => Promise<T | null>): Promise<T | null> {
  try {
    return await read();
  } catch (e) {
    if (e instanceof MercadoLibreRequestError && (e.status === 401 || e.status === 429)) throw e;
    return null;
  }
}

// Los nombres de las categorías no cambian: se guardan mientras dure el servidor.
const categoryNames = new Map<string, string | null>();

async function categoryName(accessToken: string, id: string): Promise<string | null> {
  const known = mercadolibreCatalog.category(id);
  if (known) return known.name;
  if (categoryNames.has(id)) return categoryNames.get(id) ?? null;
  const body = await optional(() => mlGet(`/categories/${encodeURIComponent(id)}`, accessToken));
  const name = isObj(body) ? str(body.name) : null;
  categoryNames.set(id, name);
  return name;
}

// Las visitas de varias publicaciones van en un solo pedido. Si Mercado Libre
// no lo acepta, se piden de a una, y no se vuelve a probar mientras dure el servidor.
let visitsTogether = true;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Visitas de los últimos 90 días de cada publicación. Las que no se pudieron leer no están. */
async function visitsOf(accessToken: string, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  if (visitsTogether) {
    const now = new Date();
    const from = isoDay(new Date(now.getTime() - VISIT_DAYS * 86_400_000));
    const q = new URLSearchParams({ ids: ids.join(','), date_from: from, date_to: isoDay(now) });
    try {
      const body = await mlGet(`/items/visits?${q.toString()}`, accessToken);
      const list = Array.isArray(body) ? body : isObj(body) ? arr(body.results) : [];
      for (const v of list) {
        if (!isObj(v)) continue;
        const id = str(v.item_id) ?? str(v.id);
        const total = num(v.total_visits);
        if (id && total !== null) out.set(id, total);
      }
      if (out.size > 0) return out;
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && (e.status === 401 || e.status === 429)) throw e;
    }
    visitsTogether = false;
  }
  const tasks = ids.map((id) => async () => {
    const body = await optional(() => mlGet(`/items/${encodeURIComponent(id)}/visits/time_window?last=${VISIT_DAYS}&unit=day`, accessToken));
    const total = isObj(body) ? num(body.total_visits) : null;
    if (total !== null) out.set(id, total);
  });
  await inParallel(tasks);
  return out;
}

/** Solo para las pruebas: vuelve a probar el pedido de visitas conjunto. */
export function resetVisitsTogether() {
  visitsTogether = true;
}

function searchPath(userId: string, params: Record<string, string>): string {
  return `/users/${encodeURIComponent(userId)}/items/search?${new URLSearchParams(params).toString()}`;
}

function results(body: unknown): string[] {
  return isObj(body) ? arr(body.results).filter((r): r is string => typeof r === 'string') : [];
}

function total(body: unknown): number {
  return (isObj(body) && isObj(body.paging) && num(body.paging.total)) || 0;
}

async function idsWithStatus(accessToken: string, userId: string, status: ListingStatus): Promise<string[]> {
  const first = await mlGet(searchPath(userId, { status, limit: String(PAGE), offset: '0' }), accessToken);
  const count = total(first);
  const ids = results(first);
  if (count <= OFFSET_MAX) {
    for (let offset = PAGE; offset < count; offset += PAGE) {
      const page = results(await mlGet(searchPath(userId, { status, limit: String(PAGE), offset: String(offset) }), accessToken));
      if (page.length === 0) break;
      ids.push(...page);
    }
    return ids;
  }
  // Muchas: se recorren con scroll_id, desde el principio.
  const scanned: string[] = [];
  let scrollId: string | null = null;
  for (let i = 0; i < SCAN_PAGES_MAX; i++) {
    const params: Record<string, string> = { status, search_type: 'scan', limit: String(PAGE) };
    if (scrollId) params.scroll_id = scrollId;
    const body = await mlGet(searchPath(userId, params), accessToken);
    const page = results(body);
    if (page.length === 0) break;
    scanned.push(...page);
    scrollId = isObj(body) ? str(body.scroll_id) : null;
    if (!scrollId || scanned.length >= count) break;
  }
  return scanned;
}

export const mercadolibreListings: ChannelListings = {
  async countByStatus(accessToken, userId) {
    const [active, paused, closed] = await Promise.all(
      (['active', 'paused', 'closed'] as const).map(async (status) =>
        total(await mlGet(searchPath(userId, { status, limit: '1' }), accessToken)),
      ),
    );
    return { active, paused, closed };
  },

  async listIds(accessToken, userId, statuses) {
    const out: string[] = [];
    for (const status of statuses) {
      for (const id of await idsWithStatus(accessToken, userId, status)) if (!out.includes(id)) out.push(id);
    }
    return out;
  },

  async readListings(accessToken, userId, ids, opts) {
    const wanted = [...new Set(ids)].slice(0, BULK_MAX);
    // Solo las propias: las de otra cuenta quedan como no leídas.
    const own = (await readItems(accessToken, wanted, ITEM_FIELDS, { allAttributes: true })).filter(
      (item) => item.seller_id === undefined || item.seller_id === null || String(item.seller_id) === userId,
    );
    const listings = own.map(parseItem);
    const visits = await visitsOf(accessToken, listings.map((l) => l.externalId));
    const tasks: (() => Promise<void>)[] = [];
    for (const l of listings) {
      l.visits90d = visits.get(l.externalId) ?? null;
      if (opts?.description && !opts.description(l)) continue;
      const id = encodeURIComponent(l.externalId);
      tasks.push(async () => {
        const body = await optional(() => mlGet(`/items/${id}/description`, accessToken));
        l.description = isObj(body) ? str(body.plain_text) : null;
      });
    }
    for (const categoryId of new Set(listings.map((l) => l.categoryId).filter((c): c is string => c !== null))) {
      tasks.push(async () => {
        const name = await categoryName(accessToken, categoryId);
        for (const l of listings) if (l.categoryId === categoryId) l.categoryName = name;
      });
    }
    await inParallel(tasks);
    const found = new Set(listings.map((l) => l.externalId));
    return { listings, missing: wanted.filter((id) => !found.has(id)) };
  },
};
