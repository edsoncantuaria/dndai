// src/components/NewCombatTracker.tsx
'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords, ChevronDown, Loader2 } from 'lucide-react';
import CombatantHeaderInfo from './CombatantHeaderInfo';
import { cn } from '@/lib/utils';
import { isUiV2Enabled } from '@/lib/uiV2';
import { GameplayCombatTracker } from '@/features/gameplay/combat/GameplayCombatTracker';
import { useCombatTrackerData } from '@/features/gameplay/combat/useCombatTrackerData';

const NewCombatTracker: React.FC = () => {
    if (isUiV2Enabled()) {
        return <GameplayCombatTracker />;
    }

    return <LegacyCombatTracker />;
};

/** @deprecated Use `GameplayCombatTracker` (UI v2). */
const LegacyCombatTracker: React.FC = () => {
    const { nextTurn, isLoading } = useGameStateContext();
    const [isExpanded, setIsExpanded] = useState(false);

    const {
        ready,
        allCombatants,
        currentCombatant,
        upcomingCombatants,
        isPlayerTurn,
        round,
    } = useCombatTrackerData();

    if (!ready) {
        return null;
    }

    const containerGlow = isPlayerTurn
        ? 'border-amber-400/70 shadow-[0_0_35px_rgba(251,191,36,0.35)]'
        : 'border-rose-500/40 shadow-[0_0_35px_rgba(244,63,94,0.3)]';
    const headerAccent = isPlayerTurn ? 'text-amber-200' : 'text-rose-200';

    return (
        <motion.div
            className={cn(
                'relative flex flex-shrink-0 flex-col overflow-hidden rounded-3xl border bg-[#070b14]/90 p-4 backdrop-blur-xl',
                containerGlow
            )}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            layout
        >
            <div
                className={cn(
                    'pointer-events-none absolute inset-0 bg-gradient-to-r opacity-40',
                    isPlayerTurn ? 'from-amber-500/20 via-amber-300/10 to-transparent' : 'from-red-600/20 via-rose-500/10 to-transparent'
                )}
            />
            <div className="relative flex-shrink-0">
                <button
                    className="flex w-full items-center justify-between"
                    onClick={() => setIsExpanded(!isExpanded)}
                    aria-expanded={isExpanded}
                >
                    <h3 className={cn('flex items-center gap-2 font-serif text-xl font-bold', headerAccent)}>
                        <Swords />
                        <span>COMBATE ATIVO</span>
                    </h3>

                    <div className="flex items-center gap-4 text-xs uppercase tracking-[0.4em] text-stone-400">
                        {!isExpanded && currentCombatant && (
                            <CombatantHeaderInfo combatant={currentCombatant as Combatant} />
                        )}
                        <span
                            className={cn(
                                'rounded-full border border-white/10 px-3 py-1 font-mono text-base',
                                headerAccent
                            )}
                        >
                            Round {round}
                        </span>
                        <ChevronDown
                            className={cn('h-6 w-6 transition-transform hover:text-white', headerAccent, {
                                'rotate-180': isExpanded,
                            })}
                        />
                    </div>
                </button>
            </div>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        key="combat-body"
                        className="mt-4 flex min-h-0 flex-grow flex-col overflow-hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    >
                        <div className="max-h-[60vh] min-h-0 flex-grow space-y-3 overflow-y-auto pr-2">
                            {currentCombatant && (
                                <motion.div
                                    className="space-y-3"
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    layout
                                >
                                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">
                                        Turno Atual: {currentCombatant.name}
                                    </p>
                                    <CombatantCard
                                        key={currentCombatant.id}
                                        combatant={currentCombatant as Combatant}
                                        isCurrentTurn={true}
                                        isPlayer={!!currentCombatant.isPlayer}
                                    />
                                </motion.div>
                            )}

                            {upcomingCombatants.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-stone-300">
                                        Próximos
                                    </p>
                                    <div className="space-y-3 opacity-90">
                                        <AnimatePresence>
                                            {upcomingCombatants.map((combatant) => (
                                                <motion.div
                                                    key={combatant.id}
                                                    initial={{ opacity: 0, x: 12 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -10 }}
                                                    layout
                                                >
                                                    <CombatantCard
                                                        combatant={combatant as Combatant}
                                                        isCurrentTurn={false}
                                                        isPlayer={!!combatant.isPlayer}
                                                    />
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!isPlayerTurn && (
                <div className="relative mt-4 flex-shrink-0">
                    <button
                        type="button"
                        onClick={nextTurn}
                        disabled={isLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-2 font-semibold text-stone-900 shadow-lg transition hover:from-amber-200 hover:to-amber-400 disabled:opacity-40"
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Próximo Turno'}
                    </button>
                </div>
            )}
        </motion.div>
    );
};

export default NewCombatTracker;
