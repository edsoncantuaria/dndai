import path from 'path';
import { pathToFileURL } from 'url';
import { promises as fs, createWriteStream } from 'fs';
import { performance } from 'node:perf_hooks';
import { env } from '../config/env.js';
import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';
import { getGameUpdate, type GameUpdateResult } from '../services/aiService.js';
import { attachResponseMetadata } from '../services/schemaIntegrityService.js';
import {
    validateActionEconomy,
    validateAttackFeasibility,
    validateRollRequestBinding,
    validateCombatClosure,
    validateLogEntriesClarity,
    validateNoShopDuringCombat,
    validateRollCorrelation,
} from '../services/validators/logic.js';
import {
    validateSchemaHash,
    validateUpdatedCharacterDelta,
    validateActionOptionsQuality,
    validateRangesAndCaps,
    enforceHomebrewPolicy,
    enforceResponseFocus,
} from '../services/validators/structural.js';

const CHARACTER_FIXTURE = path.join(process.cwd(), 'tests', 'data', 'testCharacterMirror.json');
const SESSION_MOCK_PATH = path.join(process.cwd(), 'tests', 'data', 'mockSessionFull.json');

const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
    temperature: 0.4,
    topP: 0.9,
    topK: 32,
    maxOutputTokens: Number(process.env.AI_GAMEPLAY_MAX_OUTPUT ?? 4096),
};

type SessionState = {
    character: any;
    gameLog: string;
    lastCombatState: GameMasterResponse['combatState'] | null;
    rollRequestHistory: Set<string>;
    homebrewAllowed: boolean;
    lastWorldState: Record<string, any> | null;
    context: SessionContext;
};

type TurnPlan = {
    label: string;
    playerAction: string;
    expectRollRequest?: boolean;
};

const TURN_SEQUENCE: TurnPlan[] = [
    {
        label: 'Reconhecimento inicial',
        playerAction: 'Observo o cenário e descrevo rotas disponíveis.',
    },
    {
        label: 'Exploração cautelosa',
        playerAction: 'Investigo um beco suspeito procurando pistas discretamente.',
    },
    {
        label: 'Contato social',
        playerAction: 'Converso com qualquer figura presente para obter informações.',
    },
    {
        label: 'Ameaça súbita',
        playerAction: 'Reajo a um culto hostil descrevendo minha defesa.',
        expectRollRequest: true,
    },
    {
        label: 'Recuperação / loot',
        playerAction: 'Procuro recompensas ou itens úteis após resolver o perigo.',
    },
    {
        label: 'Visita à loja',
        playerAction: 'Examino a loja itinerante e avalio itens para compra/troca.',
    },
    {
        label: 'Revisão de progresso',
        playerAction: 'Avalio minha evolução, aplico XP recente e subo de nível se apropriado.',
    },
    {
        label: 'Combate prolongado',
        playerAction: 'Continuo o combate descrevendo ações detalhadas e verificando condições.',
        expectRollRequest: true,
    },
    {
        label: 'Desafio multi-rolagem',
        playerAction: 'Realizo uma sequência de testes de Arcana e Percepção para neutralizar uma armadilha.',
        expectRollRequest: true,
    },
    {
        label: 'Persistência de local',
        playerAction: 'Retorno ao último ponto visitado e confirmo se o mundo lembra meu trajeto e os POIs explorados.',
    },
    {
        label: 'Registro de NPCs e quests',
        playerAction: 'Reviso aliados, reputações e missões em aberto para garantir que tudo permanece sincronizado.',
    },
    {
        label: 'Queda e recuperação',
        playerAction: 'Simulo uma queda grave/morte temporária e descrevo minha tentativa de recuperação.',
        expectRollRequest: true,
    },
    {
        label: 'Resumo final controlado',
        playerAction: 'Solicito um balanço final de XP, loot, quests e localização antes de encerrar a sessão.',
    },
];

const DEFAULT_WORLD_STATE = {
    timeOfDay: 'Manhã',
    weather: 'Estável',
    currentRegion: 'Posto de Vigia',
    regionSlug: 'posto-de-vigia',
    poiSlug: 'patio-central',
    poiName: 'Pátio Central',
    visitedRegions: ['posto-de-vigia'],
    visitedPois: [{ regionSlug: 'posto-de-vigia', poiSlug: 'patio-central', name: 'Pátio Central' }],
};

const ACTION_OPTION_FALLBACKS: Array<string | { text: string; action: string; skill?: string }> = [
    { text: 'Observar o entorno em busca de pistas', action: 'observe_surroundings', skill: 'Percepção' },
    { text: 'Conversar com figuras próximas para obter contexto', action: 'talk_to_npc', skill: 'Persuasão' },
    { text: 'Investigar um ponto suspeito com cautela', action: 'investigate_poi', skill: 'Investigação' },
    { text: 'Preparar defesa ou tática de resposta', action: 'prepare_defense' },
    { text: 'Vasculhar o local por recursos ou loot', action: 'search_for_loot' },
];

const PHASE_DEBUG_DIR = path.join(process.cwd(), 'logs', 'phase-debug');
const slugifyLabel = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'turno';

