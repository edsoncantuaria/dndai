import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { CharacterSpell } from '@/types';
import { DndButton, DndCard } from '@/components/primitives';
import {
  structuredFieldClass,
  structuredPanelFormClass,
  structuredPanelTitleClass,
} from '@/features/gameplay/modals/structuredPanelStyles';

const ABILITY_OPTIONS = [
  { value: 'intelligence', label: 'Inteligência' },
  { value: 'wisdom', label: 'Sabedoria' },
  { value: 'charisma', label: 'Carisma' },
];

export interface StructuredSpellPanelProps {
  variant?: 'legacy' | 'v2';
}

const StructuredSpellPanel: React.FC<StructuredSpellPanelProps> = ({ variant = 'legacy' }) => {
  const isV2 = variant === 'v2';
  const { character, isLoading, sendMotorAction } = useGameStateContext();
  const spells = character?.spells ?? [];
  const [selectedSpell, setSelectedSpell] = useState(() => (spells[0] as CharacterSpell | undefined)?.spellName ?? '');
  const [ability, setAbility] = useState<'intelligence' | 'wisdom' | 'charisma'>('intelligence');
  const [targetAc, setTargetAc] = useState('');

  const sanitizedSpell = useMemo(() => selectedSpell?.trim(), [selectedSpell]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sanitizedSpell) return;
    sendMotorAction(`Eu conjuro ${sanitizedSpell}${targetAc ? ` contra CA ${targetAc}` : ''}.`, {
      type: 'spell-attack',
      payload: {
        spellIndex: sanitizedSpell,
        ability,
        targetArmorClass: targetAc ? Number(targetAc) : undefined,
      },
    });
    setTargetAc('');
  };

  if (!spells.length) return null;

  const formBody = (
    <>
      <p className={structuredPanelTitleClass(variant)}>Ataque de magia</p>
      <div className="flex flex-col gap-2">
        <label className={isV2 ? 'font-ui text-sm text-dnd-parchment' : 'text-sm text-stone-300'}>
          Magia preparada
          <select
            className={structuredFieldClass(variant)}
            value={selectedSpell}
            onChange={(event) => setSelectedSpell(event.target.value)}
          >
            {spells.map((spell) => (
              <option key={spell.id} value={spell.spellName}>
                {spell.spellName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className={isV2 ? 'flex-1 font-ui text-sm text-dnd-parchment' : 'flex-1 text-sm text-stone-300'}>
            Habilidade
            <select
              className={structuredFieldClass(variant)}
              value={ability}
              onChange={(event) => setAbility(event.target.value as typeof ability)}
            >
              {ABILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={isV2 ? 'w-full max-w-[140px] font-ui text-sm text-dnd-parchment' : 'w-full max-w-[140px] text-sm text-stone-300'}>
            CA alvo
            <input
              type="number"
              min={5}
              max={30}
              className={structuredFieldClass(variant)}
              value={targetAc}
              onChange={(event) => setTargetAc(event.target.value)}
              placeholder="opcional"
            />
          </label>
        </div>
      </div>
      {isV2 ? (
        <DndButton type="submit" variant="ember" className="w-full" disabled={isLoading}>
          Solicitar jogada de magia
        </DndButton>
      ) : (
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-gradient-to-r from-purple-400 to-purple-600 py-2 text-sm font-semibold text-stone-900 disabled:opacity-50"
        >
          Solicitar jogada de magia
        </button>
      )}
    </>
  );

  if (isV2) {
    return (
      <form onSubmit={handleSubmit} className={structuredPanelFormClass(variant)}>
        <DndCard padding="sm" hover={false} className="space-y-2 border-dnd-gold/15">
          {formBody}
        </DndCard>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={structuredPanelFormClass(variant)}>
      {formBody}
    </form>
  );
};

export default StructuredSpellPanel;
