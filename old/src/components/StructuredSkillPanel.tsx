import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { DndButton, DndCard } from '@/components/primitives';
import {
  structuredFieldClass,
  structuredLabelClass,
  structuredPanelFormClass,
  structuredPanelTitleClass,
} from '@/features/gameplay/modals/structuredPanelStyles';

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

export interface StructuredSkillPanelProps {
  variant?: 'legacy' | 'v2';
}

const StructuredSkillPanel: React.FC<StructuredSkillPanelProps> = ({ variant = 'legacy' }) => {
  const isV2 = variant === 'v2';
  const { sendMotorAction, isLoading } = useGameStateContext();
  const [selectedSkill, setSelectedSkill] = useState(SKILL_OPTIONS[0]?.index ?? 'perception');
  const [targetDc, setTargetDc] = useState('');

  const selectedSkillLabel = useMemo(() => {
    return SKILL_OPTIONS.find((skill) => skill.index === selectedSkill)?.label ?? 'perícia';
  }, [selectedSkill]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    sendMotorAction(`Eu tento usar ${selectedSkillLabel}.`, {
      type: 'skill-check',
      payload: {
        skillIndex: selectedSkill,
        dc: targetDc ? Number(targetDc) : undefined,
      },
    });
    setTargetDc('');
  };

  if (!SKILL_OPTIONS.length) return null;

  const formBody = (
    <>
      <p className={structuredPanelTitleClass(variant)}>Teste de perícia</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={structuredLabelClass(variant)}>
          Perícia
          <select
            className={structuredFieldClass(variant)}
            value={selectedSkill}
            onChange={(event) => setSelectedSkill(event.target.value)}
          >
            {SKILL_OPTIONS.map((skill) => (
              <option key={skill.index} value={skill.index}>
                {skill.label}
              </option>
            ))}
          </select>
        </label>
        <label className={`w-full max-w-[140px] ${isV2 ? 'font-ui text-sm text-dnd-parchment' : 'text-sm text-stone-300'}`}>
          CD alvo
          <input
            type="number"
            min={5}
            max={30}
            className={structuredFieldClass(variant)}
            value={targetDc}
            onChange={(event) => setTargetDc(event.target.value)}
            placeholder="opcional"
          />
        </label>
      </div>
      {isV2 ? (
        <DndButton type="submit" variant="ember" className="w-full" disabled={isLoading}>
          Solicitar teste
        </DndButton>
      ) : (
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 py-2 text-sm font-semibold text-stone-900 disabled:opacity-50"
        >
          Solicitar teste
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

export default StructuredSkillPanel;
