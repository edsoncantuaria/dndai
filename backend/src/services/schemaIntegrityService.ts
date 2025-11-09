import crypto from 'crypto';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import { GameMasterResponseSchema } from '../schemas/gameSchemas.js';

type SystemLogCarrier = { systemLog?: string | null };

const sortObjectDeep = (value: any): any => {
    if (Array.isArray(value)) {
        return value.map(sortObjectDeep);
    }
    if (value && typeof value === 'object') {
        const sorted: Record<string, any> = {};
        Object.keys(value)
            .sort()
            .forEach(key => {
                sorted[key] = sortObjectDeep(value[key]);
            });
        return sorted;
    }
    return value;
};

const schemaJson = sortObjectDeep(zodToJsonSchema(GameMasterResponseSchema, 'GameMasterResponse'));
export const GAME_MASTER_RESPONSE_JSON_SCHEMA = schemaJson;

export const GAME_MASTER_SCHEMA_HASH = crypto
    .createHash('sha256')
    .update(JSON.stringify(schemaJson))
    .digest('hex')
    .slice(0, 12);
export const CURRENT_SCHEMA_VERSION = 2;

const HASH_REGEX = /HASH_SCHEMA=([a-f0-9]+)/i;
const DRIFT_NOTE = '[⚠️ Schema drift detectado: resposta antiga]';

const cloneStructured = <T>(value: T): T | undefined => {
    if (value === undefined || value === null) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return undefined;
    }
};

const ensureArray = <T>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);

const isPlainObject = (value: unknown): value is Record<string, any> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value));

type SchemaMigration = {
    fromVersion: number;
    toVersion: number;
    migrate: (response: GameMasterResponse) => GameMasterResponse;
    note?: string;
};

const schemaMigrations: SchemaMigration[] = [
    {
        fromVersion: 0,
        toVersion: 1,
        migrate: (response) => {
            const clone = JSON.parse(JSON.stringify(response)) as GameMasterResponse;
            if (!clone.memoryContext) {
                clone.memoryContext = { summary: '', references: [] };
            }
            return clone;
        },
        note: 'Inicialização de metadata e memória.',
    },
    {
        fromVersion: 1,
        toVersion: 2,
        migrate: (response) => {
            const clone = JSON.parse(JSON.stringify(response)) as GameMasterResponse;
            clone._meta = clone._meta ?? {};
            if (typeof clone._meta.createdAt !== 'number') {
                clone._meta.createdAt = Date.now();
            }
            return clone;
        },
        note: 'Metadados atualizados com createdAt e version.',
    },
];

const getCurrentSchemaVersion = (response: GameMasterResponse | null | undefined): number => {
    if (!response || typeof response !== 'object') return 0;
    const version = response._meta?.version ?? response._meta?.schemaVersion;
    if (typeof version === 'number' && Number.isFinite(version)) {
        return version;
    }
    return responseMatchesCurrentSchema(response) ? CURRENT_SCHEMA_VERSION : 0;
};

const applySchemaMigrations = (response: GameMasterResponse): GameMasterResponse => {
    let working = JSON.parse(JSON.stringify(response)) as GameMasterResponse;
    let currentVersion = getCurrentSchemaVersion(working);
    const appliedNotes: string[] = [];

    while (currentVersion < CURRENT_SCHEMA_VERSION) {
        const migration = schemaMigrations.find(m => m.fromVersion === currentVersion);
        if (!migration) break;
        working = migration.migrate(working);
        currentVersion = migration.toVersion;
        if (migration.note) {
            appliedNotes.push(migration.note);
        }
    }

    if (appliedNotes.length) {
        working._meta = {
            ...working._meta,
            integrityNotes: [
                ...(working._meta?.integrityNotes ?? []),
                ...appliedNotes,
            ],
        };
    }
    return working;
};

export const normalizeResponseSchema = (
    response: GameMasterResponse,
    extras?: Partial<NonNullable<GameMasterResponse['_meta']>>
): GameMasterResponse => {
    const migrated = applySchemaMigrations(response);
    return attachResponseMetadata(migrated, extras);
};

