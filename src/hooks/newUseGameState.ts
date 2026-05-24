// src/hooks/newUseGameState.ts
'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useGameLog } from './useGameLog';
import { useInteractionManager } from './useInteractionManager';
import * as GameService from '../services/gameService';
import * as characterUtils from '../utils/characterUtils';
import * as HomebrewService from '../services/homebrewService';
import type { Character, NewCharacterInfo, SessaoIA, LogEntry, GameMasterResponse, HomebrewContent, InventoryItem, ApiSpell, LevelUpState, LevelUpSelections, ProgressionFeedItem, PlayerRollRequest } from '../types';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './use-toast';
import { initializeWebSocket, sendMessage, addEventListener, removeEventListener, closeWebSocket } from '@/services/webSocketService';
import { translateAttribute } from '@/utils/translator';
import { ambientSounds } from '@/data/ambient-sounds';

const CLIENT_ACTION_TIMEOUT_MS =
    Number(process.env.NEXT_PUBLIC_ACTION_TIMEOUT_MS) || 120_000;

const buildItemKey = (item?: InventoryItem) => {
    if (!item) return null;
    const raw = item.id ?? item.index ?? item.name;
    if (!raw) return null;
    return String(raw).toLowerCase();
};

const mergeInventoryItems = (previous: InventoryItem[] | undefined, incoming: InventoryItem[]): InventoryItem[] => {
    const prevMap = new Map<string, InventoryItem>();
    (previous || []).forEach(item => {
        const key = buildItemKey(item) ?? `${Date.now()}-${Math.random()}`;
        prevMap.set(key, item);
    });

    return incoming.map(item => {
        const key = buildItemKey(item) ?? `${Date.now()}-${Math.random()}`;
        const prevItem = prevMap.get(key);
        if (!prevItem) return item;
        return { ...prevItem, ...item };
    });
};

const normalizeText = (value: string) =>
    value
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

const tokenize = (value: string): string[] => normalizeText(value).split(/[^a-z0-9]+/g).filter(Boolean);

const soundLibrary = new Map(ambientSounds.map(sound => [sound.id, sound]));
const soundTagCache = new Map(
    ambientSounds.map(sound => [sound.id, sound.tags.map(tag => normalizeText(tag)).filter(Boolean)])
);

const KEYWORD_TAGS: Record<string, string[]> = {
    taverna: ['taverna', 'social', 'interior', 'cidade'],
    tavern: ['taverna', 'social', 'interior', 'cidade'],
    taberna: ['taverna', 'social', 'interior', 'cidade'],
    pousada: ['taverna', 'interior', 'social'],
    estalagem: ['taverna', 'interior', 'social'],
    mercado: ['mercado', 'cidade', 'social'],
    bazar: ['mercado', 'cidade', 'social'],
    feira: ['mercado', 'cidade', 'social'],
    porto: ['porto', 'agua', 'cidade'],
    doca: ['porto', 'agua', 'cidade'],
    docks: ['porto', 'agua', 'cidade'],
    navio: ['oceano', 'agua', 'navio'],
    barco: ['oceano', 'agua', 'navio'],
    ship: ['oceano', 'agua', 'navio'],
    mar: ['oceano', 'agua'],
    praia: ['oceano', 'agua'],
    costa: ['oceano', 'agua'],
    floresta: ['floresta', 'natureza'],
    bosque: ['floresta', 'natureza'],
    selva: ['selva', 'floresta', 'natureza'],
    campamento: ['acampamento', 'fogueira', 'exterior'],
    acampamento: ['acampamento', 'fogueira', 'exterior'],
    fogueira: ['fogueira', 'acampamento'],
    pantano: ['pantano', 'umido', 'natureza'],
    brejo: ['pantano', 'umido', 'natureza'],
    masmorra: ['masmorra', 'subterraneo', 'perigo'],
    dungeon: ['masmorra', 'subterraneo', 'perigo'],
    caverna: ['caverna', 'subterraneo', 'perigo'],
    catacumba: ['catacumbas', 'terror', 'subterraneo'],
    cripta: ['catacumbas', 'terror', 'subterraneo'],
    mina: ['mina', 'subterraneo'],
    ruina: ['ruina', 'perigo'],
    templo: ['templo', 'sagrado', 'interior'],
    catedral: ['templo', 'sagrado', 'interior'],
    igreja: ['templo', 'sagrado', 'interior'],
    santuario: ['templo', 'sagrado', 'interior'],
    castelo: ['castelo', 'interior'],
    fortaleza: ['castelo', 'guerra'],
    torre: ['castelo'],
    palacio: ['castelo', 'social'],
    biblioteca: ['biblioteca', 'interior', 'calmo'],
    laboratorio: ['laboratorio', 'magia', 'interior'],
    ferreiro: ['forja', 'cidade', 'interior'],
    forja: ['forja', 'cidade', 'interior'],
    festival: ['festival', 'social', 'cidade'],
    carnaval: ['festival', 'social'],
    cerco: ['guerra', 'combate'],
    batalha: ['combate', 'batalha'],
    guerra: ['combate', 'guerra'],
    deserto: ['deserto', 'areia'],
    duna: ['deserto', 'areia'],
    vulcao: ['vulcao', 'lava', 'fogo'],
    lava: ['lava', 'fogo'],
    gelo: ['gelo', 'neve', 'inverno', 'frio'],
    neve: ['neve', 'inverno', 'frio'],
    inverno: ['neve', 'inverno', 'frio'],
    cidade: ['cidade', 'social'],
    vila: ['cidade', 'social'],
    aldeia: ['cidade', 'social'],
};

const KEYWORD_ENTRIES = Object.entries(KEYWORD_TAGS);

