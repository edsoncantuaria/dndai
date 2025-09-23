'use client';
import React from 'react';
import type { Feat } from '@/types';
import { Icons } from '../Icons';
import { translateAttribute } from '@/utils/translator';

interface NewFeatCardProps {
    feat: Feat;
    isSelected: boolean;
    isGranted: boolean;
    isSelectable: boolean;
    onToggle: () => void;
}

const NewFeatCard: React.FC<NewFeatCardProps> = ({ feat, isSelected, isGranted, isSelectable, onToggle }) => {
    const isDisabled = isGranted || !isSelectable;
    const cardClasses = `p-4 rounded-lg border-2 transition-all duration-200 h-full flex flex-col ${
        isSelected ? 'border-amber-500 bg-amber-900/40 shadow-lg' :
        isGranted ? 'border-green-700 bg-green-900/20 opacity-70' :
        isDisabled ? 'border-stone-700 bg-stone-800/30 opacity-50 cursor-not-allowed' :
        'border-stone-700 bg-stone-800/50 hover:border-amber-600 hover:bg-stone-700/50 cursor-pointer'
    }`;

    return (
        <div onClick={isDisabled ? undefined : onToggle} className={cardClasses}>
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-lg text-stone-100 flex-grow">{feat.name}</h4>
                {isGranted && <span className="text-xs font-bold text-green-400 bg-green-900/50 px-2 py-1 rounded-full">CONCEDIDO</span>}
                {isSelected && !isGranted && <Icons.PlusCircle className="h-6 w-6 text-amber-400" />}
            </div>
            
            {feat.prerequisites.length > 0 && (
                <div className="text-xs text-red-400 font-semibold mt-1">
                    Pré-requisitos: {feat.prerequisites.map(p => `${translateAttribute(p.ability_score.index)} ${p.minimum_score}`).join(', ')}
                </div>
            )}
            
            <div className="text-sm text-stone-300 mt-2 space-y-1 flex-grow">
                {feat.desc.map((line, index) => (
                    <p key={index}>{line}</p>
                ))}
            </div>
        </div>
    );
};

export default NewFeatCard;
