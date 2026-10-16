import './globals.css';
import type { Metadata } from 'next';
import { Urbanist } from 'next/font/google';
import { cn } from '@/lib/utils/cn';
import { APP_NAME, BRAND_ICON } from '@/lib/brand';

const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  // Cada página declara su título ("Productos") y la plantilla le suma la
  // marca, como en app.studiomrb.com.
  title: { template: `%s · ${APP_NAME}`, default: APP_NAME },
  description: 'Preparar, corregir y mejorar publicaciones de productos en canales de venta.',
  manifest: '/manifest.webmanifest',
  icons: { icon: BRAND_ICON, apple: BRAND_ICON },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className={cn('h-full overflow-hidden font-sans', urbanist.variable)}>{children}</body>
    </html>
  );
}
