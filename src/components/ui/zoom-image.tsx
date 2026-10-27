'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';

// Una foto con lupa: al pasar el mouse aparece un círculo que muestra esa
// parte de la foto en su tamaño más grande, y se mueve con el mouse. Sirve
// para leer etiquetas y medidas sin abrir nada ni hacer zoom en la pantalla.
// La foto grande se pide al pasar el mouse; mientras llega, la lupa muestra la
// chica. En los teléfonos, que no tienen mouse, no aparece.

// El diámetro de la lupa, en píxeles de pantalla.
const LENS = 320;
// Si la foto grande no es mucho más grande que lo que se ve, igual se agranda al menos esto.
const MIN_ZOOM = 3;

// Dónde está el mouse, en qué parte de la foto (0 a 1), y de qué tamaño se dibuja la foto en la lupa.
type Point = { x: number; y: number; rx: number; ry: number; zoomWidth: number; zoomHeight: number };

export function ZoomImage({
  src,
  zoomSrc,
  alt,
  className,
  loading,
  draggable,
}: {
  src: string;
  // La foto en su tamaño más grande. Sin esto, la misma que se ve.
  zoomSrc?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  draggable?: boolean;
}) {
  const img = useRef<HTMLImageElement>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [big, setBig] = useState<{ url: string; width: number; height: number } | null>(null);
  const target = zoomSrc || src;

  function start() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || big?.url === target) return;
    const probe = new Image();
    probe.onload = () => setBig({ url: target, width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = target;
  }

  function move(e: React.MouseEvent<HTMLImageElement>) {
    const el = img.current;
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const natural = big?.url === target ? big : { width: el.naturalWidth, height: el.naturalHeight };
    if (!natural.width || !natural.height) return;
    const r = el.getBoundingClientRect();
    // Con object-contain la foto puede no llenar su caja: cuenta solo la parte que tiene foto.
    let width = r.width;
    let height = r.height;
    let left = r.left;
    let top = r.top;
    if (getComputedStyle(el).objectFit === 'contain') {
      const ratio = natural.width / natural.height;
      if (r.width / r.height > ratio) {
        width = r.height * ratio;
        left += (r.width - width) / 2;
      } else {
        height = r.width / ratio;
        top += (r.height - height) / 2;
      }
    }
    const rx = (e.clientX - left) / width;
    const ry = (e.clientY - top) / height;
    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return setPoint(null);
    const zoomWidth = Math.max(natural.width, width * MIN_ZOOM);
    setPoint({ x: e.clientX, y: e.clientY, rx, ry, zoomWidth, zoomHeight: (zoomWidth * natural.height) / natural.width });
  }

  const ready = big?.url === target ? big : null;
  let lens: React.ReactNode = null;
  if (point) {
    const { zoomWidth, zoomHeight } = point;
    const url = (ready?.url ?? src).replace(/"/g, '%22');
    lens = createPortal(
      <div
        aria-hidden
        className="pointer-events-none fixed z-[70] overflow-hidden rounded-full border-2 border-white bg-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
        style={{
          left: point.x - LENS / 2,
          top: point.y - LENS / 2,
          width: LENS,
          height: LENS,
          backgroundImage: `url("${url}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${zoomWidth}px ${zoomHeight}px`,
          backgroundPosition: `${LENS / 2 - point.rx * zoomWidth}px ${LENS / 2 - point.ry * zoomHeight}px`,
        }}
      >
        {!ready ? (
          <span className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded bg-black/60 px-2 py-0.5 text-xs text-white">Cargando la foto grande…</span>
        ) : null}
      </div>,
      document.body,
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        alt={alt}
        loading={loading}
        draggable={draggable}
        className={cn('cursor-crosshair', className)}
        onMouseEnter={start}
        onMouseMove={move}
        onMouseLeave={() => setPoint(null)}
        onMouseDown={() => setPoint(null)}
      />
      {lens}
    </>
  );
}
