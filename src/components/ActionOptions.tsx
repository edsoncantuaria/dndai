// src/components/ActionOptions.tsx
'use client';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { Loader2, Send, Swords, MessageSquare, Compass, Eye, Zap, Shield, Sparkles, X } from 'lucide-react';


const HitDiceRoller: React.FC = () => {
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
    const { pendingLootOffer, takeLoot, isLoading } = useGameStateContext();
    if (!pendingLootOffer) return null;

    const hasItems = pendingLootOffer.items && pendingLootOffer.items.length > 0;
    const hasCurrency = pendingLootOffer.currency && pendingLootOffer.currency.gp > 0;
    if (!hasItems && !hasCurrency) return null;

    return (
        <div className="p-3 bg-stone-700/50 border border-amber-500 rounded-lg text-center animate-fadeIn spotlight-card">
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
                className="flex-grow bg-white/5 border border-white/15 rounded-2xl py-2 px-3 text-stone-100 placeholder:text-stone-500 focus:ring-2 focus:ring-amber-400/60 focus:border-transparent disabled:opacity-50"
            />
            <button
                type="submit"
                disabled={disabled || !inputValue.trim()}
                className="flex-shrink-0 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-900 font-semibold p-2 rounded-full transition-colors disabled:opacity-50"
                aria-label="Enviar Ação"
            >
                <Send className="h-5 w-5" />
            </button>
        </form>
    );
};

interface ActionSuggestionButtonProps {
    label: string;
    skillName?: string | null;
    disabled: boolean;
    delay: number;
    onSelect: () => void;
}

const getActionIcon = (text: string) => {
    const normalized = text.toLowerCase();
    if (normalized.includes('atac') || normalized.includes('lutar')) return <Swords className="h-5 w-5" />;
    if (normalized.includes('investig') || normalized.includes('percep')) return <Eye className="h-5 w-5" />;
    if (normalized.includes('falar') || normalized.includes('negociar')) return <MessageSquare className="h-5 w-5" />;
    if (normalized.includes('mover') || normalized.includes('explorar')) return <Compass className="h-5 w-5" />;
    if (normalized.includes('magia') || normalized.includes('conjurar')) return <Sparkles className="h-5 w-5" />;
    if (normalized.includes('defender') || normalized.includes('prote')) return <Shield className="h-5 w-5" />;
    return <Zap className="h-5 w-5" />;
};

const ActionSuggestionButton: React.FC<ActionSuggestionButtonProps> = ({ label, skillName, disabled, delay, onSelect }) => {
    const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const ripple = {
            id: Date.now(),
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            size,
        };
        setRipples(prev => [...prev, ripple]);
        onSelect();
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== ripple.id));
        }, 450);
    };

    return (
        <motion.button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className="relative text-left w-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-100 font-semibold py-3 px-4 rounded-2xl shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            whileTap={{ scale: disabled ? 1 : 0.97 }}
        >
            {ripples.map(ripple => (
                <span
                    key={ripple.id}
                    className="action-ripple"
                    style={{ width: ripple.size, height: ripple.size, left: ripple.x, top: ripple.y }}
                />
            ))}
            <span className="relative z-10 flex items-center gap-2">
                <span className="hidden sm:block">{label}</span>
                <span className="sm:hidden flex items-center gap-2 w-full">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-900/60 border border-stone-700">
                        {getActionIcon(label)}
                    </span>
                    <span className="flex-1 text-left">
                        <span className="block text-sm font-semibold text-stone-200">{label}</span>
                        {skillName && <span className="text-[11px] text-amber-300/80">{skillName}</span>}
                    </span>
                </span>
                {skillName && <span className="hidden sm:inline text-xs text-amber-300/80 ml-1">({skillName})</span>}
            </span>
        </motion.button>
    );
};

interface ActionOptionsProps {
    variant?: 'default' | 'embedded';
}

