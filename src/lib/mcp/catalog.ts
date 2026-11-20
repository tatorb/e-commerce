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

const SOURCE_LABEL = { family: 'por el tipo de producto', manual: 'a mano' } as const;

export function catalogForClaude(data: CatalogData | null) {
  if (!data) return null;
  const name = (c: { id: string; name: string }) => `${c.name} (${c.id})`;
  return {
    canal: data.channelName,
    categoria: data.category ? name(data.category) : null,
    categoria_elegida: data.source ? SOURCE_LABEL[data.source] : 'falta elegirla',
    categoria_en_el_canal: data.inChannel ? name(data.inChannel) : 'todavía no se leyó',
    ...(data.productInChannel.length > 1
      ? { categorias_del_producto_en_el_canal: data.productInChannel.map((g) => ({ categoria: `${g.name} (${g.categoryId})`, publicaciones_activas: g.externalIds })) }
      : {}),
    ...(data.categoryWarning ? { aviso_de_categoria: data.categoryWarning } : {}),
    ...(data.categoryAlert
      ? {
          alerta_de_categoria: {
            que_paso: data.categoryAlert.text,
            ...(data.categoryAlert.changedAt ? { cuando: data.categoryAlert.changedAt.toISOString().slice(0, 10) } : {}),
            producto_en_dos_categorias: data.categoryAlert.split,
            ...(data.categoryAlert.split ? { como_se_resuelve: 'Si el producto ya no acepta opciones nuevas, recreate_product_in_category lo crea de nuevo en la categoría que va y finaliza las viejas al final.' } : {}),
          },
        }
      : {}),
    // La acción directa para resolver el aviso: tomar en la app la categoría del canal.
    ...(data.categoryWarning && data.inChannel && data.productInChannel.length <= 1 && data.inChannel.id !== data.category?.id
      ? {
          usar_la_del_canal: {
            herramienta: 'save_catalog_data',
            categoria: data.inChannel.id,
            que_hace: `Pone en la app la categoría de ${data.channelName}, ${name(data.inChannel)}, en toda la familia, con los campos de su formulario. No cambia nada en ${data.channelName}.`,
          },
        }
      : {}),
    ...(data.category
      ? {}
      : { categorias_para_elegir: data.categories.map(name), otra_categoria: `Sirve cualquier categoría de ${data.channelName}: pasá su código en save_catalog_data.` }),
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
    // Lo que cambia con la medida, como el diámetro: el valor de cada medida de la familia.
    ...(data.byMeasure.length > 0
      ? {
          por_medida: data.byMeasure.map((m) => ({
            medida: m.label,
            publicacion: m.externalId ?? m.id,
            valores: Object.fromEntries(Object.entries(m.values).map(([id, v]) => [data.fields.find((f) => f.id === id)?.label ?? id, v || null])),
          })),
        }
      : {}),
  };
}