const WEATHER_TAG_RULES = [
    { match: 'tempest', tags: ['tempestade', 'chuva'] },
    { match: 'tormenta', tags: ['tempestade', 'chuva'] },
    { match: 'chuva', tags: ['chuva', 'tempestade'] },
    { match: 'neve', tags: ['neve', 'inverno', 'frio'] },
    { match: 'geada', tags: ['inverno', 'frio'] },
    { match: 'inverno', tags: ['inverno', 'frio', 'neve'] },
    { match: 'areia', tags: ['deserto'] },
    { match: 'poeira', tags: ['deserto'] },
    { match: 'vento', tags: ['vento'] },
    { match: 'neblina', tags: ['neblina', 'mistico'] },
];

const TIME_TAG_RULES = [
    { match: 'noite', tags: ['noite'] },
    { match: 'madrugada', tags: ['noite'] },
    { match: 'crepuscu', tags: ['noite'] },
    { match: 'amanhecer', tags: ['dia'] },
    { match: 'manh', tags: ['dia'] },
    { match: 'tarde', tags: ['dia'] },
    { match: 'dia', tags: ['dia'] },
];

const REGION_TYPE_TAGS: Record<string, string[]> = {
    city: ['cidade', 'social'],
    world: ['cidade'],
    dungeon: ['masmorra', 'subterraneo', 'perigo'],
    wild: ['floresta', 'natureza'],
    instance: [],
};

const COMBAT_KEYWORDS = ['combate', 'batalha', 'guerra', 'cerco', 'escaramu', 'skirmish', 'ataque', 'invasao', 'siege'];

type AmbientContext = {
    isCombatActive?: boolean;
    currentAmbientId?: string;
};

const deriveAmbientSoundFromWorld = (
    worldState?: { [key: string]: any } | null,
    context: AmbientContext = {}
): string => {
    if (!worldState) return 'none';

    const overrideCandidates = [
        worldState.ambientSoundId,
        worldState.ambientTrack,
        worldState.musicTrack,
        worldState.music?.id,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    for (const candidate of overrideCandidates) {
        if (soundLibrary.has(candidate)) {
            return candidate;
        }
    }

    const tokens = new Set<string>();
    const pushTokens = (value?: string | string[]) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(pushTokens);
            return;
        }
        tokenize(value).forEach(token => tokens.add(token));
    };

    [
        'currentRegion',
        'regionSlug',
        'regionType',
        'poiSlug',
        'poiName',
        'location',
        'biome',
        'terrain',
        'environment',
        'zone',
        'storyArc',
        'keywords',
        'weather',
        'timeOfDay',
    ].forEach(key => pushTokens(worldState[key]));

    pushTokens(worldState.ongoingEvents);
    pushTokens(worldState.environmentTags);
    pushTokens(worldState.tags);

    const derivedTags = new Set<string>();
    tokens.forEach(token => {
        derivedTags.add(token);
        KEYWORD_ENTRIES.forEach(([keyword, mappedTags]) => {
            if (token.includes(keyword)) {
                mappedTags.forEach(tag => derivedTags.add(tag));
            }
        });
    });

    const regionType = normalizeText(worldState.regionType ?? '');
    if (regionType && REGION_TYPE_TAGS[regionType]) {
        REGION_TYPE_TAGS[regionType].forEach(tag => derivedTags.add(tag));
    }

    const normalizedWeather = normalizeText(worldState.weather ?? '');
    WEATHER_TAG_RULES.forEach(rule => {
        if (rule.tags && normalizedWeather.includes(rule.match)) {
            rule.tags.forEach(tag => derivedTags.add(tag));
        }
    });

    const normalizedTime = normalizeText(worldState.timeOfDay ?? '');
    TIME_TAG_RULES.forEach(rule => {
        if (normalizedTime.includes(rule.match)) {
            rule.tags.forEach(tag => derivedTags.add(tag));
        }
    });

    const hasCombatKeyword = Array.from(tokens).some(token =>
        COMBAT_KEYWORDS.some(keyword => token.includes(keyword))
    );
    const normalizedAlert = normalizeText(worldState.alertLevel ?? worldState.dangerLevel ?? '');
    const isCombatContext = context.isCombatActive || hasCombatKeyword || normalizedAlert.includes('combate');
    if (isCombatContext) {
        ['combate', 'batalha', 'epico'].forEach(tag => derivedTags.add(tag));
    }

    const scoreSound = (soundId: string): number => {
        const tags = soundTagCache.get(soundId) ?? [];
        let score = 0;
        tags.forEach(tag => {
            if (derivedTags.has(tag)) {
                score += 3;
            }
        });
        if (isCombatContext) {
            if (tags.includes('combate') || tags.includes('batalha')) {
                score += 5;
            } else if (tags.includes('epico')) {
                score += 2;
            } else {
                score -= 3;
            }
        } else if (tags.includes('combate') || tags.includes('batalha')) {
            score -= 2;
        } else if (tags.includes('calmo')) {
            score += 0.5;
        }
        if (context.currentAmbientId && soundId === context.currentAmbientId) {
            score += 0.25;
        }
        return score;
    };

    let bestSoundId = 'none';
    let bestScore = 0;
    ambientSounds.forEach(sound => {
        if (!sound.url) return;
        const score = scoreSound(sound.id);
        if (score > bestScore) {
            bestScore = score;
            bestSoundId = sound.id;
        }
    });

    if (bestScore > 0) {
        return bestSoundId;
    }

    const fallback = isCombatContext ? 'monster_attack' : 'windswept_plains';
    if (soundLibrary.has(fallback)) {
        return fallback;
    }
    return 'none';
};

