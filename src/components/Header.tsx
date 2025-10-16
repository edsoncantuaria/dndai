// src/components/Header.tsx
'use client';
import React, { useState, useMemo } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { User, Heart, Shield, Loader2, Settings, DoorOpen, Zap, Eye, Brain, Search } from 'lucide-react';
import ActionModal from '@/components/ui/ActionModal';
import SettingsModal from './SettingsModal';
import { useAuth } from '@/contexts/AuthContext';
import { translateApiString, translateAttribute } from '@/utils/translator';
import type { Attributes } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


interface HeaderProps {
    returnToMenu: () => void;
}

const Header: React.FC<HeaderProps> = ({ returnToMenu }) => {
    const { character, isLoading } = useGameStateContext();
    const { logout } = useAuth();
    
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);

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

    return (
        <>
            <TooltipProvider delayDuration={0}>
                <div className="flex-shrink-0 bg-stone-900/50 backdrop-blur-sm p-3 rounded-lg border border-stone-700">
                    <div className="flex justify-between items-start gap-4">
                        {/* Character Info & XP */}
                        <div className="flex-grow">
                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-2">
                                <h2 className="font-bold text-xl text-stone-100 truncate font-garamond">{name}</h2>
                                <p className="text-sm text-stone-400">
                                    {translateApiString(race || '')} {translateApiString(characterClass || '')} de Nível {level}
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

                        {/* Desktop Action Buttons */}
                        <div className="hidden md:flex items-center justify-end gap-2 flex-shrink-0">
                            <button
                                onClick={() => setShowSettingsModal(true)}
                                disabled={isInteractionDisabled}
                                className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                                title="Configurações"
                            >
                                <Settings className="h-5 w-5 text-amber-300" />
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
                            <button
                                onClick={() => setShowSettingsModal(true)}
                                disabled={isInteractionDisabled}
                                className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                                title="Configurações"
                            >
                                <Settings className="h-4 w-4 text-amber-300" />
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
            </TooltipProvider>

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
