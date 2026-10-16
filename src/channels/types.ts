import type { ChannelKind } from '@/generated/prisma/enums';
import type { ContentField, ContentSnapshot } from '@/domain/content';
import type { Metrics } from '@/domain/measurements';

/** Un dato para pasar al canal a mano. */
export type ApplyItem = {
  label: string;
  // El texto para copiar o tildar. Vacío si la ficha no tiene ese dato.
  value: string;
  // Copiar y pegar, tildar a medida que se carga, o solo de referencia.
  kind: 'copy' | 'check' | 'reference';
  // Si cambió en la revisión aprobada.
  changed: boolean;
  multiline?: boolean;
};

/** Un grupo de datos, en el orden en que aparecen en el formulario del canal. */
export type ApplySection = {
  key: string;
  title: string;
  hint: string | null;
  items: ApplyItem[];
};

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
  /**
   * Guía para aplicar a mano lo que tiene la ficha: los datos agrupados y en
   * el orden del formulario del canal, marcando los que cambiaron.
   */
  applyGuide(content: ContentSnapshot, changed: ReadonlySet<ContentField>): ApplySection[];
  /**
   * Si el canal no deja cambiar el título, según la última medición: true
   * bloqueado, false libre, null si no hay datos para saberlo.
   */
  titleLock(metrics: Metrics): boolean | null;
}
