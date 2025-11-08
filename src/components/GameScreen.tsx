// src/components/GameScreen.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import ActionModal from './ui/ActionModal'; // Importar o ActionModal
import { User, Backpack, BookOpen, Map as MapIcon, Users, TrendingUp, Loader2, Download, MapPinned, Star, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import Vignette from './Vignette'; // Importar o novo componente
import StoryHighlightsCard from './StoryHighlightsCard';
import GameHud from './GameHud';
import { useToast } from '@/hooks/use-toast';
import { useEventFeedback } from '@/hooks/useEventFeedback';
import DailyRecapPanel from './DailyRecapPanel';
import GuidedTipsOverlay from './GuidedTipsOverlay';
import { useSettingsContext } from '@/contexts/SettingsContext';
import PremiumLoader from '@/components/ui/PremiumLoader';
import { TooltipProvider } from './ui/tooltip';


type Tab = 'character' | 'inventory' | 'spells' | 'progression' | 'relationships' | 'journal';

interface GameScreenProps {
    returnToMenu: () => void;
}

const ReinstallDependenciesModal: React.FC = () => {
    const { reinstallModal, setReinstallModal, isLoading } = useGameStateContext();

    if (!reinstallModal.open) return null;

    return (
        <ActionModal
            isOpen={true}
            title="Dependências Faltando"
            onClose={() => setReinstallModal({ open: false, deps: [], onConfirm: () => {} })}
            actions={[
                {
                    text: `Reinstalar (${reinstallModal.deps.length})`,
                    onClick: reinstallModal.onConfirm,
                    variant: 'primary',
                    disabled: isLoading,
                    icon: isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />
                }
            ]}
        >
            <p className="text-stone-300 mb-4">
                Para continuar esta aventura, o seguinte conteúdo homebrew precisa ser reinstalado. Isso não afetará suas outras sessões.
            </p>
            <div className="max-h-60 overflow-y-auto bg-stone-800/50 p-3 rounded-md border border-stone-700">
                <ul className="list-disc list-inside text-stone-300 space-y-1">
                    {reinstallModal.deps.map(dep => (
                        <li key={dep.id}>{dep.name}</li>
                    ))}
                </ul>
            </div>
        </ActionModal>
    );
};


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
        combatState,
    } = useGameStateContext();

    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
    const [isStoryDrawerOpen, setIsStoryDrawerOpen] = useState(false);
    const [isGuidedTipsOpen, setIsGuidedTipsOpen] = useState(false);
    const [guidedDismissed, setGuidedDismissed] = useState(false);
    const [guidedStep, setGuidedStep] = useState(0);
    const { toast } = useToast();
    const { hasSeenGuidedTips, setHasSeenGuidedTips } = useSettingsContext();
    const { playCue } = useEventFeedback();
    const [eventBadges, setEventBadges] = useState<Array<{ id: string; text: string; variant: 'xp' | 'ally' | 'enemy'; icon: React.ReactNode }>>([]);
    const showCombatHud = combatState?.isActive;
    const prevStatsRef = React.useRef<{
        xp?: number;
        inventoryTotal?: number;
        relationships?: Map<string, number>;
    }>({});
    
    const showDiceModal = !!playerRollRequest;
    
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const storedStep = window.localStorage.getItem('guidedTipsStep');
        if (storedStep) {
            const parsed = parseInt(storedStep, 10);
            if (!Number.isNaN(parsed)) {
                setGuidedStep(parsed);
            }
        }
    }, []);

    const handleGuidedStepChange = useCallback((next: number) => {
        setGuidedStep(next);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('guidedTipsStep', String(next));
        }
    }, []);

    const handleGuidedComplete = useCallback(() => {
        setHasSeenGuidedTips(true);
        setGuidedStep(0);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('guidedTipsStep');
        }
    }, [setHasSeenGuidedTips]);

    const handleGuidedClose = useCallback(() => {
        setGuidedDismissed(true);
        setIsGuidedTipsOpen(false);
    }, []);

    const handleOpenGuidedTour = useCallback(() => {
        setGuidedDismissed(false);
        setIsGuidedTipsOpen(true);
    }, []);

    useEffect(() => {
        if (!hasSeenGuidedTips) {
            setGuidedDismissed(false);
        }
    }, [hasSeenGuidedTips]);

    useEffect(() => {
        if (isMobileSheetOpen || isStoryDrawerOpen) {
            document.body.classList.add('overscroll-contain');
        } else {
            document.body.classList.remove('overscroll-contain');
        }
        return () => {
            document.body.classList.remove('overscroll-contain');
        }
    }, [isMobileSheetOpen, isStoryDrawerOpen]);


    useEffect(() => {
        if (!character) return;
        const timeoutId = setTimeout(() => {
            if (!hasSeenGuidedTips && !guidedDismissed) {
                setIsGuidedTipsOpen(true);
            }
        }, 1500); // Delay opening the tour to let the UI settle
        
        return () => clearTimeout(timeoutId);
    }, [character, hasSeenGuidedTips, guidedDismissed]);

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
        journal: { label: 'Diário', icon: <MapIcon className="h-5 w-5"/> },
        relationships: { label: 'Relações', icon: <Users className="h-5 w-5"/> },
        progression: { label: 'Progresso', icon: <TrendingUp className="h-5 w-5"/> },
    };
    
    if (isLoading && !character) {
        return (
            <PremiumLoader
                title="O Mestre está remontando a cena"
                subtitle="Recuperando aliados, inventário, registros do diário e o último ponto da história."
                description="Sincronizando dados da sessão, combatentes ativos e trilha de ambientação..."
            />
        );
    }

    const pushBadge = useCallback((badge: { text: string; variant: 'xp' | 'ally' | 'enemy'; icon: React.ReactNode }) => {
        const id = `${Date.now()}-${Math.random()}`;
        setEventBadges(prev => [...prev, { ...badge, id }]);
        setTimeout(() => {
            setEventBadges(prev => prev.filter(item => item.id !== id));
        }, 3000);
    }, []);

    useEffect(() => {
        if (!character) return;
        const prev = prevStatsRef.current;
        const safeRelationships = Array.isArray(character.relationships) ? character.relationships : [];

        if (prev.xp !== undefined && character.xp > prev.xp) {
            toast({
                title: 'XP ganho!',
                description: `+${character.xp - prev.xp} XP obtidos.`,
                className: 'bg-emerald-900/80 border border-emerald-500 text-emerald-100',
            });
            playCue('xp');
            pushBadge({
                text: `+${character.xp - prev.xp} XP`,
                variant: 'xp',
                icon: <Star className="h-3.5 w-3.5" />,
            });
        }

        const currentRelMap = new Map<string, number>(
            safeRelationships.map(rel => [rel.npcId || rel.name, rel.affinity ?? 0])
        );
        if (prev.relationships) {
            currentRelMap.forEach((affinity, npcId) => {
                const before = prev.relationships?.get(npcId);
                if (before !== undefined && affinity !== before) {
                    const delta = affinity - before;
                    toast({
                        title: delta > 0 ? 'Afinidade aumentou' : 'Afinidade caiu',
                        description: `${npcId.replace(/_/g, ' ')} ${delta > 0 ? `+${delta}` : delta} pontos.`,
                        className: delta > 0
                            ? 'bg-sky-900/80 border border-sky-500 text-sky-100'
                            : 'bg-rose-900/80 border border-rose-500 text-rose-100',
                    });
                    playCue(delta > 0 ? 'relationshipUp' : 'relationshipDown');
                    pushBadge({
                        text: `${npcId.replace(/_/g, ' ')} ${delta > 0 ? `+${delta}` : delta}`,
                        variant: delta > 0 ? 'ally' : 'enemy',
                        icon: <Heart className="h-3.5 w-3.5" />,
                    });
                }
            });
        }

        const inventoryTotal = (character.inventory || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
        if (prev.inventoryTotal !== undefined && inventoryTotal > prev.inventoryTotal) {
            toast({
                title: 'Inventário atualizado',
                description: `Você adquiriu ${inventoryTotal - prev.inventoryTotal} item(s).`,
                className: 'bg-amber-900/80 border border-amber-500 text-amber-100',
            });
            playCue('loot');
            pushBadge({
                text: `+${inventoryTotal - prev.inventoryTotal} item(s)`,
                variant: 'xp',
                icon: <Backpack className="h-3.5 w-3.5" />,
            });
        }

        prevStatsRef.current = {
            xp: character.xp,
            inventoryTotal,
            relationships: currentRelMap,
        };
    }, [character, toast, playCue, pushBadge]);

    if (!character) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-center text-red-400">
               <h2 className="text-2xl font-bold">Erro ao Carregar Personagem</h2>
                <button onClick={returnToMenu} className="mt-4 px-4 py-2 bg-stone-700 rounded-md">Voltar ao Menu</button>
           </div>
        );
    }
    
    return (
        <TooltipProvider>
            <div className="flex flex-col h-full w-full max-w-7xl mx-auto animate-fadeIn relative">
                <Vignette />
                {isLoading && (
                    <div className="absolute top-4 right-4 z-40 bg-stone-900/80 border border-amber-500/60 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-amber-200 shadow-lg">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>O Mestre está elaborando a próxima cena...</span>
                    </div>
                )}
                <ReinstallDependenciesModal />
                <AnimatePresence>
                    {eventBadges.map(badge => (
                        <motion.div
                            key={badge.id}
                            initial={{ opacity: 0, x: 40, y: 0 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 40 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                'fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-lg border',
                                badge.variant === 'xp'
                                    ? 'bg-amber-500/90 text-stone-900 border-amber-300'
                                    : badge.variant === 'ally'
                                        ? 'bg-emerald-500/90 text-stone-900 border-emerald-300'
                                        : 'bg-rose-500/90 text-stone-900 border-rose-300'
                            )}
                        >
                            {badge.icon}
                            {badge.text}
                        </motion.div>
                    ))}
                </AnimatePresence>
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
                        promptHint={skillCheckRequest.promptText}
                        onConfirm={handleSkillCheckSubmit}
                        onClose={() => setSkillCheckRequest(null)}
                    />
                )}
                {spellCastRequest && (
                    <SpellCastModal
                        spell={spellCastRequest.spell}
                        slotLevel={spellCastRequest.slotLevel}
                        slotsBefore={spellCastRequest.slotsBefore}
                        onConfirm={(spell, desc) => submitSpellCast(spell, desc)}
                        onClose={() => setSpellCastRequest(null)}
                    />
                )}
                <div className="space-y-4 w-full">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-[240px]">
                                    <AmbientPlayer /> 
                                </div>
                                <button
                                    onClick={() => setIsStoryDrawerOpen(true)}
                                    className="md:hidden inline-flex items-center gap-1 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 shadow-lg"
                                >
                                    <MapPinned className="h-4 w-4" />
                                    Fatos
                                </button>
                            </div>
                        </div>
                        {!showCombatHud && <Header returnToMenu={returnToMenu} onOpenGuidedTips={handleOpenGuidedTour} />}
                    </div>
                    {showCombatHud && (
                        <div>
                            <GameHud onExitToMenu={returnToMenu} />
                        </div>
                    )}
                </div>

                <div className={cn("flex-grow grid grid-cols-12 gap-4 mt-4 min-h-0", "md:mb-0 mb-16")}>
                    <div className="col-span-12 md:col-span-7 lg:col-span-8 xl:col-span-6 flex flex-col rounded-3xl border border-white/10 bg-[#080b12]/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden">
                        
                         {/* Container para combate e log */}
                        <div className="flex flex-col flex-grow min-h-0">
                            <NewCombatTracker />
                            
                            <div className="hidden md:block xl:hidden flex-none p-4 border-b border-white/5 bg-white/5">
                                <StoryHighlightsCard />
                            </div>

                            <div className="flex-grow p-4 min-h-0">
                                <div className="rounded-3xl border border-white/5 bg-black/30 p-4 h-full overflow-y-auto">
                                    <NewNarrativeLog />
                                </div>
                            </div>
                        </div>

                        <div className="flex-shrink-0">
                           <ActionOptions />
                        </div>
                    </div>
                    
                    <aside className="hidden md:flex md:flex-col col-span-5 lg:col-span-4 xl:col-span-3 rounded-3xl border border-white/10 bg-[#080b12]/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden">
                        <div className="flex-none border-b border-white/5 flex justify-around">
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
                        <div className="flex-grow overflow-y-auto relative">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.25 }}
                                    className="h-full"
                                >
                                    <div className="tab-shell px-3 py-4">
                                        {renderSidebarContent()}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </aside>
                    <div className="hidden xl:flex xl:flex-col col-span-3 gap-4">
                        <StoryHighlightsCard />
                        <DailyRecapPanel />
                    </div>
                </div>

                 {isStoryDrawerOpen && (
                    <div className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fadeIn">
                        <div
                            className="absolute inset-0"
                            onClick={() => setIsStoryDrawerOpen(false)}
                        />
                        <div className="absolute bottom-16 left-4 right-4 top-16 rounded-2xl border border-stone-700 bg-stone-900/95 overflow-hidden flex flex-col">
                             <div className="p-4 border-b border-stone-700 flex-shrink-0">
                                <button
                                    onClick={() => setIsStoryDrawerOpen(false)}
                                    className="text-sm text-stone-400 hover:text-stone-200"
                                >
                                    Fechar
                                </button>
                            </div>
                            <div className="flex-grow overflow-y-auto p-4">
                                <StoryHighlightsCard variant="compact" />
                            </div>
                        </div>
                    </div>
                )}


                <MobileToolbar 
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    tabConfig={tabConfig}
                    isOpen={isMobileSheetOpen}
                    setIsOpen={setIsMobileSheetOpen}
                >
                    <div className="tab-shell px-3 py-4">
                        {renderSidebarContent()}
                    </div>
                </MobileToolbar>

                <GuidedTipsOverlay
                    isOpen={isGuidedTipsOpen}
                    initialStep={guidedStep}
                    onStepChange={handleGuidedStepChange}
                    onClose={handleGuidedClose}
                    onComplete={() => {
                        handleGuidedComplete();
                        handleGuidedClose();
                    }}
                />
            </div>
        </TooltipProvider>
    );
};

export default GameScreen;

    

    

