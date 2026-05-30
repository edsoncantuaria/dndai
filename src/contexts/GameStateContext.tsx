// src/contexts/GameStateContext.tsx
'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useNewGameState } from '../hooks/newUseGameState';
import type { Character, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, PlayerRollRequest, ApiSpell, InventoryItem, ShopItem, LevelUpSelections, NewCharacterInfo, HomebrewContent, ProgressionFeedItem } from '../types';
import type { SkillCheckRequestState, SpellCastRequestState, SendMotorActionFn } from '@/hooks/useInteractionManager';
import type { StructuredIntent } from '@/hooks/game/motorIntents';

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
    pendingStructuredIntent: any | null;
    skillCheckRequest: SkillCheckRequestState | null;
    setSkillCheckRequest: React.Dispatch<React.SetStateAction<SkillCheckRequestState | null>>;
    spellCastRequest: SpellCastRequestState | null;
    setSpellCastRequest: React.Dispatch<React.SetStateAction<SpellCastRequestState | null>>;
    playerRollRequest: PlayerRollRequest | null;
    setPlayerRollRequest: React.Dispatch<React.SetStateAction<PlayerRollRequest | null>>;
    isLoading: boolean;
    apiError: string | null;
    ambientSound: string;
    setAmbientSound: React.Dispatch<React.SetStateAction<string>>;
    progressionFeed: ProgressionFeedItem[];
    reinstallModal: { open: boolean, deps: HomebrewContent[], onConfirm: () => void };
    setReinstallModal: React.Dispatch<React.SetStateAction<{ open: boolean, deps: HomebrewContent[], onConfirm: () => void }>>;
    clearApiError: () => void;
    getApiKey: () => string | undefined;
    createCharacter: (info: NewCharacterInfo) => Promise<Character | null>;
    deleteCharacter: (characterId: number) => Promise<boolean>;
    deleteSession: (sessionIdToDelete: number) => Promise<boolean>;
    startGame: (newSessionId?: number) => Promise<void>;
    sendMotorAction: (action: string, structured?: StructuredIntent) => void;
    applyLevelUp: (selections: LevelUpSelections) => Promise<void>;
    toggleEquipped: (itemId: string) => void;
    useConsumable: (itemId: string) => void;
    spendHitDice: (diceCount: number) => void;
    declineHitDiceRequest: () => void;
    takeLoot: (takeAll: boolean) => void;
    buyItem: (item: ShopItem, price: number) => void;
    sellItem: (item: InventoryItem, price: number) => void;
    openShop: (catalog: { name: string; inventory: ShopItem[]; merchantName?: string }) => void;
    closeShop: () => void;
    startEncounter: (
        character: { id: number; name: string; attributes?: { hp?: number; maxHp?: number; ac?: number } },
        hostiles: Array<{ id: string; name: string; hp: number; maxHp: number; ac?: number; initiative?: number }>,
    ) => void;
    clearGameState: () => void;
    nextTurn: () => void;
    loadGameSession: (id: number) => Promise<{ character: Character; logs: any[] } | null>;
    handleSkillCheck: (skillName: string) => void;
    handleSkillCheckSubmit: (description: string, modelOverride?: string) => void;
    castSpell: (spell: ApiSpell, options?: { slotLevel?: number; slotsBefore?: { current: number; max: number } }) => void;
    submitSpellCast: (spell: ApiSpell, description: string) => void;
    handleRollResult: (result: { rawRoll: number; rolls: number[]; }) => void;
    setCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
    setLog: React.Dispatch<React.SetStateAction<LogEntry[]>>;
    setSessionId: React.Dispatch<React.SetStateAction<number | null>>;
    actionPhaseLabel: string | null;
    isRollPending: boolean;
    /** F.1 — idle | rolling | mechanical | narrating */
    turnPipelinePhase: 'idle' | 'rolling' | 'mechanical' | 'narrating';
    // Debug Triggers
    triggerTestShop: (sendMotorAction?: SendMotorActionFn) => void;
    triggerTestCombat: (
        sendMotorAction?: SendMotorActionFn,
        character?: { id: number; name: string; attributes?: { hp?: number; maxHp?: number; ac?: number } },
    ) => void;
    getTestShopCatalog?: () => { name: string; inventory: ShopItem[]; merchantName?: string };
    triggerTestSkillCheck: (skillName: string) => void;
    setPendingStructuredIntent: React.Dispatch<React.SetStateAction<any | null>>;
    setCombatState: React.Dispatch<React.SetStateAction<CombatState>>;
    setRequest: (args: { type: 'shop' | 'loot'; request: ShopState | LootOffer }) => void;
    setActionOptions: React.Dispatch<
        React.SetStateAction<(string | { text: string; action: string; skill?: string })[]>
    >;
}


const GameStateContext = createContext<GameStateContextType | null>(null);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const gameState = useNewGameState(); 
    
    // We need to construct a value that perfectly matches the `GameStateContextType`
    const contextValue = useMemo(() => ({
        ...gameState,
        castSpell: (spell: ApiSpell, options?: { slotLevel?: number; slotsBefore?: { current: number; max: number } }) => gameState.setSpellCastRequest({ spell, ...options }),
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
