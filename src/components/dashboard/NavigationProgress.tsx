'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Cada pantalla se arma en el servidor, así que entre que se toca un link y
// llega la pantalla nueva no cambiaba nada y parecía que la app no respondía.
// Esta barra aparece arriba apenas se toca un link de la app y se va cuando
// cambia la dirección.
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState(`${pathname}?${search}`);
  if (shown !== `${pathname}?${search}`) {
    setShown(`${pathname}?${search}`);
    setPending(false);
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Los links de Next frenan la navegación del navegador y la hacen ellos: no se mira defaultPrevented.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      if (!(a instanceof HTMLAnchorElement) || !a.href || a.hasAttribute('download')) return;
      if (a.target && a.target !== '_self') return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setPending(true);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Si la navegación no termina (se canceló o falló), la barra se va sola.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(false), 20000);
    return () => clearTimeout(t);
  }, [pending]);

  if (!pending) return null;
  return (
    <div role="progressbar" aria-label="Cargando" className="fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-primary/20">
      <div className="h-full w-2/5 bg-primary animate-nav-progress motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}
