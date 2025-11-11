import path from 'path';
import { pathToFileURL } from 'url';
import { promises as fs, createWriteStream } from 'fs';
import { performance } from 'node:perf_hooks';
import { env } from '../config/env.js';
import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';
import { getGameUpdate, type GameUpdateResult } from '../services/aiService.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { processPlayerTurn, buildOptimizedCharacterForAI } from '../services/narrarService.js';

const CHARACTER_FIXTURE = path.join(process.cwd(), 'tests', 'data', 'testCharacterMirror.json');

const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
    temperature: 0.4,
    topP: 0.9,
    topK: 32,
    maxOutputTokens: Number(process.env.AI_GAMEPLAY_MAX_OUTPUT ?? 4096),
};

type SessionState = {
    character: any;
    gameLog: string;
};

type LiveContext = {
    sessionId: number;
    userId: number;
    characterId: number;
    apiKey: string;
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

const appendToGameLog = (currentLog: string, response: GameMasterResponse): string => {
    const entries = response.logEntries ?? [];
    const serialized = entries
        .map(entry => `${entry.type?.toUpperCase() ?? 'SYSTEM'}:${entry.content}`)
        .join('\n');
    const combined = `${currentLog}\n${serialized}`.trim();
    const maxChars = 4000;
    return combined.length > maxChars ? combined.slice(combined.length - maxChars) : combined;
};

const buildInput = (state: SessionState, action: string, suppressRoll: boolean): GameMasterFlowInput => ({
    character: state.character,
    playerAction: action,
    gameLog: state.gameLog || 'SEM_EVENTOS',
    useAiHomebrew: true,
    enableNarrativeRevalidation: true,
    mode: 'gameplay',
    suppressRollRequest: suppressRoll,
});

const cloneState = <T>(value: T): T =>
    typeof globalThis.structuredClone === 'function'
        ? globalThis.structuredClone(value)
        : JSON.parse(JSON.stringify(value));

const applyCharacterUpdate = (state: SessionState, response: GameMasterResponse) => {
    const mergeWorldState = (current: any, incoming: any) => {
        if (!incoming) return current;
        if (!current) return { ...incoming };
        return { ...current, ...incoming };
    };
    const mergeGameClock = (current: any, incoming: any) => {
        if (!incoming) return current;
        return { ...(current || {}), ...incoming };
    };

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
};

const CRITICAL_WARNINGS = new Set(['zod_validation_failure', 'structured_output_disabled', 'fail-soft', 'fallback']);
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
    options: { enforceScenario?: boolean } = {}
): string[] => {
    const { enforceScenario = true } = options;
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
        // Apenas cobra em modo sintético; sessões live podem não ter NPCs carregados.
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
    return issues;
};

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
    const baseInput = buildInput(state, plan.playerAction, suppressRoll);

    const prevCharacterSnapshot = cloneState(state.character);
    const narrativeStart = performance.now();
    const narrativeCall = await getGameUpdate(
        { ...baseInput, responseFocus: 'narrative' },
        model,
        config,
        apiKey
    );
    const narrativeEnd = performance.now();

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

    applyCharacterUpdate(state, stateResult.response);
    const assertionIssues = validateStateAssertions(plan, stateResult.response, prevCharacterSnapshot, state.character);

    const rollRequestIssued = Boolean(stateResult.response.playerRollRequest);
    const integrityNotesRaw = stateResult.response._meta?.integrityNotes;
    const integrityNotes = Array.isArray(integrityNotesRaw)
        ? integrityNotesRaw
        : integrityNotesRaw
            ? [integrityNotesRaw]
            : [];
    const actionableNotes = integrityNotes.filter(note => !note.toLowerCase().includes('migrado automaticamente'));
    let schemaIssues = actionableNotes.slice();

    const onlyMigrationNote = integrityNotes.length > 0 && actionableNotes.length === 0;
    const migrationWarning = (stateResult.warnings ?? []).some(w => w.type === 'schema_migration');
    const sanitizedRollRequest = !plan.expectRollRequest && rollRequestIssued && (onlyMigrationNote || migrationWarning);

    if (sanitizedRollRequest) {
        stateResult.response.playerRollRequest = undefined;
    }

    if (!plan.expectRollRequest && rollRequestIssued && !sanitizedRollRequest) {
        schemaIssues.push('roll_request_unexpected');
    }

    const combinedWarnings = [
        ...(narrativeCall.warnings ?? []).map(w => w.type),
        ...(stateResult.warnings ?? []).map(w => w.type),
    ];
    const { critical: criticalWarnings, info: infoWarnings } = classifyWarnings(combinedWarnings);

    const fallbackTriggered = [
        narrativeCall.response?.systemLog,
        stateResult.response?.systemLog,
    ].some(log => typeof log === 'string' && /fallback/i.test(log));

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

