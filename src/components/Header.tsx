// src/components/Header.tsx
'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { User, Heart, Shield, Loader2, Settings, DoorOpen, Zap, Eye, Brain, Search, BookOpenCheck, Volume2, VolumeX } from 'lucide-react';
import ActionModal from '@/components/ui/ActionModal';
import SettingsModal from './SettingsModal';
import { useAuth } from '@/contexts/AuthContext';
import type { Attributes } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import ProgressionFeed from './ProgressionFeed';
import { cn } from '@/lib/utils';


interface HeaderProps {
    returnToMenu: () => void;
    onOpenGuidedTips?: () => void;
}

const Header: React.FC<HeaderProps> = ({ returnToMenu, onOpenGuidedTips }) => {
    const { character, isLoading, progressionFeed } = useGameStateContext();
    const { logout } = useAuth();
    
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [isNarrationActive, setIsNarrationActive] = useState(false);

    const {
        name,
        level,
        characterClass,
        race,
        hp,
        ac,
        xp,
        xpToNextLevel,
        modifiers,
        proficiencies,
        proficiencyBonus,
    } = character || {};

    // Memoize passive scores calculation
    const passiveScores = useMemo(() => {
        const calculatePassiveScore = (skillName: string, attribute: keyof Attributes) => {
            if (!modifiers) return 10;
            const isProficient = (proficiencies || []).some(p => p?.name?.toLowerCase().includes(skillName.toLowerCase()));
            return 10 + (modifiers[attribute] || 0) + (isProficient ? (proficiencyBonus || 0) : 0);
        };
        return {
            perception: calculatePassiveScore('perception', 'wisdom'),
            insight: calculatePassiveScore('insight', 'wisdom'),
            investigation: calculatePassiveScore('investigation', 'intelligence'),
        }
    }, [modifiers, proficiencies, proficiencyBonus]);

    if (!character) {
        return null; // Render nothing if character data is not available
    }

    const xpPercentage = (xpToNextLevel ?? 0) > 0 ? ((xp ?? 0) / (xpToNextLevel ?? 1)) * 100 : 0;
    const initiativeBonus = modifiers?.dexterity ?? 0;
    const isInteractionDisabled = isLoading;

    const timeOfDayClass = useMemo(() => {
        const time = character.worldState?.timeOfDay?.toLowerCase() || '';
        if (time.includes('manhã')) return 'from-amber-200/40 via-yellow-100/5 to-transparent';
        if (time.includes('tarde')) return 'from-orange-300/40 via-amber-200/10 to-transparent';
        if (time.includes('noite')) return 'from-indigo-900/40 via-purple-800/20 to-transparent';
        if (time.includes('madrugada')) return 'from-blue-900/40 via-indigo-800/20 to-transparent';
        return 'from-stone-800/30 via-stone-900/20 to-transparent';
    }, [character.worldState?.timeOfDay]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ active?: boolean }>).detail;
            setIsNarrationActive(Boolean(detail?.active));
        };
        window.addEventListener('narration-speech', handler as EventListener);
        return () => {
            window.removeEventListener('narration-speech', handler as EventListener);
        };
    }, []);

    const handleNarrationToggle = useCallback(() => {
        if (isNarrationActive) {
            window.dispatchEvent(new Event('narration-stop-request'));
        } else {
            window.dispatchEvent(new Event('narration-play-request'));
        }
    }, [isNarrationActive]);

    return (
        <>
            <div className="relative flex-shrink-0 rounded-lg border border-stone-700 bg-stone-900/70 overflow-hidden">
                <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-r opacity-70 transition-colors duration-700', timeOfDayClass)} />
                <div className="relative p-3">
                <div className="flex justify-between items-start gap-4">
                    {/* Character Info & XP */}
                    <div className="flex-grow">
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-2">
                            <h2 className="font-bold text-xl text-stone-100 truncate font-garamond">{name}</h2>
                            <p className="text-sm text-stone-400">
                                {race || ''} {characterClass || ''} de Nível {level}
                            </p>
                        </div>
                        <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-stone-300">XP</span>
                                <span className="font-mono text-stone-400">{xp} / {xpToNextLevel}</span>
                            </div>
                            <div className="w-full bg-stone-700 rounded-full h-2 border border-stone-600 overflow-hidden relative">
                                <div 
                                    className="bg-purple-600 h-full rounded-full transition-all duration-300" 
                                    style={{ width: `${xpPercentage}%`}}
                                ></div>
                            </div>
                        </div>
                    </div>
                    <ProgressionFeed items={progressionFeed} />

                    {/* Desktop Action Buttons */}
                    <div className="hidden md:flex items-center justify-end gap-2 flex-shrink-0">
                        {onOpenGuidedTips && (
                            <button
                                onClick={onOpenGuidedTips}
                                disabled={isInteractionDisabled}
                                className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                                title="Tour guiado"
                            >
                                <BookOpenCheck className="h-5 w-5 text-amber-300" />
                            </button>
                        )}
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Configurações"
                        >
                            <Settings className="h-5 w-5 text-amber-300" />
                        </button>
                        <button
                            onClick={handleNarrationToggle}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title={isNarrationActive ? 'Parar narração' : 'Ouvir narrativa atual'}
                        >
                            {isNarrationActive ? (
                                <VolumeX className="h-5 w-5 text-amber-300" />
                            ) : (
                                <Volume2 className="h-5 w-5 text-amber-300" />
                            )}
                        </button>
                        <button
                            onClick={() => setShowExitModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Sair da Aventura"
                        >
                            <DoorOpen className="h-5 w-5 text-amber-300" />
                        </button>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
                        {onOpenGuidedTips && (
                            <button
                                onClick={onOpenGuidedTips}
                                disabled={isInteractionDisabled}
                                className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                                title="Tour guiado"
                            >
                                <BookOpenCheck className="h-4 w-4 text-amber-300" />
                            </button>
                        )}
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Configurações"
                        >
                            <Settings className="h-4 w-4 text-amber-300" />
                        </button>
                        <button
                            onClick={handleNarrationToggle}
                            disabled={isInteractionDisabled}
                            className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title={isNarrationActive ? 'Parar narração' : 'Ouvir narrativa atual'}
                        >
                            {isNarrationActive ? (
                                <VolumeX className="h-4 w-4 text-amber-300" />
                            ) : (
                                <Volume2 className="h-4 w-4 text-amber-300" />
                            )}
                        </button>
                        <button
                            onClick={() => setShowExitModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Sair da Aventura"
                        >
                            <DoorOpen className="h-4 w-4 text-amber-300" />
                        </button>
                    </div>
                </div>

                {/* Stats for both Mobile and Desktop */}
                <div className="grid grid-cols-6 gap-x-1 sm:gap-x-2 text-center mt-3 pt-3 border-t border-stone-700/50">
                    {/* HP */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="flex flex-col items-center justify-center">
                                <Heart className="h-4 w-4 text-red-300"/>
                                <div className="font-mono font-semibold text-sm sm:text-base"><span className="whitespace-nowrap">{hp?.current} / {hp?.max}</span></div>
                                <div className="hidden sm:block text-xs font-bold text-red-300 uppercase">Vida</div>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Pontos de Vida</p>
                        </TooltipContent>
                    </Tooltip>
                    
                    {/* AC */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="flex flex-col items-center justify-center">
                                <Shield className="h-4 w-4 text-blue-300"/>
                                <div className="font-mono font-semibold text-sm sm:text-base">{ac?.value}</div>
                                <div className="hidden sm:block text-xs font-bold text-blue-300 uppercase">CA</div>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Classe de Armadura</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Initiative */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="flex flex-col items-center justify-center">
                                <Zap className="h-4 w-4 text-green-300"/>
                                <div className="font-mono font-semibold text-sm sm:text-base">{initiativeBonus >= 0 ? `+${initiativeBonus}`: initiativeBonus}</div>
                                <div className="hidden sm:block text-xs font-bold text-green-300 uppercase">Iniciativa</div>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Iniciativa</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Passive Perception */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="flex flex-col items-center justify-center">
                                <Eye className="h-4 w-4 text-stone-400"/>
                                <p className="font-mono font-semibold text-sm sm:text-base">{passiveScores.perception}</p>
                                <div className="hidden sm:block text-xs font-bold text-stone-400 uppercase">Percepção</div>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Percepção Passiva</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Passive Insight */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="flex flex-col items-center justify-center">
                                <Brain className="h-4 w-4 text-stone-400"/>
                                <p className="font-mono font-semibold text-sm sm:text-base">{passiveScores.insight}</p>
                                <div className="hidden sm:block text-xs font-bold text-stone-400 uppercase">Intuição</div>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Intuição Passiva</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Passive Investigation */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="flex flex-col items-center justify-center">
                                <Search className="h-4 w-4 text-stone-400"/>
                                <p className="font-mono font-semibold text-sm sm:text-base">{passiveScores.investigation}</p>
                                <div className="hidden sm:block text-xs font-bold text-stone-400 uppercase">Investig.</div>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Investigação Passiva</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
            </div>

            {showExitModal && (
                <ActionModal
                    isOpen={showExitModal}
                    title="Sair da Aventura?"
                    onClose={() => setShowExitModal(false)}
                    actions={[
                        { text: "Cancelar", onClick: () => setShowExitModal(false), variant: 'secondary' },
                        { text: "Voltar ao Menu", onClick: returnToMenu, variant: 'primary' },
                        { text: "Sair da Conta (Logout)", onClick: logout, variant: 'destructive' }
                    ]}
                >
                    <p className="text-stone-300">Seu progresso é salvo automaticamente. Deseja voltar ao menu principal ou fazer logout completo?</p>
                </ActionModal>
            )}

            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />
        </>
    );
};

export default Header;
