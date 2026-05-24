import type { HomebrewSourceKind } from '@/services/homebrewService';
import { DndBadge } from '@/components/primitives';

export function SourceKindBadge({ sourceKind }: { sourceKind?: HomebrewSourceKind }) {
  if (!sourceKind || sourceKind === 'original') {
    return <DndBadge variant="default">Original</DndBadge>;
  }
  if (sourceKind === 'fork') {
    return <DndBadge variant="muted">Fork SRD</DndBadge>;
  }
  if (sourceKind === 'translation') {
    return <DndBadge variant="success">Tradução SRD</DndBadge>;
  }
  return null;
}
