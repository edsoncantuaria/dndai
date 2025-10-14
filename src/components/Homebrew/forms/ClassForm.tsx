// src/components/Homebrew/forms/ClassForm.tsx
'use client';
import React, { useState, useEffect } from 'react';

interface Props {
    onDataChange: (data: any) => void;
}

const HIT_DICE_OPTIONS = [6, 8, 10, 12];

const ClassForm: React.FC<Props> = ({ onDataChange }) => {
    const [classData, setClassData] = useState({
        name: '',
        hit_die: 8,
        // Will add more fields later: proficiencies, saving_throws, etc.
    });

    // Update parent component whenever data changes
    useEffect(() => {
        const fullData = {
            ...classData,
            index: classData.name.toLowerCase().replace(/\s+/g, '-') || `custom-class-${Date.now()}`
        };
        onDataChange(fullData);
    }, [classData, onDataChange]);

    const handleFieldChange = (field: keyof typeof classData, value: any) => {
        setClassData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="class-name" className="block text-sm font-medium text-stone-300 mb-1">
                    Nome da Classe
                </label>
                <input 
                    id="class-name" 
                    type="text" 
                    value={classData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Ex: Mestre das Lâminas"
                    required 
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500" 
                />
            </div>
            <div>
                <label htmlFor="hit-die" className="block text-sm font-medium text-stone-300 mb-1">
                    Dado de Vida
                </label>
                <select 
                    id="hit-die"
                    value={classData.hit_die}
                    onChange={e => handleFieldChange('hit_die', Number(e.target.value))}
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                >
                    {HIT_DICE_OPTIONS.map(d => <option key={d} value={d}>d{d}</option>)}
                </select>
                <p className="text-xs text-stone-400 mt-1">Define os pontos de vida que a classe ganha por nível.</p>
            </div>
        </div>
    );
};

export default ClassForm;
