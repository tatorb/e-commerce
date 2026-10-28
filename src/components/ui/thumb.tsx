import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// La portada chica de un producto o de una publicación, cuadrada y con la foto
// entera. Sin foto, una caja gris con un ícono.

const SIZE = { sm: 'h-10 w-10', md: 'h-16 w-16', lg: 'h-20 w-20 md:h-24 md:w-24' } as const;

export function Thumb({ src, alt, size = 'md', className }: { src: string | null; alt: string; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white', SIZE[size], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <ImageIcon className="h-1/3 w-1/3 text-muted-foreground/60" aria-label="Sin foto" />
      )}
    </span>
  );
}
