// src/components/Homebrew/forms/ActionForm.tsx
'use client';
import React, { useState, useEffect } from 'react';

interface Props {
    onDataChange: (data: any) => void;
}

const ActionForm: React.FC<Props> = ({ onDataChange }) => {
    const [actionData, setActionData] = useState({
        name: '',
        desc: '',
    });

    useEffect(() => {
        onDataChange(actionData);
    }, [actionData, onDataChange]);

    const handleFieldChange = (field: keyof typeof actionData, value: any) => {
        setActionData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-4">
             <div>
                <label htmlFor="action-name" className="block text-sm font-medium text-stone-300 mb-1">
                    Nome da Ação
                </label>
                <input 
                    id="action-name" 
                    type="text" 
                    value={actionData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Ex: Mordida, Pancada com a Cauda"
                    required 
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500" 
                />
            </div>
            <div>
                <label htmlFor="action-desc" className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                <textarea
                    id="action-desc"
                    value={actionData.desc}
                    onChange={e => handleFieldChange('desc', e.target.value)}
                    rows={4}
                    placeholder="Descreva o que a ação faz, incluindo detalhes de ataque, dano, alcance e efeitos."
                    required
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                />
            </div>
        </div>
    );
};

export default ActionForm;
