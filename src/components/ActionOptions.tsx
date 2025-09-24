'use client';
// components/ActionOptions.tsx
import React, { useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { Icons } from './Icons';

const HitDiceRoller: React.FC = () => {
    const { character, pendingHitDiceRequest, spendHitDice, isLoading } = useGameStateContext();
    const [diceToSpend, setDiceToSpend] = useState(1);
    
    if (!pendingHitDiceRequest || !character) return null;

    const maxDice = Math.min(pendingHitDiceRequest.maxDice, character.hitDice.current);

    const handleConfirm = () => {
        if (diceToSpend > 0) {
            spendHitDice(diceToSpend);
        }
    };
    
    return (
        <div className="p-3 bg-stone-700/50 border border-amber-500 rounded-lg text-center animate-fadeIn">
            <h4 className="font-semibold text-amber-300">Gastar Dados de Vida</h4>
            <p className="text-sm text-stone-300 my-2">Você tem {character.hitDice.current} de {character.hitDice.total} Dados de Vida (d{pendingHitDiceRequest.hitDieValue}). Quantos você quer gastar para se curar?</p>
            <div className="flex items-center justify-center gap-4 my-3">
                <input 
                    type="range" 
                    min="0" 
                    max={maxDice} 
                    value={diceToSpend} 
                    onChange={(e) => setDiceToSpend(parseInt(e.target.value, 10))}
                    className="w-full"
                    disabled={maxDice === 0}
                />
                <span className="font-bold text-lg text-amber-200">{diceToSpend}</span>
            </div>
             <button
                onClick={handleConfirm}
                disabled={isLoading || diceToSpend === 0}
                className="w-full bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
                {isLoading ? <Icons.Spinner className="mx-auto" /> : `Gastar ${diceToSpend} Dado(s) de Vida`}
            </button>
        </div>
    );
};


const LootOfferDisplay: React.FC = () => {
    const { pendingLootOffer, takeLoot, isLoading } = useGameStateContext();
    if (!pendingLootOffer) return null;

    return (
        <div className="p-3 bg-stone-700/50 border border-amber-500 rounded-lg text-center animate-fadeIn">
            <h4 className="font-semibold text-amber-300">Tesouro Encontrado!</h4>
            <ul className="text-sm text-stone-300 my-2 list-disc list-inside">
                {pendingLootOffer.items.map(item => (
                    <li key={item.id}>{item.name} (x{item.quantity})</li>
                ))}
                {pendingLootOffer.currency.gp > 0 && <li>{pendingLootOffer.currency.gp} moedas de ouro</li>}
            </ul>
             <button
                onClick={() => takeLoot(true)}
                disabled={isLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
                {isLoading ? <Icons.Spinner className="mx-auto" /> : 'Pegar Tudo'}
            </button>
        </div>
    )
}

const ActionOptions: React.FC = () => {
    const { actionOptions, processPlayerAction, isLoading, pendingLootOffer, pendingHitDiceRequest } = useGameStateContext();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4 text-stone-400">
                <Icons.Spinner />
                <span className="ml-2">Aguardando o mestre...</span>
            </div>
        );
    }
    
    if (pendingLootOffer) {
        return <LootOfferDisplay />;
    }

    if (pendingHitDiceRequest) {
        return <HitDiceRoller />;
    }

    if (actionOptions.length === 0) {
        return <div className="text-center text-stone-500 italic">Nenhuma ação sugerida no momento.</div>
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {actionOptions.map((action, index) => (
                <button
                    key={index}
                    onClick={() => processPlayerAction(action)}
                    disabled={isLoading}
                    className="text-left w-full bg-stone-700/80 hover:bg-stone-600 border border-stone-600 text-stone-300 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                    style={{ animation: `staggerIn 300ms ease-out ${index * 80}ms forwards`, opacity: 0 }}
                >
                    {action}
                </button>
            ))}
        </div>
    );
};

export default ActionOptions;
