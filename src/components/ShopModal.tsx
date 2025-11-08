// src/components/ShopModal.tsx
'use client';
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { ShopItem, InventoryItem } from '../types';
import { translateEquipment } from '../utils/translator';
import { canAfford } from '@/utils/currency';
import { useEventFeedback } from '@/hooks/useEventFeedback';
import { Coins, X, Store, Wallet } from 'lucide-react';

const PANEL = 'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-2xl shadow-[0_30px_70px_rgba(0,0,0,0.55)]';

const ShopModal: React.FC = () => {
    const { shopState, character, buyItem, sellItem, processPlayerAction, isLoading } = useGameStateContext();
    const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
    const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
    const { playCue } = useEventFeedback();

    if (!shopState?.isOpen || !character) {
        return null;
    }

    const handleClose = () => {
        processPlayerAction('Eu saio da loja.');
    };

    const isInteractionDisabled = isLoading || shopState.isHaggling;

    const renderBuyTab = () => (
        <div className="space-y-3">
            {shopState.inventory.length === 0 ? (
                <p className="text-stone-400 italic text-center py-6">O mercador não tem nada para vender no momento.</p>
            ) : (
                shopState.inventory.map((item: ShopItem) => {
                    const translatedItem = translateEquipment(item);
                    const playerCanAfford = canAfford(character.currency, { quantity: item.cost.quantity, unit: item.cost.unit as any });

                    return (
                        <div
                            key={item.id}
                            className={`rounded-2xl border bg-black/35 backdrop-blur-sm p-4 flex justify-between items-center gap-4 transition-all ${
                                highlightedItemId === item.id
                                    ? 'border-amber-400/70 shadow-[0_0_30px_rgba(251,191,36,0.35)]'
                                    : 'border-white/5 hover:border-amber-200/40'
                            }`}
                        >
                            <div className="space-y-1 min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.35em] text-stone-500">Oferta</p>
                                <h4 className="font-semibold text-lg text-white truncate">{translatedItem.name}</h4>
                                <p className="text-xs text-stone-400">Quantidade: {item.quantity === Infinity ? 'Infinita' : item.quantity}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] uppercase tracking-[0.35em] text-stone-500">Preço</p>
                                <p className="font-mono text-amber-300 text-xl">{item.cost.quantity} {item.cost.unit}</p>
                                <button
                                    onClick={() => {
                                        buyItem(item as any, item.cost.quantity);
                                        playCue('shop');
                                        setHighlightedItemId(item.id);
                                        setTimeout(() => setHighlightedItemId(null), 1200);
                                    }}
                                    disabled={isInteractionDisabled || !playerCanAfford}
                                    className="mt-3 inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-semibold text-stone-900 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Comprar
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );

    const renderSellTab = () => (
        <div className="space-y-3">
            {character.inventory.length === 0 ? (
                <p className="text-stone-400 italic text-center py-6">Você não tem nada para vender.</p>
            ) : (
                character.inventory.map(item => {
                    const sellPrice = shopState.sellPrices[item.id] || Math.floor((item.cost?.quantity || 2) / 2);
                    const translatedItem = translateEquipment(item);
                    return (
                        <div
                            key={item.id}
                            className={`rounded-2xl border bg-black/35 backdrop-blur-sm p-4 flex justify-between items-center gap-4 transition-all ${
                                highlightedItemId === item.id
                                    ? 'border-emerald-400/70 shadow-[0_0_30px_rgba(16,185,129,0.35)]'
                                    : 'border-white/5 hover:border-emerald-200/40'
                            }`}
                        >
                            <div className="max-w-[60%] space-y-1">
                                <p className="text-[11px] uppercase tracking-[0.35em] text-stone-500">Inventário</p>
                                <h4 className="font-semibold text-lg text-white truncate">
                                    {translatedItem.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}
                                </h4>
                                <p className="text-xs text-stone-400">Valor Base: {item.cost?.quantity || '-'} {item.cost?.unit || ''}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] uppercase tracking-[0.35em] text-stone-500">Oferta</p>
                                <p className="font-mono text-amber-300 text-xl">{sellPrice} gp</p>
                                <button
                                    onClick={() => {
                                        sellItem(item, sellPrice);
                                        playCue('shop');
                                        setHighlightedItemId(item.id);
                                        setTimeout(() => setHighlightedItemId(null), 1200);
                                    }}
                                    disabled={isInteractionDisabled}
                                    className="mt-3 inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-semibold text-stone-900 bg-gradient-to-r from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Vender
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#04060a]/90 backdrop-blur">
            <div className={`${PANEL} w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden`}>
                <header className="p-6 border-b border-white/10 flex justify-between items-start gap-4">
                    <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200 flex items-center gap-2">
                            <Store className="h-4 w-4" /> Loja Premium
                        </p>
                        <h2 className="text-3xl font-serif text-white leading-tight">{shopState.name}</h2>
                        <p className="text-stone-400 text-sm flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-amber-200" />
                            Seu Ouro: <span className="font-mono font-semibold text-amber-300">{character.currency.gp} gp</span>
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="rounded-full border border-white/15 p-2 text-stone-300 hover:text-white hover:border-white/40 transition"
                        aria-label="Fechar loja"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <nav className="flex justify-between items-center px-6 py-4 border-b border-white/10 gap-3">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-black/30 p-1">
                        <button
                            onClick={() => setActiveTab('buy')}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                                activeTab === 'buy' ? 'bg-white/90 text-stone-900 shadow' : 'text-stone-400'
                            }`}
                        >
                            Comprar
                        </button>
                        <button
                            onClick={() => setActiveTab('sell')}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                                activeTab === 'sell' ? 'bg-white/90 text-stone-900 shadow' : 'text-stone-400'
                            }`}
                        >
                            Vender
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-stone-400">
                        <Coins className="h-4 w-4" />
                        Cofre global
                    </div>
                </nav>

                {shopState.isHaggling && (
                    <div className="px-6 py-3 bg-amber-500/10 text-amber-200 text-sm border-b border-amber-400/40 text-center">
                        Negociando preços...
                    </div>
                )}

                <main className="p-6 overflow-y-auto min-h-0 flex-1">
                    {activeTab === 'buy' ? renderBuyTab() : renderSellTab()}
                </main>
            </div>
        </div>
    );
};

export default ShopModal;
