import type { MetadataRoute } from 'next';
import { APP_NAME, BRAND_ICON } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: 'E-commerce MRB',
    description: 'Publicaciones de productos de los clientes de Studio MRB',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f2f2',
    theme_color: '#0a0a0a',
    icons: [
      { src: BRAND_ICON, sizes: '192x192', type: 'image/jpeg', purpose: 'any' },
      { src: BRAND_ICON, sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
    ],
  };
}