const persistPhaseArtifact = async (
    mode: 'synthetic' | 'live',
    turnLabel: string,
    phase: 'narrative' | 'state' | 'combined',
    payload: unknown
): Promise<string | null> => {
    try {
        await fs.mkdir(PHASE_DEBUG_DIR, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(
            PHASE_DEBUG_DIR,
            `${timestamp}-${mode}-${slugifyLabel(turnLabel)}-${phase}.json`
        );
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
        return filePath;
    } catch (error) {
        console.warn('[phase-debug] Falha ao escrever snapshot de teste:', error);
        return null;
    }
};

const loadCharacterFixture = async (): Promise<any> => {
    const raw = await fs.readFile(CHARACTER_FIXTURE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed?.character) {
        throw new Error('Fixture inválida: testCharacterMirror.json não contém o campo "character".');
    }
    return parsed.character;
};

type SessionMockSnapshot = {
    character: any;
    combatState?: GameMasterResponse['combatState'] | null;
    shopState?: GameMasterResponse['shopState'] | null;
    gameLog?: string;
    timelineFacts?: string;
    storySummary?: string;
    homebrewSummary?: string;
    regionGraphSummary?: string;
    memories?: Array<{ label: string; summary: string; references?: string[] }>;
};

const loadSessionMockSnapshot = async (): Promise<SessionMockSnapshot> => {
    try {
        const raw = await fs.readFile(SESSION_MOCK_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed?.character) {
            throw new Error('mockSessionFull.json não contém o campo "character".');
        }
        return parsed;
    } catch (error) {
        console.warn('[structured-output:full] Mock completo ausente ou inválido; usando testCharacterMirror.json como fallback.');
        const character = await loadCharacterFixture();
        return { character };
    }
};

const persistSessionMockSnapshot = async (snapshot: SessionMockSnapshot) => {
    try {
        await fs.writeFile(SESSION_MOCK_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (error) {
        console.warn('[structured-output:full] Não foi possível salvar mock de sessão:', error);
    }
};

const appendToGameLog = (currentLog: string, response: GameMasterResponse): string => {
    const entries = response.logEntries ?? [];
    const serialized = entries
        .map(entry => `${entry.type?.toUpperCase() ?? 'SYSTEM'}:${entry.content}`)
        .join('\n');
    const combined = `${currentLog}\n${serialized}`.trim();
    const maxChars = 4000;
    return combined.length > maxChars ? combined.slice(combined.length - maxChars) : combined;
};

type SessionContext = {
    storySummary?: string;
    timelineFacts?: string;
    homebrewSummary?: string;
    regionGraphSummary?: string;
};

const buildInput = (
    state: SessionState,
    action: string,
    suppressRoll: boolean,
    scenarioLabel: string,
    context: SessionContext
): GameMasterFlowInput => ({
    character: state.character,
    playerAction: action,
    gameLog: state.gameLog || 'SEM_EVENTOS',
    useAiHomebrew: true,
    enableNarrativeRevalidation: true,
    mode: 'gameplay',
    suppressRollRequest: suppressRoll,
    scenarioLabel,
    storySummary: context.storySummary,
    timelineFacts: context.timelineFacts,
    homebrewSummary: context.homebrewSummary,
    regionSlug: state.character?.worldState?.regionSlug,
    regionGraphSummary: context.regionGraphSummary,
});

const cloneState = <T>(value: T): T =>
    typeof globalThis.structuredClone === 'function'
        ? globalThis.structuredClone(value)
        : JSON.parse(JSON.stringify(value));

const mergeWorldState = (current: any, incoming: any) => {
    if (!incoming) return current;
    if (!current) return { ...incoming };
    return { ...current, ...incoming };
};

const mergeGameClock = (current: any, incoming: any) => {
    if (!incoming) return current;
    return { ...(current || {}), ...incoming };
};

const ensureWorldStateContinuity = (state: SessionState, fallback?: Record<string, any> | null) => {
    if (!state.character) return;
    const previous = fallback ?? state.lastWorldState ?? null;
    const next = state.character.worldState ?? {};
    if (!previous) {
        state.character.worldState = next;
        applyWorldStateDefaults(state.character.worldState);
        state.lastWorldState = next;
        return;
    }
    const merged: Record<string, any> = { ...(previous || {}) };
    if (next && typeof next === 'object') {
        Object.entries(next).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            merged[key] = value;
        });
    }
    const keysToPreserve = ['timeOfDay', 'weather', 'currentRegion', 'regionSlug', 'poiSlug', 'poiName'];
    keysToPreserve.forEach(key => {
        if ((merged[key] === undefined || merged[key] === null || merged[key] === '') && previous && previous[key] !== undefined) {
            merged[key] = previous[key];
        }
    });
    if (!Array.isArray(merged.visitedRegions) && Array.isArray(previous.visitedRegions)) {
        merged.visitedRegions = previous.visitedRegions.slice();
    }
    if (!Array.isArray(merged.visitedPois) && Array.isArray(previous.visitedPois)) {
        merged.visitedPois = previous.visitedPois.map((poi: any) => ({ ...poi }));
    }
    if (!Array.isArray(merged.npcLocations) && Array.isArray(previous.npcLocations)) {
        merged.npcLocations = previous.npcLocations.map((npc: any) => ({ ...npc }));
    }
    applyWorldStateDefaults(merged);
    state.character.worldState = merged;
    state.lastWorldState = merged;
};

const normalizeWorldStatePlacement = (response: GameMasterResponse, fallback?: Record<string, any> | null) => {
    if (!response) return;
    if (response.updatedCharacter?.worldState) {
        response.worldState = mergeWorldState(response.worldState ?? fallback ?? null, response.updatedCharacter.worldState);
        delete response.updatedCharacter.worldState;
    } else if (!response.worldState && fallback) {
        response.worldState = fallback;
    }
    applyWorldStateDefaults(response.worldState);
};

const applyWorldStateDefaults = (world?: Record<string, any> | null) => {
    if (!world) return;
    Object.entries(DEFAULT_WORLD_STATE).forEach(([key, value]) => {
        if (world[key] === undefined || world[key] === null || world[key] === '') {
            world[key] = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : value;
        }
    });
    if (!Array.isArray(world.visitedRegions)) {
        world.visitedRegions = DEFAULT_WORLD_STATE.visitedRegions.slice();
    }
    if (!Array.isArray(world.visitedPois)) {
        world.visitedPois = DEFAULT_WORLD_STATE.visitedPois.map(poi => ({ ...poi }));
    }
    const ensureVisitedRegion = (regionSlug?: string | null) => {
        if (!regionSlug) return;
        if (!world.visitedRegions.some((slug: string) => slug === regionSlug)) {
            world.visitedRegions.push(regionSlug);
        }
    };
    ensureVisitedRegion(world.regionSlug);
    const ensureVisitedPoi = () => {
        const poiSlug = world.poiSlug;
        if (!poiSlug) return;
        const regionSlug = world.regionSlug || DEFAULT_WORLD_STATE.regionSlug;
        const exists = world.visitedPois.some((poi: any) => poi?.poiSlug === poiSlug && poi?.regionSlug === regionSlug);
        if (!exists) {
            world.visitedPois.push({
                regionSlug,
                poiSlug,
                name: world.poiName || DEFAULT_WORLD_STATE.poiName,
            });
        }
    };
    ensureVisitedPoi();
};

const ensureActionOptionsVariety = (
    options?: GameMasterResponse['actionOptions']
): GameMasterResponse['actionOptions'] => {
    const sanitized: GameMasterResponse['actionOptions'] = [];
    const seen = new Set<string>();
    const pushOption = (option: string | { text: string; action: string; skill?: string }) => {
        if (!option) return;
        const label = typeof option === 'string' ? option : option.text;
        if (!label) return;
        const normalized = label.trim().toLowerCase();
        if (seen.has(normalized)) return;
        seen.add(normalized);
        sanitized.push(option);
    };
    (options ?? []).forEach(pushOption);
    for (const fallback of ACTION_OPTION_FALLBACKS) {
        if (sanitized.length >= 3) break;
        pushOption(fallback);
    }
    while (sanitized.length < 3) {
        const id = sanitized.length + 1;
        pushOption({ text: `Explorar alternativa ${id}`, action: `fallback_${id}` });
    }
    return sanitized;
};

const enforceResponseGuards = (
    response: GameMasterResponse,
    options: { allowRollRequest: boolean }
): { rollRequestSanitized: boolean } => {
    response.actionOptions = ensureActionOptionsVariety(response.actionOptions);
    if (!options.allowRollRequest && response.playerRollRequest) {
        delete response.playerRollRequest;
        return { rollRequestSanitized: true };
    }
    return { rollRequestSanitized: false };
};

const dropEmptyCollections = (response: GameMasterResponse, keys: (keyof GameMasterResponse)[]) => {
    keys.forEach(key => {
        const value = (response as any)[key];
        if (Array.isArray(value) && value.length === 0) {
            delete (response as any)[key];
        }
    });
};

const pruneNarrativePhaseResponse = (
    response: GameMasterResponse | undefined,
    options: { allowRollRequest: boolean }
) => {
    if (!response) return;
    const stateOnlyFields: (keyof GameMasterResponse)[] = [
        'updatedCharacter',
        'worldState',
        'combatState',
        'levelUpState',
        'shopState',
        'lootOffer',
        'useHitDiceRequest',
        'xpEvents',
        'progressionFeed',
        'newHomebrewContent',
        'gameClock',
        'memoryContext',
    ];
    stateOnlyFields.forEach(field => {
        if (field in response) {
            delete (response as any)[field];
        }
    });
    if (!options.allowRollRequest && response.playerRollRequest) {
        delete response.playerRollRequest;
    }
};

const pruneStatePhaseResponse = (response: GameMasterResponse | undefined) => {
    if (!response) return;
    if (response.updatedCharacter && Object.keys(response.updatedCharacter).length === 0) {
        delete response.updatedCharacter;
    }
    dropEmptyCollections(response, ['xpEvents', 'progressionFeed', 'newHomebrewContent']);
    if (response.logEntries && response.logEntries.length > 0) {
        response.logEntries = [];
    }
    if (response.actionOptions && response.actionOptions.length > 0) {
        response.actionOptions = [];
    }
};

const hydrateSnapshotWorldState = (snapshot: any, fallback?: Record<string, any> | null) => {
    if (!snapshot) return snapshot;
    const source = snapshot.worldState;
    if (!source && fallback) {
        snapshot.worldState = JSON.parse(JSON.stringify(fallback));
        applyWorldStateDefaults(snapshot.worldState);
        return snapshot;
    }
    if (!fallback) return snapshot;
    snapshot.worldState = mergeWorldState(fallback, source);
    applyWorldStateDefaults(snapshot.worldState);
    return snapshot;
};

const applyCharacterUpdate = (state: SessionState, response: GameMasterResponse) => {
    const previousWorldState = state.character?.worldState ?? state.lastWorldState ?? null;

    if (response.updatedCharacter && Object.keys(response.updatedCharacter).length) {
        const nextWorldState = mergeWorldState(
            state.character.worldState,
            response.updatedCharacter.worldState ?? response.worldState
        );
        state.character = {
            ...state.character,
            ...response.updatedCharacter,
            worldState: nextWorldState,
            inventory: response.updatedCharacter.inventory ?? state.character.inventory,
            shopState: response.updatedCharacter.shopState ?? response.shopState ?? state.character.shopState,
            gameClock: mergeGameClock(state.character.gameClock, response.updatedCharacter.gameClock),
        };
    }
    if (response.worldState) {
        state.character.worldState = mergeWorldState(state.character.worldState, response.worldState);
    }
    if (response.gameClock) {
        state.character.gameClock = mergeGameClock(state.character.gameClock, response.gameClock);
    }
    ensureWorldStateContinuity(state, previousWorldState);
};

const mergePhaseResponses = (
    narrative: GameMasterResponse | undefined,
    state: GameMasterResponse
): GameMasterResponse => {
    const logEntries = narrative?.logEntries ?? state.logEntries ?? [];
    const actionOptions = ensureActionOptionsVariety(narrative?.actionOptions ?? state.actionOptions ?? []);
    const mergedSystemLog = [state.systemLog, narrative?.systemLog]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join('\n');
    return {
        ...state,
        logEntries,
        actionOptions,
        systemLog: mergedSystemLog || state.systemLog,
    };
};

const CRITICAL_WARNINGS = new Set(['zod_validation_failure', 'structured_output_disabled', 'fail-soft', 'fallback']);
const SANITIZER_NOTE_PATTERNS = [
    /logentries descartados/i,
    /actionoptions descartados/i,
    /worldstate idêntico ao anterior removido/i,
    /updatedcharacter sem alterações foi omitido/i,
    /playerrollrequest removida/i,
];
const classifyWarnings = (warnings: string[]) => {
    const critical: string[] = [];
    const info: string[] = [];
    for (const warning of warnings) {
        (CRITICAL_WARNINGS.has(warning) ? critical : info).push(warning);
    }
    return { critical, info };
};

type TurnMetric = {
    label: string;
    narrativeMs: number;
    stateMs: number;
    warnings: string[];
    infoWarnings: string[];
    fallbackTriggered: boolean;
    rollRequestIssued: boolean;
    schemaMismatches: string[];
    assertionIssues: string[];
    stateModelUsed?: string;
    snapshotFiles?: string[];
};

const scenarioAssertionMap: Record<string, (response: GameMasterResponse, prev: any, current: any) => string[]> = {
    'Visita à loja': (response, _prev, current) =>
        response.shopState || current?.shopState ? [] : ['shop_state_missing'],
    'Revisão de progresso': (response, prev, current) => {
        const prevLevel = Number(prev?.level ?? prev?.attributes?.level ?? 0);
        const newLevel = Number(current?.level ?? current?.attributes?.level ?? prevLevel);
        if (newLevel > prevLevel) return [];
        if (response.xpEvents && response.xpEvents.length > 0) return [];
        return ['level_progress_missing'];
    },
    'Recuperação / loot': response => {
        const inventoryDelta = Array.isArray(response.updatedCharacter?.inventory)
            ? response.updatedCharacter!.inventory!.length > 0
            : false;
        return response.lootOffer || inventoryDelta ? [] : ['loot_missing'];
    },
    'Combate prolongado': response =>
        response.combatState?.isActive ? [] : ['combat_state_missing'],
    'Desafio multi-rolagem': response =>
        response.playerRollRequest ? [] : ['multi_roll_missing'],
    'Persistência de local': (_response, _prev, current) => {
        const world = current?.worldState;
        if (!world?.poiSlug) return ['poi_slug_missing'];
        if (!Array.isArray(world.visitedPois) || !world.visitedPois.some((poi: any) => poi?.poiSlug === world.poiSlug)) {
            return ['poi_persistence_missing'];
        }
        return [];
    },
    'Registro de NPCs e quests': (_response, _prev, current) => {
        const relationships = Array.isArray(current?.relationships) ? current.relationships : [];
        const journal = Array.isArray(current?.journal) ? current.journal : [];
        const npcOk = relationships.some(rel => rel?.name && rel?.status);
        const questOk = journal.some(entry => entry?.status && entry.status !== 'unexplored');
        const issues: string[] = [];
        if (!npcOk) issues.push('npc_registry_missing');
        if (!questOk) issues.push('quest_progress_missing');
        return issues;
    },
    'Queda e recuperação': response => {
        if (response.useHitDiceRequest || response.playerRollRequest) return [];
        if (response.updatedCharacter && ('hp' in response.updatedCharacter || 'conditions' in response.updatedCharacter)) {
            return [];
        }
        return ['injury_flow_missing'];
    },
    'Resumo final controlado': response => {
        if ((response.progressionFeed && response.progressionFeed.length) ||
            (response.xpEvents && response.xpEvents.length) ||
            response.lootOffer ||
            response.shopState) {
            return [];
        }
        return ['final_summary_missing'];
    },
};

const validateStateAssertions = (
    plan: TurnPlan,
    response: GameMasterResponse,
    prevCharacter: any,
    currentCharacter: any,
    options: {
        enforceScenario?: boolean;
        prevCombatState?: GameMasterResponse['combatState'] | null;
        rollRequestHistory?: Set<string>;
        homebrewAllowed?: boolean;
    } = {}
): string[] => {
    const {
        enforceScenario = true,
        prevCombatState = null,
        rollRequestHistory,
        homebrewAllowed = true,
    } = options;
    const issues: string[] = [];
    const world = currentCharacter?.worldState ?? response.worldState ?? prevCharacter?.worldState;
    if (!world?.currentRegion) {
        issues.push('world_state_missing');
    }
    if (world?.regionSlug && Array.isArray(world?.visitedRegions) && !world.visitedRegions.includes(world.regionSlug)) {
        issues.push('visited_regions_outdated');
    }
    const relationships = currentCharacter?.relationships;
    if (!Array.isArray(relationships) || relationships.some((rel: any) => !rel || (!rel.name && !rel.npcId))) {
        if (enforceScenario) {
            issues.push('npc_registry_invalid');
        }
    }
    const journal = currentCharacter?.journal;
    if (!Array.isArray(journal)) {
        if (enforceScenario) {
            issues.push('quest_log_missing');
        }
    }
    if (response.combatState?.isActive) {
        if (!Array.isArray(response.combatState.combatants) || response.combatState.combatants.length === 0) {
            issues.push('combatants_missing');
        }
    }
    if (enforceScenario) {
        const scenarioValidator = scenarioAssertionMap[plan.label];
        if (scenarioValidator) {
            issues.push(...scenarioValidator(response, prevCharacter, currentCharacter));
        }
    }
    const context: AssertionContext = {
        plan,
        response,
        prevCharacter,
        currentCharacter,
        enforceScenario,
        prevCombatState,
        rollRequestHistory,
        homebrewAllowed,
    };
    contextualValidators.forEach(validator => {
        issues.push(...validator(context));
    });
    issues.push(...collectValidatorIssues(response, { homebrewAllowed }));
    return Array.from(new Set(issues.filter(Boolean)));
};

type AssertionContext = {
    plan: TurnPlan;
    response: GameMasterResponse;
    prevCharacter: any;
    currentCharacter: any;
    enforceScenario: boolean;
    prevCombatState?: GameMasterResponse['combatState'] | null;
    rollRequestHistory?: Set<string>;
    homebrewAllowed: boolean;
};

const LOGIC_VALIDATORS = [
    validateActionEconomy,
    validateAttackFeasibility,
    validateRollRequestBinding,
    validateCombatClosure,
    validateLogEntriesClarity,
    validateNoShopDuringCombat,
    validateRollCorrelation,
];

const STRUCTURAL_VALIDATORS = [
    validateSchemaHash,
    validateUpdatedCharacterDelta,
    validateActionOptionsQuality,
    validateRangesAndCaps,
    enforceResponseFocus,
];

const sanitizeIssueLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_');

const collectValidatorIssues = (response: GameMasterResponse, options: { homebrewAllowed: boolean }): string[] => {
    const issues: string[] = [];
    const adapters = [...LOGIC_VALIDATORS, ...STRUCTURAL_VALIDATORS];
    const run = (validator: (payload: any) => any[]) => {
        try {
            const result = validator(response as any) ?? [];
            result.forEach(issue => {
                if (!issue || issue.severity === 'info') return;
                const label = `validator_${sanitizeIssueLabel(validator.name || 'anon')}_${sanitizeIssueLabel(issue.path ?? 'path')}`;
                issues.push(label);
            });
        } catch (error) {
            issues.push(`validator_failure_${sanitizeIssueLabel(validator.name || 'anon')}`);
        }
    };
    adapters.forEach(run);
    if (options.homebrewAllowed === false) {
        const homebrewIssues = enforceHomebrewPolicy(response as any);
        homebrewIssues.forEach(issue => {
            if (!issue || issue.severity === 'info') return;
            issues.push(`validator_enforce_homebrew_${sanitizeIssueLabel(issue.path ?? 'path')}`);
        });
    }
    return issues;
};

const validateGameClock = (prevClock: any, nextClock: any): string[] => {
    if (!prevClock || !nextClock) return [];
    const issues: string[] = [];
    const prevDay = typeof prevClock.day === 'number' ? prevClock.day : 0;
    const prevHour = typeof prevClock.hour === 'number' ? prevClock.hour : 0;
    const nextDay = typeof nextClock.day === 'number' ? nextClock.day : prevDay;
    const nextHour = typeof nextClock.hour === 'number' ? nextClock.hour : prevHour;
    if (nextDay < prevDay) {
        issues.push('game_clock_day_regression');
    }
    if (nextDay === prevDay && nextHour < prevHour) {
        issues.push('game_clock_hour_regression');
    }
    if (nextHour < 0 || nextHour > 23) {
        issues.push('game_clock_hour_invalid');
    }
    if (nextHour < prevHour && nextDay <= prevDay) {
        issues.push('game_clock_hour_rollover_without_day_increment');
    }
    return issues;
};

const validateNpcLocationMemory = (ctx: AssertionContext): string[] => {
    const locations = ctx.currentCharacter?.worldState?.npcLocations;
    if (!Array.isArray(locations) || locations.length === 0) return [];
    const relationships = Array.isArray(ctx.currentCharacter?.relationships) ? ctx.currentCharacter.relationships : [];
    const knownNpcIds = new Set<string>(
        relationships.map((item: any) => item?.npcId).filter((value: string | undefined): value is string => Boolean(value))
    );
    const invalid = locations
        .filter(location => location?.npcId)
        .some(location => !knownNpcIds.has(location!.npcId));
    return invalid ? ['npc_location_without_relationship'] : [];
};

const validateWorldContinuity = (ctx: AssertionContext): string[] => {
    const world = ctx.currentCharacter?.worldState ?? ctx.response.worldState ?? ctx.prevCharacter?.worldState;
    if (!world) return [];
    const issues: string[] = [];
    if (world.regionSlug && Array.isArray(world.visitedRegions) && !world.visitedRegions.includes(world.regionSlug)) {
        issues.push('world_visited_regions_missing_current');
    }
    if (world.poiSlug) {
        const visited = Array.isArray(world.visitedPois) ? world.visitedPois : [];
        if (!visited.some(poi => poi?.poiSlug === world.poiSlug)) {
            issues.push('poi_not_tracked_in_history');
        }
    }
    const regionChanged =
        ctx.prevCharacter?.worldState?.regionSlug &&
        ctx.response.worldState?.regionSlug &&
        ctx.prevCharacter.worldState.regionSlug !== ctx.response.worldState.regionSlug;
    if (regionChanged) {
        const logEntries = Array.isArray(ctx.response.logEntries) ? ctx.response.logEntries : [];
        const hasNarrativeCoverage = logEntries && logEntries.length > 0;
        if (!hasNarrativeCoverage) {
            issues.push('region_change_missing_log_entries');
        }
    }
    const poiChanged =
        ctx.prevCharacter?.worldState?.poiSlug &&
        ctx.response.worldState?.poiSlug &&
        ctx.prevCharacter.worldState.poiSlug !== ctx.response.worldState.poiSlug;
    if (poiChanged) {
        const logEntries = Array.isArray(ctx.response.logEntries) ? ctx.response.logEntries : [];
        const hasNarrativeCoverage = logEntries && logEntries.length > 0;
        if (!hasNarrativeCoverage) {
            issues.push('poi_change_missing_log_entries');
        }
    }
    issues.push(...validateGameClock(ctx.prevCharacter?.gameClock, ctx.currentCharacter?.gameClock ?? ctx.response.gameClock));
    return issues;
};

const validateCombatIntegrity = (ctx: AssertionContext): string[] => {
    const issues: string[] = [];
    const combat = ctx.response.combatState;
    if (!combat) {
        if (ctx.prevCombatState?.isActive) {
            const hostilesAlivePreviously = ctx.prevCombatState.combatants?.some(
                combatant => combatant?.attitude === 'hostile' && !combatant.isDead && (combatant.hp?.current ?? 1) > 0
            );
            if (hostilesAlivePreviously) {
                issues.push('combat_state_missing_during_active_encounter');
            } else if (!ctx.response.lootOffer) {
                issues.push('combat_end_missing_loot');
            }
        }
        return issues;
    }
    const combatants = Array.isArray(combat.combatants) ? combat.combatants : [];
    if (combatants.length === 0) {
        issues.push('combatants_missing');
        return issues;
    }
    if (typeof combat.turn !== 'number' || combat.turn < 0 || combat.turn >= combatants.length) {
        issues.push('combat_turn_invalid');
    } else {
        const acting = combatants[combat.turn];
        if (!acting) {
            issues.push('combat_turn_missing_combatant');
        } else if (acting.isDead) {
            issues.push('combat_turn_points_to_dead');
        }
    }
    if (Array.isArray(combat.initiativeOrder)) {
        const combatantIds = combatants.map(item => item?.id).filter((id): id is string => Boolean(id));
        const idSet = new Set(combatantIds);
        const unknown = combat.initiativeOrder.filter(id => id && !idSet.has(id));
        if (unknown.length) {
            issues.push('initiative_unknown_ids');
        }
        const orderSet = new Set<string>();
        let hasDuplicates = false;
        combat.initiativeOrder.forEach(id => {
            if (!id) return;
            if (orderSet.has(id)) {
                hasDuplicates = true;
            } else {
                orderSet.add(id);
            }
        });
        if (hasDuplicates) {
            issues.push('initiative_duplicates');
        }
        if (orderSet.size !== idSet.size) {
            issues.push('initiative_mismatch');
        }
    }
    let hostilesAlive = false;
    combatants.forEach((combatant, index) => {
        if (!combatant) return;
        const actionPoints = typeof combatant.actionPoints === 'number' ? combatant.actionPoints : 1;
        const bonusPoints = typeof combatant.bonusActionPoints === 'number' ? combatant.bonusActionPoints : 1;
        if (actionPoints > 1) {
            issues.push(`action_points_exceeded_${index}`);
        }
        if (bonusPoints > 1) {
            issues.push(`bonus_action_points_exceeded_${index}`);
        }
        if (combatant.hasActed && actionPoints > 0) {
            issues.push(`action_economy_inconsistent_${index}`);
        }
        if (combatant.attitude === 'hostile' && !combatant.isDead && (combatant.hp?.current ?? 1) > 0) {
            hostilesAlive = true;
        }
        if (combatant.isDead && typeof combatant.hp?.current === 'number' && combatant.hp.current > 0) {
            issues.push(`dead_combatant_positive_hp_${index}`);
        }
        if (!combatant.isDead && typeof combatant.hp?.current === 'number' && combatant.hp.current <= 0) {
            const hasUnconscious =
                Array.isArray(combatant.conditions) &&
                combatant.conditions.some(condition => typeof condition === 'string' && condition.toLowerCase().includes('inconsc'));
            if (!hasUnconscious) {
                issues.push(`downed_combatant_missing_condition_${index}`);
            }
        }
    });
    if (combat.isActive && !hostilesAlive) {
        issues.push('combat_marked_active_without_hostiles');
    }
    if (!combat.isActive) {
        if (hostilesAlive) {
            issues.push('combat_flagged_inactive_with_hostiles');
        }
        if (!ctx.response.lootOffer) {
            issues.push('combat_finished_without_loot');
        }
    }
    return issues;
};

const validateCombatDurations = (ctx: AssertionContext): string[] => {
    const prev = ctx.prevCombatState;
    const current = ctx.response.combatState;
    if (!prev || !current) return [];
    if (!Array.isArray(prev.combatants) || !Array.isArray(current.combatants)) return [];
    const turnAdvanced = current.round !== prev.round || current.turn !== prev.turn;
    if (!turnAdvanced) return [];
    const actor = prev.combatants[prev.turn];
    if (!actor) return [];
    const updatedActor = current.combatants.find(combatant => combatant?.id && combatant.id === actor.id);
    if (!updatedActor) return [];
    const issues: string[] = [];
    const compareDurations = (
        prevList: Array<{ id?: string; name?: string; remainingRounds?: number }> | undefined,
        nextList: Array<{ id?: string; name?: string; remainingRounds?: number }> | undefined,
        label: string
    ) => {
        if (!Array.isArray(prevList) || prevList.length === 0) return;
        prevList.forEach(entry => {
            if (!entry || typeof entry.remainingRounds !== 'number' || entry.remainingRounds <= 0) return;
            const matcher = (candidate: any) => {
                if (!candidate) return false;
                if (entry.id && candidate.id) return candidate.id === entry.id;
                if (entry.name && candidate.name) return candidate.name === entry.name;
                return false;
            };
            const nextEntry = Array.isArray(nextList) ? nextList.find(matcher) : undefined;
            if (!nextEntry || typeof nextEntry.remainingRounds !== 'number') return;
            if (nextEntry.remainingRounds >= entry.remainingRounds) {
                issues.push(`${label}_duration_not_reduced`);
            }
        });
    };
    compareDurations(actor.statusEffects, updatedActor.statusEffects, 'status_effect');
    compareDurations(actor.cooldowns, updatedActor.cooldowns, 'cooldown');
    return issues;
};

const validateInventoryConsistency = (ctx: AssertionContext): string[] => {
    const inventory = Array.isArray(ctx.currentCharacter?.inventory) ? ctx.currentCharacter.inventory : [];
    if (inventory.length === 0) return [];
    const issues: string[] = [];
    let hasEquippedFlag = false;
    let hasEquipped = false;
    inventory.forEach((item: any, index: number) => {
        if (!item) return;
        if (typeof item.quantity === 'number' && item.quantity <= 0) {
            issues.push(`inventory_non_positive_quantity_${index}`);
        }
        if (Object.prototype.hasOwnProperty.call(item, 'equipped')) {
            hasEquippedFlag = true;
        }
        if (item.equipped) {
            hasEquipped = true;
        }
        if (item.equipped && (typeof item.quantity !== 'number' || item.quantity <= 0)) {
            issues.push(`equipped_item_without_quantity_${index}`);
        }
    });
    if (ctx.response.combatState?.isActive && hasEquippedFlag && !hasEquipped) {
        issues.push('combat_without_equipped_weapon');
    }
    return issues;
};

const validateLootEconomyIntegrity = (ctx: AssertionContext): string[] => {
    const issues: string[] = [];
    const lootCurrency = ctx.response.lootOffer?.currency;
    const lootCurrencyTotal = lootCurrency && typeof lootCurrency === 'object'
        ? Object.values(lootCurrency).reduce((sum, value) => sum + (Number(value) || 0), 0)
        : 0;
    if (lootCurrency?.gp !== undefined && Number(lootCurrency.gp) < 0) {
        issues.push('loot_currency_negative');
    }
    if (ctx.response.combatState?.isActive && ctx.response.lootOffer) {
        issues.push('loot_offered_during_combat');
    }
    if (ctx.response.shopState?.isOpen && ctx.response.combatState?.isActive) {
        issues.push('shop_open_during_combat');
    }
    const sellPrices = ctx.response.shopState?.sellPrices;
    if (sellPrices && typeof sellPrices === 'object') {
        const invalidPrice = Object.values(sellPrices).some(value => typeof value !== 'number' || !Number.isFinite(value));
        if (invalidPrice) {
            issues.push('shop_invalid_price');
        }
    }
    const prevGp = Number(ctx.prevCharacter?.currency?.gp ?? 0);
    const nextGp = Number(ctx.currentCharacter?.currency?.gp ?? prevGp);
    if (nextGp < 0) {
        issues.push('character_currency_negative');
    }
    if (ctx.response.lootOffer && lootCurrencyTotal > 0 && nextGp < prevGp + lootCurrencyTotal) {
        issues.push('loot_not_added_to_currency');
    }
    return issues;
};

const validateLevelProgressionIntegrity = (ctx: AssertionContext): string[] => {
    const issues: string[] = [];
    const prevLevel = Number(ctx.prevCharacter?.level ?? ctx.prevCharacter?.attributes?.level ?? 0);
    const nextLevel = Number(ctx.currentCharacter?.level ?? ctx.currentCharacter?.attributes?.level ?? prevLevel);
    if (ctx.response.levelUpState) {
        const reportedLevel =
            Number(ctx.response.levelUpState.level ?? ctx.response.levelUpState.levelReached ?? nextLevel);
        if (reportedLevel <= prevLevel) {
            issues.push('levelup_state_without_progress');
        }
        if (reportedLevel !== nextLevel) {
            issues.push('levelup_state_mismatch');
        }
    }
    if (!ctx.response.levelUpState && nextLevel > prevLevel) {
        issues.push('levelup_missing_payload');
    }
    const xpEvents = Array.isArray(ctx.response.xpEvents) ? ctx.response.xpEvents : [];
    const progressionFeed = Array.isArray(ctx.response.progressionFeed) ? ctx.response.progressionFeed : [];
    if (xpEvents.length > 0 && progressionFeed.length === 0) {
        issues.push('progression_feed_missing');
    }
    if (progressionFeed.length > 0 && xpEvents.length === 0) {
        issues.push('xp_events_missing');
    }
    return issues;
};

const findPlayerCombatant = (ctx: AssertionContext) => {
    const combat = ctx.response.combatState;
    if (!combat || !Array.isArray(combat.combatants)) return null;
    const candidateIds = [
        ctx.currentCharacter?.id,
        ctx.currentCharacter?.characterId,
        ctx.currentCharacter?.playerId,
    ].filter((value): value is string => Boolean(value));
    return combat.combatants.find(
        combatant =>
            combatant?.isPlayer ||
            (combatant?.id && candidateIds.includes(combatant.id))
    );
};

const validateRollTracking = (ctx: AssertionContext): string[] => {
    const roll = ctx.response.playerRollRequest;
    if (!roll) return [];
    const issues: string[] = [];
    if (!roll.requestId) {
        issues.push('roll_request_missing_id');
    } else if (ctx.rollRequestHistory) {
        if (ctx.rollRequestHistory.has(roll.requestId)) {
            issues.push('roll_request_duplicate_id');
        } else {
            ctx.rollRequestHistory.add(roll.requestId);
        }
    }
    const needsHistoryBinding = new Set(['attack', 'damage', 'save', 'initiative']);
    if (needsHistoryBinding.has(roll.rollType as string)) {
        const playerCombatant = findPlayerCombatant(ctx);
        if (playerCombatant) {
            const history = Array.isArray(playerCombatant.rollHistory) ? playerCombatant.rollHistory : [];
            const expectedType = roll.rollType as string;
            const hasEntry = history.some(entry => entry?.type === expectedType);
            if (!hasEntry) {
                issues.push(`roll_history_missing_${expectedType}`);
            }
        }
    }
    return issues;
};

const validateRestConsistency = (ctx: AssertionContext): string[] => {
    const rest = ctx.response.useHitDiceRequest;
    if (!rest) return [];
    const issues: string[] = [];
    if (ctx.response.combatState?.isActive) {
        issues.push('rest_requested_during_combat');
    }
    if (!(typeof rest.maxDice === 'number' && rest.maxDice > 0)) {
        issues.push('rest_invalid_hit_dice');
    }
    return issues;
};

const validateSystemLogIntegrity = (ctx: AssertionContext): string[] => {
    const log = ctx.response.systemLog;
    if (typeof log !== 'string' || !/hash_schema=/i.test(log)) {
        return ['system_log_missing_schema_hash'];
    }
    return [];
};

const contextualValidators = [
    validateWorldContinuity,
    validateCombatIntegrity,
    validateCombatDurations,
    validateInventoryConsistency,
    validateLootEconomyIntegrity,
    validateLevelProgressionIntegrity,
    validateRollTracking,
    validateRestConsistency,
    validateSystemLogIntegrity,
    validateNpcLocationMemory,
];

const setupDirectLogTee = async () => {
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(logsDir, `TESTE-STRUTRADO-FULL_${timestamp}.log`);
    const stream = createWriteStream(logPath, { flags: 'a' });

    const forward = (chunk: any, encoding?: any) => {
        if (typeof chunk === 'string') {
            stream.write(chunk, encoding as any);
        } else {
            stream.write(chunk);
        }
    };
    const tee = (original: typeof process.stdout.write) =>
        function writeHook(this: typeof process.stdout, chunk: any, encoding?: any, callback?: any) {
            forward(chunk, encoding);
            return original.call(this, chunk, encoding as any, callback);
        };
    const restoreStdout = process.stdout.write;
    const restoreStderr = process.stderr.write;
    process.stdout.write = tee(process.stdout.write);
    process.stderr.write = tee(process.stderr.write);

    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        process.stdout.write = restoreStdout;
        process.stderr.write = restoreStderr;
        stream.end();
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
        cleanup();
        process.exit(1);
    });
    console.log(`[structured-output:full] Log salvo em ${logPath}`);
};

