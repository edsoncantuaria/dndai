// src/components/Inventory.tsx
'use client';
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import ItemCard from './ItemCard';
import type { InventoryItem } from '../types';
import { Backpack, Hand, Loader2, Gem, ShieldCheck, Sword, Coins } from 'lucide-react';

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
                {pendingLootOffer.items.map((item, index) => (
                    <div key={item.id || index} className="text-sm text-stone-300">
                         <span className="font-semibold text-stone-200">{item.name}</span> {item.quantity > 1 ? `(x${item.quantity})` : ''}
                    </div>
                ))}
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
    
    const isPlayerTurn = combatState?.isActive ? character.id != null && combatState.combatants[combatState.turn]?.id === character.id.toString() : true;
    const actionDisabled = isLoading || !!playerRollRequest || !isPlayerTurn;

    const weapons = character.inventory.filter(i => i.weapon_category);
    const armors = character.inventory.filter(i => i.armor_category);
    const magicItems = character.inventory.filter(i => i.name.includes('(Mágico)')); // Simple check for demo
    const otherItems = character.inventory.filter(i => !i.weapon_category && !i.armor_category && !i.name.includes('(Mágico)') && !['gp', 'sp', 'cp', 'ep', 'pp'].includes(i.index));

    const renderCategory = (title: string, items: InventoryItem[], icon: React.ReactNode) => (
        <div>
            <h4 className="font-semibold text-amber-200 border-b border-stone-700 pb-1 mb-2 flex items-center gap-2">{icon} {title}</h4>
            {items.length > 0 ? (
                <div className="space-y-2">
                    {items.map(item => (
                        <ItemCard 
                            key={item.id} 
                            item={item} 
                            onToggleEquip={toggleEquipped}
                            onUseConsumable={useConsumable}
                            actionDisabled={actionDisabled}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-stone-500 italic pl-2">Nenhum item.</p>
            )}
        </div>
    );

    return (
        <div className="p-4 space-y-6">
            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2 mb-3 text-shadow-amber">
                    <Backpack />
                    Inventário
                </h3>

                <div className="bg-stone-800/50 p-3 rounded-lg border border-stone-700 space-y-3">
                    {/* Currency */}
                    <div>
                         <h4 className="font-semibold text-stone-300 text-sm mb-2 flex items-center gap-2"><Coins /> Moedas</h4>
                         <div className="flex justify-around text-center">
                            <div>
                                <p className="font-mono font-bold text-lg text-yellow-500">{character.currency.gp}</p>
                                <p className="text-xs text-stone-500">Ouro</p>
                            </div>
                            <div>
                                <p className="font-mono font-bold text-lg text-slate-400">{character.currency.sp}</p>
                                <p className="text-xs text-stone-500">Prata</p>
                            </div>
                            <div>
                                <p className="font-mono font-bold text-lg text-orange-400">{character.currency.cp}</p>
                                <p className="text-xs text-stone-500">Cobre</p>
                            </div>
                        </div>
                    </div>

                    {/* Weight */}
                    <div className="pt-3 border-t border-stone-700">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-semibold text-stone-300">Carga</span>
                            <span className="font-mono text-stone-400">{currentWeight.toFixed(1)} / {carryingCapacity.toFixed(1)} lbs</span>
                        </div>
                        <div className="w-full bg-stone-700 rounded-full h-2.5 border border-stone-600 overflow-hidden">
                            <div 
                                className={`${progressBarColor} h-full rounded-full transition-all duration-300`} 
                                style={{ width: `${Math.min(loadPercentage, 100)}%`}}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {renderCategory("Armas", weapons, <Sword className="h-4 w-4" />)}
                {renderCategory("Armaduras e Escudos", armors, <ShieldCheck className="h-4 w-4" />)}
                {renderCategory("Itens Mágicos", magicItems, <Gem className="h-4 w-4" />)}
                {renderCategory("Itens Gerais", otherItems, <Backpack className="h-4 w-4" />)}
            </div>

            <LootDisplay />
        </div>
    );
};

export default Inventory;
