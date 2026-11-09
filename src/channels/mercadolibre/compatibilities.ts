import type {
  CatalogField,
  CatalogFilter,
  CatalogValue,
  ChannelCompatibilities,
  ChannelCompatibilityRead,
  ChannelVehicle,
} from '../compatibilities-types';
import { MercadoLibreRequestError, mlGet, mlQuery } from './http';

// Las compatibilidades de autopartes en Mercado Libre, según su documentación
// (docs/ml-docs/guia-para-productos/categorizacion/051 y 052):
// - Lo cargado se lee con GET /items/{id}/compatibilities y, en el modelo de
//   producto de usuario, con GET /user-products/{id}/compatibilities.
// - Desde el 15/07/2026, las que cargó Mercado Libre (source CATALOGO) llegan
//   solo con la marca y cuántas son, y no se pueden borrar por la API.
// - El catálogo de vehículos se recorre con top_values, como los filtros de la
//   pantalla: marca, modelo, año, versión, motor, combustible y potencia. La
//   búsqueda de vehículos uno por uno (products_search/chunks) ya no existe.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);

// El catálogo de vehículos de cada sitio.
const VEHICLE_DOMAIN: Record<string, string> = {
  MLA: 'MLA-CARS_AND_VANS',
  MLB: 'MLB-CARS_AND_VANS',
  MLU: 'MLU-CARS_AND_VANS',
  MLM: 'MLM-CARS_AND_VANS_FOR_COMPATIBILITIES',
  MLC: 'MLC-CARS_AND_VANS_FOR_COMPATIBILITIES',
  MCO: 'MCO-CARS_AND_VANS_FOR_COMPATIBILITIES',
};

export const vehicleDomain = (site: string) => VEHICLE_DOMAIN[site.toUpperCase()] ?? VEHICLE_DOMAIN.MLA;

// Cada lista, con el nombre del dato en el catálogo de autos y camionetas de Argentina, Brasil y Uruguay.
const ATTRIBUTE: Record<CatalogField, string> = {
  brand: 'BRAND',
  model: 'MODEL',
  year: 'VEHICLE_YEAR',
  version: 'SHORT_VERSION',
  engine: 'ENGINE',
  fuel: 'FUEL_TYPE',
  power: 'POWER',
};

// En México, Chile y Colombia algunos datos se llaman distinto.
const ATTRIBUTE_FOR_COMPATIBILITIES: Partial<Record<CatalogField, string>> = {
  model: 'CAR_AND_VAN_MODEL',
  year: 'YEAR',
  version: 'CAR_AND_VAN_SUBMODEL',
  engine: 'CAR_AND_VAN_ENGINE',
};

export function attributeOf(site: string, field: CatalogField): string {
  const forCompat = vehicleDomain(site).endsWith('_FOR_COMPATIBILITIES');
  return (forCompat ? ATTRIBUTE_FOR_COMPATIBILITIES[field] : undefined) ?? ATTRIBUTE[field];
}

const knownBody = (site: string, known: CatalogFilter[]) => known.map((k) => ({ id: attributeOf(site, k.field), value_id: k.id }));

/** Una compatibilidad como la manda Mercado Libre. */
export function parseVehicle(raw: unknown): ChannelVehicle | null {
  if (!isObj(raw)) return null;
  const name = str(raw.catalog_product_name) ?? str(raw.name);
  if (!name) return null;
  const id = str(raw.id);
  const vehicleId = str(raw.catalog_product_id);
  // Las que cargó Mercado Libre llegan sin código y con el total de la marca.
  const byChannel = raw.source === 'CATALOGO' || (id === null && vehicleId === null);
  const total = typeof raw.total === 'number' ? raw.total : null;
  return { id, vehicleId, name, byChannel, total, note: str(raw.note) };
}

/** La lista de compatibilidades de una respuesta: { products: [...] }, o la lista sola. */
export function parseVehicles(body: unknown): ChannelVehicle[] {
  const list = Array.isArray(body) ? body : isObj(body) && Array.isArray(body.products) ? body.products : [];
  return list.map(parseVehicle).filter((v): v is ChannelVehicle => v !== null);
}

