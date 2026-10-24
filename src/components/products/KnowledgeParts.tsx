import Link from 'next/link';
import { RichTextView } from '@/components/ui/rich-text-view';
import type { StoreKnowledge } from '@/domain/research';

// En un combo: lo que sabe la tienda de cada producto que lo forma, que el
// combo hereda. Se edita en la Investigación de cada producto.

export function KnowledgeParts({ accountSlug, parts }: { accountSlug: string; parts: StoreKnowledge['parts'] }) {
  if (parts.length === 0) return null;
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">También vale lo que se sabe de sus productos:</p>
      {parts.map((p) => (
        <div key={p.productId} className="space-y-1">
          <Link href={`/a/${accountSlug}/productos/${p.productId}?seccion=investigacion`} className="text-sm font-medium hover:underline">
            {p.name}
          </Link>
          <RichTextView html={p.html} />
        </div>
      ))}
    </div>
  );
}