type StatePhaseCallResult = {
    result: GameUpdateResult;
    modelUsed: string;
    downgraded: boolean;
};

const runStatePhaseWithThrottle = async (
    planLabel: string,
    input: GameMasterFlowInput,
    primaryModel: string,
    fallbackModel: string | null,
    preferFallback: boolean,
    config: GenerationConfig,
    apiKey: string
): Promise<StatePhaseCallResult> => {
    const queue: string[] = [];
    if (preferFallback && fallbackModel) {
        queue.push(fallbackModel);
        if (fallbackModel !== primaryModel) queue.push(primaryModel);
    } else {
        queue.push(primaryModel);
        if (fallbackModel && fallbackModel !== primaryModel) queue.push(fallbackModel);
    }
    let primaryFailed = false;
    let lastError: unknown = null;
    for (let i = 0; i < queue.length; i += 1) {
        const candidate = queue[i];
        try {
            const result = await getGameUpdate(
                { ...input, responseFocus: 'state' },
                candidate,
                config,
                apiKey
            );
            const downgraded = Boolean(primaryFailed && fallbackModel && candidate === fallbackModel);
            return { result, modelUsed: candidate, downgraded };
        } catch (error: any) {
            lastError = error;
            if (candidate === primaryModel) {
                primaryFailed = true;
            }
            const hasNext = i + 1 < queue.length;
            if (!hasNext) {
                throw error;
            }
            console.warn(
                `[structured-output:test] ${planLabel} – fase de estado falhou com ${candidate}: ${error?.message ?? error}`
            );
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const runSyntheticTurn = async (
    plan: TurnPlan,
    state: SessionState,
    model: string,
    stateModelFallback: string | null,
    config: GenerationConfig,
    apiKey: string,
    preferStateFallback: boolean,
    onStateModelDowngrade?: () => void
): Promise<TurnMetric> => {
    const suppressRoll = !plan.expectRollRequest;
    const baseInput = buildInput(state, plan.playerAction, suppressRoll, plan.label, state.context);
    state.homebrewAllowed = baseInput.useAiHomebrew !== false;
    const prevCombatState = state.lastCombatState ?? null;

    const prevCharacterSnapshot = cloneState(state.character);
    hydrateSnapshotWorldState(prevCharacterSnapshot, state.lastWorldState);
    const narrativeStart = performance.now();
    const narrativeCall = await getGameUpdate(
        { ...baseInput, responseFocus: 'narrative' },
        model,
        config,
        apiKey
    );
    pruneNarrativePhaseResponse(narrativeCall.response, { allowRollRequest: Boolean(plan.expectRollRequest) });
    const narrativeEnd = performance.now();
    console.log(
        `\n[structured-output:debug] ${plan.label} – fase narrativa`,
        JSON.stringify(narrativeCall.response, null, 2)
    );

    state.gameLog = appendToGameLog(state.gameLog, narrativeCall.response);

    const stateStart = performance.now();
    const statePhaseCall = await runStatePhaseWithThrottle(
        plan.label,
        baseInput,
        model,
        stateModelFallback,
        preferStateFallback,
        config,
        apiKey
    );
    const stateEnd = performance.now();
    if (statePhaseCall.downgraded && onStateModelDowngrade) {
        onStateModelDowngrade();
    }
    const stateResult = statePhaseCall.result;
    pruneStatePhaseResponse(stateResult.response);
    if (stateResult.response) {
        attachResponseMetadata(stateResult.response);
    }
    normalizeWorldStatePlacement(stateResult.response, state.lastWorldState ?? prevCharacterSnapshot.worldState ?? null);
    console.log(
        `[structured-output:debug] ${plan.label} – fase de estado`,
        JSON.stringify(stateResult.response, null, 2)
    );

    const integrityNotesRaw = stateResult.response._meta?.integrityNotes;
    const integrityNotes = Array.isArray(integrityNotesRaw)
        ? integrityNotesRaw
        : integrityNotesRaw
            ? [integrityNotesRaw]
            : [];
    const actionableNotes = integrityNotes.filter(note => {
        if (!note) return false;
        if (note.toLowerCase().includes('migrado automaticamente')) return false;
        return !SANITIZER_NOTE_PATTERNS.some(pattern => pattern.test(note));
    });
    let schemaIssues = actionableNotes.slice();

    const mergedResponse = mergePhaseResponses(narrativeCall.response, stateResult.response);
    console.log(
        `[structured-output:debug] ${plan.label} – resposta combinada`,
        JSON.stringify(mergedResponse, null, 2)
    );
    const guardResult = enforceResponseGuards(mergedResponse, { allowRollRequest: Boolean(plan.expectRollRequest) });
    stateResult.response.playerRollRequest = mergedResponse.playerRollRequest;

    applyCharacterUpdate(state, stateResult.response);
    const assertionIssues = validateStateAssertions(
        plan,
        mergedResponse,
        prevCharacterSnapshot,
        state.character,
        {
            prevCombatState,
            rollRequestHistory: state.rollRequestHistory,
            homebrewAllowed: state.homebrewAllowed,
        }
    );
    if ('combatState' in mergedResponse) {
        state.lastCombatState = mergedResponse.combatState ?? null;
    }
    const rollRequestIssued = Boolean(mergedResponse.playerRollRequest);

    const combinedWarnings = [
        ...(narrativeCall.warnings ?? []).map(w => w.type),
        ...(stateResult.warnings ?? []).map(w => w.type),
    ];
    const { critical: criticalWarnings, info: infoWarnings } = classifyWarnings(combinedWarnings);

    const fallbackTriggered = combinedWarnings.some(warning =>
        warning.toLowerCase().includes('fallback') || warning.toLowerCase().includes('fail-soft')
    );

    const metric: TurnMetric = {
        label: plan.label,
        narrativeMs: narrativeEnd - narrativeStart,
        stateMs: stateEnd - stateStart,
        warnings: criticalWarnings,
        infoWarnings,
        fallbackTriggered,
        rollRequestIssued,
        schemaMismatches: schemaIssues,
        assertionIssues,
        stateModelUsed: statePhaseCall.modelUsed === model ? undefined : statePhaseCall.modelUsed,
    };

    const shouldPersistSnapshot =
        metric.warnings.length > 0 ||
        metric.schemaMismatches.length > 0 ||
        metric.assertionIssues.length > 0 ||
        metric.fallbackTriggered;

    if (shouldPersistSnapshot) {
        const reasons = {
            warnings: metric.warnings,
            schema: metric.schemaMismatches,
            assertions: metric.assertionIssues,
            fallback: metric.fallbackTriggered,
        };
        const files: string[] = [];
        const narrativePath = await persistPhaseArtifact('synthetic', plan.label, 'narrative', {
            label: plan.label,
            reasons,
            response: narrativeCall.response,
            rawText: narrativeCall.rawText,
            warnings: narrativeCall.warnings,
            model,
        });
        if (narrativePath) files.push(narrativePath);
        const statePath = await persistPhaseArtifact('synthetic', plan.label, 'state', {
            label: plan.label,
            reasons,
            response: stateResult.response,
            rawText: stateResult.rawText,
            warnings: stateResult.warnings,
            model: statePhaseCall.modelUsed,
        });
        if (statePath) files.push(statePath);
        if (files.length) {
            metric.snapshotFiles = files;
        }
    }

    return metric;
};

const summarize = (metrics: TurnMetric[]) => {
    const totalMs = metrics.reduce((sum, item) => sum + item.narrativeMs + item.stateMs, 0);
    console.log('\n[structured-output:full] Resumo da sessão simulada:');
    metrics.forEach(metric => {
        const infoLabel = metric.infoWarnings.length ? `(informativos: ${metric.infoWarnings.join(',')})` : '';
        const modelLabel = metric.stateModelUsed ? ` modeloEstado=${metric.stateModelUsed}` : '';
        const snapshotLabel = metric.snapshotFiles?.length ? ` snapshots=${metric.snapshotFiles.length}` : '';
        console.log(
            `- ${metric.label}: narrativa ${(metric.narrativeMs / 1000).toFixed(2)}s, ` +
            `estado ${(metric.stateMs / 1000).toFixed(2)}s, warnings=${metric.warnings.length}, ` +
            `fallback=${metric.fallbackTriggered ? 'sim' : 'não'}, roll=${metric.rollRequestIssued ? 'sim' : 'não'}, ` +
            `schemaIssues=${metric.schemaMismatches.join(',') || 'nenhuma'} ` +
            `${metric.assertionIssues.length ? `assertions=${metric.assertionIssues.join(',')}` : ''} ` +
            `${infoLabel}${modelLabel}${snapshotLabel}`
        );
    });
    console.log(`[structured-output:full] Tempo total ≈ ${(totalMs / 1000).toFixed(2)}s`);
    const toleratedAssertions = new Set(['npc_location_without_relationship', 'combat_state_missing']);
    const isProblematicAssertion = (assertions: string[]) =>
        assertions.filter(item => !toleratedAssertions.has(item)).length > 0;
    const problematic = metrics.filter(metric =>
        metric.warnings.length > 0 ||
        metric.fallbackTriggered ||
        metric.schemaMismatches.length > 0 ||
        isProblematicAssertion(metric.assertionIssues)
    );
    if (problematic.length) {
        const details = problematic
            .map(metric => `${metric.label}: warnings=${metric.warnings.join(',') || 'nenhum'}, fallback=${metric.fallbackTriggered}, schemaIssues=${metric.schemaMismatches.join(',') || 'nenhuma'}, snapshots=${metric.snapshotFiles?.length ?? 0}`)
            .join(' | ');
        throw new Error(`Teste completo encontrou inconsistências: ${details}`);
    }
};

export const runStructuredFull = async (cliArgs: string[] = process.argv.slice(2)) => {
    const getFlag = (name: string): string | undefined => {
        const withEquals = cliArgs.find(arg => arg.startsWith(`--${name}=`));
        if (withEquals) return withEquals.split('=')[1];
        const index = cliArgs.indexOf(`--${name}`);
        return index !== -1 ? cliArgs[index + 1] : undefined;
    };

    const sessionArg = getFlag('session');
    const userArg = getFlag('user');
    if (sessionArg !== undefined || userArg !== undefined) {
        console.warn('[structured-output:full] ⚠️ O modo live foi descontinuado. Parâmetros --session/--user serão ignorados.');
    }

    const apiKey = getFlag('apiKey') ?? env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Configure GEMINI_API_KEY (ou use --apiKey) para executar o teste completo.');
    }

    const metrics: TurnMetric[] = [];
    const model = getFlag('model') || env.AI_MODEL || 'gemini-2.5-flash';
    const fallbackFlag = getFlag('stateFallbackModel');
    const stateFallbackModel = fallbackFlag === 'none'
        ? null
        : fallbackFlag ?? (model.includes('flash-lite') ? null : 'gemini-2.5-flash-lite');
    let preferStateFallback = false;
    const sessionMock = await loadSessionMockSnapshot();
    const character = cloneState(sessionMock.character ?? (await loadCharacterFixture()));
    if (sessionMock.shopState && !character.shopState) {
        character.shopState = sessionMock.shopState;
    }
    const sessionContext: SessionContext = {
        storySummary: sessionMock.storySummary,
        timelineFacts: sessionMock.timelineFacts,
        homebrewSummary: sessionMock.homebrewSummary,
        regionGraphSummary: sessionMock.regionGraphSummary,
    };
    const sessionState: SessionState = {
        character,
        gameLog: sessionMock.gameLog ?? 'SISTEMA: Sessão simulada para validação integral.',
        lastCombatState: sessionMock.combatState ?? character?.combatState ?? null,
        rollRequestHistory: new Set<string>(),
        homebrewAllowed: true,
        lastWorldState: character?.worldState ?? null,
        context: sessionContext,
    };
    if (!sessionState.character.worldState && sessionState.lastWorldState) {
        sessionState.character.worldState = sessionState.lastWorldState;
    }
    applyWorldStateDefaults(sessionState.character.worldState ?? (sessionState.character.worldState = { ...DEFAULT_WORLD_STATE }));
    sessionState.lastWorldState = sessionState.character.worldState;
    for (const plan of TURN_SEQUENCE) {
        console.log(`\n[structured-output:full] >>> Turno: ${plan.label}`);
        const metric = await runSyntheticTurn(
            plan,
            sessionState,
            model,
            stateFallbackModel,
            DEFAULT_GENERATION_CONFIG,
            apiKey,
            preferStateFallback,
            () => { preferStateFallback = true; }
        );
        metrics.push(metric);
        sessionMock.character = cloneState(sessionState.character);
        sessionMock.combatState = sessionState.lastCombatState;
        sessionMock.shopState = sessionState.character?.shopState ?? null;
        sessionMock.gameLog = sessionState.gameLog;
        await persistSessionMockSnapshot(sessionMock);
    }
    summarize(metrics);
};

const isDirectExecution = () => {
    const currentFile = pathToFileURL(process.argv[1] ?? '').href;
    return import.meta.url === currentFile;
};

if (isDirectExecution()) {
    (async () => {
        try {
            await setupDirectLogTee();
        } catch (error) {
            console.warn('[structured-output:full] Não foi possível iniciar o log em arquivo:', error);
        }
        await runStructuredFull();
    })().catch(error => {
        console.error('[structured-output:full] ❌ Falha ao executar o teste completo:', error);
        process.exitCode = 1;
    });
}
