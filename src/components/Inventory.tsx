// src/components/Inventory.tsx
'use client';
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import ItemCard from './ItemCard';
import type { InventoryItem } from '../types';
import { Backpack, Hand, Loader2, Gem, ShieldCheck, Sword, Coins, Layers, Package } from 'lucide-react';
import { translateEquipment } from '../utils/translator'; // Importar a função de tradução

const PANEL = 'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]';

const LootDisplay: React.FC = () => {
    const { pendingLootOffer, takeLoot, isLoading } = useGameStateContext();

    if (!pendingLootOffer) return null;
    const hasItems = pendingLootOffer.items && pendingLootOffer.items.length > 0;
    const hasCurrency = pendingLootOffer.currency && pendingLootOffer.currency.gp > 0;
    if (!hasItems && !hasCurrency) return null;

    return (
        <div className="mt-6 animate-fadeIn">
             <h4 className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200 mb-3 flex items-center gap-2">
                <Hand className="h-5 w-5" />
                Saque Próximo
            </h4>
            <div className="rounded-3xl border border-white/10 bg-black/40 p-4 space-y-2">
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
    const COIN_TYPES = ['pp', 'gp', 'ep', 'sp', 'cp'];


    if (!character) return null;

    const currentWeight = Number(character.currentWeight ?? 0);
    const carryingCapacity = Number(
        character.carryingCapacity ?? (character.attributes?.strength ? character.attributes.strength * 15 : 0)
    );
    const loadPercentage = carryingCapacity > 0 ? (currentWeight / carryingCapacity) * 100 : 0;

    let progressBarColor = 'bg-gradient-to-r from-emerald-400 to-emerald-600';
    if (loadPercentage > 90) progressBarColor = 'bg-gradient-to-r from-rose-500 to-red-600';
    else if (loadPercentage > 75) progressBarColor = 'bg-gradient-to-r from-amber-400 to-orange-500';
    
    const isPlayerTurn = combatState?.isActive ? character.id != null && combatState.combatants[combatState.turn]?.id === character.id.toString() : true;
    const actionDisabled = isLoading || !!playerRollRequest || !isPlayerTurn;

    const safeCurrency = {
        pp: character.currency?.pp ?? 0,
        gp: character.currency?.gp ?? 0,
        ep: character.currency?.ep ?? 0,
        sp: character.currency?.sp ?? 0,
        cp: character.currency?.cp ?? 0,
    };

    const inventoryItems = (character.inventory || []).map(item => translateEquipment(item));

    const weapons = inventoryItems.filter(i => i.weapon_category);
    const armors = inventoryItems.filter(i => i.armor_category || i.equipment_category?.index === 'shields');
    const magicItems = inventoryItems.filter(i => i.name.includes('(Mágico)')); // Simple check for demo
    const otherItems = inventoryItems.filter(i => 
        !i.weapon_category &&
        !i.armor_category &&
        i.equipment_category?.index !== 'shields' &&
        !i.name.includes('(Mágico)') &&
        !COIN_TYPES.includes(i.index)
    );

    const renderCategory = (title: string, items: InventoryItem[], icon: React.ReactNode) => (
        <div className={`${PANEL} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-200 uppercase tracking-widest">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-black/40 border border-white/10">
                        {icon}
                    </span>
                    {title}
                </div>
                <span className="text-xs text-stone-400">{items.length} itens</span>
            </div>
            {items.length > 0 ? (
                <div className="space-y-3">
                    {items.map(item => (
                        <ItemCard 
                            key={item.id} 
                            item={item} 
                            onToggleEquip={toggleEquipped}
                            onUseConsumable={useConsumable}
                            actionDisabled={actionDisabled}
                            proficiencies={character.proficiencies || []}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-stone-500 italic pl-2">Nenhum item.</p>
            )}
        </div>
    );

    return (
        <div className="p-5 space-y-6 text-sm text-stone-200">
            <div className={`${PANEL} p-5 space-y-4`}>
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 border border-white/10 text-amber-200">
                        <Backpack className="h-6 w-6" />
                    </span>
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">Inventário & Carga</p>
                        <h3 className="text-2xl font-serif text-white leading-tight">Bolsa do Aventureiro</h3>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <h4 className="text-xs uppercase tracking-[0.35em] text-stone-400 mb-3 flex items-center gap-2"><Coins className="h-4 w-4 text-amber-200" /> Tesouro</h4>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            {(['gp','sp','pp','cp','ep'] as const).map((type) => (
                                <div key={type} className="rounded-2xl bg-black/40 border border-white/5 p-2">
                                    <p className="font-mono text-lg text-amber-200">{safeCurrency[type]}</p>
                                    <p className="uppercase tracking-wide text-[10px] text-stone-500">{type.toUpperCase()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-stone-400">
                            <span>Carga Atual</span>
                            <span className="font-mono text-stone-200 tracking-normal">{currentWeight.toFixed(1)} / {carryingCapacity.toFixed(1)} lbs</span>
                        </div>
                        <div className="h-3 rounded-full border border-white/10 overflow-hidden bg-black/60">
                            <div
                                className={`h-full rounded-full ${progressBarColor}`}
                                style={{ width: `${Math.min(loadPercentage, 100)}%`}}
                            />
                        </div>
                        <p className="text-xs text-stone-400 text-right">{loadPercentage.toFixed(0)}% da capacidade</p>
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                {renderCategory("Armas", weapons, <Sword className="h-4 w-4" />)}
                {renderCategory("Armaduras e Escudos", armors, <ShieldCheck className="h-4 w-4" />)}
                {renderCategory("Itens Mágicos", magicItems, <Gem className="h-4 w-4" />)}
                {renderCategory("Itens Gerais", otherItems, <Package className="h-4 w-4" />)}
            </div>

            <LootDisplay />
        </div>
    );
};

export default Inventory;
