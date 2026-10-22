import { MercadoLibreRequestError, mlGet, mlSend } from './http';
import { variationsOf } from './listings';
import { measureText, variantKey } from '@/domain/media';
import { PublishError, type ChannelAttributeUpdate, type ChannelPicture, type ChannelPictureLayout, type ChannelPublisher } from '../publish-types';

// Subir a Mercado Libre el título y la descripción de una publicación propia.
// Si Mercado Libre no acepta el cambio, se explica por qué en castellano.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

// Los motivos que más aparecen, por el código que manda Mercado Libre.
const KNOWN: [RegExp, string][] = [
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

/** El motivo, en castellano, de por qué Mercado Libre no aceptó el cambio. */
export function rejectionMessage(status: number, body: unknown): string {
  if (status === 403) return 'La aplicación de Mercado Libre no tiene permiso para modificar publicaciones. Revisá que tenga el permiso de escritura y volvé a conectar la tienda.';
  if (status === 404) return 'Mercado Libre no encontró la publicación.';
  const causes = isObj(body) && Array.isArray(body.cause) ? body.cause.filter(isObj) : [];
  const codes = [...causes.map((c) => `${c.code ?? ''} ${c.message ?? ''}`), isObj(body) ? `${body.error ?? ''} ${body.message ?? ''}` : ''].join(' ');
  const detail = causes.map((c) => (typeof c.message === 'string' ? c.message : null)).find(Boolean) ?? (isObj(body) && typeof body.message === 'string' ? body.message : null);
  for (const [pattern, message] of KNOWN) {
    if (!pattern.test(codes)) continue;
    // En los datos de catálogo y en las fotos, el detalle dice cuál fue.
    return /attribute|picture/i.test(pattern.source) && detail ? `${message.slice(0, -1)}: ${detail}` : message;
  }
  return detail ? `Mercado Libre no lo aceptó: ${detail}` : `Mercado Libre no lo aceptó (código ${status}).`;
}

// Una llave vencida o "demasiados pedidos" siguen como error de conexión.
function translated(e: unknown): unknown {
  return e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429 ? new PublishError(rejectionMessage(e.status, e.body)) : e;
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
function variantOf(layout: ChannelPictureLayout, v: { sku: string | null; measure: string | null }) {
  const key = variantKey(v);
  const exact = key ? layout.variants.find((x) => variantKey(x) === key) : undefined;
  if (exact) return exact;
  const bySku = layout.variants.filter((x) => sameSku(x.sku, v.sku));
  if (bySku.length === 1) return bySku[0];
  const byMeasure = (bySku.length > 1 ? bySku : layout.variants).filter((x) => sameMeasure(x.measure, v.measure));
  return byMeasure.length === 1 ? byMeasure[0] : undefined;
}

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

const LISTING_TYPE_ID: Record<string, string> = { clasica: 'gold_special', premium: 'gold_pro' };

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
    const pictures = await picturesBody(accessToken, l.pictures);
    const attributes = [...l.attributes.map(attributeBody), ...(l.sku ? [{ id: 'SELLER_SKU', value_name: l.sku }] : [])];
    const created = await send('POST', '/items', accessToken, {
      title: l.title,
      category_id: l.categoryId,
      price: l.price,
      currency_id: l.currency,
      available_quantity: l.quantity,
      buying_mode: 'buy_it_now',
      listing_type_id: LISTING_TYPE_ID[l.listingType] ?? 'gold_special',
      condition: 'new',
      pictures,
      attributes,
      ...(l.warranty
        ? { sale_terms: [{ id: 'WARRANTY_TYPE', value_name: 'Garantía del vendedor' }, { id: 'WARRANTY_TIME', value_name: l.warranty }] }
        : {}),
    });
    const id = isObj(created) && typeof created.id === 'string' ? created.id : null;
    if (!id) throw new PublishError('Mercado Libre no devolvió el código de la publicación nueva.');
    const warnings: string[] = [];
    if (l.description) {
      try {
        await send('POST', `/items/${encodeURIComponent(id)}/description`, accessToken, { plain_text: l.description });
      } catch (e) {
        if (!(e instanceof PublishError)) throw e;
        warnings.push(`La publicación se creó, pero la descripción no: ${e.message} Queda en el borrador para subirla.`);
      }
    }
    return {
      externalId: id,
      url: isObj(created) && typeof created.permalink === 'string' ? created.permalink : null,
      pictureIds: pictureIdsOf(created),
      warnings,
    };
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
              const own = (variantOf(layout, v)?.pictures ?? layout.general).filter((i) => i >= 0 && i < body.length);
              // Cada variante necesita al menos una foto.
              return { id: v.id, picture_ids: (own.length > 0 ? own : everything).map((i) => ref(body[i])) };
            }),
          }
        : {}),
    });
    return pictureIdsOf(res) ?? (body.every((p) => 'id' in p) ? body.map((p) => (p as { id: string }).id) : null);
  },

  async updateAttributes(accessToken, externalId, attributes) {
    // Mercado Libre cambia los que llegan y deja los demás como están.
    await send('PUT', `/items/${encodeURIComponent(externalId)}`, accessToken, { attributes: attributes.map(attributeBody) });
  },

  async update(accessToken, externalId, field, value) {
    const id = encodeURIComponent(externalId);
    if (field === 'title') {
      await send('PUT', `/items/${id}`, accessToken, { title: value });
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
