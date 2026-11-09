import type {
  CatalogField,
  CatalogFilter,
  CatalogValue,
  ChannelCompatibilities,
  ChannelCompatibilityRead,
  ChannelVehicle,
  CompatibilityWriteResult,
} from '../compatibilities-types';
import { MercadoLibreRequestError, mlGet, mlQuery, mlSend } from './http';

// Las compatibilidades de autopartes en Mercado Libre, según su documentación
// (docs/ml-docs/guia-para-productos/categorizacion/051 y 052):
// - Lo cargado se lee con GET /items/{id}/compatibilities y, en el modelo de
//   producto de usuario, con GET /user-products/{id}/compatibilities.
// - Desde el 15/07/2026, las que cargó Mercado Libre (source CATALOGO) llegan
//   solo con la marca y cuántas son, y no se pueden borrar por la API.
// - El catálogo de vehículos se recorre con top_values, como los filtros de la
//   pantalla: marca, modelo, año, versión, motor, combustible y potencia. La
//   búsqueda de vehículos uno por uno (products_search/chunks) ya no existe.
// - Se agregan y se borran con PUT: create con grupos de vehículos
//   (products_families, con creation_source) y delete con los vehículos
//   (products). Hasta 10 grupos y 200 vehículos por pedido, y 100 pedidos por
//   minuto. Si la publicación tiene producto de usuario, va a
//   /user-products/{id}/compatibilities con domain_id y category_id (en la
//   publicación lo rechaza); si no, a /items/{id}/compatibilities. Las opciones
//   de venta de un mismo producto comparten lo cargado: alcanza con una.

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

// Cuántos grupos de vehículos van por pedido: Mercado Libre acepta 10 grupos y
// 200 vehículos, y un grupo (un modelo, un año, un motor) suele tener hasta 20.
const GROUPS_PER_CALL = 5;
// Cuántos vehículos se borran por pedido.
const REMOVE_PER_CALL = 200;

const chunks = <T>(list: T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** Un grupo de vehículos como lo pide Mercado Libre para crearlo: varias versiones van juntas en value_ids. */
export function familyBody(site: string, filters: CatalogFilter[]) {
  const byField = new Map<CatalogField, string[]>();
  for (const f of filters) byField.set(f.field, [...(byField.get(f.field) ?? []), f.id]);
  return {
    domain_id: vehicleDomain(site),
    creation_source: 'DEFAULT',
    attributes: [...byField].map(([field, ids]) =>
      ids.length === 1 ? { id: attributeOf(site, field), value_id: ids[0] } : { id: attributeOf(site, field), value_ids: ids },
    ),
  };
}

/** Un rechazo que dice qué no aceptó: los demás errores (llave, demasiados pedidos, falla del canal) siguen como están. */
const rejected = (e: unknown): e is MercadoLibreRequestError =>
  e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429 && !e.changeUnknown;

/** Por qué Mercado Libre no aceptó las compatibilidades, con lo que respondió. */
export function writeRejection(e: MercadoLibreRequestError): string {
  if (e.status === 403) return 'Mercado Libre no deja cambiar las compatibilidades de esta publicación con esta cuenta.';
  if (e.status === 404) return 'Mercado Libre no encontró la publicación o alguno de los vehículos.';
  const body = e.body;
  const causes = isObj(body) && Array.isArray(body.cause) ? body.cause.filter(isObj).filter((c) => c.type !== 'warning') : [];
  const detail = causes.map((c) => str(c.message)).find(Boolean) ?? (isObj(body) ? str(body.message) : null);
  const raw = body !== null && body !== undefined && JSON.stringify(body) !== '{}' ? ` Respuesta completa: ${JSON.stringify(body).slice(0, 600)}` : '';
  return detail
    ? `Mercado Libre no aceptó las compatibilidades: ${detail.replace(/\.+$/, '')}.${raw}`
    : `Mercado Libre no aceptó las compatibilidades (código ${e.status}).${raw}`;
}

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
    const productList = (productId: string) =>
      readList(`/user-products/${encodeURIComponent(productId)}/compatibilities?main_domain_id=${encodeURIComponent(vehicleDomain(site))}&extended=true`, accessToken);
    // Lo que no depende de otra respuesta se pide a la vez.
    const [item, listing, known] = await Promise.all([
      mlGet(`/items/${id}?attributes=id,tags,domain_id,category_id,user_product_id`, accessToken),
      readList(`/items/${id}/compatibilities?extended=true`, accessToken),
      ref.channelProductId ? productList(ref.channelProductId) : Promise.resolve(null),
    ]);
    const tags = isObj(item) && Array.isArray(item.tags) ? item.tags : [];
    const productId = ref.channelProductId ?? (isObj(item) ? str(item.user_product_id) : null);
    const product = known ?? (productId ? await productList(productId) : null);
    const out: ChannelCompatibilityRead = {
      listing: listing.list ?? [],
      product: product?.list ?? null,
      needed: tags.includes('incomplete_compatibilities'),
      suggested: tags.includes('pending_compatibilities'),
      productId,
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
      // Con los mismos datos con que se crea el grupo: varias versiones van juntas en value_ids.
      const body = await mlQuery('/catalog_compatibilities/products_search/count_family_products', accessToken, {
        domain_id: vehicleDomain(site),
        attributes: familyBody(site, filters).attributes,
      });
      return isObj(body) && typeof body.count === 'number' ? body.count : null;
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status !== 401 && e.status !== 429) return null;
      throw e;
    }
  },

  async write(accessToken, { externalId }, change) {
    const site = externalId.slice(0, 3).toUpperCase();
    // En el modelo de producto de usuario, lo cargado vive en el producto: Mercado
    // Libre rechaza el cambio en la publicación ("Use the corresponding User
    // Product resources") y pide mandarlo al producto, con el dominio y la categoría.
    const item = await mlGet(`/items/${encodeURIComponent(externalId)}?attributes=id,category_id,user_product_id`, accessToken);
    const productId = isObj(item) ? str(item.user_product_id) : null;
    const categoryId = isObj(item) ? str(item.category_id) : null;
    const path = productId ? `/user-products/${encodeURIComponent(productId)}/compatibilities` : `/items/${encodeURIComponent(externalId)}/compatibilities`;
    const top = productId ? { domain_id: vehicleDomain(site), ...(categoryId ? { category_id: categoryId } : {}) } : {};
    const put = (body: object) => mlSend('PUT', path, accessToken, { ...top, ...body });
    const out: CompatibilityWriteResult = { rejectedGroups: [], removeRejected: null };

    for (const ids of chunks(change.remove, REMOVE_PER_CALL)) {
      try {
        await put({ delete: { products: ids.map((id) => ({ id })) } });
      } catch (e) {
        if (!rejected(e)) throw e;
        out.removeRejected ??= writeRejection(e);
      }
    }
    const groups = change.add.map((filters, index) => ({ index, body: familyBody(site, filters) }));
    for (const part of chunks(groups, GROUPS_PER_CALL)) {
      try {
        await put({ create: { products_families: part.map((g) => g.body) } });
      } catch (e) {
        if (!rejected(e)) throw e;
        // Mercado Libre rechaza el pedido entero: se prueba cada grupo solo, para saber cuál no acepta.
        if (part.length === 1) {
          out.rejectedGroups.push({ index: part[0].index, message: writeRejection(e) });
          continue;
        }
        for (const g of part) {
          try {
            await put({ create: { products_families: [g.body] } });
          } catch (e2) {
            if (!rejected(e2)) throw e2;
            out.rejectedGroups.push({ index: g.index, message: writeRejection(e2) });
          }
        }
      }
    }
    return out;
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
