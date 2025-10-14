// src/components/Homebrew/forms/SubclassForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as DndApiService from '@/services/dndApiService';
import { translateApiString } from '@/utils/translator';
import { Loader2 } from 'lucide-react';
import type { ApiListItem } from '@/types';

interface Props {
    onDataChange: (data: any) => void;
}

const SubclassForm: React.FC<Props> = ({ onDataChange }) => {
    const [subclassData, setSubclassData] = useState({
        name: '',
        subclass_flavor: '',
        desc: [''],
        class: { index: '', name: '', url: '' },
    });
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
    
    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>
    }

    return (
        <div className="space-y-4">
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
        </div>
    );
};

export default SubclassForm;
