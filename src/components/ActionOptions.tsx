'use client';
import React, { useState, useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { Loader2, Send, Swords, X } from 'lucide-react';
import DiceRollModal from './ui/DiceRollModal';
import { SKILL_ATTRIBUTE_MAP, translateApiString } from '@/utils/translator';
import { PlayerRollRequest } from '@/types';


const HitDiceRoller: React.FC = () => {
    // ... (código existente inalterado)
    const { character, pendingHitDiceRequest, spendHitDice, isLoading } = useGameStateContext();
    const [diceToSpend, setDiceToSpend] = useState(1);
    
    if (!pendingHitDiceRequest || !character) return null;

    const maxDice = Math.min(pendingHitDiceRequest.maxDice || 0, character.hitDice.current || 0);

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
                    max={maxDice || 0}
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
                {isLoading ? <Loader2 className="mx-auto animate-spin" /> : `Gastar ${diceToSpend} Dado(s) de Vida`}
            </button>
        </div>
    );
};

const LootOfferDisplay: React.FC = () => {
    // ... (código existente inalterado)
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
                {isLoading ? <Loader2 className="mx-auto animate-spin" /> : 'Pegar Tudo'}
            </button>
        </div>
    )
};

const CustomActionInput: React.FC<{ onActionSubmit: (action: string) => void, disabled: boolean }> = ({ onActionSubmit, disabled }) => {
    // ... (código existente inalterado)
    const [inputValue, setInputValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !disabled) {
            onActionSubmit(inputValue.trim());
            setInputValue('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-4">
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="O que você faz?"
                disabled={disabled}
                className="flex-grow bg-stone-800 border border-stone-600 rounded-md py-2 px-3 text-stone-200 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
            />
            <button
                type="submit"
                disabled={disabled || !inputValue.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold p-2 rounded-md transition-colors disabled:opacity-50"
                aria-label="Enviar Ação"
            >
                <Send className="h-5 w-5" />
            </button>
        </form>
    );
};

const ActionOptions: React.FC = () => {
    const { character, actionOptions, processPlayerAction, isLoading, pendingLootOffer, pendingHitDiceRequest, playerRollRequest, submitPlayerRoll, requestPlayerRoll } = useGameStateContext();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isLoading || playerRollRequest) {
            setIsOpen(false);
        }
    }, [isLoading, playerRollRequest]);

    const handleSkillCheck = (skillName: string) => {
        if (!character) return;
        const attribute = SKILL_ATTRIBUTE_MAP[skillName as keyof typeof SKILL_ATTRIBUTE_MAP];
        const isProficient = character.proficiencies.some(p => p.name.toLowerCase().includes(skillName.toLowerCase()));
        const modifier = character.modifiers[attribute] + (isProficient ? character.proficiencyBonus : 0);

        const rollRequest: PlayerRollRequest = {
            reason: `um teste de ${translateApiString(`Skill: ${skillName}`)}`,
            dice: '1d20',
            modifier,
            rollType: 'check',
        };
        requestPlayerRoll(rollRequest);
    };

    const renderActionContent = () => {
        if (pendingLootOffer) {
            return <LootOfferDisplay />;
        }
    
        if (pendingHitDiceRequest) {
            return <HitDiceRoller />;
        }

        const hasSuggestedActions = actionOptions.length > 0;
    
        return (
            <div className="w-full">
                 {isLoading && !playerRollRequest && (
                    <div className="flex items-center justify-center p-4 text-stone-400">
                        <Loader2 className="animate-spin" />
                        <span className="ml-2">Aguardando o mestre...</span>
                    </div>
                )}
                {!isLoading && hasSuggestedActions && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {actionOptions.map((action, index) => {
                             if (typeof action === 'object' && action !== null && 'skill' in action) {
                                const skillAction = action as { text: string; skill: string };
                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleSkillCheck(skillAction.skill)}
                                        disabled={isLoading}
                                        className="text-left w-full bg-stone-700/80 hover:bg-stone-600 border border-stone-600 text-stone-300 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                                        style={{ animation: `staggerIn 300ms ease-out ${index * 80}ms forwards`, opacity: 0 }}
                                    >
                                        {skillAction.text}
                                    </button>
                                );
                            }

                            const actionText = (typeof action === 'object' && action !== null) 
                                ? (action as any).text || (action as any).description 
                                : action;
                            const actionValue = (typeof action === 'object' && action !== null && 'action' in action) 
                                ? (action as any).action 
                                : action;
                            
                            if (!actionText || typeof actionText !== 'string') return null;
    
                            return (
                                <button
                                    key={index}
                                    onClick={() => processPlayerAction(actionValue)}
                                    disabled={isLoading}
                                    className="text-left w-full bg-stone-700/80 hover:bg-stone-600 border border-stone-600 text-stone-300 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                                    style={{ animation: `staggerIn 300ms ease-out ${index * 80}ms forwards`, opacity: 0 }}
                                >
                                    {actionText}
                                </button>
                            )
                        })}
                    </div>
                )}
                 <CustomActionInput onActionSubmit={processPlayerAction} disabled={isLoading} />
                 {!isLoading && !hasSuggestedActions && (
                     <p className="text-center text-xs text-stone-500 italic mt-2">O mestre aguarda sua próxima ação.</p>
                 )}
            </div>
        );
    }
    
    return (
        <>
            {playerRollRequest && (
                <DiceRollModal
                    request={playerRollRequest}
                    onRoll={submitPlayerRoll}
                />
            )}
            {/* Desktop: Static Panel */}
            <div className="hidden md:block p-4 flex-shrink-0 border-t border-stone-700/80 bg-stone-900/30">
                 {renderActionContent()}
            </div>

            {/* Mobile: Floating Action Button and Modal */}
            <div className="md:hidden">
                {isOpen && (
                    <div 
                        className="fixed inset-0 bg-black/50 z-20"
                        onClick={() => setIsOpen(false)}
                    />
                )}
                <div className="fixed bottom-20 right-4 z-30">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        disabled={isLoading || !!playerRollRequest}
                        className="h-16 w-16 rounded-full bg-amber-600 text-stone-900 flex items-center justify-center shadow-lg transition-all duration-300 ease-in-out disabled:bg-stone-500 disabled:cursor-not-allowed"
                        aria-label={isOpen ? "Fechar Ações" : "Abrir Ações"}
                    >
                        {isOpen ? <X className="h-8 w-8" /> : (isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Swords className="h-8 w-8" />)}
                    </button>
                </div>
                
                {isOpen && (
                     <div className="fixed bottom-40 right-4 w-[calc(100%-2rem)] max-w-md bg-stone-800/80 backdrop-blur-md rounded-lg shadow-2xl p-4 border border-stone-600 z-30 animate-fadeInSlideUp">
                        {renderActionContent()}
                    </div>
                )}
            </div>
        </>
    );
};

export default ActionOptions;
