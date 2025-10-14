// src/components/Homebrew/forms/SubclassForm.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import * as DndApiService from '@/services/dndApiService';
import { translateApiString } from '@/utils/translator';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { ApiListItem } from '@/types';
import FeatureCreator from '../FeatureCreator';

interface Props {
    onDataChange: (data: any) => void;
}

const SubclassForm: React.FC<Props> = ({ onDataChange }) => {
    const [subclassData, setSubclassData] = useState({
        name: '',
        subclass_flavor: '',
        desc: [''],
        class: { index: '', name: '', url: '' },
        features: [] as any[],
    });
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFeatureCreatorOpen, setIsFeatureCreatorOpen] = useState(false);


    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const classList = await DndApiService.getClasses();
                setClasses(classList?.results || []);
            } catch (error) {
                console.error("Falha ao buscar classes:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClasses();
    }, []);

    useEffect(() => {
        const fullData = {
            ...subclassData,
            index: subclassData.name.toLowerCase().replace(/\s+/g, '-') || `custom-subclass-${Date.now()}`
        };
        onDataChange(fullData);
    }, [subclassData, onDataChange]);

    const handleFieldChange = (field: keyof typeof subclassData, value: any) => {
        setSubclassData(prev => ({ ...prev, [field]: value }));
    };

    const handleClassChange = (classIndex: string) => {
        const selectedClass = classes.find(c => c.index === classIndex);
        if (selectedClass) {
            handleFieldChange('class', selectedClass);
        }
    };
    
    const handleFeatureCreated = (newFeature: any) => {
        const updatedFeatures = [...subclassData.features, newFeature].sort((a, b) => a.level - b.level);
        handleFieldChange('features', updatedFeatures);
    };

    const handleRemoveFeature = (featureIndex: string) => {
        handleFieldChange('features', subclassData.features.filter(f => f.index !== featureIndex));
    };

    const groupedFeatures = useMemo(() => {
        return subclassData.features.reduce((acc, feature) => {
            const level = `Nível ${feature.level}`;
            if (!acc[level]) {
                acc[level] = [];
            }
            acc[level].push(feature);
            return acc;
        }, {} as Record<string, any[]>);
    }, [subclassData.features]);

    
    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>
    }

    return (
        <div className="space-y-6">
             <div>
                <label htmlFor="subclass-name" className="block text-sm font-medium text-stone-300 mb-1">Nome da Subclasse</label>
                <input id="subclass-name" type="text" value={subclassData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: Mestre das Runas" />
            </div>
            
            <div>
                <label htmlFor="subclass-class" className="block text-sm font-medium text-stone-300 mb-1">Classe Original</label>
                <select 
                    id="subclass-class"
                    value={subclassData.class.index}
                    onChange={e => handleClassChange(e.target.value)}
                    required
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                >
                    <option value="" disabled>Selecione a classe...</option>
                    {classes.map(c => <option key={c.index} value={c.index}>{translateApiString(c.name)}</option>)}
                </select>
            </div>
            
            <div>
                <label htmlFor="subclass-flavor" className="block text-sm font-medium text-stone-300 mb-1">"Sabor" da Subclasse</label>
                <input id="subclass-flavor" type="text" value={subclassData.subclass_flavor} onChange={e => handleFieldChange('subclass_flavor', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: Patrono Sobrenatural, Origem Dracônica" />
            </div>

            <div>
                <label htmlFor="subclass-desc" className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                <textarea id="subclass-desc" value={subclassData.desc[0]} onChange={e => handleFieldChange('desc', [e.target.value])} required rows={4} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Descreva o conceito e o tema da subclasse."/>
            </div>
            
            {/* Features Section */}
            <div className="pt-4 border-t border-stone-700">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-lg font-bold text-amber-300">Características de Subclasse</h4>
                    <button type="button" onClick={() => setIsFeatureCreatorOpen(true)} className="flex items-center gap-1.5 text-sm bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors">
                        <Plus className="h-4 w-4" /> Adicionar
                    </button>
                </div>
                <div className="space-y-4">
                    {Object.keys(groupedFeatures).length > 0 ? (
                        Object.keys(groupedFeatures).map(level => (
                            <div key={level}>
                                <h5 className="font-semibold text-stone-300 text-md border-b border-stone-600 pb-1 mb-2">{level}</h5>
                                <div className="space-y-2">
                                {groupedFeatures[level].map((feature: any) => (
                                    <div key={feature.index} className="bg-stone-800/60 p-3 rounded-md flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-stone-200">{feature.name}</p>
                                            <p className="text-xs text-stone-400 mt-1">{feature.desc[0].substring(0, 100)}...</p>
                                        </div>
                                        <button onClick={() => handleRemoveFeature(feature.index)} className="ml-2 text-red-500 hover:text-red-400 flex-shrink-0">
                                            <Trash2 className="h-4 w-4"/>
                                        </button>
                                    </div>
                                ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-stone-500 italic text-center">Nenhuma característica adicionada ainda.</p>
                    )}
                </div>
            </div>

            <FeatureCreator
                isOpen={isFeatureCreatorOpen}
                onClose={() => setIsFeatureCreatorOpen(false)}
                onFeatureCreated={handleFeatureCreated}
                classId={subclassData.class.index}
            />
        </div>
    );
};

export default SubclassForm;