export const useNewGameState = () => {
    const { user, revalidateUserSession } = useAuth();
    const { apiKey, model, useAiHomebrew } = useSettingsContext();
    const { toast } = useToast();
    const [character, setCharacter] = useState<Character | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');
    const [progressionFeed, setProgressionFeed] = useState<ProgressionFeedItem[]>([]);
    const actionOptionsBackupRef = useRef<(string | { text: string; action: string; skill?: string })[] | null>(null);
    const clientStateVersionRef = useRef(0);
    const lastLogVersionRef = useRef(0);
    const [actionPhaseLabel, setActionPhaseLabel] = useState<string | null>(null);
    const actionPhaseActionIdRef = useRef<string | null>(null);
    const [clientInstanceId] = useState(() => `web-${Math.random().toString(36).slice(2, 10)}`);
    const actionCursorRef = useRef(0);
    const pendingActionsRef = useRef<Set<string>>(new Set());
    const actionTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const processPlayerActionRef = useRef<(action: string, sessionIdOverride?: number, modelOverride?: string) => Promise<void>>();
    
    const [reinstallModal, setReinstallModal] = useState<{ open: boolean; deps: HomebrewContent[]; onConfirm: () => void }>({ open: false, deps: [], onConfirm: () => {} });

    const logState = useGameLog();
    const interactionState = useInteractionManager();
    
    const getApiKey = useCallback(() => apiKey, [apiKey]);
    const clearApiError = useCallback(() => setApiError(null), []);

    const resetActionPipeline = useCallback((label: string | null = null) => {
        pendingActionsRef.current.clear();
        actionTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        actionTimeoutsRef.current.clear();
        setIsLoading(false);
        setActionPhaseLabel(label);
    }, []);

    const clearPendingAction = useCallback((actionId?: string) => {
        if (!actionId) return;
        pendingActionsRef.current.delete(actionId);
        const timer = actionTimeoutsRef.current.get(actionId);
        if (timer) {
            clearTimeout(timer);
            actionTimeoutsRef.current.delete(actionId);
        }
        setIsLoading(pendingActionsRef.current.size > 0);
        if (pendingActionsRef.current.size === 0 && !interactionState.playerRollRequest) {
            setActionPhaseLabel(null);
        }
    }, [interactionState.playerRollRequest]);

    const updateCharacter = useCallback((updates: Partial<Character>) => {
        setCharacter(prev => {
            if (!prev) return null;
            
            const newChar: Character = { ...prev };

            if (updates.level !== undefined) {
                newChar.level = updates.level;
                newChar.proficiencyBonus = characterUtils.getProficiencyBonus(updates.level);
            }
            if (updates.attributes) {
                newChar.attributes = { ...prev.attributes, ...updates.attributes };
            }
            if (updates.hp) {
                newChar.hp = { ...prev.hp, ...updates.hp };
            }
            if ('xp' in updates && updates.xp !== undefined) {
                newChar.xp = updates.xp;
            }
            if (updates.inventory) {
                const mergedInventory = mergeInventoryItems(prev.inventory, updates.inventory as InventoryItem[]);
                newChar.inventory = mergedInventory;
                newChar.currency = characterUtils.calculateCurrency(mergedInventory);
                newChar.currentWeight = characterUtils.calculateWeight(mergedInventory);
                const strengthScore = newChar.attributes?.strength ?? prev.attributes?.strength ?? 10;
                newChar.carryingCapacity = characterUtils.calculateCarryingCapacity(strengthScore);
            }
            if (updates.spellSlots) {
                const mergedSlots = { ...prev.spellSlots };
                Object.entries(updates.spellSlots).forEach(([key, slot]) => {
                    const prevSlot = mergedSlots[key as keyof typeof mergedSlots];
                    const max = Math.max(slot?.max ?? prevSlot?.max ?? 0, prevSlot?.max ?? 0);
                    const current = slot?.current ?? prevSlot?.current ?? max;
                    mergedSlots[key as keyof typeof mergedSlots] = {
                        max,
                        current: Math.min(Math.max(current, 0), max),
                    };
                });
                newChar.spellSlots = mergedSlots;
            }
            if (updates.spells) {
                newChar.spells = updates.spells as Character['spells'];
            }
            if (updates.classLevelsData) {
                newChar.classLevelsData = updates.classLevelsData;
            }
            if (updates.subclassLevelsData) {
                newChar.subclassLevelsData = updates.subclassLevelsData;
            }
            if (updates.traits) {
                newChar.traits = updates.traits as Character['traits'];
            }
            if (updates.languages) {
                newChar.languages = updates.languages;
            }
            if (updates.personalityTraits) {
                newChar.personalityTraits = updates.personalityTraits;
            }
            if (updates.feats) {
                newChar.feats = updates.feats;
            }
            if (updates.journal) {
                newChar.journal = updates.journal;
            }
            if (updates.relationships) {
                const prevRelationships = prev.relationships || [];
                const relMap = new Map<string, typeof prevRelationships[number]>();
                prevRelationships.forEach(rel => {
                    const key = rel.npcId || rel.name;
                    if (key) relMap.set(key, rel);
                });
                newChar.relationships = updates.relationships.map(rel => {
                    const key = rel.npcId || rel.name;
                    const existing = key ? relMap.get(key) : null;
                    if (!existing) return rel;
                    return {
                        ...existing,
                        ...rel,
                        quests: Array.isArray(rel.quests) ? rel.quests : existing.quests || [],
                        status: rel.status || existing.status,
                    };
                });
            }
            if (updates.worldState) {
                const prevWorld = prev.worldState || {};
                const nextWorld = { ...prevWorld, ...updates.worldState };
                newChar.worldState = {
                    ...nextWorld,
                    timeOfDay: updates.worldState.timeOfDay || prevWorld.timeOfDay || 'Manhã',
                    weather: updates.worldState.weather || prevWorld.weather || 'Ensolarado',
                    location: updates.worldState.location || prevWorld.location,
                    currentRegion: updates.worldState.currentRegion || prevWorld.currentRegion || 'Desconhecida',
                };
            }
            if (updates.currentRegion) {
                newChar.currentRegion = updates.currentRegion;
            }
            if ('storySoFar' in updates) {
                newChar.storySoFar = updates.storySoFar;
            }
            if (updates.factionReputation) {
                newChar.factionReputation = { ...(prev.factionReputation || {}), ...updates.factionReputation };
            }
            if (updates.ac) {
                newChar.ac = { ...prev.ac, ...updates.ac };
            }
            if (updates.deathSaves) {
                newChar.deathSaves = { ...prev.deathSaves, ...updates.deathSaves };
            }
            if (updates.conditions) {
                newChar.conditions = updates.conditions as any;
            }
            if (updates.hitDice) {
                newChar.hitDice = { ...prev.hitDice, ...updates.hitDice };
            }
            if (updates.currency) {
                newChar.currency = { ...(prev.currency || {}), ...updates.currency };
            }

            const attributesForCalc = newChar.attributes || prev.attributes;
            const inventoryForCalc = Array.isArray(newChar.inventory) ? newChar.inventory : [];
            const modifiers = attributesForCalc ? characterUtils.calculateModifiers(attributesForCalc) : prev.modifiers;
            const ac = updates.ac
                ? { ...prev.ac, ...updates.ac }
                : characterUtils.calculateAC(inventoryForCalc, modifiers);
            const currentWeight = characterUtils.calculateWeight(inventoryForCalc);
            const carryingCapacity = attributesForCalc ? characterUtils.calculateCarryingCapacity(attributesForCalc.strength) : prev.carryingCapacity;
            const currency = updates.currency
                ? { ...(prev.currency || {}), ...updates.currency }
                : characterUtils.calculateCurrency(inventoryForCalc);
            const xpToNextLevel = characterUtils.getXpThreshold(newChar.level);
            newChar.currency = currency;
            newChar.carryingCapacity = carryingCapacity;
            newChar.ac = ac;
            newChar.currentWeight = currentWeight;
            newChar.modifiers = modifiers;
            newChar.xpToNextLevel = xpToNextLevel;
            
            return {
                ...newChar,
                modifiers,
                ac,
                currentWeight,
                carryingCapacity,
                currency,
                xpToNextLevel,
            };
        });
    }, []);

    const clearGameState = useCallback(() => {
        setCharacter(null);
        logState.clearLog();
        interactionState.clearAllInteractions();
        setSessionId(null);
        setApiError(null);
        setProgressionFeed([]);
        resetActionPipeline(null);
        closeWebSocket();
    }, [logState, interactionState, resetActionPipeline]);


    const handleApiResponse = useCallback((response: GameMasterResponse, isRestoring: boolean = false) => {
        const responseStateVersion = typeof response.stateVersion === 'number' ? response.stateVersion : undefined;
        const versionForLogs = responseStateVersion ?? clientStateVersionRef.current ?? null;
        if (!isRestoring && response.logEntries && (!versionForLogs || versionForLogs > lastLogVersionRef.current)) {
            if (typeof versionForLogs === 'number') {
                lastLogVersionRef.current = versionForLogs;
            }
            const newLogEntries = response.logEntries.map((entry: any) => ({
                ...entry,
                id: uuidv4(),
                stateVersion: versionForLogs ?? undefined,
            }));
            logState.addLogEntries(newLogEntries);
        }

        if (response.updatedCharacter) {
             updateCharacter(response.updatedCharacter);
        }
        
        if (response.worldState) {
            updateCharacter({ worldState: response.worldState });
        } else if (character?.worldState) {
            updateCharacter({ worldState: character.worldState });
        }
        
        if(response.playerRollRequest && Object.keys(response.playerRollRequest).length > 0) {
            interactionState.setRequest({ type: 'roll', request: response.playerRollRequest });
            if (response.actionOptions !== undefined) {
                interactionState.setActionOptions(response.actionOptions);
                actionOptionsBackupRef.current = null;
            }
            return;
        }

        if (response.actionOptions !== undefined) {
            interactionState.setActionOptions(response.actionOptions);
            actionOptionsBackupRef.current = null;
        }
        
        if (response.combatState) interactionState.setCombatState(response.combatState);
        
        if (response.levelUpState) interactionState.setRequest({ type: 'levelUp', request: response.levelUpState });
        if (response.shopState) interactionState.setRequest({ type: 'shop', request: response.shopState });
        if (response.lootOffer) interactionState.setRequest({ type: 'loot', request: response.lootOffer });
        if (response.useHitDiceRequest) interactionState.setRequest({ type: 'hitDice', request: response.useHitDiceRequest });
        
        const nextWorldState = response.worldState ?? character?.worldState ?? null;
        const derivedAmbient = deriveAmbientSoundFromWorld(nextWorldState, {
            isCombatActive: response.combatState?.isActive ?? interactionState.combatState?.isActive ?? false,
            currentAmbientId: ambientSound,
        });
        if (derivedAmbient !== ambientSound) {
            setAmbientSound(derivedAmbient);
        }

        if (Array.isArray(response.progressionFeed) && response.progressionFeed.length) {
            const enrichedEvents: ProgressionFeedItem[] = response.progressionFeed.map(event => ({
                ...event,
                id: uuidv4(),
                timestamp: new Date().toISOString(),
            }));

            setProgressionFeed(prev => {
                const merged = [...prev, ...enrichedEvents];
                return merged.slice(-10);
            });

            if (!isRestoring) {
                enrichedEvents.forEach(event => {
                    if (event.type === 'level_up') {
                        toast({
                            title: event.summary,
                            description: event.detail || 'Você avançou para um novo patamar de poder.',
                        });
                    } else if (event.type === 'xp_gain') {
                        const detailParts = [event.source, event.detail].filter(Boolean);
                        toast({
                            title: event.summary,
                            description: detailParts.length ? detailParts.join(' • ') : undefined,
                        });
                    }
                });
            }
        }

    }, [logState, updateCharacter, interactionState, toast, setProgressionFeed, character, ambientSound]);

    const startGame = useCallback(async (newSessionId?: number): Promise<void> => {
        const targetSessionId = newSessionId ?? sessionId;
        if (!targetSessionId || isLoading) return;
        if (!processPlayerActionRef.current) return;
        await processPlayerActionRef.current("A aventura começa. Onde eu estou e o que está acontecendo?", targetSessionId);
    }, [sessionId, isLoading]);

    const loadGameSession = useCallback(async (id: number): Promise<{ character: Character, logs: any[] } | null> => {
        setIsLoading(true);
        setApiError(null);
        try {
            initializeWebSocket(); // Inicia a conexão WebSocket
            const sessionDetails: SessaoIA = await GameService.getSessionDetails(id);
            const userInstalledIds = new Set(user?.installedHomebrewIds || []);
            const sessionRequiredIds = sessionDetails.homebrewContentIds || [];
            
            const missingIds = sessionRequiredIds.filter(id => !userInstalledIds.has(id));

            const loadSessionContent = async () => {
                if (sessionDetails) {
                    const characterId = sessionDetails.character?.id ?? sessionDetails.characterId;
                    let backendCharacterPayload: Character | null = null;
                    const inventorySnapshot = Array.isArray(sessionDetails.character?.inventory)
                        ? sessionDetails.character?.inventory
                        : null;

                    if (characterId) {
                        try {
                            backendCharacterPayload = await GameService.getCharacterById(characterId);
                        } catch (err) {
                            console.warn(`[loadGameSession] Falha ao buscar personagem ${characterId} diretamente:`, err);
                            backendCharacterPayload = sessionDetails.character as any;
                        }
                    } else if (sessionDetails.character) {
                        backendCharacterPayload = sessionDetails.character as any;
                    }

                    if (!backendCharacterPayload) {
                        setApiError('Não foi possível carregar os dados do personagem desta sessão.');
                        return null;
                    }

                    const fullCharacter = await characterUtils.buildFrontendCharacter(backendCharacterPayload as any);
                    if ((!fullCharacter.inventory || fullCharacter.inventory.length === 0) && inventorySnapshot?.length) {
                        fullCharacter.inventory = inventorySnapshot as InventoryItem[];
                    }
                    const baseStateVersion = sessionDetails.stateVersion ?? 0;
                    const displayLogs = (sessionDetails.logs || [])
                        .filter(log => !['state', 'gm_raw', 'gm_validation'].includes(log.type))
                        .map(log => {
                            let parsedContent: any = log.response;
                            if (typeof log.response === 'string') {
                                try {
                                    parsedContent = JSON.parse(log.response);
                                } catch {
                                    parsedContent = log.response;
                                }
                            }
                            const audioUrl =
                                parsedContent && typeof parsedContent === 'object' && 'audioUrl' in parsedContent
                                    ? (parsedContent as any).audioUrl
                                    : undefined;
                            return {
                                id: log.id?.toString() || uuidv4(),
                                type: log.type as LogEntry['type'],
                                content: parsedContent,
                                rollResult: log.rollResult,
                                audioUrl,
                                stateVersion: log.stateVersion ?? baseStateVersion,
                            };
                        });
                    const previousStateVersion = lastLogVersionRef.current ?? 0;
                    setCharacter(fullCharacter);
                    logState.setLog(prev => {
                        if (!prev.length || sessionId !== id) {
                            return displayLogs;
                        }
                        const incrementalEntries = displayLogs.filter(entry => {
                            if (typeof entry.stateVersion !== 'number') return false;
                            return entry.stateVersion > previousStateVersion;
                        });
                        if (!incrementalEntries.length) {
                            return prev;
                        }
                        return [...prev, ...incrementalEntries];
                    });
                    setSessionId(id);
                    clientStateVersionRef.current = sessionDetails.stateVersion ?? clientStateVersionRef.current;
                    lastLogVersionRef.current = sessionDetails.stateVersion ?? previousStateVersion;

                    const lastStateLog = [...(sessionDetails.logs || [])].reverse().find(l => l.type === 'state');
                    if (lastStateLog?.response) {
                        try {
                            const parsedState = JSON.parse(lastStateLog.response);
                            handleApiResponse(parsedState, true);
                        } catch(e) {
                            await startGame(id);
                        }
                    } else if (displayLogs.length === 0) {
                        await startGame(id);
                    }
                    return { character: fullCharacter, logs: displayLogs };
                }
                return null;
            };

            if (missingIds.length > 0) {
                const deps = await Promise.all(missingIds.map(id => HomebrewService.getHomebrewDetails(id)));
                setReinstallModal({
                    open: true,
                    deps: deps.filter((d): d is HomebrewContent => !!d),
                    onConfirm: async () => {
                        try {
                            setIsLoading(true);
                            for (const depId of missingIds) {
                                await GameService.updateSessionHomebrew(id, depId, 'install');
                            }
                            toast({ title: 'Dependências restauradas!', description: 'O conteúdo necessário para a sessão foi instalado.'});
                            setReinstallModal({ open: false, deps: [], onConfirm: () => {} });
                            await loadSessionContent();
                        } catch (err: any) {
                            setApiError(`Falha ao reinstalar dependências: ${err.message}`);
                        } finally {
                            setIsLoading(false);
                        }
                    },
                });
                return null; // Don't proceed with loading yet
            } else {
                return await loadSessionContent();
            }
        } catch (err: any) {
            const httpError = err as any;
            console.error("[loadGameSession] Erro ao carregar sessão:", err);
            setApiError(httpError.message || "Erro ao carregar sessão.");
            // Fecha o socket apenas em erro de autenticação real
            if (httpError?.response?.status === 401) {
              console.warn("[loadGameSession] Sessão expirada — limpando estado e desconectando.");
              clearGameState();
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [user, handleApiResponse, startGame, logState, toast, clearGameState, sessionId]);

    // WebSocket event handlers
    useEffect(() => {
        const handleGameStateUpdate = (payload: GameMasterResponse & { stateVersion?: number }) => {
            if (typeof payload?.stateVersion === 'number') {
                clientStateVersionRef.current = payload.stateVersion;
            }
            handleApiResponse(payload);
            if (!interactionState.playerRollRequest && pendingActionsRef.current.size === 0) {
                setActionPhaseLabel(null);
            }
        };
        const handleError = (payload: { message: string; actionId?: string | null }) => {
            setApiError(payload.message);
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            } else if (pendingActionsRef.current.size) {
                pendingActionsRef.current.forEach(id => clearPendingAction(id));
                pendingActionsRef.current.clear();
                actionTimeoutsRef.current.forEach(timer => clearTimeout(timer));
                actionTimeoutsRef.current.clear();
                setActionPhaseLabel(null);
            }
            if (actionOptionsBackupRef.current) {
                interactionState.setActionOptions(actionOptionsBackupRef.current);
                actionOptionsBackupRef.current = null;
            }
            if (sessionId) {
                void loadGameSession(sessionId);
            }
        };
        const updateLoadingState = () => setIsLoading(pendingActionsRef.current.size > 0);

        const handleStartLoading = (payload?: { actionId?: string }) => {
            if (payload?.actionId) {
                pendingActionsRef.current.add(payload.actionId);
                updateLoadingState();
            } else {
                setIsLoading(true);
            }
            setActionPhaseLabel('Validando regras...');
        };

        const handleStopLoading = (payload?: { actionId?: string }) => {
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            } else {
                pendingActionsRef.current.clear();
                actionTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
                actionTimeoutsRef.current.clear();
                setIsLoading(false);
            }
            if (pendingActionsRef.current.size === 0 && !interactionState.playerRollRequest) {
                setActionPhaseLabel(null);
            }
        };

        const handleActionAck = (payload?: { actionId?: string; receivedAt?: string }) => {
            if (payload?.actionId) {
                console.debug('[WS] actionAck', payload.actionId, payload.receivedAt);
            }
        };

        const handleActionResolution = (payload?: { actionId?: string; stateVersion?: number; status?: string; result?: GameMasterResponse; stateDelta?: Record<string, unknown> }) => {
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            }
            if (typeof payload?.stateVersion === 'number') {
                clientStateVersionRef.current = payload.stateVersion;
            }
            if (payload?.status === 'rejected' && payload.result?.systemLog) {
                toast({ variant: 'destructive', title: payload.result.systemLog });
            }
            if (payload?.stateDelta?.rest && typeof payload.stateDelta.rest === 'object') {
                const rest = payload.stateDelta.rest as { type?: string; benefits?: string[] };
                toast({
                    title: rest.type === 'long' ? 'Descanso longo validado' : 'Descanso curto validado',
                    description: rest.benefits?.join(' • '),
                });
            }
            if (payload?.status === 'needs_roll') {
                setActionPhaseLabel('Aguardando rolagem do jogador');
            } else if (payload?.status === 'accepted') {
                setActionPhaseLabel('Gerando narrativa...');
            }
            if (payload?.result) {
                handleApiResponse({ ...payload.result, stateVersion: payload.stateVersion });
            }
        };

        const handleSocketClosed = (payload?: { code?: number; reason?: string }) => {
            resetActionPipeline('Conexão perdida. Reconectando...');
            if (sessionId) {
                void loadGameSession(sessionId);
            }
            console.warn('[WS] conexão encerrada', payload);
        };

        addEventListener('gameStateUpdate', handleGameStateUpdate);
        addEventListener('error', handleError);
        addEventListener('startLoading', handleStartLoading);
        addEventListener('stopLoading', handleStopLoading);
        const handleNarrationLoading = (payload?: { actionId?: string }) => {
            if (payload?.actionId) {
                pendingActionsRef.current.add(payload.actionId);
                actionPhaseActionIdRef.current = payload.actionId;
            }
            setActionPhaseLabel('O Mestre está narrando...');
            setIsLoading(true);
        };

        const handleNarrationComplete = (payload?: { actionId?: string }) => {
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            }
            if (pendingActionsRef.current.size === 0 && !interactionState.playerRollRequest) {
                setActionPhaseLabel(null);
                setIsLoading(false);
            }
        };

        const handleActionTimeout = (payload?: { actionId?: string }) => {
            if (!payload?.actionId) return;
            pendingActionsRef.current.delete(payload.actionId);
            updateLoadingState();
            toast({ variant: 'destructive', title: 'Ação demorou demais', description: 'Recarregando a sessão para sincronizar.' });
            if (sessionId) {
                void loadGameSession(sessionId);
            }
        };
        addEventListener('timeout', handleActionTimeout);
        addEventListener('narrationLoading', handleNarrationLoading);
        addEventListener('narrationComplete', handleNarrationComplete);
        addEventListener('actionAck', handleActionAck);
        addEventListener('actionResolution', handleActionResolution);
        addEventListener('connectionClosed', handleSocketClosed);

        return () => {
            removeEventListener('gameStateUpdate', handleGameStateUpdate);
            removeEventListener('error', handleError);
            removeEventListener('startLoading', handleStartLoading);
            removeEventListener('stopLoading', handleStopLoading);
            removeEventListener('timeout', handleActionTimeout);
            removeEventListener('narrationLoading', handleNarrationLoading);
            removeEventListener('narrationComplete', handleNarrationComplete);
            removeEventListener('actionAck', handleActionAck);
            removeEventListener('actionResolution', handleActionResolution);
            removeEventListener('connectionClosed', handleSocketClosed);
        };
    }, [handleApiResponse, interactionState.playerRollRequest, interactionState, clearPendingAction, loadGameSession, sessionId, resetActionPipeline]);


    const processPlayerAction = useCallback(async (action: string, sessionIdOverride?: number, modelOverride?: string) => {
        const currentSessionId = sessionIdOverride ?? sessionId;
        
        if (currentSessionId == null || currentSessionId <= 0) {
            const warningMessage = 'Nenhuma sessão ativa. Abra ou selecione uma aventura antes de agir.';
            console.warn('[processPlayerAction] aborted: no active session.');
            setApiError(warningMessage);
            toast({ variant: 'destructive', title: warningMessage });
            return;
        }
        const finalSessionId = currentSessionId;
        
        const key = getApiKey();
        if (!key) {
             console.error("[processPlayerAction] Aborted: No API Key.");
             setApiError("Chave de API não encontrada. Por favor, configure-a nas Configurações.");
             return;
        }
        
        const isInternalAction = action.startsWith("Recarregar estado atual") || action.startsWith("A aventura começa.") || action.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades");

        if (!isInternalAction && finalSessionId !== -1) {
            logState.addLogEntry({
                id: uuidv4(),
                type: 'action',
                content: action,
                stateVersion: clientStateVersionRef.current,
            });
        }

        actionOptionsBackupRef.current = interactionState.actionOptions.slice();
        interactionState.clearTransientInteractions();
        interactionState.setActionOptions([]);
        
        const actionId = uuidv4();
        actionCursorRef.current += 1;
        actionPhaseActionIdRef.current = actionId;
        setActionPhaseLabel('Enfileirando ação...');

        const intentPayload = interactionState.pendingStructuredIntent && typeof interactionState.pendingStructuredIntent === 'object'
            ? interactionState.pendingStructuredIntent
            : undefined;

        sendMessage('processAction', {
            contractVersion: 1,
            sessionId: finalSessionId,
            prompt: action,
            apiKey: key,
            combatState: interactionState.combatState,
            useAiHomebrew,
            model: modelOverride || model,
            intent: intentPayload,
            actionId,
            clientStateVersion: clientStateVersionRef.current,
            clientInstanceId,
            actionCursor: actionCursorRef.current,
        });
        interactionState.setPendingStructuredIntent(null);
        pendingActionsRef.current.add(actionId);
        setIsLoading(true);
        const safetyTimeout = setTimeout(() => {
            actionTimeoutsRef.current.delete(actionId);
            if (pendingActionsRef.current.delete(actionId)) {
                setIsLoading(pendingActionsRef.current.size > 0);
                setActionPhaseLabel('Sem resposta do motor');
                toast({
                    variant: 'destructive',
                    title: 'Ação não confirmada',
                    description: 'O Mestre demorou mais que o esperado. Recarregando a sessão para sincronizar.',
                });
                void loadGameSession(finalSessionId);
            }
        }, CLIENT_ACTION_TIMEOUT_MS);
        actionTimeoutsRef.current.set(actionId, safetyTimeout);
        
    }, [sessionId, interactionState.combatState, getApiKey, logState, interactionState, model, character, useAiHomebrew, toast, loadGameSession]);

    useEffect(() => {
        processPlayerActionRef.current = processPlayerAction;
    }, [processPlayerAction]);

    const submitRollResult = useCallback((request: PlayerRollRequest, result: { rawRoll: number; rolls: number[] }) => {
        if (!sessionId) {
            setApiError('Nenhuma sessão ativa para enviar o resultado da rolagem.');
            return;
        }
        if (!request.requestId) {
            setApiError('Esta rolagem não possui um identificador válido.');
            return;
        }
        const key = getApiKey();
        if (!key) {
            setApiError('Chave de API não encontrada. Configure-a nas Configurações.');
            return;
        }
        sendMessage('submitRollResult', {
            sessionId,
            requestId: request.requestId,
            rolls: result.rolls,
            rawRoll: result.rawRoll,
            apiKey: key,
            combatState: interactionState.combatState,
            useAiHomebrew,
            clientStateVersion: clientStateVersionRef.current,
        });
    }, [sessionId, getApiKey, interactionState.combatState, useAiHomebrew, setApiError]);

    useEffect(() => {
        if (interactionState.playerRollRequest) {
            setActionPhaseLabel('Aguardando sua rolagem...');
        } else if (pendingActionsRef.current.size === 0) {
            setActionPhaseLabel(null);
        }
    }, [interactionState.playerRollRequest]);
    

    const createCharacter = useCallback(async (info: NewCharacterInfo): Promise<Character | null> => {
        setIsLoading(true);
        setApiError(null);
        try {
            const savedCharacterResponse = await GameService.createNewCharacter(info);
            if(savedCharacterResponse.character) {
                return savedCharacterResponse.character;
            }
            return null;
        } catch (error: any) {
            setApiError(error.message || 'Falha ao criar o personagem no servidor.');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteCharacter = useCallback(async (characterId: number): Promise<boolean> => {
        setIsLoading(true);
        setApiError(null);
        try {
            await GameService.deleteCharacterById(characterId);
            return true;
        } catch (error: any) {
            setApiError(error.message || 'Falha ao deletar o personagem.');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteSession = useCallback(async (sessionIdToDelete: number): Promise<boolean> => {
        setIsLoading(true);
        setApiError(null);
        try {
            await GameService.deleteSessionById(sessionIdToDelete);
            if(sessionId === sessionIdToDelete) {
                clearGameState();
            }
            return true;
        } catch (error: any) {
            setApiError(error.message || 'Falha ao deletar a sessão.');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, clearGameState]);

    const handleApplyLevelUp = useCallback(async (selections: LevelUpSelections) => {
        if (!character || !interactionState.levelUpState || !interactionState.levelUpState.isPending) return;

        const { newLevel } = interactionState.levelUpState;
        const summaryParts: string[] = [];

        if (selections.attributes) {
            const attrChanges = Object.entries(selections.attributes)
                .filter(([, value]) => !!value)
                .map(([attr, value]) => `${translateAttribute(attr)} +${value}`);
            if (attrChanges.length) {
                summaryParts.push(`Atributos: ${attrChanges.join(', ')}`);
            }
        }

        if (selections.spells && selections.spells.length) {
            summaryParts.push(`Novas magias: ${selections.spells.join(', ')}`);
        }

        if (selections.featureChoices && selections.featureChoices.length) {
            const featSummary = selections.featureChoices
                .map(choice => choice.selections.join(', '))
                .filter(Boolean);
            if (featSummary.length) {
                summaryParts.push(`Características: ${featSummary.join('; ')}`);
            }
        }

        if (selections.subclass) {
            summaryParts.push(`Subclasse: ${selections.subclass}`);
        }

        if (selections.hpIncrease !== undefined) {
            summaryParts.push(`Aumento de PV total: +${selections.hpIncrease}`);
        }

        const actionText = [
            `Confirmo meu avanço para o nível ${newLevel}.`,
            summaryParts.length ? summaryParts.join(' | ') : ''
        ].filter(Boolean).join(' ');

        interactionState.clearRequest('levelUp');
        interactionState.setActionOptions([]);
        await processPlayerAction(actionText);
    }, [character, interactionState, processPlayerAction]);

    const handleToggleEquipped = useCallback((itemId: string) => {
        const item = character?.inventory.find(i => i.id === itemId);
        if (!item) return;

        const willEquip = !item.equipped;

        setCharacter(prev => {
            if (!prev || !Array.isArray(prev.inventory)) return prev;
            return {
                ...prev,
                inventory: prev.inventory.map(invItem =>
                    invItem.id === itemId ? { ...invItem, equipped: willEquip } : invItem
                ),
            };
        });

        const actionText = willEquip
            ? `Eu equipo meu ${item.name}.`
            : `Eu desequipo meu ${item.name}.`;
        processPlayerAction(actionText);
    }, [character, processPlayerAction, setCharacter]);

    const handleUseConsumable = useCallback((itemId: string) => {
        const item = character?.inventory.find(i => i.id === itemId);
        if (!item || !item.consumable) {
            toast({ variant: "destructive", title: "Item não consumível" });
            return;
        }
        const actionText = `Eu uso ${item.name}.`;
        processPlayerAction(actionText);
    }, [character, processPlayerAction, toast]);

    const handleSpendHitDice = useCallback((diceCount: number) => {
        if (!character || character.hitDice.current < diceCount) return;
        processPlayerAction(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
    }, [character, processPlayerAction]);

    const handleDeclineHitDiceRequest = useCallback(() => {
        interactionState.clearRequest('hitDice');
        toast({
            title: 'Sem descanso agora',
            description: 'Os Dados de Vida continuam disponíveis para a próxima pausa.',
        });
        processPlayerAction('Eu não vou gastar dados de vida agora.');
    }, [interactionState, processPlayerAction, toast]);

    const isRollPending = Boolean(interactionState.playerRollRequest);

    useEffect(() => {
        if (sessionId) {
            resetActionPipeline(null);
        }
    }, [sessionId, resetActionPipeline]);

    const memoizedValue = useMemo(() => ({
        character: character,
        log: logState.log,
        sessionId,
        ...interactionState,
        reinstallModal,
        setReinstallModal,
        isLoading,
       apiError,
       ambientSound,
        progressionFeed,
        clearApiError,
        getApiKey,
        createCharacter,
        deleteCharacter,
        deleteSession,
        startGame,
        processPlayerAction,
        clearGameState,
        loadGameSession,
        handleRollResult: interactionState.handleRollResult(submitRollResult),
        handleSkillCheckSubmit: interactionState.handleSkillCheckSubmit(processPlayerAction),
        submitSpellCast: interactionState.submitSpellCast(processPlayerAction),
        applyLevelUp: handleApplyLevelUp,
        toggleEquipped: handleToggleEquipped,
        useConsumable: handleUseConsumable,
        spendHitDice: handleSpendHitDice,
        declineHitDiceRequest: handleDeclineHitDiceRequest,
        takeLoot: interactionState.handleTakeLoot(processPlayerAction),
        buyItem: interactionState.handleBuyItem(processPlayerAction),
        sellItem: interactionState.handleSellItem(processPlayerAction),
        nextTurn: interactionState.nextTurn(processPlayerAction),
        setCharacter,
        setLog: logState.setLog,
        setSessionId,
        actionPhaseLabel,
        isRollPending,
    }), [
        character, logState, sessionId, interactionState, reinstallModal,
        isLoading, apiError, ambientSound, progressionFeed,
        clearApiError, getApiKey, createCharacter, deleteCharacter, deleteSession, 
        startGame, processPlayerAction, submitRollResult, clearGameState, loadGameSession, handleApplyLevelUp,
        handleToggleEquipped, handleUseConsumable, handleSpendHitDice, handleDeclineHitDiceRequest, setCharacter,
        actionPhaseLabel, isRollPending
    ]);

    return memoizedValue;
};
