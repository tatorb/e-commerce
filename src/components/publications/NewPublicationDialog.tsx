'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ChannelInfo } from '@/channels';
import { PublicationForm } from '@/components/publications/PublicationForm';

export type StoreOption = { id: string; name: string; channel: ChannelInfo };

// "Agregar publicación": elige la tienda (si hay más de una) y carga los
// datos básicos. La publicación nueva entra en la etapa Importado.
export function NewPublicationDialog({
  accountSlug,
  productId,
  productName,
  stores,
  label,
  variant = 'outline',
}: {
  accountSlug: string;
  productId: string;
  productName: string;
  stores: StoreOption[];
  label: string;
  variant?: 'outline' | 'default';
}) {
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const store = stores.find((s) => s.id === storeId);

  if (stores.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva publicación</DialogTitle>
          <DialogDescription>
            La publicación de <strong>{productName}</strong> en una tienda. Entra en la etapa
            Importado.
          </DialogDescription>
        </DialogHeader>
        {stores.length > 1 ? (
          <div className="space-y-1.5">
            <Label htmlFor="new-pub-store">Tienda</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger id="new-pub-store">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {store ? (
          <PublicationForm
            key={store.id}
            accountSlug={accountSlug}
            channel={store.channel}
            mode={{ kind: 'create', productId, storeId: store.id }}
            initial={{
              externalId: '',
              url: '',
              title: '',
              description: '',
              attributes: [],
              price: '',
              channelStatus: 'ACTIVE',
            }}
            onCreated={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
