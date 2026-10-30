import { MercadoLibreRequestError, mlGet, mlSend } from './http';
import { CAMPAIGN_TAG, CLASSIC, inFull, INSTALLMENT_TAGS, LOW_INTEREST_TAG, PREMIUM, tagsOf, variationsOf } from './listings';
import { measureText, variantKey, type VariantLike } from '@/domain/media';
import { formatPrice } from '@/domain/money';
import { isInstallmentPlan, LOW_INTEREST_PLAN } from '@/domain/pricing';
import { campaignPrice, dealPrice } from '@/domain/promotions';
import { JOIN_WITH_PRICE, needsDetail, NEEDS_OFFER, parsePromotions, readRef, withDetail } from './promotions';
import { MAX_QUANTITY, quantityKey } from '@/domain/quantities';
import {
  PublishError,
  type ChannelAttributeUpdate,
  type ChannelCampaign,
  type ChannelCreated,
  type ChannelNewListing,
  type ChannelPicture,
  type ChannelPromotions,
  type ChannelPublisher,
  type ChannelStatusChange,
} from '../publish-types';

// Subir a Mercado Libre el título y la descripción de una publicación propia.
// Si Mercado Libre no acepta el cambio, se explica por qué en castellano.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

// Los motivos que más aparecen, por el código que manda Mercado Libre.
const KNOWN: [RegExp, string][] = [
  [/attributes? \[[^\]]*\] (is|are) (all )?required|missing_required/i, 'Mercado Libre pide datos de catálogo que faltan.'],
  [/item\.variations|field variations/i, 'Mercado Libre no aceptó las medidas.'],
  [/available_quantity|quantity|stock/i, 'Mercado Libre no aceptó la cantidad.'],
  [/item\.price|price/i, 'Mercado Libre no aceptó el precio.'],
  [/attribute/i, 'Mercado Libre no aceptó un dato de catálogo.'],
  [/title.*not_modifiable|title.*modif/i, 'Mercado Libre no deja cambiar el título de una publicación con ventas.'],
  [/title.*(length|max|long)/i, 'El título es más largo de lo que acepta la categoría en Mercado Libre.'],
  [/title/i, 'Mercado Libre no aceptó el título.'],
  [/description.*(length|max|long)/i, 'La descripción es más larga de lo que acepta Mercado Libre.'],
  [/description.*(html|tag|link|url|mail|phone|contact)/i, 'Mercado Libre no acepta links, mails, teléfonos ni etiquetas HTML en la descripción.'],
  [/description/i, 'Mercado Libre no aceptó la descripción.'],
  [/picture|image/i, 'Mercado Libre no aceptó las fotos.'],
  [/under_review|moderat/i, 'La publicación está en revisión en Mercado Libre: no se puede cambiar por ahora.'],
  [/closed|inactive|status/i, 'La publicación está finalizada en Mercado Libre: no se puede cambiar.'],
];

/** Lo que explica Mercado Libre del rechazo, tal cual lo manda. */
function detailOf(body: unknown): string | null {
  const causes = isObj(body) && Array.isArray(body.cause) ? body.cause.filter(isObj) : [];
  return causes.map((c) => (typeof c.message === 'string' ? c.message : null)).find(Boolean) ?? (isObj(body) && typeof body.message === 'string' ? body.message : null);
}

/** El motivo, en castellano, de por qué Mercado Libre no aceptó el cambio. */
export function rejectionMessage(status: number, body: unknown): string {
  if (status === 403) return 'La aplicación de Mercado Libre no tiene permiso para modificar publicaciones. Revisá que tenga el permiso de escritura y volvé a conectar la tienda.';
  if (status === 404) return 'Mercado Libre no encontró la publicación.';
  const causes = isObj(body) && Array.isArray(body.cause) ? body.cause.filter(isObj) : [];
  const codes = [...causes.map((c) => `${c.code ?? ''} ${c.message ?? ''}`), isObj(body) ? `${body.error ?? ''} ${body.message ?? ''}` : ''].join(' ');
  const detail = detailOf(body);
  for (const [pattern, message] of KNOWN) {
    if (!pattern.test(codes)) continue;
    // En las medidas, los datos de catálogo y las fotos, el detalle dice cuál fue.
    return /variation|attribute|picture|price|quantity/i.test(pattern.source) && detail ? `${message.slice(0, -1)}: ${detail}` : message;
  }
  return detail ? `Mercado Libre no lo aceptó: ${detail}` : `Mercado Libre no lo aceptó (código ${status}).`;
}

