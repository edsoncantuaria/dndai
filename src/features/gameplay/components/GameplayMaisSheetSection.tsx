'use client';

import { useState } from 'react';
import { DndTabs, type DndTabItem } from '@/components/primitives';
import { Scroll, TrendingUp } from 'lucide-react';
import Spellbook from '@/components/Spellbook';
import ProgressionTab from '@/components/ProgressionTab';

const MAIS_SHEET_TABS: DndTabItem[] = [
    { id: 'spells', label: 'Magias', icon: <Scroll className="h-4 w-4" /> },
    { id: 'progress', label: 'Progressão', icon: <TrendingUp className="h-4 w-4" /> },
];

export function GameplayMaisSheetSection() {
    const [tab, setTab] = useState('spells');

    return (
        <div className="space-y-3">
            <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">Ficha</p>
            <DndTabs items={MAIS_SHEET_TABS} value={tab} onValueChange={setTab} className="shrink-0" />
            <div className="min-h-0 overflow-y-auto [&_.rounded-3xl]:rounded-lg [&_.border-white\\/10]:border-dnd-gold/15">
                {tab === 'spells' && <Spellbook />}
                {tab === 'progress' && <ProgressionTab />}
            </div>
        </div>
    );
}
