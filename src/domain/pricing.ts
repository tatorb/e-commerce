// Los parámetros para calcular el precio de una publicación, con los valores
// de partida. Los porcentajes van como número, por ejemplo 14.3 para 14,3 %.

export const PRICING_DEFAULTS = {
  // Cargo del canal por vender.
  channelFeePct: 14.3,
  // Ingresos brutos, débitos y créditos, y retenciones.
  taxesPct: 4.9,
  vatRatePct: 21,
  installments3Pct: 5,
  installments6Pct: 9,
  adsPct: 0,
  returnsPct: 0,
  // Montos fijos por venta, en pesos.
  shipping: 10_890,
  packaging: 0,
  // Márgenes sobre el costo.
  minMarginPct: 15,
  targetMarginPct: 30,
} as const;
