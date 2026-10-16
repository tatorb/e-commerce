import type { ChannelKind } from '@/generated/prisma/enums';

// Lo único que el resto de la app sabe de un canal. Todo lo específico de
// cada canal (formato del ID, cómo armar el link, más adelante cómo aplicar
// una publicación) vive detrás de esta interfaz, en src/channels/<canal>/.
export interface ChannelAdapter {
  kind: ChannelKind;
  name: string;
  externalId: {
    label: string;
    placeholder: string;
    help: string;
  };
  /** Largo máximo del título en el canal, si tiene uno. */
  titleMaxLength: number | null;
  /** Limpia lo que escribió la persona: acepta el ID suelto o el link entero. */
  normalizeExternalId(raw: string): { ok: true; value: string } | { ok: false; error: string };
  /** Link público de la publicación a partir de su ID, si el canal lo permite. */
  publicationUrl(externalId: string): string | null;
}
