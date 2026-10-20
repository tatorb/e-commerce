import { cn } from '@/lib/utils/cn';
import { BRAND_ICON, BRAND_LOGO } from '@/lib/brand';

// La animación de las esperas: el logo de Studio MRB con un latido suave. Las
// imágenes son las mismas del menú, así que ya están cargadas cuando hacen
// falta. Con "reducir movimiento" en el sistema, el logo queda quieto.

/** El ícono latiendo, chico: va adentro de un botón o al lado de un texto. */
export function BrandMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_ICON}
      alt=""
      aria-hidden
      // El borde claro lo separa del fondo de un botón oscuro.
      className={cn('h-4 w-4 shrink-0 rounded-[3px] ring-1 ring-white/80 animate-brand-beat motion-reduce:animate-none', className)}
    />
  );
}

/** El logo latiendo con una línea que avanza y un texto: para cambiar de pantalla y las esperas largas. */
export function BrandLoader({
  label = 'Cargando…',
  hint,
  className,
}: {
  label?: string;
  // Una línea más, por ejemplo cuánto puede tardar.
  hint?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center justify-center gap-3 px-4 py-12 text-center', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND_LOGO} alt="" aria-hidden className="h-7 w-auto animate-brand-beat motion-reduce:animate-none" />
      <div aria-hidden className="h-0.5 w-28 overflow-hidden rounded-full bg-primary/15">
        <div className="h-full w-2/5 rounded-full bg-primary animate-nav-progress motion-reduce:w-full motion-reduce:animate-none" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
