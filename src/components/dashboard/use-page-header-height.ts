'use client';

import { useEffect, useState } from 'react';

/**
 * Cuánto ocupa arriba el encabezado de la página cuando queda fijo, para que
 * lo que queda fijo debajo, como los títulos de una tabla, quede justo debajo.
 * Cero si no queda fijo.
 */
export function usePageHeaderHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-page-header]');
    if (!header) return;
    const update = () => setHeight(getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  return height;
}
