import { latestMetrics } from '@/domain/measurements';
import { parseNameValueList } from '@/domain/name-value';
import type { ScoreInput } from '@/domain/standard';

// Arma lo que necesita el puntaje a partir de las filas de la base. No usa la
// base directamente, así sirve también en las pruebas y en otros servicios.

type ProductForScore = {
  warranty: string | null;
  kitContents: string | null;
  partNumber: string | null;
  specs: unknown;
  variants: { measure: string | null }[];
  compatibilities: { vehicleBrand: string | null; model: string | null; engine: string | null }[];
  assets: { kind: 'PHOTO' | 'VIDEO' }[];
};

type PublicationForScore = {
  title: string | null;
  description: string | null;
  attributes: unknown;
  measurements: { takenAt: Date; metrics: unknown }[];
};

export function toScoreInput(product: ProductForScore, publication: PublicationForScore): ScoreInput {
  // Las mediciones vienen de la más nueva a la más vieja: vale la fecha de la
  // última, con el último dato que se tiene de cada métrica.
  const last = publication.measurements[0];
  return {
    product: {
      warranty: product.warranty,
      kitContents: product.kitContents,
      partNumber: product.partNumber,
      specs: parseNameValueList(product.specs),
      variants: product.variants,
      compatibilities: product.compatibilities,
      assets: product.assets,
    },
    publication: {
      title: publication.title,
      description: publication.description,
      attributes: parseNameValueList(publication.attributes),
    },
    measurement: last ? { takenAt: last.takenAt, metrics: latestMetrics(publication.measurements) } : null,
  };
}
