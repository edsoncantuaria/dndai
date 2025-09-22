// components/ItemCard.tsx
import React, { useState } from 'react';
import type { InventoryItem } from '../types';
import { Icons } from './Icons';

interface ItemCardProps {
    item: InventoryItem;
    onToggleEquip?: (itemId: string) => void;
    defaultExpanded?: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onToggleEquip, defaultExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const canBeEquipped = !!(item.weapon_category || item.armor_category);

    return (
        <div className="bg-stone-800/70 p-3 rounded-lg border border-stone-700">
            <div className="flex justify-between items-start">
                <div className="flex-grow">
                    <h4 className="font-semibold text-stone-200">{item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}</h4>
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                        {item.weight !== undefined && <span>{item.weight} lbs</span>}
                        {canBeEquipped && (
                            <span className={`px-2 py-0.5 rounded-full ${item.equipped ? 'bg-amber-800 text-amber-200' : 'bg-stone-600 text-stone-300'}`}>
                                {item.equipped ? 'Equipado' : 'Desequipado'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center">
                     {canBeEquipped && onToggleEquip && (
                        <button
                            onClick={() => onToggleEquip(item.id)}
                            className="p-1 text-stone-400 hover:text-amber-300"
                            title={item.equipped ? 'Desequipar' : 'Equipar'}
                        >
                            <Icons.Shield />
                        </button>
                    )}
                    <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-stone-400 hover:text-amber-300">
                        <Icons.ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-2 text-sm text-stone-300 space-y-2 pt-2 border-t border-stone-600/50">
                    {item.desc && <div className="text-stone-400 text-xs italic space-y-1">{item.desc.map((d, i) => <p key={i}>{d}</p>)}</div>}
                    
                    {/* Weapon Details */}
                    {item.damage && <p><strong className="font-semibold text-stone-400">Dano:</strong> {item.damage.damage_dice} {item.damage.damage_type.name}</p>}
                    {item.two_handed_damage && <p><strong className="font-semibold text-stone-400">Dano (Duas Mãos):</strong> {item.two_handed_damage.damage_dice} {item.two_handed_damage.damage_type.name}</p>}
                    {item.properties && item.properties.length > 0 && <p><strong className="font-semibold text-stone-400">Propriedades:</strong> {item.properties.map(p => p.name).join(', ')}</p>}

                    {/* Armor Details */}
                    {item.armor_class && <p><strong className="font-semibold text-stone-400">Classe de Armadura:</strong> {item.armor_class.base} {item.armor_class.dex_bonus ? `+ Mod de Destreza${item.armor_class.max_bonus ? ` (máx ${item.armor_class.max_bonus})` : ''}` : ''}</p>}
                    {!!item.str_minimum && item.str_minimum > 0 && <p><strong className="font-semibold text-stone-400">Força Mínima:</strong> {item.str_minimum}</p>}
                    {item.stealth_disadvantage && <p className="text-red-400">Desvantagem em testes de Furtividade.</p>}

                </div>
            )}
        </div>
    );
};

export default ItemCard;
