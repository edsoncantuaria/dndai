// src/components/GameScreen.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Header from './Header';
import ActionOptions from './ActionOptions';
import Inventory from './Inventory';
import CharacterSheet from './CharacterSheet';
import Spellbook from './Spellbook';
import MobileToolbar from './MobileToolbar';
import NewCombatTracker from './NewCombatTracker';
import { useGameStateContext } from '../contexts/GameStateContext';
import LevelUpModal from './LevelUpModal';
import ProgressionTab from './ProgressionTab';
import ShopModal from './ShopModal';
import ErrorModal from './ui/ErrorModal';
import NewNarrativeLog from './NewNarrativeLog';
import NewJournal from './NewJournal';
import NewRelationships from './NewRelationships';
import AmbientPlayer from './AmbientPlayer';
import DiceRollModal from './DiceRollModal';
import SkillCheckModal from './ui/SkillCheckModal';
import SpellCastModal from './ui/SpellCastModal';
import { User, Backpack, BookOpen, Map, Users, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import Vignette from './Vignette'; // Importar o novo componente
import { Loader2 } from 'lucide-react';

type Tab = 'character' | 'inventory' | 'spells' | 'progression' | 'relationships' | 'journal';

interface GameScreenProps {
    returnToMenu: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ returnToMenu }) => {
    const [activeTab, setActiveTab] = useState<Tab>('character');
    const { 
        character,
        log,
        isLoading,
        levelUpState, 
        shopState, 
        apiError, 
        clearApiError,
        playerRollRequest,
        setPlayerRollRequest,
        handleRollResult,
        skillCheckRequest,
        setSkillCheckRequest,
        handleSkillCheckSubmit,
        spellCastRequest,
        setSpellCastRequest,
        submitSpellCast,
    } = useGameStateContext();

    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
    
    // O useEffect para mostrar o modal de dados foi removido.
    // A visibilidade agora é controlada diretamente pela existência do `playerRollRequest`.
    // Isso evita o atraso e simplifica a lógica.
    const showDiceModal = !!playerRollRequest;


    const handleModalAction = () => setIsMobileSheetOpen(false);

    const renderSidebarContent = () => {
        switch (activeTab) {
            case 'character':
                return <CharacterSheet onModalAction={handleModalAction} />;
            case 'inventory':
                return <Inventory />;
            case 'spells':
                return <Spellbook onModalAction={handleModalAction} />;
            case 'progression':
                return <ProgressionTab />;
            case 'relationships':
                return <NewRelationships />;
            case 'journal':
                return <NewJournal />;
            default:
                return <CharacterSheet onModalAction={handleModalAction} />;
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
    
    // Mostra um loader principal se o personagem ainda não carregou
    if (!character) {
        return (
           <div className="flex flex-col items-center justify-center h-full text-center text-stone-300">
               <Loader2 className="h-12 w-12 animate-spin mb-4" />
               <h2 className="text-2xl font-bold font-garamond text-amber-300">Carregando Aventura...</h2>
           </div>
       );
    }
    
    // Mostra um loader específico se estivermos aguardando a primeira narração.
    if (isLoading && log.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-stone-300">
                <Loader2 className="h-12 w-12 animate-spin mb-4" />
                <h2 className="text-2xl font-bold font-garamond text-amber-300">Aguarde...</h2>
                <p className="mt-2">O Mestre de Jogo está preparando o início da sua jornada.</p>
            </div>
        )
    }

    return (
        <>
            <div className="flex flex-col h-full w-full max-w-7xl mx-auto animate-fadeIn relative">
                <Vignette />
                {levelUpState?.isPending && <LevelUpModal />}
                {shopState?.isOpen && <ShopModal />}
                {apiError && <ErrorModal message={apiError} onClose={clearApiError} />}
                {showDiceModal && (
                    <DiceRollModal 
                        request={playerRollRequest!}
                        onRoll={handleRollResult}
                        onClose={() => setPlayerRollRequest(null)}
                        show={showDiceModal}
                    />
                )}
                {skillCheckRequest && (
                    <SkillCheckModal
                        skillName={skillCheckRequest.skillName}
                        onConfirm={handleSkillCheckSubmit}
                        onClose={() => setSkillCheckRequest(null)}
                    />
                )}
                {spellCastRequest && (
                    <SpellCastModal
                        spell={spellCastRequest.spell}
                        onConfirm={(spell, desc) => submitSpellCast(spell, desc)}
                        onClose={() => setSpellCastRequest(null)}
                    />
                )}
                <AmbientPlayer /> 

                <Header returnToMenu={returnToMenu} />
                
                <NewCombatTracker /> 

                <div className={cn("flex-grow grid grid-cols-12 gap-4 mt-4 overflow-hidden", "md:mb-0 mb-16")}>
                    <div className="col-span-12 md:col-span-7 lg:col-span-8 flex flex-col bg-stone-800/60 backdrop-blur-sm rounded-lg border border-stone-700/80 overflow-hidden">
                        <div className={cn(
                            "flex-grow p-4 overflow-y-auto h-0"
                        )}>
                            <NewNarrativeLog />
                        </div>
                        <ActionOptions />
                    </div>
                    
                    <aside className="hidden md:flex md:flex-col col-span-5 lg:col-span-4 bg-stone-800/60 backdrop-blur-sm rounded-lg border border-stone-700/80 overflow-hidden">
                        <div className="flex-none border-b border-stone-700 flex justify-around">
                            {(Object.keys(tabConfig) as Tab[]).map((key) => {
                                const tabKey = key as Tab;
                                return (
                                <button 
                                    key={key} 
                                    onClick={() => setActiveTab(tabKey)} 
                                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-2 text-xs font-semibold transition-colors ${activeTab === tabKey ? 'bg-stone-900/50 text-amber-400' : 'text-stone-400 hover:bg-stone-900/30'}`}
                                    title={tabConfig[tabKey].label}
                                >
                                    {tabConfig[tabKey].icon}
                                    <span className="hidden lg:inline">{tabConfig[tabKey].label}</span>
                                </button>
                            )})}
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
                    isOpen={isMobileSheetOpen}
                    setIsOpen={setIsMobileSheetOpen}
                >
                    {renderSidebarContent()}
                </MobileToolbar>
            </div>
        </>
    );
};

export default GameScreen;
`