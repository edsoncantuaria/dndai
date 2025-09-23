// src/components/NewCreationCharacter/NewFeats/NewFeatCard.tsx
import React, { useState } from 'react';
import { ApiFeat, Attributes } from '@/types';
import { translateApiString, translateAttribute } from '@/utils/translator';
import { Icons } from '@/components/Icons';

interface NewFeatCardProps {
    feat: ApiFeat;
    isSelectable: boolean;
    isSelected: boolean;
    isGranted: boolean;
    isDisabled: boolean;
    onToggle: () => void;
}

const Prerequisite: React.FC<{ prereq: { ability_score: { index: string, name: string }, minimum_score: number }, finalAttributes: Attributes }> = ({ prereq, finalAttributes }) => {
    const attrKey = translateAttribute(prereq.ability_score.index as any).toLowerCase() as keyof Attributes;
    const hasMet = finalAttributes[attrKey] >= prereq.minimum_score;

    return (
        <span className={`text-xs font-mono px-2 py-1 rounded-full ${hasMet ? 'bg-green-800 text-green-200' : 'bg-red-900 text-red-200'}`}>
            {prereq.ability_score.name} {prereq.minimum_score}
        </span>
    );
};


const NewFeatCard: React.FC<NewFeatCardProps> = ({ feat, isSelectable, isSelected, isGranted, isDisabled, onToggle }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const cardStateClasses = () => {
        if (isGranted) return 'border-green-700 bg-green-900/30';
        if (isSelected) return 'border-amber-600 bg-amber-900/30 shadow-lg shadow-amber-950/20';
        if (isDisabled && !isGranted) return 'border-stone-700 bg-stone-800/40 opacity-60';
        return 'border-stone-700 bg-stone-800/60 hover:border-stone-600';
    };

    return (
        <div className={`p-4 rounded-lg border transition-all duration-300 ${cardStateClasses()}`}>
            <div className="flex justify-between items-start gap-4">
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        {isSelectable && (
                             <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isDisabled || isGranted}
                                onChange={onToggle}
                                className="form-checkbox h-5 w-5 text-amber-500 bg-stone-700 border-stone-600 rounded focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                        )}
                         <h4 className="font-bold text-lg text-stone-100">{translateApiString(feat.name)}</h4>
                    </div>
                    
                    {isGranted && (
                        <span className="text-xs font-semibold bg-green-600 text-white px-2 py-0.5 rounded-full ml-8">Concedido pela Raça</span>
                    )}

                    <div className="flex flex-wrap gap-2 mt-2">
                        {feat.prerequisites.map((prereq, index) => (
                           <span key={index} className="text-xs font-mono px-2 py-1 rounded-full bg-red-900 text-red-200">{translateAttribute(prereq.ability_score.name as any)} {prereq.minimum_score}</span>
                        ))}
                    </div>
                </div>
                <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-stone-400 hover:text-amber-300 flex-shrink-0">
                    <Icons.ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>
             {isExpanded && (
                <div className="mt-3 pt-3 border-t border-stone-700/50 space-y-2 text-sm text-stone-400">
                    {feat.desc.map((d, i) => <p key={i}>{d}</p>)}
                </div>
            )}
        </div>
    );
};

export default NewFeatCard;
