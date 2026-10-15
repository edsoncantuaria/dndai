// src/components/Homebrew/forms/FeatureForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { hb, hbChipClass, hbTileClass } from '@/features/homebrew/forms/formUi';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const FeatureForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const [featureData, setFeatureData] = useState(() => ({
        name: '',
        level: 1,
        desc: [''],
        ...(initialData || {}),
        desc: initialData?.desc || [''],
    }));

    useEffect(() => {
        if (initialData) {
            setFeatureData({
                ...initialData,
                desc: initialData.desc || [''],
            });
        }
    }, [initialData]);

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
        <div className={hb.root}>
             <div>
                <label htmlFor="feature-name" className={hb.label}>
                    Nome da Característica
                </label>
                <input 
                    id="feature-name" 
                    type="text" 
                    value={featureData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Ex: Fúria, Surto de Ação"
                    required 
                    className={hb.control} 
                />
            </div>
            <div>
                <label htmlFor="feature-level" className={hb.label}>
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
                    className={hb.control} 
                />
            </div>
             <div>
                <label htmlFor="feature-desc" className={hb.label}>Descrição</label>
                <textarea
                    id="feature-desc"
                    value={featureData.desc[0]}
                    onChange={e => handleFieldChange('desc', [e.target.value])}
                    rows={6}
                    placeholder="Descreva o que esta característica faz, incluindo seus benefícios mecânicos e como usá-la."
                    required
                    className={hb.control}
                />
            </div>
        </div>
    );
};

export default FeatureForm;
