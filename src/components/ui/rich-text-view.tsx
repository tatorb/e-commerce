import { cleanRichText } from '@/domain/research';
import { cn } from '@/lib/utils/cn';
import { RICH_TEXT_CLASS } from './rich-text-class';

// Un texto con formato para leer: negrita, cursiva y listas. Se vuelve a
// limpiar antes de mostrarlo, aunque ya se guardó limpio. Solo en el servidor.

export function RichTextView({ html, empty = 'Sin cargar.', className }: { html: string | null | undefined; empty?: string; className?: string }) {
  let clean: string | null = null;
  try {
    clean = html ? cleanRichText(html) : null;
  } catch {
    clean = null;
  }
  if (!clean) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className={cn('text-sm leading-relaxed [&>:first-child]:mt-0 [&>:last-child]:mb-0', RICH_TEXT_CLASS, className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
