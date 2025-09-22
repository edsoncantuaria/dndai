
// components/LevelCard.tsx
import React, { useState, useEffect } from 'react';
// FIX: Corrected import paths for local modules.
import type { ApiClassLevel } from '../types';
import * as DndApiService from '../services/dndApiService';
import { translateApiString } from '../utils/translator';
import { Icons } from './Icons';

interface LevelCardProps {
    level: number;
    classLevelData: ApiClassLevel;
    subclassLevelData?: ApiClassLevel;
    isCurrent: boolean;
    isPast: boolean;
}

const FeatureItem: React.FC<{ featureName: string; featureIndex: string }> = ({ featureName, featureIndex }) => {
    const [description, setDescription] = useState<string[] | null>(null);

    const fetchFeatureDetails = async () => {
        if (!description) {
            const details = await DndApiService.getFeatureDetails(featureIndex);
            setDescription(details?.desc || ['Descrição não encontrada.']);
        }
    };

    return (
        <li className="relative group text-sm">
            <span onMouseEnter={fetchFeatureDetails} className="cursor-help">{translateApiString(featureName)}</span>
            {description && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-stone-900 text-stone-300 text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg border border-stone-600">
                    <h4 className="font-bold text-amber-300 mb-1">{translateApiString(featureName)}</h4>
                    <div className="space-y-1">
                        {description.map((d, i) => <p key={i}>{d}</p>)}
                    </div>
                </div>
            )}
        </li>
    );
};

const LevelCard: React.FC<LevelCardProps> = ({ level, classLevelData, subclassLevelData, isCurrent, isPast }) => {
    const [isExpanded, setIsExpanded] = useState(isCurrent);

    useEffect(() => {
        setIsExpanded(isCurrent);
    }, [isCurrent]);

    const allFeatures = [
        ...(classLevelData.features || []),
        ...(subclassLevelData?.features || [])
    ];
    
    const classSpecificEntries = Object.entries(classLevelData.class_specific || {}).map(([key, value]) => {
        // FIX: Cast key to string to prevent errors on .replace if it's a number.
        const readableKey = String(key).replace(/_/g, ' ');
        // FIX: Explicitly cast value to string to resolve 'unknown' to 'ReactNode' type error.
        return `${readableKey.charAt(0).toUpperCase() + readableKey.slice(1)}: ${String(value)}`;
    });

    return (
        <div className={`border rounded-lg overflow-hidden transition-all duration-300 ${isCurrent ? 'border-amber-500 shadow-lg shadow-amber-900/50' : isPast ? 'border-stone-700 opacity-60' : 'border-stone-700'}`}>
            <button
                className="w-full p-3 text-left flex justify-between items-center bg-stone-800/70 hover:bg-stone-700/80"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="font-semibold font-garamond text-lg text-stone-200">
                    Nível {level}
                    {isCurrent && <span className="text-amber-400 text-sm ml-2">(Atual)</span>}
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-stone-400">
                    <span>Bônus Prof: +{classLevelData.prof_bonus}</span>
                    {isExpanded ? <Icons.Minus className="h-4 w-4" /> : <Icons.Plus className="h-4 w-4" />}
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 bg-stone-800/30 text-stone-300 space-y-3">
                    {allFeatures.length > 0 && (
                        <div>
                            <h5 className="font-bold text-stone-300 text-sm mb-1">Características:</h5>
                            <ul className="list-disc list-inside space-y-1">
                                {allFeatures.map(feature => (
                                    <FeatureItem key={feature.index} featureName={feature.name} featureIndex={feature.index} />
                                ))}
                            </ul>
                        </div>
                    )}
                    {classSpecificEntries.length > 0 && (
                        <div>
                            <h5 className="font-bold text-stone-300 text-sm mb-1">Específico da Classe:</h5>
                             <ul className="list-disc list-inside space-y-1 text-sm">
                                {classSpecificEntries.map((entry, index) => (
                                    <li key={index}>{entry}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                     {classLevelData.spellcasting && (
                        <div>
                            <h5 className="font-bold text-stone-300 text-sm mb-1">Conjuração:</h5>
                             <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                {Object.entries(classLevelData.spellcasting).map(([key, value]) => {
                                    const readableKey = key.replace(/_/g, ' ');
                                    return <span key={key} className="text-stone-400">{readableKey.charAt(0).toUpperCase() + readableKey.slice(1)}: <span className="font-semibold text-stone-200">{value}</span></span>
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LevelCard;