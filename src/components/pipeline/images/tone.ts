import type { PhotoTone } from '@/domain/photo-steps';

// Cada foto lleva el color de su estado, en el paso Imágenes y en el producto.
export const PHOTO_TONE: Record<PhotoTone, { label: string; dot: string; pill: string; card: string }> = {
  approved: { label: 'Aprobadas', dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-800', card: 'border-emerald-200' },
  review: { label: 'Falta verificar', dot: 'bg-amber-400', pill: 'bg-amber-100 text-amber-900', card: 'border-amber-300' },
  pending: { label: 'Sin procesar', dot: 'bg-red-500', pill: 'bg-red-100 text-red-800', card: 'border-red-200' },
};