/** Los valores de una lista del catálogo: [{ id, name, metric }]. */
export function parseValues(body: unknown): CatalogValue[] {
  const list = Array.isArray(body) ? body : isObj(body) && Array.isArray(body.values) ? body.values : [];
  const out: CatalogValue[] = [];
  for (const v of list) {
    if (!isObj(v)) continue;
    const id = str(v.id);
    const name = str(v.name);
    if (id && name && !out.some((x) => x.id === id)) out.push({ id, name });
  }
  return out;
}

// Lo que se muestra de una respuesta para revisarla: no hace falta todo.
const clip = (v: unknown) => {
  const text = JSON.stringify(v ?? null);
  return text.length <= 2500 ? v : `${text.slice(0, 2500)}…`;
};

/** Lee una lista de compatibilidades: si no tiene ninguna, Mercado Libre puede responder que no la encuentra. */
async function readList(path: string, token: string): Promise<{ list: ChannelVehicle[] | null; body: unknown }> {
  try {
    const body = await mlGet(path, token);
    return { list: parseVehicles(body), body };
  } catch (e) {
    if (e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429) {
      return { list: e.status === 404 ? [] : null, body: { error: e.status, respuesta: e.body } };
    }
    throw e;
  }
}

export const mercadolibreCompatibilities: ChannelCompatibilities = {
  async read(accessToken, ref, opts) {
    const id = encodeURIComponent(ref.externalId);
    const site = ref.externalId.slice(0, 3).toUpperCase();
    const item = await mlGet(`/items/${id}?attributes=id,tags,domain_id,category_id,user_product_id`, accessToken);
    const tags = isObj(item) && Array.isArray(item.tags) ? item.tags : [];
    const productId = ref.channelProductId ?? (isObj(item) ? str(item.user_product_id) : null);
    const listing = await readList(`/items/${id}/compatibilities?extended=true`, accessToken);
    const product = productId
      ? await readList(
          `/user-products/${encodeURIComponent(productId)}/compatibilities?main_domain_id=${encodeURIComponent(vehicleDomain(site))}&extended=true`,
          accessToken,
        )
      : null;
    const out: ChannelCompatibilityRead = {
      listing: listing.list ?? [],
      product: product?.list ?? null,
      needed: tags.includes('incomplete_compatibilities'),
      suggested: tags.includes('pending_compatibilities'),
    };
    if (opts?.raw) {
      out.raw = {
        publicacion: clip(item),
        compatibilidades_de_la_publicacion: clip(listing.body),
        ...(product ? { compatibilidades_del_producto: clip(product.body), producto: productId } : {}),
      };
    }
    return out;
  },

  async values(accessToken, { site, field, known }) {
    const path = `/catalog_domains/${encodeURIComponent(vehicleDomain(site))}/attributes/${attributeOf(site, field)}/top_values`;
    const body = known.length > 0 ? { known_attributes: knownBody(site, known) } : undefined;
    try {
      return parseValues(await mlQuery(`${path}?limit=1000`, accessToken, body));
    } catch (e) {
      // Un dato que el catálogo no tiene, o un pedido que no entiende: no hay lista.
      if (e instanceof MercadoLibreRequestError && [400, 404].includes(e.status)) return null;
      throw e;
    }
  },

  async count(accessToken, { site, filters }) {
    try {
      const body = await mlQuery('/catalog_compatibilities/products_search/count_family_products', accessToken, {
        domain_id: vehicleDomain(site),
        attributes: knownBody(site, filters),
      });
      return isObj(body) && typeof body.count === 'number' ? body.count : null;
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429) return null;
      throw e;
    }
  },

  async probeSearch(accessToken, { site, filters }) {
    try {
      return clip(
        await mlQuery('/products/search', accessToken, {
          site_id: site,
          domain_id: vehicleDomain(site),
          status: 'active',
          attributes: knownBody(site, filters),
        }),
      );
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429) return { error: e.status, respuesta: clip(e.body) };
      throw e;
    }
  },
};