// Una llave vencida o "demasiados pedidos" siguen como error de conexión.
function translated(e: unknown): unknown {
  return e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429 ? new PublishError(rejectionMessage(e.status, e.body)) : e;
}

/**
 * El rechazo de algo puntual, como las cuotas o el descuento: lo que no
 * aceptó y el detalle que manda Mercado Libre.
 */
function rejectedAs(what: string, e: unknown, opts: { raw?: boolean } = {}): unknown {
  if (!(e instanceof MercadoLibreRequestError) || e.status === 401 || e.status === 429) return e;
  if (e.status === 404) return new PublishError('Mercado Libre no encontró la publicación.');
  const detail = detailOf(e.body);
  // Con raw, la respuesta completa de Mercado Libre va en el mensaje, para entender rechazos que no se conocen.
  const raw = opts.raw && e.body !== null && e.body !== undefined ? ` Respuesta completa: ${JSON.stringify(e.body).slice(0, 600)}` : '';
  if (detail) return new PublishError(`Mercado Libre no aceptó ${what}: ${detail}${raw}`);
  return new PublishError((e.status === 403 ? `Mercado Libre no deja cambiar ${what} con esta cuenta.` : `Mercado Libre no aceptó ${what} (código ${e.status}).`) + raw);
}

async function send(method: 'PUT' | 'POST', path: string, token: string, body: unknown): Promise<unknown> {
  try {
    return await mlSend(method, path, token, body);
  } catch (e) {
    throw translated(e);
  }
}

async function get(path: string, token: string): Promise<unknown> {
  try {
    return await mlGet(path, token);
  } catch (e) {
    throw translated(e);
  }
}

const sameSku = (a: string | null, b: string | null) => !!a && !!b && a.trim().toUpperCase() === b.trim().toUpperCase();
const sameMeasure = (a: string | null, b: string | null) => measureText(a) !== null && measureText(a) === measureText(b);

/**
 * La medida de la ficha de una variante: la que tiene el mismo SKU y la misma
 * medida; si no, la única con ese SKU, o la única con esa medida.
 */
function variantOf<T extends VariantLike>(list: T[], v: VariantLike): T | undefined {
  const key = variantKey(v);
  const exact = key ? list.find((x) => variantKey(x) === key) : undefined;
  if (exact) return exact;
  const bySku = list.filter((x) => sameSku(x.sku, v.sku));
  if (bySku.length === 1) return bySku[0];
  const byMeasure = (bySku.length > 1 ? bySku : list).filter((x) => sameMeasure(x.measure, v.measure));
  return byMeasure.length === 1 ? byMeasure[0] : undefined;
}

// Los motivos más comunes al cambiar el estado, antes que los generales.
const STATUS_KNOWN: [RegExp, string][] = [
  [/quantity|stock/i, 'No tiene stock en Mercado Libre: cargale stock para reactivarla.'],
  [/under_review|moderat/i, 'La publicación está en revisión en Mercado Libre: no se puede cambiar por ahora.'],
  [/deleted|delete/i, 'Mercado Libre solo deja eliminar publicaciones finalizadas.'],
  [/relist/i, 'Mercado Libre no deja republicar esta publicación.'],
];

