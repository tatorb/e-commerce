import type { CatalogCategory, CatalogField, CatalogFieldType, ProductSourceField } from '@/domain/catalog-data';
import { PACKAGE, TAXES } from './categories';

// Cualquier categoría de Mercado Libre Argentina, leída de su API de
// categorías (/categories/{id} y /categories/{id}/attributes), con los mismos
// criterios que la lista fija para los campos que el formulario muestra para
// cargar a mano. Los demás que Mercado Libre acepta (los que su formulario
// esconde o deja en "otros", como el diámetro del disco de un kit de embrague)
// van aparte, marcados como extra. Marca, número de pieza y origen salen de la
// ficha; el paquete y los impuestos van siempre.

const FROM_PRODUCT: Record<string, ProductSourceField> = { BRAND: 'brand', PART_NUMBER: 'partNumber', ORIGIN: 'origin' };

// Los que no se cargan en el formulario de la app: los pone el canal, otra parte de la app o van siempre.
const SKIP = new Set([
  'ITEM_CONDITION',
  'SELLER_SKU',
  'GTIN',
  'EMPTY_GTIN_REASON',
  'VEHICLE_TYPE',
  ...PACKAGE.map((f) => f.id),
  ...TAXES.map((f) => f.id),
]);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Si el código parece de una categoría de Mercado Libre Argentina, como MLA458790. */
export const isMlaCategoryId = (id: string) => /^MLA\d{3,}$/i.test(id.trim());

/** Los campos del formulario, de la respuesta de /categories/{id}/attributes. */
export function fieldsFromAttributes(body: unknown): CatalogField[] {
  if (!Array.isArray(body)) return [];
  const out: CatalogField[] = [];
  for (const a of body) {
    if (!isObj(a)) continue;
    const id = str(a.id);
    const label = str(a.name);
    if (!id || !label || SKIP.has(id)) continue;
    const tags = isObj(a.tags) ? a.tags : {};
    // Los de solo lectura, los fijos y los de las variantes no se cargan. Los
    // escondidos y los de "otros" sí se aceptan: van aparte.
    if (tags.read_only || tags.fixed || tags.variation_attribute) continue;
    const extra = Boolean(tags.hidden || tags.others);
    const fromProduct = FROM_PRODUCT[id];
    const values = Array.isArray(a.values) ? a.values.flatMap((v) => (isObj(v) && str(v.name) ? [str(v.name)!] : [])) : [];
    const units = Array.isArray(a.allowed_units) ? a.allowed_units.flatMap((u) => (isObj(u) && str(u.name ?? u.id) ? [str(u.name ?? u.id)!] : [])) : [];
    const valueType = str(a.value_type);
    const type: CatalogFieldType = fromProduct
      ? 'text'
      : valueType === 'boolean'
        ? 'boolean'
        : valueType === 'number'
          ? 'number'
          : valueType === 'number_unit'
            ? 'number_unit'
            : valueType === 'list'
              ? 'list'
              : 'text';
    const field: CatalogField = { id, label, type };
    if (!fromProduct && (type === 'list' || type === 'text') && values.length > 0) field.options = values;
    if (type === 'number_unit' && units.length > 0) {
      field.units = units;
      field.defaultUnit = str(a.default_unit) ?? units[0];
    }
    if (tags.multivalued && type === 'text') field.multiple = true;
    if (tags.required || tags.catalog_required) field.required = true;
    if (fromProduct) field.fromProduct = fromProduct;
    if (extra && !fromProduct && !field.required) field.extra = true;
    // Una lista sin opciones no se puede cargar: queda como texto.
    if (field.type === 'list' && !field.options) field.type = 'text';
    out.push(field);
  }
  // Primero los de la ficha, como en la lista fija; al final los que el formulario no muestra.
  out.sort((x, y) => Number(Boolean(y.fromProduct)) - Number(Boolean(x.fromProduct)) || Number(Boolean(x.extra)) - Number(Boolean(y.extra)));
  return [...out, ...PACKAGE, ...TAXES];
}

export type RemoteCategory = CatalogCategory & { path: string | null; leaf: boolean };

/** La categoría con su nombre, su camino y si se puede publicar en ella, de /categories/{id} y sus atributos. */
export function categoryFromApi(id: string, info: unknown, attributes: unknown): RemoteCategory | null {
  if (!isObj(info) || !str(info.name)) return null;
  const path = Array.isArray(info.path_from_root)
    ? info.path_from_root
        .flatMap((p) => (isObj(p) && str(p.name) ? [str(p.name)!] : []))
        .join(' > ')
    : null;
  const children = Array.isArray(info.children_categories) ? info.children_categories.length : 0;
  const settings = isObj(info.settings) ? info.settings : {};
  const leaf = children === 0 && settings.listing_allowed !== false;
  return { id: id.toUpperCase(), name: str(info.name)!, path: path || null, leaf, fields: fieldsFromAttributes(attributes) };
}
