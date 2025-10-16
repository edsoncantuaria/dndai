'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useNewGameState } from '../hooks/newUseGameState';
import type { Character, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, PlayerRollRequest, ApiSpell, InventoryItem, ShopItem, LevelUpSelections, NewCharacterInfo } from '../types';

// Define a mais específica para o valor do contexto
export interface GameStateContextType {
    character: Character | null;
    log: LogEntry[];
    sessionId: number | null;
    actionOptions: (string | { text: string; action: string; skill?: string; })[];
    combatState: CombatState;
    levelUpState: LevelUpState | null;
    shopState: ShopState | null;
    pendingLootOffer: LootOffer | null;
    pendingHitDiceRequest: UseHitDiceRequest | null;
    skillCheckRequest: { skillName: string; } | null;
    setSkillCheckRequest: React.Dispatch<React.SetStateAction<{ skillName: string; } | null>>;
    spellCastRequest: { spell: ApiSpell; } | null;
    setSpellCastRequest: React.Dispatch<React.SetStateAction<{ spell: ApiSpell; } | null>>;
    playerRollRequest: PlayerRollRequest | null;
    setPlayerRollRequest: React.Dispatch<React.SetStateAction<PlayerRollRequest | null>>;
    isLoading: boolean;
    apiError: string | null;
    ambientSound: string;
    clearApiError: () => void;
    getApiKey: () => string | undefined;
    createCharacter: (info: NewCharacterInfo) => Promise<Character | null>;
    deleteCharacter: (characterId: number) => Promise<boolean>;
    deleteSession: (sessionIdToDelete: number) => Promise<boolean>;
    startGame: (newSessionId?: number) => Promise<void>;
    processPlayerAction: (action: string, sessionIdOverride?: number, modelOverride?: string) => Promise<void>;
    applyLevelUp: (selections: LevelUpSelections) => Promise<void>;
    toggleEquipped: (itemId: string) => void;
    useConsumable: (itemId: string) => void;
    spendHitDice: (diceCount: number) => void;
    takeLoot: (takeAll: boolean) => void;
    buyItem: (item: ShopItem, price: number) => void;
    sellItem: (item: InventoryItem, price: number) => void;
    clearGameState: () => void;
    nextTurn: () => void;
    loadGameSession: (id: number) => Promise<{ character: Character; logs: any[] } | null>;
    handleSkillCheckSubmit: (description: string, modelOverride?: string) => void;
    castSpell: (spell: ApiSpell) => void;
    submitSpellCast: (spell: ApiSpell, description: string) => void;
    handleRollResult: (result: { rawRoll: number; rolls: number[]; }) => void;
    setCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
    setLog: React.Dispatch<React.SetStateAction<LogEntry[]>>;
    setSessionId: React.Dispatch<React.SetStateAction<number | null>>;
    // Debug Triggers
    triggerTestShop: () => void;
    triggerTestCombat: () => void;
    triggerTestSkillCheck: (skillName: string) => void;
}


const GameStateContext = createContext<GameStateContextType | null>(null);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const gameState = useNewGameState(); 
    
    // We need to construct a value that perfectly matches the `GameStateContextType`
    const contextValue = useMemo(() => ({
        ...gameState,
        // Ensure all functions are correctly bound and passed
        castSpell: (spell: ApiSpell) => gameState.setSpellCastRequest({ spell }),
    }), [gameState]);

    return (
        <GameStateContext.Provider value={contextValue as any}>
            {children}
        </GameStateContext.Provider>
    );
};

export const useGameStateContext = (): GameStateContextType => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error('useGameStateContext deve ser usado dentro de um GameStateProvider');
    }
    return context;
};
