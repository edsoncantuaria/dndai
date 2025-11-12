import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';

const SKILL_OPTIONS = [
    { index: 'acrobatics', label: 'Acrobacia', ability: 'dexterity' },
    { index: 'animal-handling', label: 'Adestrar Animais', ability: 'wisdom' },
    { index: 'arcana', label: 'Arcanismo', ability: 'intelligence' },
    { index: 'athletics', label: 'Atletismo', ability: 'strength' },
    { index: 'deception', label: 'Enganação', ability: 'charisma' },
    { index: 'history', label: 'História', ability: 'intelligence' },
    { index: 'insight', label: 'Intuição', ability: 'wisdom' },
    { index: 'intimidation', label: 'Intimidação', ability: 'charisma' },
    { index: 'investigation', label: 'Investigação', ability: 'intelligence' },
    { index: 'medicine', label: 'Medicina', ability: 'wisdom' },
    { index: 'nature', label: 'Natureza', ability: 'intelligence' },
    { index: 'perception', label: 'Percepção', ability: 'wisdom' },
    { index: 'performance', label: 'Atuação', ability: 'charisma' },
    { index: 'persuasion', label: 'Persuasão', ability: 'charisma' },
    { index: 'religion', label: 'Religião', ability: 'intelligence' },
    { index: 'sleight-of-hand', label: 'Prestidigitação', ability: 'dexterity' },
    { index: 'stealth', label: 'Furtividade', ability: 'dexterity' },
    { index: 'survival', label: 'Sobrevivência', ability: 'wisdom' },
] as const;

const StructuredSkillPanel: React.FC = () => {
    const { processPlayerAction, isLoading, setPendingStructuredIntent } = useGameStateContext();
    const [selectedSkill, setSelectedSkill] = useState(SKILL_OPTIONS[0]?.index ?? 'perception');
    const [targetDc, setTargetDc] = useState('');

    const selectedSkillLabel = useMemo(() => {
        return SKILL_OPTIONS.find(skill => skill.index === selectedSkill)?.label ?? 'perícia';
    }, [selectedSkill]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setPendingStructuredIntent({
            type: 'skill-check',
            payload: {
                skillIndex: selectedSkill,
                dc: targetDc ? Number(targetDc) : undefined,
            },
        });
        processPlayerAction(`Eu tento usar ${selectedSkillLabel}.`);
        setTargetDc('');
    };

    if (!SKILL_OPTIONS.length) return null;

    return (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Teste de Perícia</p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex-1 text-sm text-stone-300">
                    Perícia
                    <select
                        className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100"
                        value={selectedSkill}
                        onChange={event => setSelectedSkill(event.target.value)}
                    >
                        {SKILL_OPTIONS.map(skill => (
                            <option key={skill.index} value={skill.index}>
                                {skill.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="w-full max-w-[140px] text-sm text-stone-300">
                    CD alvo
                    <input
                        type="number"
                        min={5}
                        max={30}
                        className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100"
                        value={targetDc}
                        onChange={event => setTargetDc(event.target.value)}
                        placeholder="opcional"
                    />
                </label>
            </div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 py-2 text-sm font-semibold text-stone-900 transition hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-50"
            >
                Solicitar teste
            </button>
        </form>
    );
};

export default StructuredSkillPanel;
