import { parseMetrics } from '@/domain/measurements';
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
  // La medición más reciente: viene ordenada de la más nueva a la más vieja.
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
    measurement: last ? { takenAt: last.takenAt, metrics: parseMetrics(last.metrics) } : null,
  };
}
