import React from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';

const StructuredRestPanel: React.FC = () => {
    const { processPlayerAction, isLoading, setPendingStructuredIntent, combatState } = useGameStateContext();
    const isCombatActive = combatState?.isActive;

    const handleRest = (restType: 'short' | 'long') => {
        setPendingStructuredIntent({
            type: 'rest',
            payload: { restType },
        });
        processPlayerAction(
            restType === 'short'
                ? 'Quero fazer um descanso curto para recuperar o fôlego.'
                : 'Organizo um descanso longo para recuperar minhas forças.'
        );
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-300">Descansar</p>
            <p className="text-xs text-stone-400">Aplique as regras oficiais de descanso.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => handleRest('short')}
                    disabled={isCombatActive || isLoading}
                    className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                    Descanso curto
                </button>
                <button
                    type="button"
                    onClick={() => handleRest('long')}
                    disabled={isCombatActive || isLoading}
                    className="rounded-xl border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-300/60 hover:bg-blue-500/20 disabled:opacity-40"
                >
                    Descanso longo
                </button>
            </div>
            {isCombatActive && (
                <p className="mt-2 text-[11px] text-red-300">Interrompa o combate antes de descansar.</p>
            )}
        </div>
    );
};

export default StructuredRestPanel;
