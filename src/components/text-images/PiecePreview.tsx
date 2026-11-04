'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { pieceDocument, type PieceFit, type PiecePaint } from '@/lib/text-images/piece-html';

// La vista previa en vivo de la imagen con texto: la misma página que usa el
// servidor para el PNG, achicada para que entre en la pantalla. Cada cambio
// la vuelve a pintar y devuelve cómo quedó: versión, dudas, achique y si entra.

type PieceWindow = Window & { pintar?: (p: PiecePaint) => Promise<PieceFit>; piezaLista?: boolean };

export function PiecePreview({ paint, onFit }: { paint: PiecePaint; onFit: (fit: PieceFit | null) => void }) {
  const doc = useMemo(() => pieceDocument({ archivo: '/api/fuentes/archivo.woff2', inter: '/api/fuentes/inter.woff2' }), []);
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(0.4);
  const turn = useRef(0);
  const report = useRef(onFit);
  useEffect(() => {
    report.current = onFit;
  }, [onFit]);

  // La página de la pieza puede terminar de cargar antes de que la pantalla la escuche: se mira también al empezar.
  useEffect(() => {
    const f = frame.current;
    const check = () => {
      if ((f?.contentWindow as PieceWindow | null)?.piezaLista) setReady(true);
    };
    const t = window.setTimeout(check, 0);
    f?.addEventListener('load', check);
    return () => {
      window.clearTimeout(t);
      f?.removeEventListener('load', check);
    };
  }, []);

  // Del ancho que tiene la pantalla.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(Math.max(0.1, el.clientWidth / 1200));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const key = JSON.stringify(paint);
  useEffect(() => {
    if (!ready) return;
    const w = frame.current?.contentWindow as PieceWindow | null;
    if (!w?.pintar) return;
    const mine = ++turn.current;
    w.pintar(JSON.parse(key) as PiecePaint)
      .then((fit) => {
        if (mine === turn.current) report.current(fit);
      })
      .catch(() => report.current(null));
  }, [ready, key]);

  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-md border bg-muted" style={{ height: 1200 * scale }}>
      <iframe
        ref={frame}
        title="Vista previa de la imagen con texto"
        srcDoc={doc}
        className="absolute left-0 top-0 origin-top-left border-0"
        style={{ width: 1200, height: 1200, transform: `scale(${scale})` }}
      />
    </div>
  );
}
