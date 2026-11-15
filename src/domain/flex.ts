// Envíos Flex: los textos de la marca y de la confirmación. Sin la base de
// datos, para poder probarlo solo.

/** "Con Flex", "Sin Flex" o "Sin dato". */
export function flexLabel(flex: boolean | null | undefined): string {
  return flex === true ? 'Con Flex' : flex === false ? 'Sin Flex' : 'Sin dato';
}

/** Lo que se pregunta antes de prender o apagar Flex. */
export function flexConfirm(on: boolean, channelName: string, count: number, familySize = 0): string {
  const which = count === 1 ? (familySize >= 2 ? `esta publicación y las ${familySize} medidas de su familia` : 'esta publicación') : `${count} publicaciones`;
  return on
    ? `¿Prender Envíos Flex en ${which}? Las ventas que entren por Flex las entregás vos, en el día o al día siguiente, según tu configuración en ${channelName}.`
    : `¿Apagar Envíos Flex en ${which}? Dejan de ofrecer entrega con Flex en ${channelName}.`;
}

// El filtro de la lista de Publicaciones.
export const FLEX_OPTIONS = [
  { value: 'con', label: 'Con Flex' },
  { value: 'sin', label: 'Sin Flex' },
  { value: 'sin-dato', label: 'Sin dato' },
] as const;

export function flexOption(flex: boolean | null | undefined): string {
  return flex === true ? 'con' : flex === false ? 'sin' : 'sin-dato';
}