const buildLiveWarnings = (response: GameMasterResponse): string[] => {
    const warnings: string[] = [];
    const integrityNotes = response._meta?.integrityNotes;
    if (integrityNotes) {
        const notes = Array.isArray(integrityNotes) ? integrityNotes : [integrityNotes];
        warnings.push(...notes.map(note => {
            const normalized = note.toLowerCase();
            if (normalized.includes('migrado')) return 'schema_migration';
            if (normalized.includes('fase') && normalized.includes('estado')) return 'phase_sanitization';
            if (normalized.includes('logentries') || normalized.includes('actionoptions')) return 'phase_sanitization';
            return note;
        }));
    }
    if (response.systemLog && /fallback/i.test(response.systemLog)) {
        warnings.push('fallback');
    }
    return warnings;
};

const runLiveTurn = async (
    plan: TurnPlan,
    context: LiveContext
): Promise<TurnMetric> => {
    const prevSnapshot = await buildOptimizedCharacterForAI(context.characterId, false);
    const start = performance.now();
    const response = await processPlayerTurn(
        context.sessionId,
        context.userId,
        plan.playerAction,
        context.apiKey
    );
    const end = performance.now();
    const nextSnapshot = await buildOptimizedCharacterForAI(context.characterId, false);
    const assertionIssues = validateStateAssertions(plan, response, prevSnapshot, nextSnapshot, { enforceScenario: false });
    const rawWarnings = buildLiveWarnings(response);
    const { critical, info } = classifyWarnings(rawWarnings);
    const fallbackTriggered = Boolean(response.systemLog && /fallback/i.test(response.systemLog));
    const metric: TurnMetric = {
        label: plan.label,
        narrativeMs: end - start,
        stateMs: end - start,
        warnings: critical,
        infoWarnings: info,
        fallbackTriggered,
        rollRequestIssued: Boolean(response.playerRollRequest),
        schemaMismatches: [],
        assertionIssues,
    };
    const shouldPersist = metric.warnings.length > 0 || metric.assertionIssues.length > 0 || metric.fallbackTriggered;
    if (shouldPersist) {
        const snapshot = await persistPhaseArtifact('live', plan.label, 'combined', {
            label: plan.label,
            response,
            warnings: rawWarnings,
            assertionIssues,
        });
        if (snapshot) {
            metric.snapshotFiles = [snapshot];
        }
    }
    return metric;
};

const summarize = (metrics: TurnMetric[], options: { tolerateLiveWarnings?: boolean } = {}) => {
    const { tolerateLiveWarnings = false } = options;
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
    const problematic = metrics.filter(metric =>
        metric.warnings.length > 0 ||
        metric.fallbackTriggered ||
        metric.schemaMismatches.length ||
        metric.assertionIssues.length
    );
    if (problematic.length && !tolerateLiveWarnings) {
        const details = problematic
            .map(metric => `${metric.label}: warnings=${metric.warnings.join(',') || 'nenhum'}, fallback=${metric.fallbackTriggered}, schemaIssues=${metric.schemaMismatches.join(',') || 'nenhuma'}, snapshots=${metric.snapshotFiles?.length ?? 0}`)
            .join(' | ');
        throw new Error(`Teste completo encontrou inconsistências: ${details}`);
    }
    if (problematic.length && tolerateLiveWarnings) {
        console.warn('[structured-output:test5] ⚠️ Ocorreram inconsistências não críticas em modo live:', problematic.map(metric => metric.label).join(', '));
    }
};

const createLiveContext = async (sessionId: number, userId: number, apiKey: string): Promise<LiveContext> => {
    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepo.findOne({
        where: { id: sessionId, userId },
        relations: ['character'],
    });
    if (!sessao?.character) {
        throw new Error(`Sessão ${sessionId} / usuário ${userId} não encontrada ou sem personagem associado.`);
    }
    return {
        sessionId,
        userId,
        characterId: sessao.character.id,
        apiKey,
    };
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
    const liveMode = sessionArg !== undefined && userArg !== undefined;

    const apiKey = getFlag('apiKey') ?? env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Configure GEMINI_API_KEY (ou use --apiKey) para executar o teste completo.');
    }

    const metrics: TurnMetric[] = [];
    if (liveMode) {
        const sessionId = Number(sessionArg);
        const userId = Number(userArg);
        if (!Number.isFinite(sessionId) || !Number.isFinite(userId)) {
            throw new Error('Parâmetros --session e --user devem ser números válidos.');
        }
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        try {
            const liveContext = await createLiveContext(sessionId, userId, apiKey);
            for (const plan of TURN_SEQUENCE) {
                console.log(`\n[structured-output:full] >>> Turno (live): ${plan.label}`);
                const metric = await runLiveTurn(plan, liveContext);
                metrics.push(metric);
            }
        } finally {
            await AppDataSource.destroy();
        }
    } else {
        const model = getFlag('model') || env.AI_MODEL || 'gemini-2.5-flash';
        const fallbackFlag = getFlag('stateFallbackModel');
        const stateFallbackModel = fallbackFlag === 'none'
            ? null
            : fallbackFlag ?? (model.includes('flash-lite') ? null : 'gemini-2.5-flash-lite');
        let preferStateFallback = false;
        const character = await loadCharacterFixture();
        const sessionState: SessionState = {
            character,
            gameLog: 'SISTEMA: Sessão simulada para validação integral.',
        };
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
        }
    }
    summarize(metrics, { tolerateLiveWarnings: liveMode });
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