export const attachResponseMetadata = (
    response: GameMasterResponse,
    extras?: Partial<NonNullable<GameMasterResponse['_meta']>>
): GameMasterResponse => {
    const previousHash = response._meta?.hash ?? extractEmbeddedSchemaHash(response);
    const previousVersion = getCurrentSchemaVersion(response);
    const recoveryStrategies = new Set<string>(response._meta?.recoveryStrategies ?? []);
    (extras?.recoveryStrategies ?? []).forEach(strategy => {
        if (strategy) recoveryStrategies.add(strategy);
    });
    const integrityNotes = [
        ...(response._meta?.integrityNotes ?? []),
        ...(extras?.integrityNotes ?? []),
    ].filter(Boolean);
    const createdAtCandidate = typeof extras?.createdAt === 'number'
        ? extras.createdAt
        : typeof response._meta?.createdAt === 'number'
            ? response._meta?.createdAt!
            : Date.now();
    const normalizedCreatedAt = Number.isFinite(createdAtCandidate)
        ? createdAtCandidate
        : Date.now();
    const migratedFrom = previousHash && previousHash !== GAME_MASTER_SCHEMA_HASH
        ? previousHash
        : response._meta?.migratedFrom ?? null;

    response._meta = {
        version: CURRENT_SCHEMA_VERSION,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        hash: GAME_MASTER_SCHEMA_HASH,
        migratedFrom,
        createdAt: normalizedCreatedAt,
        recoveryStrategies: recoveryStrategies.size ? Array.from(recoveryStrategies) : undefined,
        reconstructionScore: extras?.reconstructionScore ?? response._meta?.reconstructionScore,
        integrityNotes: integrityNotes.length ? integrityNotes : undefined,
    };

    if (previousVersion < CURRENT_SCHEMA_VERSION) {
        const notes = response._meta.integrityNotes ?? [];
        const migrationNote = `Migrado automaticamente do schema v${previousVersion} para v${CURRENT_SCHEMA_VERSION}`;
        if (!notes.includes(migrationNote)) {
            response._meta.integrityNotes = [...notes, migrationNote];
        }
    }

    const hashLine = `HASH_SCHEMA=${GAME_MASTER_SCHEMA_HASH}`;
    if (typeof response.systemLog === 'string') {
        if (!response.systemLog.includes(hashLine)) {
            response.systemLog = response.systemLog.trim()
                ? `${response.systemLog.trim()}\n${hashLine}`
                : hashLine;
        }
    } else {
        response.systemLog = hashLine;
    }

    return response;
};

const coerceLogEntries = (
    logEntries: any,
    fallbackNarrative: string
): GameMasterResponse['logEntries'] => {
    if (Array.isArray(logEntries) && logEntries.length) {
        const mapped = logEntries
            .map(entry => {
                if (!entry) return null;
                if (typeof entry === 'string') {
                    return { type: 'narration', content: entry.trim() };
                }
                if (isPlainObject(entry) && typeof entry.content === 'string') {
                    const type =
                        typeof entry.type === 'string'
                            ? entry.type
                            : 'narration';
                    return { type, content: entry.content };
                }
                return null;
            })
            .filter(Boolean) as GameMasterResponse['logEntries'];
        if (mapped.length) {
            return mapped;
        }
    }
    return [
        {
            type: 'narration',
            content:
                fallbackNarrative ||
                'O Mestre de Jogo enviou uma resposta antiga. O sistema preservou o estado para manter a sessão estável.',
        },
    ];
};

const DEFAULT_ACTIONS = [
    { text: 'Observe o cenário para entender melhor a situação.', action: 'observar' },
    { text: 'Revise seus recursos e equipamentos antes de agir.', action: 'avaliar' },
    { text: 'Planeje o próximo movimento com cautela.', action: 'planejar' },
];

const coerceActionOptions = (actionOptions: any): GameMasterResponse['actionOptions'] => {
    if (Array.isArray(actionOptions)) {
        const mapped = actionOptions
            .map(option => {
                if (!option) return null;
                if (typeof option === 'string') {
                    return option.trim();
                }
                if (isPlainObject(option) && typeof option.text === 'string') {
                    const normalizedAction = option.text.toLowerCase().slice(0, 40);
                    return {
                        text: option.text,
                        action: option.action ?? (normalizedAction || 'acao'),
                        skill: typeof option.skill === 'string' ? option.skill : undefined,
                    };
                }
                return null;
            })
            .filter(Boolean) as GameMasterResponse['actionOptions'];
        if (mapped.length >= 2) {
            return mapped;
        }
        const hydrated = [...mapped];
        for (const fallback of DEFAULT_ACTIONS) {
            hydrated.push(fallback);
            if (hydrated.length >= 2) break;
        }
        return hydrated.slice(0, 3);
    }
    return DEFAULT_ACTIONS.slice(0, 3);
};

