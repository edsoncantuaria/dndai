// src/components/Homebrew/forms/SubclassForm.tsx
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as DndApiService from '@/services/dndApiService';
import * as HomebrewService from '@/services/homebrewService';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import type { ApiListItem } from '@/types';
import FeatureCreator from './FeatureCreator';
import { useAuth } from '@/contexts/AuthContext';
import { hb, hbChipClass, hbTileClass } from '@/features/homebrew/forms/formUi';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const SubclassForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [subclassData, setSubclassData] = useState(() => {
        const base = {
            name: '',
            subclass_flavor: '',
            desc: [''],
            class: { index: '', name: '', url: '' },
            features: [] as any[],
            dependencies: [] as string[],
            official_index: '',
        };

        const merged = {
            ...base,
            ...(initialData || {}),
        };

        return {
            ...merged,
            desc: Array.isArray(merged.desc) && merged.desc.length > 0 ? merged.desc : [''],
            features: Array.isArray(merged.features) ? merged.features : [],
            dependencies: Array.isArray(merged.dependencies) ? merged.dependencies : [],
        };
    });
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFeatureCreatorOpen, setIsFeatureCreatorOpen] = useState(false);
    const [editingFeature, setEditingFeature] = useState<{ feature: any, index: number } | null>(null);

    const fetchClasses = useCallback(async () => {
        setIsLoading(true);
        try {
            const officialClassesPromise = DndApiService.getClasses();
            const homebrewClassesPromise = HomebrewService.listHomebrewContent('public', undefined, 'class');
            const myHomebrewClassesPromise = user ? HomebrewService.listHomebrewContent('mine', undefined, 'class') : Promise.resolve([]);

            const [officialClasses, homebrewClasses, myHomebrewClasses] = await Promise.all([
                officialClassesPromise,
                homebrewClassesPromise,
                myHomebrewClassesPromise
            ]);

            const all = [...(officialClasses?.results || [])];
            const myIds = new Set((myHomebrewClasses).map(c => c.id));

            all.push(...(myHomebrewClasses).map(c => ({ index: c.id, name: `(Meu) ${c.name}`, url: '' })));
            all.push(...homebrewClasses.filter(c => !myIds.has(c.id)).map(c => ({ index: c.id, name: `(H) ${c.name}`, url: '' })));

            setClasses(all.sort((a,b) => a.name.localeCompare(b.name)));
            
            if (initialData?.class?.index && !all.some(c => c.index === initialData.class.index)) {
                setClasses(prev => [initialData.class, ...prev]);
            }

        } catch (error) {
            console.error("Falha ao buscar classes:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user, initialData]);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);


    useEffect(() => {
        const fullData = {
            ...subclassData,
            index: subclassData.official_index || (subclassData.name || '').toLowerCase().replace(/\s+/g, '-') || `custom-subclass-${Date.now()}`
        };
        const { official_index, ...finalData } = fullData; // Remove o campo auxiliar
        onDataChange(finalData);
    }, [subclassData, onDataChange]);

    const handleFieldChange = (field: keyof typeof subclassData, value: any) => {
        setSubclassData(prev => ({ ...prev, [field]: value }));
    };

    const handleClassChange = (classIndex: string) => {
        const selectedClass = classes.find(c => c.index === classIndex);
        if (selectedClass) {
            handleFieldChange('class', selectedClass);
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classIndex)) {
                setSubclassData(prev => ({ ...prev, dependencies: [classIndex] }));
            } else {
                setSubclassData(prev => ({ ...prev, dependencies: [] }));
            }
        }
    };
    
    const handleFeatureCreated = (feature: any) => {
        if (editingFeature !== null) {
            const updatedFeatures = [...subclassData.features];
            updatedFeatures[editingFeature.index] = feature;
            handleFieldChange('features', updatedFeatures.sort((a, b) => a.level - b.level));
        } else {
            const updatedFeatures = [...subclassData.features, feature].sort((a, b) => a.level - b.level);
            handleFieldChange('features', updatedFeatures);
        }
    };
    
    const handleRemoveFeature = (featureIndex: number) => {
        handleFieldChange('features', subclassData.features.filter((_, i) => i !== featureIndex));
    };

    const openEditModal = (feature: any, index: number) => {
        setEditingFeature({ feature, index });
        setIsFeatureCreatorOpen(true);
    };

    const openCreateModal = () => {
        setEditingFeature(null);
        setIsFeatureCreatorOpen(true);
    };


    const groupedFeatures = useMemo(() => {
        return subclassData.features.reduce((acc: any, feature: any) => {
            const level = `Nível ${feature.level}`;
            if (!acc[level]) {
                acc[level] = [];
            }
            acc[level].push(feature);
            return acc;
        }, {} as Record<string, any[]>);
    }, [subclassData.features]);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className={hb.root}>
             <div>
                <label htmlFor="subclass-name" className={hb.label}>Nome da Subclasse</label>
                <input id="subclass-name" type="text" value={subclassData.name} onChange={e => handleFieldChange('name', e.target.value)} required className={hb.control} placeholder="Ex: Mestre de Batalha, Ladrão Arcano"/>
            </div>
            {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className={hb.label}>Índice Oficial (para Sobrescrever/Traduzir)</label>
                    <input id="official_index" type="text" value={subclassData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className={hb.control} placeholder="Ex: champion (opcional)"/>
                </div>
            )}
             <div>
                <label htmlFor="subclass-flavor" className={hb.label}>Nome do "Sabor" da Subclasse</label>
                <input id="subclass-flavor" type="text" value={subclassData.subclass_flavor} onChange={e => handleFieldChange('subclass_flavor', e.target.value)} required className={hb.control} placeholder="Ex: Arquétipo Marcial, Tradição Arcana"/>
            </div>
            <div>
                <label htmlFor="subclass-parent-class" className={hb.label}>Classe Principal</label>
                <select id="subclass-parent-class" value={subclassData.class.index} onChange={e => handleClassChange(e.target.value)} required className={hb.control}>
                    <option value="" disabled>Selecione a classe principal...</option>
                    {classes.map(c => <option key={c.index} value={c.index}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="subclass-desc" className={hb.label}>Descrição</label>
                <textarea id="subclass-desc" value={subclassData.desc[0]} onChange={e => handleFieldChange('desc', [e.target.value])} required rows={3} className={hb.control} placeholder="Descreva o conceito e o tema da subclasse."/>
            </div>
            
            {/* Features Section */}
             <div className={hb.dividerSection}>
                <div className="flex justify-between items-center mb-2">
                    <h4 className={hb.heading}>Características de Subclasse</h4>
                    <button type="button" onClick={openCreateModal} className={hb.btnAdd}>
                        <Plus className="h-4 w-4" /> Adicionar
                    </button>
                </div>
                <div className="space-y-3">
                    {Object.keys(groupedFeatures).length > 0 ? (
                        Object.keys(groupedFeatures).map(level => (
                            <div key={level}>
                                <h5 className={`${hb.sectionTitle} border-b border-dnd-gold/20 pb-1 mb-2`}>{level}</h5>
                                <div className="space-y-2">
                                {groupedFeatures[level].map((feature: any, index: number) => (
                                    <div key={feature.index || index} className={hb.rowBetween}>
                                        <div>
                                            <p className="font-ui text-sm font-semibold text-dnd-parchment">{feature.name}</p>
                                            <p className="mt-1 font-ui text-xs text-dnd-parchment-muted">{feature.desc[0].substring(0, 100)}...</p>
                                        </div>
                                        <div className="flex flex-shrink-0 ml-2 gap-2">
                                            <button type="button" onClick={() => openEditModal(feature, subclassData.features.findIndex(f => f.name === feature.name && f.level === feature.level))} className="text-blue-400 hover:text-blue-300">
                                                <Edit className="h-4 w-4"/>
                                            </button>
                                            <button type="button" onClick={() => handleRemoveFeature(subclassData.features.findIndex(f => f.name === feature.name && f.level === feature.level))} className={hb.btnDanger}>
                                                <Trash2 className="h-4 w-4"/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className={hb.empty}>Nenhuma característica adicionada ainda.</p>
                    )}
                </div>
             </div>
             <FeatureCreator
                isOpen={isFeatureCreatorOpen}
                onClose={() => setIsFeatureCreatorOpen(false)}
                onFeatureCreated={handleFeatureCreated}
                classId={subclassData.class?.index || 'unknown'}
                initialData={editingFeature?.feature}
            />
        </div>
    )
};

export default SubclassForm;
