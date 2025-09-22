
import { useState, useCallback, useEffect } from 'react';
import type { Character, NewCharacterInfo, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, LevelUpSelections, ApiSpell, InventoryItem, ShopItem } from '../types';
import * as geminiService from '../services/geminiService';
import * as characterUtils from '../utils/characterUtils';
import * as DndApiService from '../services/dndApiService';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY = 'rpg-de-cria-savegame';

// A simple deep merge utility for updating character state
function mergeDeep(target: any, source: any) {    
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = mergeDeep(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item: any) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

export const useGameState = () => {
    const [character, setCharacter] = useState<Character | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [actionOptions, setActionOptions] = useState<string[]>([]);
    const [combatState, setCombatState] = useState<CombatState>({ isActive: false, round: 0, turn: 0, combatants: [] });
    const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);
    const [shopState, setShopState] = useState<ShopState | null>(null);
    const [pendingLootOffer, setPendingLootOffer] = useState<LootOffer | null>(null);
    const [pendingHitDiceRequest, setPendingHitDiceRequest] = useState<UseHitDiceRequest | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const saveGameToLocalStorage = useCallback(() => {
        if (character) {
            try {
                const gameState = { character, log };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
            } catch (error) {
                console.error("Failed to save game to local storage:", error);
            }
        }
    }, [character, log]);

    useEffect(() => {
        // Auto-save whenever character or log changes
        saveGameToLocalStorage();
    }, [character, log, saveGameToLocalStorage]);

    const loadGameFromLocalStorage = useCallback(() => {
        try {
            const savedGame = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedGame) {
                const { character: savedCharacter, log: savedLog } = JSON.parse(savedGame);
                setCharacter(savedCharacter);
                setLog(savedLog || []);
                // Reset transient states
                setActionOptions([]);
                setCombatState({ isActive: false, round: 0, turn: 0, combatants: [] });
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Failed to load game from local storage:", error);
        }
    }, []);
    
    const checkForSavedGame = useCallback((): boolean => {
         return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
    }, []);

    const startNewGame = useCallback(() => {
        if (window.confirm('Tem certeza que deseja iniciar um novo jogo? O progresso atual será perdido.')) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setCharacter(null);
            setLog([]);
            setActionOptions([]);
            setCombatState({ isActive: false, round: 0, turn: 0, combatants: [] });
            setLevelUpState(null);
        }
    }, []);

    const handleGeminiResponse = useCallback((response: geminiService.GeminiResponse | null) => {
        if (!response) {
            // Handle API error gracefully
            setLog(prev => [...prev, { id: uuidv4(), type: 'system', content: 'Ocorreu um erro ao contatar o Mestre. Tente novamente.' }]);
            setActionOptions(prev => prev.length > 0 ? prev : ['Tentar novamente.']);
            return;
        }

        if (response.updatedCharacter) {
             setCharacter(prev => {
                if (!prev) return null;
                // Use a deep merge to safely update nested properties like hp, currency, etc.
                const updated = mergeDeep(prev, response.updatedCharacter);
                
                // Recalculate derived stats if relevant properties changed
                const newModifiers = characterUtils.calculateModifiers(updated.attributes);
                updated.modifiers = newModifiers;
                updated.ac = characterUtils.calculateAC(updated.inventory, newModifiers);
                updated.carryingCapacity = characterUtils.calculateCarryingCapacity(updated.attributes.strength);
                updated.currentWeight = updated.inventory.reduce((sum: number, item: InventoryItem) => sum + (item.weight || 0) * item.quantity, 0);

                return updated;
            });
        }
        
        if (response.logEntries) {
            setLog(prev => [...prev, ...response.logEntries.map(entry => ({ ...entry, id: uuidv4() }))]);
        }
        
        if (response.actionOptions) {
            setActionOptions(response.actionOptions);
        }

        if (response.combatState) {
            setCombatState(response.combatState);
        }

        if (response.levelUpState) {
            setLevelUpState(prev => ({ ...(prev || {isPending: false, newLevel: 0, choices: {}}), ...response.levelUpState }));
        }

        if (response.shopState) {
            setShopState(response.shopState);
        }

        if (response.lootOffer) {
            setPendingLootOffer(response.lootOffer);
        }

        if (response.useHitDiceRequest) {
            setPendingHitDiceRequest(response.useHitDiceRequest);
        }

    }, []);

    const processPlayerAction = useCallback(async (action: string) => {
        if (!character) return;
        
        setIsLoading(true);
        setActionOptions([]); // Clear old options
        setLog(prev => [...prev, { id: uuidv4(), type: 'action', content: action }]);

        const response = await geminiService.getGameUpdate(character, action, log);
        handleGeminiResponse(response);
        setIsLoading(false);

    }, [character, log, handleGeminiResponse]);
    
    const createCharacter = useCallback(async (info: NewCharacterInfo) => {
        setIsLoading(true);
        
        const modifiers = characterUtils.calculateModifiers(info.attributes);
        const proficiencyBonus = characterUtils.getProficiencyBonus(1);
        const maxHp = characterUtils.calculateMaxHpAtLevel1(info.hitDie, modifiers.constitution);

        const [classLevelsData, subclassLevelsData] = await Promise.all([
            DndApiService.getClassLevels(info.characterClass.toLowerCase()),
            info.subclass ? DndApiService.getSubclassLevels(info.subclass.toLowerCase()) : Promise.resolve(null),
        ]);

        const newCharacter: Character = {
            ...info,
            level: 1,
            xp: 0,
            xpToNextLevel: characterUtils.getXpThreshold(1),
            modifiers,
            hp: { current: maxHp, max: maxHp, temp: 0 },
            ac: characterUtils.calculateAC(info.inventory, modifiers),
            proficiencyBonus,
            currentWeight: info.inventory.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0),
            carryingCapacity: characterUtils.calculateCarryingCapacity(info.attributes.strength),
            spellSlots: {},
            deathSaves: { successes: 0, failures: 0 },
            conditions: [],
            relationships: [],
            journal: [],
            currentRegion: 'Desconhecida',
            hitDice: { current: 1, total: 1 },
            classLevelsData: classLevelsData || [],
            subclassLevelsData: subclassLevelsData || [],
        };
        
        // Populate initial spell slots if any
        const level1Data = classLevelsData?.find(l => l.level === 1);
        if (level1Data?.spellcasting) {
            Object.keys(level1Data.spellcasting).forEach(key => {
                if (key.startsWith('spell_slots_level_')) {
                    const level = key.replace('spell_slots_level_', '');
                    const max = level1Data.spellcasting![key as keyof typeof level1Data.spellcasting] as number;
                    newCharacter.spellSlots[`level${level}`] = { current: max, max: max };
                }
            });
        }

        setCharacter(newCharacter);
        setLog([]);

        const response = await geminiService.getInitialStory(newCharacter);
        handleGeminiResponse(response);
        setIsLoading(false);
    }, [handleGeminiResponse]);
    
    const applyLevelUp = useCallback((selections: LevelUpSelections) => {
        const action = `Eu subo de nível! Minhas escolhas são: ${JSON.stringify(selections)}`;
        setLevelUpState(null); // Close the modal immediately
        processPlayerAction(action);
    }, [processPlayerAction]);
    
    const toggleEquipped = useCallback((itemId: string) => {
        setCharacter(prev => {
            if (!prev) return null;
            const newInventory = prev.inventory.map(item => {
                if (item.id === itemId) {
                    return { ...item, equipped: !item.equipped };
                }
                return item;
            });
            const newCharacter = { ...prev, inventory: newInventory };
            newCharacter.ac = characterUtils.calculateAC(newInventory, newCharacter.modifiers);
            return newCharacter;
        });
    }, []);
    
    const castSpell = useCallback((spell: ApiSpell) => {
        processPlayerAction(`Eu conjuro a magia: ${spell.name}.`);
    }, [processPlayerAction]);

    const spendHitDice = useCallback((diceCount: number) => {
        setPendingHitDiceRequest(null);
        processPlayerAction(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
    }, [processPlayerAction]);
    
    const takeLoot = useCallback((accept: boolean) => {
        setPendingLootOffer(null);
        if (accept) {
            processPlayerAction("Eu pego todos os itens.");
        } else {
            processPlayerAction("Eu deixo os itens para trás.");
        }
    }, [processPlayerAction]);
    
    const buyItem = useCallback((item: ShopItem, price: number) => {
        processPlayerAction(`Eu compro ${item.name} por ${price} moedas de ouro.`);
    }, [processPlayerAction]);

    const sellItem = useCallback((item: InventoryItem, price: number) => {
        processPlayerAction(`Eu vendo ${item.name} por ${price} moedas de ouro.`);
    }, [processPlayerAction]);

    const saveGameToFile = useCallback(() => {
        if (!character) return;
        const gameState = { character, log };
        const blob = new Blob([JSON.stringify(gameState, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${character.name.replace(/\s/g, '_')}_save.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [character, log]);

    const loadGameFromFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result;
                if (typeof text === 'string') {
                    const { character: savedCharacter, log: savedLog } = JSON.parse(text);
                     if (savedCharacter && savedCharacter.name) {
                        setCharacter(savedCharacter);
                        setLog(savedLog || []);
                        // Reset transient states
                        setActionOptions([]);
                        setCombatState({ isActive: false, round: 0, turn: 0, combatants: [] });
                        setIsLoading(false);
                    } else {
                        alert("Arquivo de save inválido.");
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar o jogo do arquivo:", error);
                alert("Falha ao carregar o arquivo de save. O arquivo pode estar corrompido.");
            }
        };
        reader.readAsText(file);
    }, []);
    

    return {
        character,
        log,
        actionOptions,
        combatState,
        levelUpState,
        shopState,
        pendingLootOffer,
        pendingHitDiceRequest,
        isLoading,
        createCharacter,
        processPlayerAction,
        applyLevelUp,
        toggleEquipped,
        castSpell,
        spendHitDice,
        takeLoot,
        buyItem,
        sellItem,
        startNewGame,
        saveGameToFile,
        loadGameFromFile,
        checkForSavedGame,
        loadGameFromLocalStorage,
    };
};
