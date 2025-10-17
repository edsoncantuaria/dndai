'use client';
import React, { useState } from 'react';
import type { ApiSpell } from '@/types';
import { translateMagicSchool } from '@/utils/translator';
import { ChevronDown, Sparkles } from 'lucide-react';

interface NewSpellCardProps {
    spell: ApiSpell;
    isSelectable?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
    onToggleSelect?: () => void;
    onCast?: (spell: ApiSpell) => void;
    canCast?: boolean;
    isActionLoading?: boolean;
    defaultExpanded?: boolean;
    usesLeft?: number;
    maxUses?: number;
}

const NewSpellCard: React.FC<NewSpellCardProps> = ({ 
    spell, 
    isSelectable, 
    isSelected, 
    isDisabled, 
    onToggleSelect, 
    onCast, 
    canCast, 
    isActionLoading, 
    defaultExpanded = false,
    usesLeft,
    maxUses
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    
    // A magia já vem traduzida do backend.
    const translatedSpell = spell;

    if (!translatedSpell || !translatedSpell.school) {
        return null;
    }
    
    const handleCastClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card from expanding/collapsing
        if (onCast && canCast && !isActionLoading) {
            onCast(spell); // Pass the original spell object
        }
    };
    
    const hasUses = usesLeft !== undefined && maxUses !== undefined;

    const cardContent = (
        <>
            <div className="flex justify-between items-start w-full cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-stone-200 group-hover:text-amber-300 transition-colors" title={spell.name}>{translatedSpell.name}</h4>
                        {hasUses && (
                             <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${usesLeft > 0 ? 'bg-sky-800 text-sky-200' : 'bg-stone-700 text-stone-400'}`}>
                                {usesLeft}/{maxUses}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-stone-400">{spell.level === 0 ? 'Truque' : `Nível ${spell.level}`} de {translateMagicSchool(spell.school.name)}</p>
                </div>
                <div className="flex items-center pl-2">
                    {onCast && (
                        <button
                            onClick={handleCastClick}
                            disabled={!canCast || isActionLoading}
                            className="mr-2 p-1.5 rounded-md bg-amber-700/80 hover:bg-amber-600/80 text-stone-100 font-semibold text-sm transition-colors disabled:bg-stone-600/50 disabled:text-stone-400 disabled:cursor-not-allowed"
                            title={canCast ? "Conjurar Magia" : hasUses && usesLeft === 0 ? "Uso já gasto" : "Sem espaços de magia"}
                        >
                            <Sparkles className="h-4 w-4" />
                        </button>
                    )}
                    <div className="p-1 text-stone-400 hover:text-amber-300 flex-shrink-0">
                        <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-2 text-sm text-stone-300 space-y-2 pt-2 border-t border-stone-600/50">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <p><strong className="font-semibold text-stone-400">Tempo:</strong> {translatedSpell.casting_time}</p>
                        <p><strong className="font-semibold text-stone-400">Alcance:</strong> {translatedSpell.range}</p>
                        <p><strong className="font-semibold text-stone-400">Componentes:</strong> {translatedSpell.components.join(', ')}</p>
                        <p><strong className="font-semibold text-stone-400">Duração:</strong> {translatedSpell.duration}</p>
                    </div>
                    {translatedSpell.material && <p className="text-xs text-stone-500 italic"><strong className="text-stone-400">Material:</strong> {translatedSpell.material}</p>}
                    <div className="text-stone-400 text-sm italic space-y-1 pt-2">
                        {translatedSpell.desc.map((d: string, i: number) => <p key={i}>{d}</p>)}
                        {translatedSpell.higher_level && translatedSpell.higher_level.length > 0 && <p className="mt-2"><strong className="text-stone-300">Em Níveis Superiores:</strong> {translatedSpell.higher_level.join(' ')}</p>}
                    </div>
                </div>
            )}
        </>
    );

    if (isSelectable) {
        return (
            <div className={`relative group bg-stone-800 p-3 rounded-md border-2 transition-all duration-200 ${isSelected ? 'border-amber-500' : 'border-stone-700'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-600/70'}`}>
                <label className="flex items-start gap-3 w-full">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={onToggleSelect}
                        className={`form-checkbox h-5 w-5 text-amber-500 bg-stone-900 border-stone-600 rounded focus:ring-amber-500 focus:ring-offset-stone-800 transition-all ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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

export default NewSpellCard;
