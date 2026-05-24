'use client';

import { DndTabs, type DndTabItem } from '@/components/primitives';
import { BookOpen, Map, Package, User } from 'lucide-react';

const SIDE_TABS: DndTabItem[] = [
  { id: 'map', label: 'Mapa', icon: <Map className="h-4 w-4" /> },
  { id: 'story', label: 'História', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'inventory', label: 'Inventário', icon: <Package className="h-4 w-4" /> },
  { id: 'sheet', label: 'Ficha', icon: <User className="h-4 w-4" /> },
];

export interface GameplaySidePanelProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
}

export function GameplaySidePanel({ activeTab, onTabChange, children }: GameplaySidePanelProps) {
  return (
    <aside className="flex h-full w-full flex-col border-l border-dnd-gold/15 dnd-surface-glass">
      <DndTabs items={SIDE_TABS} value={activeTab} onValueChange={onTabChange} className="shrink-0 px-2" />
      <div className="flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
    </aside>
  );
}
