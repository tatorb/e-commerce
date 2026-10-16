import { z } from 'zod';

// Lista de pares nombre y valor. La usan la ficha técnica del producto y los
// atributos de una publicación.
export type NameValue = { name: string; value: string };

export const nameValueSchema = z.object({
  name: z.string().trim().max(200),
  value: z.string().trim().max(2000),
});

/** Lee una lista guardada como JSON, descartando lo que no tenga forma válida. */
export function parseNameValueList(raw: unknown): NameValue[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = nameValueSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Saca las filas vacías que deja el formulario. */
export function compactNameValues(list: NameValue[]): NameValue[] {
  return list.filter((row) => row.name !== '' || row.value !== '');
}
