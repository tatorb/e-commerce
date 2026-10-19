import { BOOLEAN_OPTIONS, type CatalogFieldType } from '@/domain/catalog-data';
import type { CatalogData } from '@/lib/catalog-data';

// Los datos de catálogo como los ve Claude: la categoría, lo que sale de la
// ficha y cada campo con su tipo, sus opciones y lo cargado.

const TYPE_LABEL: Record<CatalogFieldType, string> = {
  text: 'texto',
  list: 'opción',
  boolean: 'sí o no',
  number: 'número',
  number_unit: 'número con unidad',
};

const SOURCE_LABEL = { family: 'por la familia', manual: 'a mano' } as const;

export function catalogForClaude(data: CatalogData | null) {
  if (!data) return null;
  const name = (c: { id: string; name: string }) => `${c.name} (${c.id})`;
  return {
    canal: data.channelName,
    categoria: data.category ? name(data.category) : null,
    categoria_elegida: data.source ? SOURCE_LABEL[data.source] : 'falta elegirla',
    ...(data.category ? {} : { categorias_para_elegir: data.categories.map(name) }),
    de_la_ficha: data.fromProduct.map(({ field, value }) => ({ nombre: field.label, valor: value })),
    campos: data.fields.map((f) => ({
      campo: f.id,
      nombre: f.label,
      tipo: TYPE_LABEL[f.type],
      ...(f.type === 'list' ? { opciones: f.options } : {}),
      ...(f.type === 'boolean' ? { opciones: BOOLEAN_OPTIONS } : {}),
      ...(f.type === 'text' && f.options?.length ? { sugerencias: f.options } : {}),
      ...(f.units ? { unidades: f.units } : {}),
      ...(f.multiple ? { varios_valores: true } : {}),
      ...(f.required ? { obligatorio: true } : {}),
      valor: data.values[f.id] ?? null,
    })),
  };
}
