// El título es de la publicación y el nombre es del producto: son cosas
// distintas. Una publicación sin título se muestra así, nunca con el nombre
// del producto, para que no parezca que tiene uno.

export const UNTITLED = 'Sin título';

export function titleOrUntitled(title: string | null | undefined): string {
  return title?.trim() || UNTITLED;
}
