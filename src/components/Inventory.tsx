'use client';
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import ItemCard from './ItemCard';
import type { InventoryItem } from '../types';
import { translateEquipment } from '../utils/translator';
import { Backpack, Hand, Loader2 } from 'lucide-react';

const LootDisplay: React.FC = () => {
    const { pendingLootOffer, takeLoot, isLoading } = useGameStateContext();

    if (!pendingLootOffer) return null;
    const hasItems = pendingLootOffer.items && pendingLootOffer.items.length > 0;
    const hasCurrency = pendingLootOffer.currency && pendingLootOffer.currency.gp > 0;
    if (!hasItems && !hasCurrency) return null;

    return (
        <div className="mt-6 animate-fadeIn">
             <h4 className="font-semibold text-amber-300 mb-3 border-b border-stone-700 pb-2 flex items-center gap-2">
                <Hand className="h-5 w-5" />
                Saque Próximo
            </h4>
            <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 space-y-2">
                {pendingLootOffer.items.map((item, index) => {
                    const translatedItem = translateEquipment(item);
                    return (
                        <div key={item.id || index} className="text-sm text-stone-300">
                             <span className="font-semibold text-stone-200">{translatedItem.name}</span> {item.quantity > 1 ? `(x${item.quantity})` : ''}
                        </div>
                    )
                })}
                {pendingLootOffer.currency.gp > 0 && (
                    <div className="text-amber-400 font-semibold">{pendingLootOffer.currency.gp} moedas de ouro</div>
                )}
                 <button
                    onClick={() => takeLoot(true)}
                    disabled={isLoading}
                    className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="mx-auto animate-spin" /> : 'Pegar Tudo'}
                </button>
            </div>
        </div>
    );
};


const Inventory: React.FC = () => {
    const { character, toggleEquipped, useConsumable, isLoading, combatState, playerRollRequest } = useGameStateContext();

    if (!character) return null;

    const currentWeight = character.currentWeight ?? 0;
    const carryingCapacity = character.carryingCapacity ?? 0;
    const loadPercentage = carryingCapacity > 0 ? (currentWeight / carryingCapacity) * 100 : 0;

    let progressBarColor = 'bg-green-600';
    if (loadPercentage > 90) progressBarColor = 'bg-red-600';
    else if (loadPercentage > 75) progressBarColor = 'bg-yellow-500';
    
    const isPlayerTurn = combatState?.isActive ? combatState.combatants[combatState.turn]?.id === 'player' : true;
    const actionDisabled = isLoading || !!playerRollRequest || !isPlayerTurn;

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2 mb-3 text-shadow-amber">
                <Backpack />
                Inventário
            </h3>
            
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-stone-300">Carga</span>
                    <span className="font-mono text-stone-400">{currentWeight.toFixed(1)} / {carryingCapacity} lbs</span>
                </div>
                <div className="w-full bg-stone-700 rounded-full h-2.5 border border-stone-600 overflow-hidden">
                    <div 
                        className={`${progressBarColor} h-full rounded-full transition-all duration-300`} 
                        style={{ width: `${Math.min(loadPercentage, 100)}%`}}
                    ></div>
                </div>
             </div>

            {(character.inventory || []).length === 0 ? (
                <p className="text-stone-400 italic text-center py-4 bg-stone-800/40 rounded-md">Sua bolsa está vazia.</p>
            ) : (
                <div className="space-y-2">
                    {character.inventory.map((item) => (
                        <ItemCard 
                            key={item.id} 
                            item={item} 
                            onToggleEquip={toggleEquipped}
                            onUseConsumable={useConsumable}
                            actionDisabled={actionDisabled}
                        />
                    ))}
                </div>
            )}

            <LootDisplay />
        </div>
    );
};

export default Inventory;
