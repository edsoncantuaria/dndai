// src/components/NewCreationCharacter/ClassDetailsModal.tsx
import React from 'react';
import type { ApiClass, ApiClassLevel } from '@/types';
import ActionModal from '../ui/ActionModal';
import LevelCard from '../LevelCard';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    classDetails: ApiClass;
    classLevels: ApiClassLevel[];
}

const ClassDetailsModal: React.FC<Props> = ({ isOpen, onClose, classDetails, classLevels }) => {
    
    // Log para depuração
    console.log('[ClassDetailsModal] Rendering with props:', { classDetails, classLevels });

    return (
        <ActionModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Detalhes da Classe: ${classDetails.name}`}
            actions={[{ text: "Fechar", onClick: onClose, variant: 'primary' }]}
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-stone-800/60 p-2 rounded">
                        <p className="text-xs text-stone-400">Dado de Vida</p>
                        <p className="font-bold text-lg text-stone-200">d{classDetails.hit_die}</p>
                    </div>
                    <div className="bg-stone-800/60 p-2 rounded col-span-2 md:col-span-1">
                        <p className="text-xs text-stone-400">Resistências</p>
                        <p className="font-bold text-md text-stone-200">{classDetails.saving_throws.map(st => st.name.substring(0,3)).join(', ')}</p>
                    </div>
                    {classDetails.spellcasting && (
                        <div className="bg-stone-800/60 p-2 rounded">
                            <p className="text-xs text-stone-400">Atributo de Magia</p>
                            <p className="font-bold text-lg text-stone-200">{classDetails.spellcasting.spellcasting_ability.name}</p>
                        </div>
                    )}
                </div>

                <div>
                    <p className="font-semibold text-stone-400 text-sm mb-2">Proficiências</p>
                    <div className="flex flex-wrap gap-2">
                        {classDetails.proficiencies.map(p => (
                            <span key={p.index} className="px-2 py-1 text-xs bg-stone-700 text-stone-300 rounded-full">{p.name}</span>
                        ))}
                    </div>
                </div>

                {classLevels && classLevels.length > 0 ? (
                    <div className="space-y-2 pt-4 border-t border-stone-700/50">
                        <h5 className="font-semibold text-stone-300">Progressão de Nível</h5>
                        {classLevels.map((level, index) => (
                            <LevelCard
                                key={`${level?.level}-${index}`}
                                level={level.level}
                                classLevelData={level}
                                subclassLevelData={undefined} // Será ajustado se necessário
                                isCurrent={level.level === 1}
                                isPast={false}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-stone-500 italic pt-4 border-t border-stone-700/50">
                        (Informações de progressão de nível não disponíveis)
                    </div>
                )}
            </div>
        </ActionModal>
    );
};

export default ClassDetailsModal;
