// src/components/Homebrew/forms/FeatureForm.tsx
'use client';
import React, { useState, useEffect } from 'react';

interface Props {
    onDataChange: (data: any) => void;
}

const FeatureForm: React.FC<Props> = ({ onDataChange }) => {
    const [featureData, setFeatureData] = useState({
        name: '',
        level: 1,
        desc: [''],
    });

    // Update parent component whenever data changes
    useEffect(() => {
        const fullData = {
            ...featureData,
            index: `${featureData.name.toLowerCase().replace(/\s+/g, '-')}-level-${featureData.level}`
        };
        onDataChange(fullData);
    }, [featureData, onDataChange]);

    const handleFieldChange = (field: keyof typeof featureData, value: any) => {
        setFeatureData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-4">
             <div>
                <label htmlFor="feature-name" className="block text-sm font-medium text-stone-300 mb-1">
                    Nome da Característica
                </label>
                <input 
                    id="feature-name" 
                    type="text" 
                    value={featureData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Ex: Fúria, Surto de Ação"
                    required 
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500" 
                />
            </div>
            <div>
                <label htmlFor="feature-level" className="block text-sm font-medium text-stone-300 mb-1">
                    Nível Adquirido
                </label>
                <input 
                    id="feature-level" 
                    type="number" 
                    min="1" 
                    max="20"
                    value={featureData.level}
                    onChange={e => handleFieldChange('level', Number(e.target.value))}
                    required 
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500" 
                />
            </div>
             <div>
                <label htmlFor="feature-desc" className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                <textarea
                    id="feature-desc"
                    value={featureData.desc[0]}
                    onChange={e => handleFieldChange('desc', [e.target.value])}
                    rows={6}
                    placeholder="Descreva o que esta característica faz, incluindo seus benefícios mecânicos e como usá-la."
                    required
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                />
            </div>
        </div>
    );
};

export default FeatureForm;
