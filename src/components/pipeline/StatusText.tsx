import { cn } from '@/lib/utils/cn';

export function StatusText({ status, className }: { status: { kind: 'ok' | 'error'; text: string } | null; className?: string }) {
  if (!status) return null;
  return (
    <span role="status" className={cn('text-sm', status.kind === 'error' ? 'text-destructive' : 'text-muted-foreground', className)}>
      {status.text}
    </span>
  );
}
