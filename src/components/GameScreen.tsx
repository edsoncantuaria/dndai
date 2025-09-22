import React, { useState } from 'react';
import Header from './Header';
import NarrativeLog from './NarrativeLog';
import ActionOptions from './ActionOptions';
import Inventory from './Inventory';
import CharacterSheet from './CharacterSheet';
import Spellbook from './Spellbook';
import MobileToolbar from './MobileToolbar';
import CombatTracker from './CombatTracker';
import { useGameStateContext } from '../contexts/GameStateContext';
import LevelUpModal from './LevelUpModal';
import ProgressionTab from './ProgressionTab';
import RelationshipsTab from './RelationshipsTab';
import JournalTab from './JournalTab';
import ShopModal from './ShopModal';
import { Icons } from './Icons';

const GameScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'inventory' | 'character' | 'spells' | 'progression' | 'relationships' | 'journal'>('character');
    const { combatState, levelUpState, shopState } = useGameStateContext();

    const renderSidebarContent = () => {
        switch (activeTab) {
            case 'character':
                return <CharacterSheet />;
            case 'spells':
                return <Spellbook />;
            case 'progression':
                return <ProgressionTab />;
            case 'relationships':
                return <RelationshipsTab />;
            case 'journal':
                return <JournalTab />;
            case 'inventory':
            default:
                return <Inventory />;
        }
    };
    
    const closeShop = () => {
        // This would ideally be handled by the AI setting shopState.isOpen to false
        // For now, we can have a manual close, but the AI should control the state.
        // Or we send an action: "I'm done shopping"
    };

    const tabConfig = {
        character: { label: 'Personagem', icon: <Icons.User className="h-4 w-4"/> },
        inventory: { label: 'Inventário', icon: <Icons.Backpack className="h-4 w-4"/> },
        spells: { label: 'Magias', icon: <Icons.Book className="h-4 w-4"/> },
        progression: { label: 'Progresso', icon: <Icons.TrendingUp className="h-4 w-4"/> },
        relationships: { label: 'Relações', icon: <Icons.Users className="h-4 w-4"/> },
        journal: { label: 'Diário', icon: <Icons.Map className="h-4 w-4"/> },
    }

    return (
        <div className="flex flex-col flex-grow overflow-hidden animate-fadeIn">
            {levelUpState?.isPending && <LevelUpModal />}
            {shopState?.isOpen && <ShopModal />}
            <Header />
            {combatState.isActive && <CombatTracker />}
            <div className="flex-grow grid grid-cols-12 gap-4 mt-4 overflow-hidden">
                {/* Main Content: Narrative and Actions */}
                <div className="col-span-12 md:col-span-7 lg:col-span-8 flex flex-col bg-stone-800/60 backdrop-blur-sm rounded-lg border border-stone-700/80 overflow-hidden">
                    <div className="flex-grow p-4 overflow-y-auto md:pb-4 pb-40">
                        <NarrativeLog />
                    </div>
                    <div className="p-4 flex-shrink-0 border-t border-stone-700/80 bg-stone-900/30 hidden md:block">
                        <ActionOptions />
                    </div>
                </div>
                
                {/* Sidebar: Inventory, Character Sheet etc. (Desktop on Right) */}
                <aside className="hidden md:flex flex-col col-span-12 md:col-span-5 lg:col-span-4 bg-stone-800/60 backdrop-blur-sm rounded-lg border border-stone-700/80 overflow-hidden">
                     <div className="flex flex-wrap border-b border-stone-700 flex-shrink-0">
                        {Object.entries(tabConfig).map(([key, {label, icon}]) => (
                             <button key={key} onClick={() => setActiveTab(key as any)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold transition-colors ${activeTab === key ? 'bg-stone-900/50 text-amber-400' : 'text-stone-400 hover:bg-stone-900/30'}`}>
                                {icon}
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {renderSidebarContent()}
                    </div>
                </aside>
            </div>
             {/* Mobile Sticky Actions & Toolbar */}
            <div className="md:hidden fixed bottom-16 left-0 right-0 bg-stone-800/80 backdrop-blur-md p-2 z-20 border-t border-stone-700 max-h-48 overflow-y-auto">
                <ActionOptions />
            </div>
            <MobileToolbar setActiveTab={setActiveTab} activeTab={activeTab}>
                {renderSidebarContent()}
            </MobileToolbar>
        </div>
    );
};

export default GameScreen;