const ActionOptions: React.FC<ActionOptionsProps> = ({ variant = 'default' }) => {
    const { 
        processPlayerAction, 
        isLoading, 
        actionOptions,
        pendingLootOffer, 
        pendingHitDiceRequest, 
        playerRollRequest,
        combatState,
        character,
        nextTurn,
    } = useGameStateContext();

    const [isOpen, setIsOpen] = useState(false);

    const getCombatantId = (entry: any): string => {
        if (!entry) return '';
        return typeof entry === 'string' ? entry : (entry.id || entry.name || '');
    };
    
    const isPlayerTurn = useMemo(() => {
        if (!combatState.isActive || !character) {
            return !combatState.isActive; 
        }
        if (!combatState.initiativeOrder || combatState.initiativeOrder.length === 0) {
            return false;
        }
    
        const currentCombatantEntry = combatState.initiativeOrder[combatState.turn % combatState.initiativeOrder.length];
        const currentCombatantId = getCombatantId(currentCombatantEntry);
    
        const playerCombatant = combatState.combatants.find(c => c.isPlayer);
        return playerCombatant ? currentCombatantId === getCombatantId(playerCombatant) : false;
    
    }, [combatState, character]);

    
    const isActionLocked = !!playerRollRequest || !!pendingLootOffer || !!pendingHitDiceRequest || isLoading;

    const handleActionClick = (action: string | { text: string; action: string; skill?: string; }) => {
        // Prioriza o texto visível para o jogador.
        const actionCommand = (typeof action === 'object' && action.text) ? action.text :
                              (typeof action === 'object' && action.action) ? action.action :
                              action as string;

        if (actionCommand) {
            processPlayerAction(actionCommand);
        }
        setIsOpen(false);
    };

    const handleCustomSubmit = (action: string) => {
        processPlayerAction(action);
        setIsOpen(false);
    };

    const renderActionContent = () => {
        if (combatState.isActive && !isPlayerTurn) {
            return (
                <div className="text-center">
                    <p className="text-stone-400 italic mb-3">Aguardando turno de outros combatentes...</p>
                    <button
                        onClick={nextTurn}
                        disabled={isLoading}
                        className="w-full px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Próximo Turno' }
                    </button>
                </div>
            );
        }

        if(playerRollRequest) {
            return (
                <div className="flex items-center justify-center p-4 text-stone-400">
                    <Loader2 className="animate-spin" />
                    <span className="ml-2">Aguardando sua rolagem de dados...</span>
                </div>
            );
        }

        if (pendingLootOffer) {
            return <LootOfferDisplay />;
        }
    
        if (pendingHitDiceRequest) {
            return <HitDiceRoller />;
        }
        
        if (isLoading) {
            return (
                <div className="flex items-center justify-center p-4 text-stone-400">
                    <Loader2 className="animate-spin" />
                    <span className="ml-2">Aguardando o mestre...</span>
                </div>
            );
        }

        const hasSuggestedActions = actionOptions.length > 0;
    
        return (
            <div className="w-full">
                {hasSuggestedActions && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {actionOptions.map((action, index) => {
                            const actionText = typeof action === 'object' ? action.text : action;
                            const skillName = typeof action === 'object' && action.skill ? action.skill : null;
                            if (!actionText || typeof actionText !== 'string') return null;

                            return (
                                <ActionSuggestionButton
                                    key={`${actionText}-${index}`}
                                    label={actionText}
                                    skillName={skillName}
                                    disabled={isActionLocked}
                                    delay={index * 0.05}
                                    onSelect={() => handleActionClick(action)}
                                />
                            );
                        })}
                    </div>
                )}
                 <CustomActionInput onActionSubmit={handleCustomSubmit} disabled={isActionLocked} />
                 {!hasSuggestedActions && (
                     <p className="text-center text-xs text-stone-500 italic mt-2">O mestre aguarda sua próxima ação.</p>
                 )}
            </div>
        );
    }
    
    const isMobileCombatButtonVisible = combatState.isActive;
    const isMobileCombatButtonEnabled = isPlayerTurn && !isLoading;
    const isMobileNonCombatButtonVisible = !combatState.isActive;

    const desktopWrapperClasses =
        variant === 'embedded'
            ? 'hidden md:block border-t border-white/5 bg-black/40 px-4 py-3'
            : 'hidden md:block p-4 flex-shrink-0 border-t border-white/10 bg-white/5 backdrop-blur-sm rounded-b-2xl overflow-y-auto';

    return (
        <>
            <div className={desktopWrapperClasses}>
                {renderActionContent()}
            </div>
            <div className="md:hidden">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            key="action-backdrop"
                            className="fixed inset-0 bg-black/60 z-20"
                            onClick={() => setIsOpen(false)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />
                    )}
                </AnimatePresence>
                {(isMobileCombatButtonVisible || isMobileNonCombatButtonVisible) && (
                    <div className="fixed bottom-5 right-4 z-30">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            disabled={!isMobileCombatButtonEnabled && combatState.isActive}
                            className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-stone-900 flex items-center justify-center shadow-lg shadow-amber-900/50 border border-white/10 transition-all duration-300 ease-in-out disabled:from-stone-600 disabled:to-stone-700 disabled:text-stone-300 disabled:cursor-not-allowed"
                            aria-label={isOpen ? "Fechar Ações" : "Abrir Ações"}
                        >
                            {isOpen ? <X className="h-8 w-8" /> : (isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Swords className="h-8 w-8" />)}
                        </button>
                    </div>
                )}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            key="action-sheet"
                            initial={{ opacity: 0, y: 35 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.25 }}
                            className="fixed inset-x-4 top-24 bottom-24 bg-[#0b0f16]/95 backdrop-blur-2xl rounded-3xl shadow-2xl p-5 border border-white/10 z-30 overflow-y-auto"
                        >
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-300 mb-3">Escolha sua ação</h3>
                            {renderActionContent()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};

export default ActionOptions;
