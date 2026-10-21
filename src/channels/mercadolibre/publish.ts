import { MercadoLibreRequestError, mlSend } from './http';
import { PublishError, type ChannelAttributeUpdate, type ChannelPublisher } from '../publish-types';

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
    // En los datos de catálogo, el detalle dice cuál fue.
    return /attribute/i.test(pattern.source) && detail ? `${message.slice(0, -1)}: ${detail}` : message;
  }
  return detail ? `Mercado Libre no lo aceptó: ${detail}` : `Mercado Libre no lo aceptó (código ${status}).`;
}

// Una llave vencida o "demasiados pedidos" siguen como error de conexión.
function translated(e: unknown): unknown {
  return e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429 ? new PublishError(rejectionMessage(e.status, e.body)) : e;
}

async function send(method: 'PUT' | 'POST', path: string, token: string, body: unknown) {
  try {
    await mlSend(method, path, token, body);
  } catch (e) {
    throw translated(e);
  }
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
  async updateAttributes(accessToken, externalId, attributes) {
    // Mercado Libre cambia los que llegan y deja los demás como están.
    await send('PUT', `/items/${encodeURIComponent(externalId)}`, accessToken, { attributes: attributes.map(attributeBody) });
  },

  async update(accessToken, externalId, field, value) {
    const id = encodeURIComponent(externalId);
    if (field === 'title') return send('PUT', `/items/${id}`, accessToken, { title: value });
    // La descripción: se reemplaza; si la publicación no tenía, se crea.
    try {
      await mlSend('PUT', `/items/${id}/description?api_version=2`, accessToken, { plain_text: value });
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status === 404) return send('POST', `/items/${id}/description`, accessToken, { plain_text: value });
      throw translated(e);
    }
  },
};