/** Lo mismo que send, con los motivos de los cambios de estado. */
async function sendStatus(method: 'PUT' | 'POST', path: string, token: string, body: unknown): Promise<unknown> {
  try {
    return await mlSend(method, path, token, body);
  } catch (e) {
    if (e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429 && e.status !== 403 && e.status !== 404) {
      const causes = isObj(e.body) && Array.isArray(e.body.cause) ? e.body.cause.filter(isObj) : [];
      const text = [...causes.map((c) => `${c.code ?? ''} ${c.message ?? ''}`), isObj(e.body) ? `${e.body.error ?? ''} ${e.body.message ?? ''}` : ''].join(' ');
      const known = STATUS_KNOWN.find(([pattern]) => pattern.test(text));
      if (known) throw new PublishError(known[1]);
    }
    throw translated(e);
  }
}

const STATUS_BODY: Record<ChannelStatusChange, Obj> = {
  pause: { status: 'paused' },
  activate: { status: 'active' },
  close: { status: 'closed' },
  // Solo las finalizadas: después no se pueden recuperar.
  delete: { deleted: 'true' },
};

/** Las fotos como las pide Mercado Libre: los archivos se suben antes y quedan por su código. */
async function picturesBody(token: string, pictures: ChannelPicture[]): Promise<({ id: string } | { source: string })[]> {
  const out: ({ id: string } | { source: string })[] = [];
  for (const p of pictures) {
    if (p.kind === 'existing') out.push({ id: p.id });
    else if (p.kind === 'link') out.push({ source: p.url });
    else {
      const form = new FormData();
      form.append('file', new Blob([p.data as BlobPart], { type: p.type }), p.name);
      const body = await send('POST', '/pictures/items/upload', token, form);
      const id = isObj(body) && typeof body.id === 'string' ? body.id : null;
      if (!id) throw new PublishError('Mercado Libre no devolvió el código de una foto subida.');
      out.push({ id });
    }
  }
  return out;
}

/** El código de cada foto, en orden, de lo que respondió Mercado Libre. */
function pictureIdsOf(body: unknown): string[] | null {
  if (!isObj(body) || !Array.isArray(body.pictures)) return null;
  const ids = body.pictures.map((p) => (isObj(p) && typeof p.id === 'string' ? p.id : null));
  return ids.every((id): id is string => id !== null) ? ids : null;
}

const LISTING_TYPE_ID: Record<string, string> = { clasica: CLASSIC, premium: PREMIUM };

// ───────────────────────────── El descuento ─────────────────────────────

// Lo que acepta Mercado Libre en un descuento propio, en %, y cuántos días puede durar.
const DISCOUNT_RANGE = { min: 5, max: 80 };
const DISCOUNT_DAYS = 14;

// La hora de cada sitio, para las fechas del descuento. Mercado Libre las pide sin zona.
const SITE_TIME_ZONE: Record<string, string> = {
  MLA: 'America/Argentina/Buenos_Aires',
  MLB: 'America/Sao_Paulo',
  MLM: 'America/Mexico_City',
  MLC: 'America/Santiago',
  MCO: 'America/Bogota',
  MLU: 'America/Montevideo',
  MPE: 'America/Lima',
};

