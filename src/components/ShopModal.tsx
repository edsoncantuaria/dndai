'use client';
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { ShopItem, InventoryItem } from '../types';
import { translateEquipment } from '../utils/translator';
import ItemCard from './ItemCard';

const ShopModal: React.FC = () => {
    const { shopState, character, buyItem, sellItem, processPlayerAction, isLoading } = useGameStateContext();
    const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

    if (!shopState?.isOpen || !character) {
        return null;
    }

    const handleClose = () => {
        processPlayerAction("Eu saio da loja.");
    };

    const isInteractionDisabled = isLoading || shopState.isHaggling;

    const renderBuyTab = () => (
        <div className="space-y-2">
            {shopState.inventory.length === 0 ? (
                <p className="text-stone-400 italic text-center py-4">O mercador não tem nada para vender no momento.</p>
            ) : (
                shopState.inventory.map(item => {
                    const translatedItem = translateEquipment(item);
                    return (
                        <div key={item.id} className="bg-stone-800/70 p-3 rounded-lg border border-stone-700 flex justify-between items-center">
                            <div>
                                <h4 className="font-semibold text-stone-200">{translatedItem.name}</h4>
                                <p className="text-xs text-stone-400">Quantidade: {item.quantity === Infinity ? 'Infinita' : item.quantity}</p>
                            </div>
                            <div className="text-right">
                                 <p className="font-mono text-amber-400 font-bold">{item.cost.quantity} {item.cost.unit}</p>
                                 <button
                                    onClick={() => buyItem(item as any, item.cost.quantity)}
                                    disabled={isInteractionDisabled || character.currency.gp < item.cost.quantity}
                                    className="mt-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Comprar
                                </button>
                            </div>
                        </div>
                    )
                })
            )}
        </div>
    );
    
    const renderSellTab = () => (
        <div className="space-y-2">
            {character.inventory.length === 0 ? (
                 <p className="text-stone-400 italic text-center py-4">Você não tem nada para vender.</p>
            ) : (
                character.inventory.map(item => {
                    const sellPrice = shopState.sellPrices[item.id] || Math.floor((item.cost?.quantity || 2) / 2);
                    const translatedItem = translateEquipment(item);
                     return (
                         <div key={item.id} className="bg-stone-800/70 p-3 rounded-lg border border-stone-700 flex justify-between items-center">
                            <div className="max-w-[60%]">
                                <h4 className="font-semibold text-stone-200 truncate">{translatedItem.name} {item.quantity > 1 ? `(x${item.quantity})`: ''}</h4>
                                <p className="text-xs text-stone-400">Valor Base: {item.cost?.quantity || '-'} {item.cost?.unit || ''}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-amber-400 font-bold">{sellPrice} gp</p>
                                <button
                                    onClick={() => sellItem(item, sellPrice)}
                                    disabled={isInteractionDisabled}
                                    className="mt-1 bg-amber-700 hover:bg-amber-600 text-stone-900 font-semibold py-1 px-3 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Vender
                                </button>
                            </div>
                        </div>
                    )
                })
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-amber-500 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold font-garamond text-amber-300">{shopState.name}</h2>
                        <p className="text-stone-400 text-sm">Seu Ouro: <span className="font-mono font-semibold text-amber-300">{character.currency.gp} gp</span></p>
                    </div>
                    <button onClick={handleClose} disabled={isLoading} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                 <nav className="flex border-b border-stone-700 flex-shrink-0">
                    <button onClick={() => setActiveTab('buy')} className={`flex-1 py-2 px-4 text-sm font-semibold ${activeTab === 'buy' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'}`}>Comprar</button>
                    <button onClick={() => setActiveTab('sell')} className={`flex-1 py-2 px-4 text-sm font-semibold ${activeTab === 'sell' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400'}`}>Vender</button>
                </nav>
                 {shopState.isHaggling && (
                    <div className="p-2 text-center bg-yellow-900/50 text-yellow-300 text-sm border-b border-stone-700">
                        Negociando preços...
                    </div>
                 )}
                <main className="p-4 overflow-y-auto">
                    {activeTab === 'buy' ? renderBuyTab() : renderSellTab()}
                </main>
            </div>
        </div>
    );
};

export default ShopModal;
