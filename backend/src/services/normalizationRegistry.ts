import { AppDataSource } from '../database/data-source.js';
import redisClient, { ensureRedisConnection } from '../database/redis-client.js';
import { SanitizationPattern } from '../entities/SanitizationPattern.js';

export type NormalizationCategory =
    | 'logEntry.type'
    | 'combat.zone'
    | 'combat.attitude'
    | 'roll.type'
    | 'progression.type'
    | 'relationship.status'
    | 'world.timeOfDay'
    | 'world.weather';

export type NormalizationRecord = {
    category: NormalizationCategory | string;
    rawValue: string;
    normalizedValue: string;
    metadata?: Record<string, any>;
    occurrences?: number;
};

const pending = new Map<string, NormalizationRecord & { occurrences: number }>();
let flushTimer: NodeJS.Timeout | null = null;
let dbAvailable = true;
let initializationPromise: Promise<void> | null = null;

const ensureDataSource = async (): Promise<boolean> => {
    if (AppDataSource.isInitialized) return true;
    if (!dbAvailable) return false;
    if (!initializationPromise) {
        initializationPromise = AppDataSource.initialize().catch(error => {
            dbAvailable = false;
            console.warn('[normalizationRegistry] Não foi possível inicializar DataSource:', error);
            throw error;
        }).finally(() => {
            initializationPromise = null;
        });
    }
    try {
        await initializationPromise;
        return AppDataSource.isInitialized;
    } catch {
        return false;
    }
};

const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushQueue();
    }, 500);
};

const buildKey = (category: string, rawValue: string, normalizedValue: string): string =>
    `${category}::${rawValue.toLowerCase()}::${normalizedValue.toLowerCase()}`;

const normalizeString = (value: string): string => value.trim().slice(0, 255);

export const trackNormalization = (
    category: NormalizationCategory | string,
    rawValue: string | undefined | null,
    normalizedValue: string | undefined | null,
    metadata?: Record<string, any>
) => {
    if (!rawValue || !normalizedValue) return;
    const raw = normalizeString(String(rawValue));
    const normalized = normalizeString(String(normalizedValue));
    if (!raw || raw.toLowerCase() === normalized.toLowerCase()) return;
    const key = buildKey(category, raw, normalized);
    const existing = pending.get(key);
    if (existing) {
        existing.occurrences += 1;
        if (metadata) {
            existing.metadata = { ...existing.metadata, ...metadata };
        }
    } else {
        pending.set(key, {
            category,
            rawValue: raw,
            normalizedValue: normalized,
            metadata,
            occurrences: 1,
        });
    }
    scheduleFlush();
};

const upsertInDatabase = async (records: NormalizationRecord[]) => {
    if (!records.length) return;
    const ready = await ensureDataSource();
    if (!ready) return;
    try {
        const repo = AppDataSource.getRepository(SanitizationPattern);
        for (const record of records) {
            const existing = await repo.findOne({
                where: { category: record.category, rawValue: record.rawValue },
            });
            if (existing) {
                existing.normalizedValue = record.normalizedValue;
                existing.occurrences += record.occurrences ?? 1;
                existing.metadata = {
                    ...(existing.metadata ?? {}),
                    ...(record.metadata ?? {}),
                };
                await repo.save(existing);
            } else {
                const pattern = repo.create({
                    category: record.category,
                    rawValue: record.rawValue,
                    normalizedValue: record.normalizedValue,
                    occurrences: record.occurrences ?? 1,
                    metadata: record.metadata,
                });
                await repo.save(pattern);
            }
        }
    } catch (error) {
        dbAvailable = false;
        console.warn('[normalizationRegistry] Falha ao gravar padrões no banco:', error);
    }
};

const storeInRedis = async (records: NormalizationRecord[]) => {
    if (!redisClient) return;
    try {
        const client = await ensureRedisConnection();
        if (!client) return;
        const grouped = records.reduce<Record<string, Array<[string, string]>>>(
            (acc, record) => {
                const key = `normalization:${record.category}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push([record.rawValue, record.normalizedValue]);
                return acc;
            },
            {}
        );
        for (const [hashKey, pairs] of Object.entries(grouped)) {
            await client.hSet(hashKey, Object.fromEntries(pairs));
        }
    } catch (error) {
        console.warn('[normalizationRegistry] Falha ao gravar padrões no Redis:', error);
    }
};

const flushQueue = async () => {
    if (!pending.size) return;
    const batch = Array.from(pending.values());
    pending.clear();
    try {
        await storeInRedis(batch);
        if (dbAvailable) {
            await upsertInDatabase(batch);
        }
    } catch (error) {
        console.warn('[normalizationRegistry] Erro ao processar fila de normalizações:', error);
    }
};

process.on('beforeExit', () => {
    if (!pending.size) return;
    void flushQueue();
});

export type NormalizationSeed = {
    category: NormalizationCategory | string;
    rawValue: string;
    normalizedValue: string;
};

export const primeNormalizationSeeds = async (seeds: NormalizationSeed[]) => {
    if (!seeds.length) return;
    await storeInRedis(seeds);
    await upsertInDatabase(seeds.map(seed => ({ ...seed, occurrences: 1 })));
};

export const getCachedNormalization = async (
    category: NormalizationCategory | string,
    rawValue: string
): Promise<string | null> => {
    if (!redisClient) return null;
    try {
        const client = await ensureRedisConnection();
        if (!client) return null;
        const value = await client.hGet(`normalization:${category}`, rawValue);
        return value ?? null;
    } catch {
        return null;
    }
};
