'use client';

import { useReadOnly } from '@/components/access/AccessProvider';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { saveVideoMeasureAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import { measureVideo } from '@/components/drive/upload';

// Mide en el navegador los videos que todavía no midió, de a uno: lee solo el
// principio del archivo. Así se sabe si los que se agregaron desde la Mac
// sirven como clip, con el giro del teléfono bien aplicado.
export function AutoMeasure({ accountSlug, videoIds }: { accountSlug: string; videoIds: string[] }) {
  const router = useRouter();
  const tried = useRef(new Set<string>());
  const key = videoIds.join(',');
  // Quien solo puede ver no guarda medidas.
  const readOnly = useReadOnly();

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    (async () => {
      let changed = false;
      for (const id of key ? key.split(',') : []) {
        if (cancelled || tried.current.has(id)) continue;
        tried.current.add(id);
        const measure = await measureVideo(`/api/drive/videos/${id}`, 30_000);
        if (cancelled || !measure) continue;
        const r = await saveVideoMeasureAction(accountSlug, id, measure).catch(() => null);
        if (r?.ok && r.changed) changed = true;
      }
      if (changed && !cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [accountSlug, key, router, readOnly]);

  return null;
}
