import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Botón para abrir un link en una pestaña nueva. Se apaga si el link no es válido. */
export function OpenLinkButton({ url, label, className }: { url: string; label: string; className?: string }) {
  const value = url.trim();
  const valid = isHttpUrl(value);
  return (
    <Button asChild variant="outline" size="icon" className={cn('shrink-0', !valid && 'pointer-events-none opacity-40', className)}>
      <a href={valid ? value : undefined} target="_blank" rel="noreferrer" aria-label={label} title={label}>
        <ExternalLink className="h-4 w-4" />
      </a>
    </Button>
  );
}
