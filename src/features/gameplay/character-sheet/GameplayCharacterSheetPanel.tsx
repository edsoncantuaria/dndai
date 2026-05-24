'use client';

import { useState } from 'react';
import { DndTabs, type DndTabItem } from '@/components/primitives';
import { Scroll, User, Users, TrendingUp } from 'lucide-react';
import CharacterSheet from '@/components/CharacterSheet';
import Spellbook from '@/components/Spellbook';
import NewRelationships from '@/components/NewRelationships';
import ProgressionTab from '@/components/ProgressionTab';

const SHEET_TABS: DndTabItem[] = [
  { id: 'attrs', label: 'Atributos', icon: <User className="h-4 w-4" /> },
  { id: 'spells', label: 'Magias', icon: <Scroll className="h-4 w-4" /> },
  { id: 'relations', label: 'Relações', icon: <Users className="h-4 w-4" /> },
  { id: 'progress', label: 'Progressão', icon: <TrendingUp className="h-4 w-4" /> },
];

export function GameplayCharacterSheetPanel() {
  const [tab, setTab] = useState('attrs');

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DndTabs items={SHEET_TABS} value={tab} onValueChange={setTab} className="shrink-0" />
      <div className="min-h-0 flex-1 overflow-y-auto [&_.rounded-3xl]:rounded-lg [&_.border-white\\/10]:border-dnd-gold/15">
        {tab === 'attrs' && <CharacterSheet />}
        {tab === 'spells' && <Spellbook />}
        {tab === 'relations' && <NewRelationships />}
        {tab === 'progress' && <ProgressionTab />}
      </div>
    </div>
  );
}