/** La fecha y hora en esa zona, como la pide Mercado Libre: 2026-10-23T00:00:00. */
function wallClock(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

/** El momento de una fecha y hora de esa zona. */
function fromWallClock(text: string, timeZone: string): Date {
  const guess = new Date(`${text}Z`);
  const offset = Date.parse(`${wallClock(guess, timeZone)}Z`) - guess.getTime();
  return new Date(guess.getTime() - offset);
}

/** Desde hoy a la mañana hasta el último minuto del día 14, en la hora del sitio. */
export function discountDates(externalId: string, now: Date): { start: string; finish: string; until: Date } {
  const timeZone = SITE_TIME_ZONE[externalId.slice(0, 3).toUpperCase()] ?? SITE_TIME_ZONE.MLA;
  const today = wallClock(now, timeZone).slice(0, 10);
  const last = new Date(`${today}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + DISCOUNT_DAYS - 1);
  const finish = `${last.toISOString().slice(0, 10)}T23:59:59`;
  return { start: `${today}T00:00:00`, finish, until: fromWallClock(finish, timeZone) };
}

/**
 * Las promociones de la publicación. Sin ninguna, Mercado Libre puede
 * responder que no la encuentra. Con details, las invitaciones se completan
 * con lo que hace falta para sumarse desde la app.
 */
async function promotionsOf(id: string, token: string, details = false): Promise<ChannelPromotions> {
  let promotions: ChannelPromotions;
  try {
    promotions = parsePromotions(await mlGet(`/seller-promotions/items/${id}?app_version=v2`, token));
  } catch (e) {
    if (e instanceof MercadoLibreRequestError && e.status === 404) return parsePromotions([]);
    throw e;
  }
  if (!details) return promotions;
  const campaigns: ChannelCampaign[] = [];
  for (const c of promotions.campaigns) {
    const ref = needsDetail(c);
    if (!ref) {
      campaigns.push(c);
      continue;
    }
    const query = new URLSearchParams({ promotion_type: ref.type, item_id: decodeURIComponent(id), app_version: 'v2' });
    const raw = await mlGet(`/seller-promotions/promotions/${encodeURIComponent(ref.promotion)}/items?${query}`, token).catch((e) => {
      // Sin el detalle se ve igual, pero no se puede sumar desde la app.
      if (e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429) return null;
      throw e;
    });
    campaigns.push(withDetail(c, ref, raw));
  }
  return { ...promotions, campaigns };
}

/**
 * Si la publicación tiene un descuento propio puesto o por empezar. La que
 * solo puede llevar uno figura como candidata: ahí no hay nada para sacar.
 */
async function hasDiscount(id: string, token: string): Promise<boolean> {
  try {
    return (await promotionsOf(id, token)).current !== null;
  } catch (e) {
    throw rejectedAs('el descuento', e);
  }
}

// Mercado Libre no acepta un descuento chico para los precios que tuvo la publicación.
const notCredible = (e: unknown) => e instanceof MercadoLibreRequestError && /credib/i.test(JSON.stringify(e.body ?? ''));

/** Por qué no aceptó el descuento, con el precio con descuento más alto que acepta si lo informa. */
async function notCredibleMessage(id: string, token: string): Promise<string> {
  const why = 'Mercado Libre no acepta este descuento porque le parece chico para los precios que tuvo la publicación.';
  const max = await promotionsOf(id, token).then(
    (p) => p.discount?.maxPrice ?? null,
    () => null,
  );
  return max ? `${why} El precio con descuento tiene que ser de ${formatPrice(max)} o menos.` : why;
}

/** Saca el descuento propio. Si Mercado Libre ya no lo tiene, no hay nada que sacar. */
async function removeDiscount(id: string, token: string): Promise<void> {
  try {
    await mlSend('DELETE', `/seller-promotions/items/${id}?promotion_type=PRICE_DISCOUNT&app_version=v2`, token);
  } catch (e) {
    const gone = e instanceof MercadoLibreRequestError && (e.status === 404 || /no offers? found/i.test(detailOf(e.body) ?? ''));
    if (!gone) throw e;
  }
}

/**
 * Si la cuenta está en el modelo de "precio por variación": cada medida es una
 * publicación aparte, sin título propio (Mercado Libre lo arma), agrupadas por
 * nombre de familia. Si no se puede saber, se crea como siempre.
 */
async function separateVariants(token: string): Promise<boolean> {
  try {
    const me = await mlGet('/users/me', token);
    return isObj(me) && Array.isArray(me.tags) && me.tags.includes('user_product_seller');
  } catch (e) {
    if (e instanceof MercadoLibreRequestError && (e.status === 401 || e.status === 429)) throw e;
    return false;
  }
}

type PictureBody = { id: string } | { source: string };

/**
 * Las fotos de cada publicación, de a una por vez: una foto por link se sube
 * con la primera que la lleva y las demás usan el código que le dio Mercado
 * Libre, así es la misma foto en todas.
 */
function pictureKeeper(body: PictureBody[]) {
  const known = new Map<number, string>();
  body.forEach((p, i) => {
    if ('id' in p) known.set(i, p.id);
  });
  const valid = (list: number[]) => list.filter((i) => i >= 0 && i < body.length);
  return {
    valid,
    of: (list: number[]): PictureBody[] => valid(list).map((i) => (known.has(i) ? { id: known.get(i)! } : body[i])),
    // Anota los códigos que devolvió Mercado Libre; devuelve los de esas fotos, si los sabe.
    learn(list: number[], ids: string[] | null): string[] | null {
      const own = valid(list);
      if (ids && ids.length === own.length) own.forEach((i, k) => known.set(i, ids[k]));
      return own.every((i) => known.has(i)) ? own.map((i) => known.get(i)!) : null;
    },
    all: (): string[] | null => (body.every((_, i) => known.has(i)) ? body.map((_, i) => known.get(i)!) : null),
  };
}

/**
 * Crea una publicación por cada una que se pide, de a una por vez. Con nombre
 * de familia, Mercado Libre agrupa las medidas y arma el título de cada una;
 * sin ese modelo, cada una lleva el título.
 */
async function createMembers(accessToken: string, l: ChannelNewListing, family: boolean): Promise<ChannelCreated> {
  const keeper = pictureKeeper(await picturesBody(accessToken, l.pictures));
  const members: ChannelCreated['members'] = [];
  const warnings: string[] = [];
  for (const m of l.members) {
    const name = m.measure ? `La medida ${m.measure}` : 'La publicación';
    let body: unknown;
    try {
      body = await send('POST', '/items', accessToken, {
        ...(family ? { family_name: l.title } : { title: l.title }),
        category_id: l.categoryId,
        price: m.price,
        currency_id: l.currency,
        available_quantity: m.quantity,
        buying_mode: 'buy_it_now',
        listing_type_id: LISTING_TYPE_ID[l.listingType] ?? 'gold_special',
        condition: 'new',
        pictures: keeper.of(m.pictures),
        attributes: [
          ...l.attributes.map(attributeBody),
          ...(m.sku ? [{ id: 'SELLER_SKU', value_name: m.sku }] : []),
          // Las categorías de repuestos no traen un campo de medida: va con su nombre.
          ...(m.measure ? [{ name: 'Medida', value_name: m.measure }] : []),
        ],
        ...(l.warranty
          ? { sale_terms: [{ id: 'WARRANTY_TYPE', value_name: 'Garantía del vendedor' }, { id: 'WARRANTY_TIME', value_name: l.warranty }] }
          : {}),
      });
    } catch (e) {
      // Si ya se creó otra, se sigue con las demás y se avisa cuál faltó.
      if (!(e instanceof PublishError) || !members.some(Boolean)) throw e;
      warnings.push(`${name} no se creó: ${e.message}`);
      members.push(null);
      continue;
    }
    const id = isObj(body) && typeof body.id === 'string' ? body.id : null;
    if (!id) {
      if (!members.some(Boolean)) throw new PublishError('Mercado Libre no devolvió el código de la publicación nueva.');
      warnings.push(`${name} no se creó: Mercado Libre no devolvió su código.`);
      members.push(null);
      continue;
    }
    members.push({ externalId: id, url: isObj(body) && typeof body.permalink === 'string' ? body.permalink : null, pictureIds: keeper.learn(m.pictures, pictureIdsOf(body)) });
    if (l.description) {
      try {
        await send('POST', `/items/${encodeURIComponent(id)}/description`, accessToken, { plain_text: l.description });
      } catch (e) {
        if (!(e instanceof PublishError)) throw e;
        warnings.push(`${name} se creó, pero la descripción no: ${e.message} Queda en el borrador para subirla.`);
      }
    }
  }
  return { members, warnings };
}

/** Un dato de catálogo como lo pide Mercado Libre: un valor por nombre, o la lista si acepta varios. */
function attributeBody(a: ChannelAttributeUpdate) {
  if (!a.multiple) return { id: a.id, value_name: a.value };
  const names = a.value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return { id: a.id, values: names.map((name) => ({ name })) };
}

export const mercadolibrePublisher: ChannelPublisher = {
  listingTypes: [
    { value: 'clasica', label: 'Clásica' },
    { value: 'premium', label: 'Premium, con cuotas sin interés' },
  ],

  async create(accessToken, l) {
    return createMembers(accessToken, l, await separateVariants(accessToken));
  },

  async updatePictures(accessToken, externalId, pictures, layout) {
    const id = encodeURIComponent(externalId);
    // Con variantes, las fotos de cada una van en el mismo pedido, y todas las
    // variantes: Mercado Libre borra las que no van.
    const item = await get(`/items/${id}?attributes=variations`, accessToken);
    const variations = isObj(item) ? variationsOf(item) : [];
    const body = await picturesBody(accessToken, pictures);
    const ref = (p: { id: string } | { source: string }) => ('id' in p ? p.id : p.source);
    const everything = body.map((_, i) => i);
    const res = await send('PUT', `/items/${id}`, accessToken, {
      pictures: body,
      ...(variations.length > 0
        ? {
            variations: variations.map((v) => {
              const own = (variantOf(layout.variants, v)?.pictures ?? layout.general).filter((i) => i >= 0 && i < body.length);
              // Cada variante necesita al menos una foto.
              return { id: v.id, picture_ids: (own.length > 0 ? own : everything).map((i) => ref(body[i])) };
            }),
          }
        : {}),
    });
    return pictureIdsOf(res) ?? (body.every((p) => 'id' in p) ? body.map((p) => (p as { id: string }).id) : null);
  },

  async updateSeparatePictures(accessToken, listings, pictures) {
    const keeper = pictureKeeper(await picturesBody(accessToken, pictures));
    const out: (string[] | null)[] = [];
    for (const l of listings) {
      const res = await send('PUT', `/items/${encodeURIComponent(l.externalId)}`, accessToken, { pictures: keeper.of(l.pictures) });
      out.push(keeper.learn(l.pictures, pictureIdsOf(res)));
    }
    return out;
  },

  async setStatus(accessToken, externalId, change) {
    await sendStatus('PUT', `/items/${encodeURIComponent(externalId)}`, accessToken, STATUS_BODY[change]);
  },

  async relist(accessToken, externalId, r) {
    const id = encodeURIComponent(externalId);
    // Con variantes, la cantidad va en cada una, todas al mismo precio.
    const item = await get(`/items/${id}?attributes=variations`, accessToken);
    const variations = isObj(item) ? variationsOf(item) : [];
    const res = await sendStatus('POST', `/items/${id}/relist`, accessToken, {
      price: r.price,
      listing_type_id: LISTING_TYPE_ID[r.listingType] ?? 'gold_special',
      ...(variations.length > 0
        ? { variations: variations.map((v) => ({ id: v.id, price: r.price, quantity: variantOf(r.variants, v)?.quantity ?? r.quantity })) }
        : { quantity: r.quantity }),
    });
    const newId = isObj(res) && typeof res.id === 'string' ? res.id : null;
    if (!newId) throw new PublishError('Mercado Libre no devolvió el código de la publicación republicada.');
    return { externalId: newId, url: isObj(res) && typeof res.permalink === 'string' ? res.permalink : null };
  },

  async updatePrice(accessToken, externalId, price) {
    const id = encodeURIComponent(externalId);
    // Con medidas, Mercado Libre pide el precio en cada una.
    const item = await get(`/items/${id}?attributes=variations`, accessToken);
    const variations = isObj(item) ? variationsOf(item) : [];
    await send('PUT', `/items/${id}`, accessToken, variations.length > 0 ? { variations: variations.map((v) => ({ id: v.id, price })) } : { price });
  },

  async setInstallments(accessToken, externalId, plan) {
    if (!isInstallmentPlan(plan)) throw new PublishError('Mercado Libre no ofrece ese plan de cuotas.');
    const id = encodeURIComponent(externalId);
    const item = await get(`/items/${id}?attributes=listing_type_id,tags`, accessToken);
    const current = isObj(item) ? item : {};
    // Las cuotas sin interés son de la Premium; sin cuotas o la cuota promocionada, de la Clásica.
    const type = plan >= 3 ? PREMIUM : CLASSIC;
    const tag = plan >= 3 ? CAMPAIGN_TAG[plan] : plan === LOW_INTEREST_PLAN ? LOW_INTEREST_TAG : undefined;
    const tags = tagsOf(current);
    // Mercado Libre reemplaza la lista entera de etiquetas: van las demás como estaban.
    const next = [...tags.filter((t) => !INSTALLMENT_TAGS.includes(t)), ...(tag ? [tag] : [])];
    try {
      if (current.listing_type_id !== type) await mlSend('POST', `/items/${id}/listing_type`, accessToken, { id: type });
      if (next.length !== tags.length || next.some((t, i) => t !== tags[i])) await mlSend('PUT', `/items/${id}`, accessToken, { tags: next });
    } catch (e) {
      throw rejectedAs('las cuotas', e);
    }
  },

  async setQuantity(accessToken, externalId, lines) {
    if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 0 || l.quantity > MAX_QUANTITY)) {
      throw new PublishError(`La cantidad tiene que ser un número entero de 0 a ${MAX_QUANTITY}.`);
    }
    const id = encodeURIComponent(externalId);
    const item = await get(`/items/${id}?attributes=variations,shipping`, accessToken);
    const current = isObj(item) ? item : {};
    if (inFull(current)) throw new PublishError('La publicación está en Full: la cantidad la maneja Mercado Libre.');
    const variations = variationsOf(current);
    const changed = new PublishError('Las medidas cambiaron en Mercado Libre: volvé a leer la publicación.');
    if (variations.length === 0) {
      if (lines.length !== 1) throw changed;
      await send('PUT', `/items/${id}`, accessToken, { available_quantity: lines[0].quantity });
      return;
    }
    const keys = variations.map((v, i) => quantityKey(v, i));
    if (lines.some((l) => !keys.includes(l.key))) throw changed;
    const wanted = new Map(lines.map((l) => [l.key, l.quantity]));
    // Mercado Libre borra las medidas que no van: van todas, las demás sin cambios.
    await send('PUT', `/items/${id}`, accessToken, {
      variations: variations.map((v, i) => (wanted.has(keys[i]) ? { id: v.id, available_quantity: wanted.get(keys[i]) } : { id: v.id })),
    });
  },

  discountRange: DISCOUNT_RANGE,

  async setDiscount(accessToken, externalId, { pct, listPrice }, now) {
    if (pct !== 0 && !(pct >= DISCOUNT_RANGE.min && pct <= DISCOUNT_RANGE.max)) {
      throw new PublishError(`Mercado Libre acepta descuentos de ${DISCOUNT_RANGE.min} a ${DISCOUNT_RANGE.max} %.`);
    }
    const deal = dealPrice(listPrice, pct);
    if (pct !== 0 && !(deal > 0 && deal < listPrice)) throw new PublishError('Falta el precio publicado para calcular el descuento.');
    const id = encodeURIComponent(externalId);
    try {
      // Mercado Libre no deja dos a la vez: el que había se saca antes.
      if (await hasDiscount(id, accessToken)) await removeDiscount(id, accessToken);
      if (pct === 0) return { until: null };
      const dates = discountDates(externalId, now);
      await mlSend('POST', `/seller-promotions/items/${id}?app_version=v2`, accessToken, {
        promotion_type: 'PRICE_DISCOUNT',
        deal_price: deal,
        start_date: dates.start,
        finish_date: dates.finish,
      });
      return { until: dates.until };
    } catch (e) {
      if (notCredible(e)) throw new PublishError(await notCredibleMessage(id, accessToken));
      throw rejectedAs('el descuento', e);
    }
  },

  async readPromotions(accessToken, externalId, opts) {
    try {
      return await promotionsOf(encodeURIComponent(externalId), accessToken, opts?.details ?? true);
    } catch (e) {
      // Una llave vencida o "demasiados pedidos" siguen como error de conexión.
      if (e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429) {
        throw new PublishError(`No se pudieron leer las promociones de Mercado Libre (código ${e.status}).`);
      }
      throw e;
    }
  },

  async joinCampaign(accessToken, externalId, ref, price) {
    const campaign = readRef(ref);
    if (!campaign) throw new PublishError('No se reconoce la campaña: volvé a consultar las promociones.');
    const withPrice = JOIN_WITH_PRICE.has(campaign.type);
    if (withPrice && !(price !== null && price > 0)) throw new PublishError('Falta el precio para el comprador en la campaña.');
    const id = encodeURIComponent(externalId);
    try {
      const response = await mlSend('POST', `/seller-promotions/items/${id}?app_version=v2`, accessToken, {
        promotion_id: campaign.promotion,
        promotion_type: campaign.type,
        ...(withPrice ? { deal_price: campaignPrice(price!) } : {}),
        ...(campaign.offer && NEEDS_OFFER.has(campaign.type) ? { offer_id: campaign.offer } : {}),
      });
      // Lo que respondió al aceptar, por si después no la muestra: solo el código, nunca datos de la cuenta.
      console.info(`[ml] campaña ${campaign.type} ${campaign.promotion} en ${externalId}: ${JSON.stringify(response).slice(0, 300)}`);
    } catch (e) {
      if (notCredible(e)) throw new PublishError('Mercado Libre no acepta ese precio en la campaña porque le parece poco descuento. Elegí uno dentro del rango que informa.');
      console.error(`[ml] campaña ${campaign.type} ${campaign.promotion} en ${externalId} rechazada: ${e instanceof MercadoLibreRequestError ? `${e.status} ${JSON.stringify(e.body).slice(0, 600)}` : e instanceof Error ? e.message : e}`);
      throw rejectedAs('la campaña', e, { raw: true });
    }
  },

  async leaveCampaign(accessToken, externalId, ref) {
    const campaign = readRef(ref);
    if (!campaign) throw new PublishError('No se reconoce la campaña: volvé a consultar las promociones.');
    const query = new URLSearchParams({
      promotion_type: campaign.type,
      promotion_id: campaign.promotion,
      ...(campaign.offer && NEEDS_OFFER.has(campaign.type) ? { offer_id: campaign.offer } : {}),
      app_version: 'v2',
    });
    try {
      await mlSend('DELETE', `/seller-promotions/items/${encodeURIComponent(externalId)}?${query}`, accessToken);
    } catch (e) {
      // Ya no estaba: no hay nada que sacar.
      if (e instanceof MercadoLibreRequestError && (e.status === 404 || /no offers? found/i.test(detailOf(e.body) ?? ''))) return;
      throw rejectedAs('la salida de la campaña', e);
    }
  },

  async updateAttributes(accessToken, externalId, attributes) {
    // Mercado Libre cambia los que llegan y deja los demás como están.
    await send('PUT', `/items/${encodeURIComponent(externalId)}`, accessToken, { attributes: attributes.map(attributeBody) });
  },

  async update(accessToken, externalId, field, value, opts) {
    const id = encodeURIComponent(externalId);
    if (field === 'title') {
      // En una familia el título lo arma Mercado Libre con el nombre de la familia y la medida: se cambia el nombre.
      await send('PUT', `/items/${id}`, accessToken, opts?.family ? { family_name: value } : { title: value });
      return;
    }
    // La descripción: se reemplaza; si la publicación no tenía, se crea.
    try {
      await mlSend('PUT', `/items/${id}/description?api_version=2`, accessToken, { plain_text: value });
    } catch (e) {
      if (!(e instanceof MercadoLibreRequestError) || e.status !== 404) throw translated(e);
      await send('POST', `/items/${id}/description`, accessToken, { plain_text: value });
    }
  },
};
