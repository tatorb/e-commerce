import Anthropic from '@anthropic-ai/sdk';

// Conexión con la API de Claude. El modelo y los precios están acá, en un
// solo lugar. La clave sale de ANTHROPIC_API_KEY y nunca se muestra.

export const PROPOSAL_MODEL = 'claude-opus-5-5';

export const AI_NOT_CONFIGURED = 'Falta configurar la clave de la API de Claude en Vercel.';

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

export function claude(): Anthropic {
  // Cada propuesta corre en un pedido de hasta 5 minutos en Vercel.
  client ??= new Anthropic({ timeout: 270_000, maxRetries: 2 });
  return client;
}

// Dólares por millón de tokens. Si respondió otro modelo por un rechazo, se
// usa su precio; si no está en la lista, el del modelo principal.
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
};

export type AiUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
};

export function usageOf(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
): AiUsage {
  const price = PRICES[model] ?? PRICES[PROPOSAL_MODEL];
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cost =
    (usage.input_tokens * price.input +
      cacheWrite * price.input * 1.25 +
      cacheRead * price.input * 0.05 +
      usage.output_tokens * price.output) /
    1_000_000;
  return {
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheWriteTokens: cacheWrite,
    cacheReadTokens: cacheRead,
    costUsd: Math.round(cost * 10000) / 10000,
  };
}
