// src/components/Homebrew/forms/ActionForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import * as DndApiService from '@/services/dndApiService';
import { ApiListItem } from '@/types';
import { translateApiString } from '@/utils/translator';

interface Props {
    onDataChange: (data: any) => void;
}

const ActionForm: React.FC<Props> = ({ onDataChange }) => {
    const [actionData, setActionData] = useState({
        name: '',
        desc: '',
        attack_bonus: 0,
        damage: [] as { damage_dice: string; damage_type: ApiListItem }[],
    });

    const [damageTypes, setDamageTypes] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDamageTypes = async () => {
            setIsLoading(true);
            try {
                const result = await DndApiService.getDamageTypes();
                setDamageTypes(result?.results || []);
            } catch (error) {
                console.error("Failed to fetch damage types", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDamageTypes();
    }, []);

    useEffect(() => {
        onDataChange(actionData);
    }, [actionData, onDataChange]);

    const handleFieldChange = (field: keyof typeof actionData, value: any) => {
        setActionData(prev => ({ ...prev, [field]: value }));
    };

    const handleDamageChange = (index: number, field: 'damage_dice' | 'damage_type', value: string) => {
        const newDamage = [...actionData.damage];
        if (field === 'damage_type') {
            const selectedType = damageTypes.find(dt => dt.index === value);
            if (selectedType) {
                newDamage[index].damage_type = selectedType;
            }
        } else {
            newDamage[index].damage_dice = value;
        }
        handleFieldChange('damage', newDamage);
    };

    const addDamage = () => {
        const defaultType = damageTypes.length > 0 ? damageTypes[0] : { index: 'bludgeoning', name: 'Bludgeoning', url: ''};
        handleFieldChange('damage', [...actionData.damage, { damage_dice: '1d6', damage_type: defaultType }]);
    };

    const removeDamage = (index: number) => {
        handleFieldChange('damage', actionData.damage.filter((_, i) => i !== index));
    };

    if (isLoading) {
        return <div className="flex items-center justify-center p-4"><Loader2 className="animate-spin h-6 w-6"/></div>
    }

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
                    rows={3}
                    placeholder="Descreva o que a ação faz, incluindo detalhes de ataque, dano, alcance e efeitos."
                    required
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                />
            </div>
            <div>
                <label htmlFor="action-attack-bonus" className="block text-sm font-medium text-stone-300 mb-1">Bônus de Ataque</label>
                <input
                    id="action-attack-bonus"
                    type="number"
                    value={actionData.attack_bonus}
                    onChange={e => handleFieldChange('attack_bonus', Number(e.target.value))}
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                />
            </div>

            <div className="pt-4 border-t border-stone-700/60">
                 <h5 className="text-sm font-medium text-stone-300 mb-2">Componentes de Dano</h5>
                <div className="space-y-2">
                    {actionData.damage.map((dmg, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-stone-900/50 rounded-md">
                            <input
                                type="text"
                                value={dmg.damage_dice}
                                onChange={e => handleDamageChange(index, 'damage_dice', e.target.value)}
                                placeholder="Ex: 2d6"
                                className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200"
                            />
                             <select
                                value={dmg.damage_type.index}
                                onChange={e => handleDamageChange(index, 'damage_type', e.target.value)}
                                className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200"
                            >
                                {damageTypes.map(dt => (
                                    <option key={dt.index} value={dt.index}>{translateApiString(dt.name)}</option>
                                ))}
                            </select>
                            <button type="button" onClick={() => removeDamage(index)} className="p-2 text-red-500 hover:text-red-400">
                                <Trash2 className="h-4 w-4"/>
                            </button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addDamage} className="mt-2 text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    <Plus className="h-4 w-4"/> Adicionar Componente de Dano
                </button>
            </div>
        </div>
    );
};

export default ActionForm;
