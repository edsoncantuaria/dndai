// components/ItemCard.tsx
import React, { useState, useMemo } from 'react';
import type { InventoryItem, Proficiency } from '../types';
import { Shield, ChevronDown, Hand, Check, X } from 'lucide-react';

interface ItemCardProps {
    item: InventoryItem;
    onToggleEquip?: (itemId: string) => void;
    onUseConsumable?: (itemId: string) => void;
    actionDisabled?: boolean;
    defaultExpanded?: boolean;
    proficiencies: Proficiency[];
}

const ProficiencyIndicator: React.FC<{ proficient: boolean }> = ({ proficient }) => {
    const Icon = proficient ? Check : X;
    const color = proficient ? 'text-green-400' : 'text-red-500';
    const text = proficient ? 'Proficiente' : 'Não Proficiente';

    return (
        <div className={`flex items-center gap-1 text-xs font-semibold ${color}`} title={text}>
            <Icon className="h-4 w-4" />
        </div>
    );
};

const ItemCard: React.FC<ItemCardProps> = ({ item, onToggleEquip, onUseConsumable, actionDisabled, defaultExpanded = false, proficiencies = [] }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const isProficient = useMemo(() => {
        if (!item) return true;
    
        const characterProficiencies = new Set(proficiencies.map(p => p.index.toLowerCase()));
    
        // Proficiências Gerais
        if (characterProficiencies.has('all-armor') && item.armor_category) return true;
        if (characterProficiencies.has('martial-weapons') && item.weapon_category === 'Martial') return true;
        if (characterProficiencies.has('simple-weapons') && item.weapon_category === 'Simple') return true;
        if (characterProficiencies.has('shields') && item.equipment_category?.index === 'shields') return true;
    
        const armorCategory = item.armor_category?.toLowerCase();
        if (armorCategory && characterProficiencies.has(`${armorCategory}-armor`)) return true;
    
        const itemIndex = item.index?.toLowerCase();
        if (itemIndex && characterProficiencies.has(itemIndex)) return true;
    
        return !(item.armor_category || item.weapon_category || item.equipment_category?.index === 'shields');
    
    }, [item, proficiencies]);
    
    const canBeEquipped = !!(item.weapon_category || item.armor_category || item.equipment_category?.index === 'shields');
    const canBeUsed = item.consumable || item.usable;
    const canEquipNow = canBeEquipped && isProficient && !actionDisabled;

    const handleCastClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onUseConsumable && canBeUsed && !actionDisabled) {
            onUseConsumable(item.id);
        }
    };
    
    const handleToggleEquipClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggleEquip && canEquipNow) {
            onToggleEquip(item.id);
        }
    };

    return (
        <div className="bg-stone-800/70 p-3 rounded-lg border border-stone-700">
            <div className="flex justify-between items-start">
                <div className="flex-grow">
                    <h4 className="font-semibold text-stone-200">{item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}</h4>
                    <div className="flex items-center gap-2 text-xs text-stone-400 mt-1">
                        {item.weight !== undefined && <span>{item.weight} lbs</span>}
                        {canBeEquipped && <ProficiencyIndicator proficient={isProficient} />}
                        {canBeEquipped && (
                            <span className={`px-2 py-0.5 rounded-full ${item.equipped ? 'bg-amber-800 text-amber-200' : 'bg-stone-600 text-stone-300'}`}>
                                {item.equipped ? 'Equipado' : 'Desequipado'}
                            </span>
                        )}
                         {canBeUsed && <span className="px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300">Consumível/Usável</span>}
                    </div>
                </div>
                <div className="flex items-center">
                     {canBeUsed && onUseConsumable && (
                         <button
                            onClick={handleCastClick}
                            disabled={actionDisabled}
                            className="p-1 text-stone-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Usar Item"
                        >
                            <Hand />
                        </button>
                     )}
                     {canBeEquipped && onToggleEquip && (
                        <button
                            onClick={handleToggleEquipClick}
                            disabled={!canEquipNow}
                            className="p-1 text-stone-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isProficient ? (item.equipped ? 'Desequipar' : 'Equipar') : 'Proficiência necessária'}
                        >
                            <Shield />
                        </button>
                    )}
                    {(item.desc?.length || item.damage || item.armor_class) > 0 && (
                        <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-stone-400 hover:text-amber-300">
                            <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="mt-2 text-sm text-stone-300 space-y-2 pt-2 border-t border-stone-600/50">
                    {item.desc && item.desc.length > 0 && <div className="text-stone-400 text-xs italic space-y-1">{item.desc.map((d, i) => <p key={i}>{d}</p>)}</div>}
                    
                    {item.damage && <p><strong className="font-semibold text-stone-400">Dano:</strong> {item.damage.damage_dice} {item.damage.damage_type.name}</p>}
                    {item.two_handed_damage && <p><strong className="font-semibold text-stone-400">Dano (2 Mãos):</strong> {item.two_handed_damage.damage_dice} {item.two_handed_damage.damage_type.name}</p>}
                    {item.properties && item.properties.length > 0 && <p><strong className="font-semibold text-stone-400">Propriedades:</strong> {item.properties.map(p => p.name).join(', ')}</p>}

                    {item.armor_class && <p><strong className="font-semibold text-stone-400">Classe de Armadura (CA):</strong> {item.armor_class.base} {item.armor_class.dex_bonus ? `+ Mod de Destreza${item.armor_class.max_bonus ? ` (máx ${item.armor_class.max_bonus})` : ''}` : ''}</p>}
                    {!!item.str_minimum && item.str_minimum > 0 && <p><strong className="font-semibold text-stone-400">Força Mínima:</strong> {item.str_minimum}</p>}
                    {item.stealth_disadvantage && <p className="text-red-400">Desvantagem em testes de Furtividade.</p>}

                </div>
            )}
        </div>
    );
};

export default ItemCard;

    