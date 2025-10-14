// src/components/CharacterSheet/SkillItem.tsx
import React from 'react';
import { useGameStateContext } from '../../contexts/GameStateContext';
import * as characterUtils from '../../utils/characterUtils';
import { translateApiString, translateAttribute } from '../../utils/translator';
import { Dice5 } from 'lucide-react';

const SkillItem: React.FC<{ skillName: string, onUse?: () => void }> = ({ skillName, onUse }) => {
    const { isLoading, character, handleSkillCheck, playerRollRequest } = useGameStateContext();
    
    if (!character) return null;
    
    const isProficient = (character.proficiencies || []).some(p => p?.name?.toLowerCase().includes(skillName.toLowerCase()));
    const attribute = characterUtils.SKILL_ATTRIBUTE_MAP[skillName as keyof typeof characterUtils.SKILL_ATTRIBUTE_MAP];
    const modifier = (character.modifiers ? character.modifiers[attribute] : 0) + (isProficient ? (character.proficiencyBonus || 0) : 0);

    const handleSkillUse = () => {
        if (onUse) onUse();
        handleSkillCheck(skillName);
    }
    
    return (
        <div className="flex items-center justify-between text-sm py-1">
            <div className="flex items-center gap-2">
                 <div className={`w-3 h-3 rounded-full border-2 ${isProficient ? 'bg-amber-400 border-amber-300' : 'bg-stone-600 border-stone-500'}`} title={isProficient ? 'Proficiente' : 'Não Proficiente'}></div>
                <span className="text-stone-300">{translateApiString(`Skill: ${skillName}`)}</span>
                <span className="text-xs text-stone-500">({translateAttribute(attribute).substring(0, 3)})</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-amber-300">{modifier >= 0 ? `+${modifier}`: modifier}</span>
                <button onClick={handleSkillUse} disabled={isLoading || !!playerRollRequest} className="px-1 py-0.5 bg-stone-700/80 hover:bg-stone-600 border border-stone-600 rounded text-xs text-stone-300 disabled:opacity-50 flex items-center gap-1">
                    <Dice5 className="h-3 w-3"/> Usar
                </button>
            </div>
        </div>
    )
}

export default SkillItem;
