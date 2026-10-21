import Link from 'next/link';
import { MessageCircleQuestion } from 'lucide-react';
import { formatDuration } from '@/lib/format';

// El aviso de arriba del Pipeline: cuántas preguntas esperan respuesta y desde cuándo.
export function QuestionsNotice({ accountSlug, count, oldestAt }: { accountSlug: string; count: number; oldestAt: Date | null }) {
  if (count === 0) return null;
  return (
    <Link
      href={`/a/${accountSlug}/preguntas`}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-alert/40 bg-alert/10 px-4 py-3 text-sm transition-colors hover:bg-alert/15"
    >
      <MessageCircleQuestion className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">{count === 1 ? 'Hay 1 pregunta sin responder.' : `Hay ${count} preguntas sin responder.`}</span>
      {oldestAt ? <span className="text-muted-foreground">{count === 1 ? 'Espera' : 'La más vieja espera'} hace {formatDuration(oldestAt, new Date())}.</span> : null}
      <span className="font-medium underline-offset-4 sm:ml-auto">Ver preguntas</span>
    </Link>
  );
}