const ensureWorldStateSnapshot = (source: any, input?: GameMasterFlowInput) => {
    const worldStateCandidate = source?.worldState ?? input?.character?.worldState;
    if (!isPlainObject(worldStateCandidate)) return undefined;
    const snapshot: Record<string, any> = {};
    if (typeof worldStateCandidate.timeOfDay === 'string') snapshot.timeOfDay = worldStateCandidate.timeOfDay;
    if (typeof worldStateCandidate.weather === 'string') snapshot.weather = worldStateCandidate.weather;
    if (typeof worldStateCandidate.currentRegion === 'string') snapshot.currentRegion = worldStateCandidate.currentRegion;
    return Object.keys(snapshot).length ? snapshot : undefined;
};

const ensureCombatStateSnapshot = (source: any, input?: GameMasterFlowInput) => {
    const combatSource = source?.combatState ?? (input?.combatState?.isActive ? input?.combatState : null);
    if (!combatSource || typeof combatSource !== 'object') return null;
    return cloneStructured(combatSource) ?? null;
};

export const extractEmbeddedSchemaHash = (carrier: SystemLogCarrier): string | null => {
    const systemLog = typeof carrier.systemLog === 'string' ? carrier.systemLog : '';
    const match = systemLog.match(HASH_REGEX);
    return match ? match[1] : null;
};

export const responseMatchesCurrentSchema = (carrier: SystemLogCarrier): boolean => {
    const embedded = extractEmbeddedSchemaHash(carrier);
    if (!embedded) return false;
    return embedded === GAME_MASTER_SCHEMA_HASH;
};

export const ensureResponseSchemaHash = <T extends SystemLogCarrier>(response: T): T => {
    if (response && typeof response === 'object') {
        attachResponseMetadata(response as GameMasterResponse);
    }
    return response;
};

export const markSchemaDrift = (response: SystemLogCarrier): void => {
    const existing = typeof response.systemLog === 'string' ? response.systemLog : '';
    if (!existing.includes(DRIFT_NOTE)) {
        response.systemLog = existing
            ? `${existing}\n${DRIFT_NOTE}`
            : DRIFT_NOTE;
    }
    ensureResponseSchemaHash(response);
};

export const migrateLegacyResponse = (
    source: any,
    context?: { input?: GameMasterFlowInput; rawText?: string }
): GameMasterResponse => {
    const safeSource = isPlainObject(source) ? source : {};
    const logEntries = coerceLogEntries(
        safeSource.logEntries,
        context?.rawText ?? ''
    );
    const actionOptions = coerceActionOptions(safeSource.actionOptions);
    while (actionOptions.length < 2) {
        actionOptions.push(DEFAULT_ACTIONS[actionOptions.length % DEFAULT_ACTIONS.length]);
    }

    const updatedCharacter = isPlainObject(safeSource.updatedCharacter)
        ? safeSource.updatedCharacter
        : {};

    const response: GameMasterResponse = {
        logEntries,
        actionOptions,
        updatedCharacter,
        combatState: ensureCombatStateSnapshot(safeSource, context?.input),
        playerRollRequest: safeSource.playerRollRequest ?? null,
        ambientSound: typeof safeSource.ambientSound === 'string' ? safeSource.ambientSound : undefined,
        systemLog: typeof safeSource.systemLog === 'string' ? safeSource.systemLog : undefined,
        levelUpState: safeSource.levelUpState ?? null,
        shopState: safeSource.shopState ?? null,
        lootOffer: safeSource.lootOffer ?? null,
        useHitDiceRequest: safeSource.useHitDiceRequest ?? null,
        worldState: ensureWorldStateSnapshot(safeSource, context?.input),
        newHomebrewContent: ensureArray(safeSource.newHomebrewContent),
        xpEvents: ensureArray(safeSource.xpEvents),
        progressionFeed: ensureArray(safeSource.progressionFeed),
        gameClock: safeSource.gameClock,
        memoryContext: safeSource.memoryContext,
    };

    attachResponseMetadata(response, {
        recoveryStrategies: ['legacy-mapping'],
    });
    return response;
};
