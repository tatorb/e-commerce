import { Camera, ClipboardCheck, Video } from 'lucide-react';
import type { ShootKind } from '@/domain/shoot';

/** El ícono de cada tipo de paso: foto, video o sin registro. */
export function ShootKindIcon({ kind, className }: { kind: ShootKind; className?: string }) {
  const Icon = kind === 'PHOTO' ? Camera : kind === 'VIDEO' ? Video : ClipboardCheck;
  return <Icon className={className} />;
}
