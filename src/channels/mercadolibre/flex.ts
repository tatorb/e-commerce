import { ConnectError } from '../connect-types';
import { FlexError, type ChannelFlex, type FlexDay, type FlexRange, type FlexService, type FlexZone } from '../flex-types';
import { MercadoLibreRequestError, mlGet, mlSend } from './http';

// Envíos Flex en Mercado Libre (developers.mercadolibre.com.ar/envios-flex):
//   GET|POST|DELETE /flex/sites/{site}/items/{item}/v2 → si la publicación lo
//   ofrece, prenderlo y apagarlo.
//   GET /flex/sites/{site}/users/{user}/subscriptions/v1 → los servicios Flex
//   de la cuenta; con cada service_id, sus zonas, rangos de entrega y feriados.
// Mercado Libre pide que prender Flex sea una decisión del vendedor: la app
// solo lo hace cuando una persona lo confirma.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** El sitio de la publicación: las tres letras del código, como MLA. */
export const siteOf = (externalId: string) => (/^[A-Z]{3}/.exec(externalId.toUpperCase())?.[0] ?? 'MLA');

const itemPath = (externalId: string) => `/flex/sites/${siteOf(externalId)}/items/${encodeURIComponent(externalId)}/v2`;

/** Lo que respondió Mercado Libre, en palabras, para el que está prendiendo o apagando. */
export function flexRejection(status: number, on: boolean): string {
  if (status === 403) {
    return on
      ? 'Mercado Libre no deja ofrecer Envíos Flex en esta publicación. Revisá que la cuenta tenga Flex activo, que la publicación tenga Mercado Envíos y que su categoría permita Flex.'
      : 'Mercado Libre dice que esta publicación no ofrece Envíos Flex.';
  }
  if (status === 404) return 'Mercado Libre no tiene Envíos Flex para esta publicación: el país no lo tiene o la publicación no existe.';
  if (status === 409) return 'Mercado Libre está cambiando esta publicación. Probá de nuevo en un minuto.';
  return `Mercado Libre no aceptó el cambio (código ${status}).`;
}

function translate(e: unknown, on: boolean): unknown {
  if (e instanceof MercadoLibreRequestError && !e.changeUnknown && e.status !== 401 && e.status !== 429) return new FlexError(flexRejection(e.status, on));
  if (e instanceof MercadoLibreRequestError && e.changeUnknown) return new FlexError(e.message);
  return e;
}

const DAYS: FlexDay[] = ['week', 'saturday', 'sunday'];

function cutoffOf(v: unknown): Partial<Record<FlexDay, number>> | null {
  if (!isObj(v)) return null;
  const out: Partial<Record<FlexDay, number>> = {};
  for (const d of DAYS) {
    const n = num(v[d]);
    if (n !== null) out[d] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseZones(body: unknown): FlexZone[] {
  if (!isObj(body)) return [];
  return arr(body.zones)
    .filter(isObj)
    .map((z) => ({ id: str(z.id) ?? '', cutoff: cutoffOf(z.cutoff) }))
    .filter((z) => z.id);
}

export function parseRanges(body: unknown): { window: string | null; ranges: FlexRange[]; extended: boolean; moderated: boolean } {
  if (!isObj(body)) return { window: null, ranges: [], extended: false, moderated: false };
  const byDay = isObj(body.delivery_ranges) ? body.delivery_ranges : {};
  const ranges: FlexRange[] = [];
  for (const day of DAYS) {
    for (const r of arr(byDay[day]).filter(isObj)) {
      ranges.push({ day, from: num(r.from), to: num(r.to), cutoff: num(r.cutoff), capacity: num(r.capacity) });
    }
  }
  return { window: str(body.delivery_window), ranges, extended: body.has_extended_range === true, moderated: body.is_downgraded === true };
}

export function parseHolidays(body: unknown): FlexService['holidays'] {
  if (!isObj(body)) return [];
  return arr(body.holidays)
    .filter(isObj)
    .map((h) => ({ date: str(h.date) ?? '', description: str(h.description) ?? '', selected: h.selected === true }))
    .filter((h) => h.date);
}

/** Una parte opcional: si falla, se sigue con las demás y se avisa. */
async function part<T>(read: () => Promise<T>, what: string, warnings: string[]): Promise<T | null> {
  try {
    return await read();
  } catch (e) {
    if (e instanceof ConnectError && (e.reauth || e.busy)) throw e;
    warnings.push(`No se pudo leer ${what}.`);
    return null;
  }
}

export const mercadolibreFlex: ChannelFlex = {
  async hasFlex(accessToken, externalId) {
    const body = await mlGet(itemPath(externalId), accessToken);
    return isObj(body) && body.has_flex === true;
  },

  async setFlex(accessToken, externalId, on) {
    try {
      if (on) await mlSend('POST', itemPath(externalId), accessToken);
      else await mlSend('DELETE', itemPath(externalId), accessToken);
    } catch (e) {
      // Ya estaba prendido: es lo que se pidió.
      if (on && e instanceof MercadoLibreRequestError && e.status === 400 && JSON.stringify(e.body ?? '').toLowerCase().includes('already')) return;
      throw translate(e, on);
    }
  },

  async config(accessToken, userId, site) {
    const base = `/flex/sites/${encodeURIComponent(site)}/users/${encodeURIComponent(userId)}`;
    let subs: unknown;
    try {
      subs = await mlGet(`${base}/subscriptions/v1`, accessToken);
    } catch (e) {
      // Sin Flex en la cuenta, Mercado Libre no tiene suscripciones.
      if (e instanceof MercadoLibreRequestError && (e.status === 404 || e.status === 403)) return [];
      throw e;
    }
    const out: FlexService[] = [];
    for (const s of arr(subs).filter(isObj)) {
      if (str(s.mode) !== 'FLEX') continue;
      const serviceId = str(s.service_id);
      if (!serviceId) continue;
      const set = isObj(s.configuration) && isObj(s.configuration.set) ? s.configuration.set : {};
      const coverage = isObj(set.coverage) ? str(set.coverage.type) : null;
      const origin = isObj(s.origin) ? [str(s.origin.address_line), isObj(s.origin.city) ? str(s.origin.city.name) : null].filter(Boolean).join(', ') || null : null;
      const svc = `${base}/services/${encodeURIComponent(serviceId)}/configurations`;
      const warnings: string[] = [];
      const zones = coverage === 'zone' ? await part(() => mlGet(`${svc}/coverage/zones/v1`, accessToken).then(parseZones), 'las zonas', warnings) : null;
      const ranges = await part(() => mlGet(`${svc}/delivery-ranges/v1`, accessToken).then(parseRanges), 'los rangos de entrega', warnings);
      const holidays = await part(() => mlGet(`${svc}/holidays/v1`, accessToken).then(parseHolidays), 'los feriados', warnings);
      out.push({
        serviceId,
        status: str(s.status) ?? '',
        origin,
        coverage,
        zones,
        deliveryWindow: ranges?.window ?? null,
        ranges: ranges?.ranges ?? [],
        extendedRange: ranges?.extended ?? false,
        moderated: ranges?.moderated ?? false,
        holidays: holidays ?? [],
        warnings,
      });
    }
    return out;
  },
};
