import type * as React from 'react';
import { linkParts } from '@/domain/text-links';
import { cn } from '@/lib/utils/cn';

// Un texto con los links que trae, por ejemplo la descripción de una tarea
// que armó la app. Los de afuera de la app se abren en otra pestaña.

export function LinkedText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = linkParts(text).map((p, i) => {
    if (!p.href) return p.text;
    let external: boolean;
    try {
      // Los de la app tienen la forma de sus direcciones: /a/<cuenta>/...
      external = !new URL(p.href).pathname.startsWith('/a/');
    } catch {
      return p.text;
    }
    return (
      <a key={i} href={p.href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className="font-medium text-primary underline-offset-4 hover:underline">
        {p.text}
      </a>
    );
  });
  return <p className={cn('whitespace-pre-line break-words', className)}>{parts}</p>;
}

