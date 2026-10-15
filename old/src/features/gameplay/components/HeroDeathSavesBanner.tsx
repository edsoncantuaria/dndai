'use client';

import { useGameStateContext } from '@/contexts/GameStateContext';

/** Testes de morte — visível no log quando HP = 0. */
export function HeroDeathSavesBanner() {
    const { character } = useGameStateContext();
    if (!character?.hp || character.hp.current > 0) return null;

    const { successes, failures } = character.deathSaves ?? { successes: 0, failures: 0 };

    return (
        <div
            className="mx-2 rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3"
            role="status"
        >
            <h3 className="font-display text-sm text-red-300">Testes de morte</h3>
            <div className="mt-2 flex justify-around gap-4">
                <div className="text-center">
                    <span className="font-ui text-[10px] uppercase tracking-wide text-stone-400">
                        Sucessos
                    </span>
                    <div className="mt-1 flex justify-center gap-1.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={`s-${i}`}
                                className={`h-3.5 w-3.5 rounded-full border-2 ${
                                    i < successes
                                        ? 'border-green-400 bg-green-500'
                                        : 'border-stone-600 bg-stone-800'
                                }`}
                            />
                        ))}
                    </div>
                </div>
                <div className="text-center">
                    <span className="font-ui text-[10px] uppercase tracking-wide text-stone-400">
                        Falhas
                    </span>
                    <div className="mt-1 flex justify-center gap-1.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={`f-${i}`}
                                className={`h-3.5 w-3.5 rounded-full border-2 ${
                                    i < failures
                                        ? 'border-red-500 bg-red-600'
                                        : 'border-stone-600 bg-stone-800'
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
