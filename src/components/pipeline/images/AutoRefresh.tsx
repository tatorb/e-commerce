'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Mientras el trabajador tiene pasos en cola o en proceso, recarga los datos
// de la página cada tanto para mostrar lo nuevo sin tocar nada.
export function AutoRefresh({ active, seconds = 5 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [active, seconds, router]);
  return null;
}
