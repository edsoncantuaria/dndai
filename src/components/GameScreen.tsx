import React, { useState } from 'react';
import Header from './Header';
import ActionOptions from './ActionOptions';
import Inventory from './Inventory';
import CharacterSheet from './CharacterSheet';
import Spellbook from './Spellbook';
import MobileToolbar from './MobileToolbar';
import CombatTracker from './CombatTracker';
import { useGameStateContext } from '../contexts/GameStateContext';
import LevelUpModal from './LevelUpModal';
import ProgressionTab from './ProgressionTab';
import ShopModal from './ShopModal';
import ErrorModal from './ui/ErrorModal';
import NewNarrativeLog from './NewNarrativeLog';
import NewJournal from './NewJournal';
import NewRelationships from './NewRelationships';
import AmbientPlayer from './AmbientPlayer';
import SkillCheckModal from './ui/SkillCheckModal';
import { User, Backpack, BookOpen, Map, Users, TrendingUp } from 'lucide-react';
import Head from 'next/head';

type Tab = 'character' | 'inventory' | 'spells' | 'progression' | 'relationships' | 'journal';

const GameScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('character');
    const { 
        combatState, 
        levelUpState, 
        shopState, 
        apiError, 
        clearApiError,
        skillCheckRequest,
        setSkillCheckRequest,
        processPlayerAction
    } = useGameStateContext();

    const handleSkillCheckSubmit = (description: string) => {
        if (!skillCheckRequest) return;
        const fullAction = `Eu tento usar ${skillCheckRequest.skillName} para ${description}`;
        processPlayerAction(fullAction);
        setSkillCheckRequest(null);
    };

    const renderSidebarContent = () => {
        switch (activeTab) {
            case 'character':
                return <CharacterSheet />;
            case 'inventory':
                return <Inventory />;
            case 'spells':
                return <Spellbook />;
            case 'progression':
                return <ProgressionTab />;
            case 'relationships':
                return <NewRelationships />;
            case 'journal':
                return <NewJournal />;
            default:
                return <CharacterSheet />;
        }
    };

    const tabConfig: Record<Tab, { label: string, icon: React.ReactNode }> = {
        character: { label: 'Personagem', icon: <User className="h-5 w-5"/> },
        inventory: { label: 'Inventário', icon: <Backpack className="h-5 w-5"/> },
        spells: { label: 'Magias', icon: <BookOpen className="h-5 w-5"/> },
        journal: { label: 'Diário', icon: <Map className="h-5 w-5"/> },
        relationships: { label: 'Relações', icon: <Users className="h-5 w-5"/> },
        progression: { label: 'Progresso', icon: <TrendingUp className="h-5 w-5"/> },
    };

    return (
        <>
            <Head>
                {/* Carrega as libs de dados 3D apenas quando necessário */}
                <script src="/extras/dice-main/libs/teal.js" defer></script>
                <script src="/extras/dice-main/libs/three.min.js" defer></script>
                <script src="/extras/dice-main/libs/cannon.min.js" defer></script>
                <script src="/extras/dice-main/dice.js" defer></script>
            </Head>
            <div className="flex flex-col h-full w-full max-w-7xl mx-auto animate-fadeIn">
                {levelUpState?.isPending && <LevelUpModal />}
                {shopState?.isOpen && <ShopModal />}
                {apiError && <ErrorModal message={apiError} onClose={clearApiError} />}
                {skillCheckRequest && (
                    <SkillCheckModal
                        skillName={skillCheckRequest.skillName}
                        onConfirm={handleSkillCheckSubmit}
                        onClose={() => setSkillCheckRequest(null)}
                    />
                )}
                <AmbientPlayer /> 

                <Header />
                
                {combatState.isActive && <CombatTracker />}

                <div className="flex-grow grid grid-cols-12 gap-4 mt-4 overflow-hidden">
                    <div className="col-span-12 md:col-span-7 lg:col-span-8 flex flex-col bg-stone-800/60 backdrop-blur-sm rounded-lg border border-stone-700/80 overflow-hidden">
                        <div className="flex-grow p-4 overflow-y-auto h-0 pb-40 md:pb-4">
                            <NewNarrativeLog />
                        </div>
                        <ActionOptions />
                    </div>
                    
                    <aside className="hidden md:flex md:flex-col col-span-5 lg:col-span-4 bg-stone-800/60 backdrop-blur-sm rounded-lg border border-stone-700/80 overflow-hidden">
                        <div className="flex-none border-b border-stone-700 flex justify-around">
                            {Object.entries(tabConfig).map(([key, {label, icon}]) => (
                                <button 
                                    key={key} 
                                    onClick={() => setActiveTab(key as Tab)} 
                                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-2 text-xs font-semibold transition-colors ${activeTab === key ? 'bg-stone-900/50 text-amber-400' : 'text-stone-400 hover:bg-stone-900/30'}`}
                                    title={label}
                                >
                                    {icon}
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex-grow overflow-y-auto">
                            {renderSidebarContent()}
                        </div>
                    </aside>
                </div>

                <MobileToolbar 
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    tabConfig={tabConfig}
                >
                    {renderSidebarContent()}
                </MobileToolbar>
            </div>
        </>
    );
};

export default GameScreen;
