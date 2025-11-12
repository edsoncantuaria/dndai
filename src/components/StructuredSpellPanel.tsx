import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { CharacterSpell } from '@/types';

const ABILITY_OPTIONS = [
    { value: 'intelligence', label: 'Inteligência' },
    { value: 'wisdom', label: 'Sabedoria' },
    { value: 'charisma', label: 'Carisma' },
];

const StructuredSpellPanel: React.FC = () => {
    const { character, isLoading, processPlayerAction, setPendingStructuredIntent } = useGameStateContext();
    const spells = character?.spells ?? [];
    const [selectedSpell, setSelectedSpell] = useState(() => (spells[0] as CharacterSpell | undefined)?.spellName ?? '');
    const [ability, setAbility] = useState<'intelligence' | 'wisdom' | 'charisma'>('intelligence');
    const [targetAc, setTargetAc] = useState('');

    const sanitizedSpell = useMemo(() => selectedSpell?.trim(), [selectedSpell]);
    if (!spells.length) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!sanitizedSpell) return;
        setPendingStructuredIntent({
            type: 'spell-attack',
            payload: {
                spellIndex: sanitizedSpell,
                ability,
                targetArmorClass: targetAc ? Number(targetAc) : undefined,
            },
        });
        processPlayerAction(`Eu conjuro ${sanitizedSpell}${targetAc ? ` contra CA ${targetAc}` : ''}.`);
        setTargetAc('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Ataque de Magia</p>
            <div className="flex flex-col gap-2">
                <label className="text-sm text-stone-300">
                    Magia preparada
                    <select
                        className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100"
                        value={selectedSpell}
                        onChange={event => setSelectedSpell(event.target.value)}
                    >
                        {spells.map(spell => (
                            <option key={spell.id} value={spell.spellName}>
                                {spell.spellName}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="flex-1 text-sm text-stone-300">
                        Habilidade
                        <select
                            className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100"
                            value={ability}
                            onChange={event => setAbility(event.target.value as typeof ability)}
                        >
                            {ABILITY_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="w-full max-w-[140px] text-sm text-stone-300">
                        CA alvo
                        <input
                            type="number"
                            min={5}
                            max={30}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100"
                            value={targetAc}
                            onChange={event => setTargetAc(event.target.value)}
                            placeholder="opcional"
                        />
                    </label>
                </div>
            </div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-gradient-to-r from-purple-400 to-purple-600 py-2 text-sm font-semibold text-stone-900 transition hover:from-purple-300 hover:to-purple-500 disabled:opacity-50"
            >
                Solicitar jogada de magia
            </button>
        </form>
    );
};

export default StructuredSpellPanel;
