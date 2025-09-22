// components/SpellCard.tsx
import React, { useState } from 'react';
// FIX: Corrected import path for local module.
import type { ApiSpell } from '../types';
import { translateMagicSchool, translateSpell } from '../utils/translator';
import { Icons } from './Icons';

interface SpellCardProps {
    spell: ApiSpell;
    isSelectable?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
    onToggleSelect?: () => void;
    onCast?: (spell: ApiSpell) => void;
    canCast?: boolean;
    isActionLoading?: boolean;
    defaultExpanded?: boolean;
}

const SpellCard: React.FC<SpellCardProps> = ({ spell, isSelectable, isSelected, isDisabled, onToggleSelect, onCast, canCast, isActionLoading, defaultExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    if (!spell) {
        return null;
    }
    
    const handleCastClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card from expanding/collapsing if the button is inside
        if (onCast && canCast && !isActionLoading) {
            onCast(spell);
        }
    };

    const cardContent = (
        <>
            <div className="flex justify-between items-start">
                <div className="flex-grow">
                    <h4 className="font-semibold text-stone-200">{translateSpell(spell.name)}</h4>
                    <p className="text-xs text-stone-400">{spell.level === 0 ? 'Truque' : `Nível ${spell.level}`} de {translateMagicSchool(spell.school.name)}</p>
                </div>
                 <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-stone-400 hover:text-amber-300 flex-shrink-0">
                    <Icons.ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isExpanded && (
                <div className="mt-2 text-sm text-stone-300 space-y-2 pt-2 border-t border-stone-600/50">
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <p><strong className="font-semibold text-stone-400">Tempo de Conjuração:</strong> {spell.casting_time}</p>
                            <p><strong className="font-semibold text-stone-400">Alcance:</strong> {spell.range}</p>
                            <p><strong className="font-semibold text-stone-400">Componentes:</strong> {spell.components.join(', ')}</p>
                            <p><strong className="font-semibold text-stone-400">Duração:</strong> {spell.duration}</p>
                        </div>
                        {onCast && (
                             <button
                                onClick={handleCastClick}
                                disabled={!canCast || isActionLoading}
                                className="self-end bg-amber-700/80 hover:bg-amber-600/80 text-stone-100 font-semibold py-1 px-3 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Conjurar
                            </button>
                        )}
                    </div>
                    <div className="text-stone-400 text-xs italic space-y-1 pt-2">
                        {spell.desc.map((d, i) => <p key={i}>{d}</p>)}
                    </div>
                </div>
            )}
        </>
    );

    if (isSelectable) {
        return (
            <div className={`bg-stone-800 p-3 rounded-md border transition-all duration-300 ${isSelected ? 'border-amber-600' : 'border-stone-700'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={onToggleSelect}
                        className="form-checkbox h-5 w-5 text-amber-500 bg-stone-800 border-stone-600 focus:ring-amber-500 rounded mt-1"
                    />
                    <div className="flex-grow">
                        {cardContent}
                    </div>
                </label>
            </div>
        );
    }

    return (
        <div className="bg-stone-800/70 p-3 rounded-lg border border-stone-700">
            {cardContent}
        </div>
    );
};

export default SpellCard;