import type { ContentField, ContentSnapshot } from '@/domain/content';
import { compatText } from '../shared/apply-format';
import type { ApplySection } from '../types';

// Guía para pasar a mano lo aprobado a una publicación de Mercado Libre, en
// el orden en que aparece al modificarla. Si el formulario de Mercado Libre
// cambia de orden, se ajusta acá y en ningún otro lado.
export function mercadolibreApplyGuide(c: ContentSnapshot, changed: ReadonlySet<ContentField>): ApplySection[] {
  const has = (f: ContentField) => changed.has(f);
  const characteristics = [
    { label: 'Marca', value: c.brand ?? '', field: 'brand' as const },
    { label: 'Número de pieza', value: c.partNumber ?? '', field: 'partNumber' as const },
    { label: 'Tipo de producto', value: c.productType ?? '', field: 'productType' as const },
    { label: 'Origen', value: c.origin ?? '', field: 'origin' as const },
  ].filter((x) => x.value || has(x.field));

  return [
    {
      key: 'title',
      title: 'Título',
      hint: 'Hasta 60 caracteres. Reemplazá el título entero.',
      items: [{ label: 'Título', value: c.title ?? '', kind: 'copy', changed: has('title') }],
    },
    {
      key: 'characteristics',
      title: 'Características',
      hint: 'Cada dato va en su casillero. Si la categoría no tiene casillero para alguno, sumalo a la descripción.',
      items: [
        ...characteristics.map((x) => ({ label: x.label, value: x.value, kind: 'copy' as const, changed: has(x.field) })),
        ...c.specs.map((s) => ({ label: s.name, value: s.value, kind: 'copy' as const, changed: has('specs') })),
      ],
    },
    {
      key: 'compatibilities',
      title: 'Compatibilidades',
      hint: 'Se eligen de las listas de Mercado Libre y no se pueden pegar. Tildá cada una a medida que la cargás.',
      items: c.compatibilities.map((x) => ({
        label: compatText(x),
        value: compatText(x),
        kind: 'check' as const,
        changed: has('compatibilities'),
      })),
    },
    {
      key: 'description',
      title: 'Descripción',
      hint: 'Texto plano. Borrá la descripción anterior y pegá esta entera.',
      items: [
        { label: 'Descripción', value: c.description ?? '', kind: 'copy', changed: has('description'), multiline: true },
        ...(c.kitContents || has('kitContents')
          ? [
              {
                label: 'Contenido del kit',
                value: c.kitContents ?? '',
                kind: 'copy' as const,
                changed: has('kitContents'),
                multiline: true,
              },
            ]
          : []),
      ],
    },
    {
      key: 'warranty',
      title: 'Garantía',
      hint: 'Elegí el tipo de garantía, de fábrica o del vendedor, y el tiempo. El texto sirve de referencia.',
      items: [{ label: 'Garantía', value: c.warranty ?? '', kind: 'copy', changed: has('warranty') }],
    },
    {
      key: 'measures',
      title: 'Medidas por SKU',
      hint: 'De referencia. La medida suele ir en el título, en las características o en las variantes.',
      items: c.measures.map((m) => ({
        label: m.sku ?? 'Sin SKU',
        value: m.measure ?? '',
        kind: 'copy' as const,
        changed: has('measures'),
      })),
    },
  ];
}
