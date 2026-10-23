-- Los estados del canal como los maneja Mercado Libre, y los cambios de estado en el registro.
ALTER TYPE "ChannelStatus" ADD VALUE 'CLOSED';
ALTER TYPE "ChannelStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "ChannelStatus" ADD VALUE 'DELETED';
ALTER TYPE "SyncChangeKind" ADD VALUE 'STATUS_CHANGED';
ALTER TYPE "SyncChangeKind" ADD VALUE 'STATUS_FAILED';
ALTER TYPE "SyncChangeKind" ADD VALUE 'RELISTED';
