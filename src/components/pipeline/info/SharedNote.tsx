import { Users } from 'lucide-react';

/**
 * La descripción de una tarjeta que es del producto, con el aviso de que la
 * ven sus otras publicaciones. Con una sola publicación no avisa nada.
 */
export function withSharedNote(description: string, sharedWith: number, except?: string) {
  if (sharedWith < 2) return description;
  return (
    <>
      {description}
      <span className="mt-1 flex items-center gap-1.5 font-medium text-foreground/80">
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Es del producto: lo ven sus {sharedWith} publicaciones{except ? `, salvo ${except}` : ''}.
      </span>
    </>
  );
}
