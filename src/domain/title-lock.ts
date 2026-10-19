// Título bloqueado: cuando el canal no deja cambiarlo. Lo dicen los datos de
// la última medición (la regla es de cada canal, en src/channels/). Si no hay
// datos, vale la marca a mano de la publicación. Una publicación que todavía
// no está en el canal no tiene ventas: su título siempre se puede cambiar.

export type TitleLock = { locked: boolean | null; source: 'data' | 'manual' | 'unpublished' | null };

export function resolveTitleLock(fromData: boolean | null, manual: boolean | null, published = true): TitleLock {
  if (!published) return { locked: false, source: 'unpublished' };
  if (fromData !== null) return { locked: fromData, source: 'data' };
  if (manual !== null) return { locked: manual, source: 'manual' };
  return { locked: null, source: null };
}

export function titleLockText(lock: TitleLock): string {
  if (lock.locked === null) return 'Sin datos de ventas para saber si el título está bloqueado.';
  if (lock.source === 'unpublished') return 'Todavía no está publicada: el título se puede cambiar.';
  if (lock.source === 'manual') return lock.locked ? 'Título bloqueado, marcado a mano.' : 'Título libre, marcado a mano.';
  return lock.locked ? 'Título bloqueado: la publicación tiene ventas.' : 'Título libre: la publicación no tiene ventas.';
}
