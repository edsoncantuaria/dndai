// components/LevelCard.tsx
import React, { useState, useEffect } from 'react';
import type { ApiClassLevel, ApiSubclass } from '../types';
import * as DndApiService from '../services/dndApiService';
import { Minus, Plus } from 'lucide-react';

interface LevelCardProps {
    level: number;
    classLevelData: ApiClassLevel;
    subclassLevelData?: ApiClassLevel;
    isCurrent: boolean;
    isPast: boolean;
}

const FEATURE_LEVEL_MAP: Record<string, number> = {};

const FeatureItem: React.FC<{ featureName: string; featureIndex: string }> = ({ featureName, featureIndex }) => {
    const [details, setDetails] = useState<any>(null);

    const fetchDetails = async () => {
        if (!details) {
            const data = await DndApiService.getFeatureDetails(featureIndex);
            setDetails(data);
        }
    };

    return (
        <li className="relative group text-sm">
            <span onMouseEnter={fetchDetails} className="cursor-help">{featureName}</span>
            {details && (
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-stone-900 text-stone-300 text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg border border-stone-600">
                    <h4 className="font-bold text-amber-300 mb-1">{details.name}</h4>
                    <div className="space-y-1">
                        {details.desc.map((d: string, i: number) => <p key={i}>{d}</p>)}
                    </div>
                </div>
            )}
        </li>
    );
};

const LABEL_MAP: Record<string, string> = {
    rage_count: 'Usos de Fúria',
    rage_damage_bonus: 'Bônus de Dano (Fúria)',
    brutal_critical_dice: 'Dados de Crítico Brutal',
    bardic_inspiration_die: 'Dado de Inspiração de Bardo',
    song_of_rest_die: 'Dado de Canção do Descanso',
    magical_secrets_max_5: 'Segredos Mágicos (Nível 5)',
    magical_secrets_max_7: 'Segredos Mágicos (Nível 7)',
    magical_secrets_max_9: 'Segredos Mágicos (Nível 9)',
    channel_divinity_charges: 'Cargas de Canalizar Divindade',
    destroy_undead_cr: 'Destruir Mortos-Vivos (ND)',
    wild_shape_max_cr: 'Metamorfose Selvagem (ND Máx)',
    wild_shape_swim: 'Metamorfose Aquática',
    wild_shape_fly: 'Metamorfose Voadora',
    action_surges: 'Surtos de Ação',
    indomitable_uses: 'Usos de Indomável',
    extra_attacks: 'Ataques Extras',
    ki_points: 'Pontos de Ki',
    unarmored_movement: 'Movimento sem Armadura',
    martial_arts: 'Artes Marciais (Dano)',
    aura_range: 'Alcance da Aura',
    favored_enemies: 'Inimigos Favorecidos',
    favored_terrain: 'Terreno Favorecido',
    sneak_attack: 'Ataque Furtivo (Dados)',
    sorcery_points: 'Pontos de Feitiçaria',
    metamagic_known: 'Metamagias Conhecidas',
    creating_spell_slots: 'Criação de Espaços de Magia',
    invocations_known: 'Invocações Conhecidas',
    mystic_arcanum_level_6: 'Arcanum Místico (Nível 6)',
    mystic_arcanum_level_7: 'Arcanum Místico (Nível 7)',
    mystic_arcanum_level_8: 'Arcanum Místico (Nível 8)',
    mystic_arcanum_level_9: 'Arcanum Místico (Nível 9)',
    arcane_recovery_levels: 'Níveis de Recuperação Arcana',
};


const LevelCard: React.FC<LevelCardProps> = ({ level, classLevelData, subclassLevelData, isCurrent, isPast }) => {
    const [isExpanded, setIsExpanded] = useState(isCurrent);

    useEffect(() => {
        setIsExpanded(isCurrent);
    }, [isCurrent]);

    // Combina características da classe e subclasse para o nível atual
    const allFeatures = [
        ...(classLevelData?.features || []),
        ...(subclassLevelData?.features || [])
    ];
    
    // Processa e filtra os dados específicos da classe
    const classSpecificData = classLevelData?.class_specific || {};
    const classSpecificEntries = Object.entries(classSpecificData)
        .filter(([_, value]) => value !== null && value !== undefined && value !== 0 && (!Array.isArray(value) || value.length > 0))
        .map(([key, value]) => {
            const readableKey = LABEL_MAP[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            let displayValue: string;
            if (typeof value === 'object' && value !== null) {
                // Para objetos como sneak_attack: { dice_count: 1, dice_value: 6 }
                displayValue = Object.entries(value).map(([k, v]) => `${k.replace('dice_', '')}: ${v}`).join(', ');
            } else {
                displayValue = String(value);
            }
            
            return `${readableKey}: ${displayValue}`;
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
                    {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
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
                                    const readableKey = LABEL_MAP[key] || key.replace(/_/g, ' ').replace('level', 'Nível').replace(/\b\w/g, l => l.toUpperCase());
                                    return <span key={key} className="text-stone-400">{readableKey}: <span className="font-semibold text-stone-200">{value}</span></span>
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
