import Anthropic from '@anthropic-ai/sdk';
import { claude, usageOf, type AiUsage } from './claude';

// Envía un pedido a Claude con respuesta de forma fija y la devuelve validada.
// Lo usan la propuesta completa y las propuestas de título. Los errores salen
// con un mensaje para la pantalla y nunca con el contenido del pedido.

export class ProposalError extends Error {
  // Lo que se gastó aunque no haya propuesta, por ejemplo si la respuesta quedó cortada.
  constructor(
    message: string,
    readonly usage: AiUsage | null = null,
    // Vale la pena reintentar en un rato: límite de pedidos o Claude saturado.
    readonly retryable = false,
  ) {
    super(message);
  }
}

export type StructuredResult<T> = { output: T; usage: AiUsage; model: string };

type Request = Anthropic.Beta.MessageCreateParamsNonStreaming;

export async function sendStructured<T>(request: Request, parse: (text: string) => T): Promise<StructuredResult<T>> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await claude().beta.messages.create(request);
  } catch (e) {
    // Si el reintento ante rechazos no está disponible para esta cuenta, se
    // pide igual sin él.
    if (!(e instanceof Anthropic.BadRequestError && /fallback|anthropic-beta/i.test(apiDetail(e)))) throw toProposalError(e);
    console.error('Claude no aceptó el reintento ante rechazos:', apiDetail(e));
    try {
      response = await claude().beta.messages.create({ ...request, betas: undefined, fallbacks: undefined } as Request);
    } catch (e2) {
      throw toProposalError(e2);
    }
  }

  const usage = usageOf(response.model, response.usage);
  if (response.stop_reason === 'refusal') {
    throw new ProposalError('Claude no quiso generar esta propuesta. Probá de nuevo o revisá los datos de la publicación.', usage);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ProposalError('La respuesta de Claude quedó cortada. Probá de nuevo.', usage);
  }
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text');
  if (!text) throw new ProposalError('Claude no devolvió una propuesta. Probá de nuevo.', usage);
  let output: T;
  try {
    output = parse(text.text);
  } catch {
    throw new ProposalError('La respuesta de Claude no tuvo la forma esperada. Probá de nuevo.', usage);
  }
  return { output, usage, model: response.model };
}

/** El motivo que da la API, sin datos del pedido. */
function apiDetail(e: unknown): string {
  if (!(e instanceof Anthropic.APIError)) return e instanceof Error ? e.name : 'error desconocido';
  const body = e.error as { error?: { message?: unknown } } | undefined;
  return typeof body?.error?.message === 'string' ? body.error.message : e.message;
}

function toProposalError(e: unknown): ProposalError {
  // Solo el código y el motivo: nunca el contenido de la publicación.
  console.error('Error de la API de Claude:', e instanceof Anthropic.APIError ? e.status : '', apiDetail(e));
  const retryable =
    e instanceof Anthropic.RateLimitError ||
    e instanceof Anthropic.InternalServerError ||
    e instanceof Anthropic.APIConnectionError;
  return new ProposalError(apiErrorMessage(e), null, retryable);
}

function apiErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'La clave de la API de Claude no es válida. Revisala en Vercel.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'La clave de la API de Claude no tiene permiso para usar este modelo.';
  if (e instanceof Anthropic.RateLimitError) return 'Claude está recibiendo demasiados pedidos. Probá de nuevo en un minuto.';
  if (e instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(apiDetail(e))) return 'La cuenta de la API de Claude no tiene saldo. Cargale crédito en console.anthropic.com.';
    return `Claude no aceptó el pedido. Motivo: ${apiDetail(e)}`;
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError) return 'Claude tardó demasiado en responder. Probá de nuevo.';
  if (e instanceof Anthropic.APIConnectionError) return 'No se pudo conectar con Claude. Probá de nuevo.';
  if (e instanceof Anthropic.APIError) return 'Claude no está respondiendo bien en este momento. Probá de nuevo en unos minutos.';
  return 'No se pudo pedir la propuesta. Probá de nuevo.';
}
