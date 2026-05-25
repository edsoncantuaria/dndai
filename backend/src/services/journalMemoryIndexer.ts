import { randomUUID } from 'crypto';
import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import redisClient from '../database/redis-client.js';
import { storeMemory } from './vectorMemoryService.js';
import { shouldEmbedForOperation } from './embeddingPolicy.js';

type JournalEntry = {
    id?: string;
    name?: string;
    region?: string;
    summary?: string;
    looted?: boolean;
};

const indexedKey = (sessaoId: number) => `oss:journal-indexed:${sessaoId}`;

async function loadIndexedIds(sessaoId: number): Promise<Set<string>> {
    if (!redisClient?.isOpen) return new Set();
    try {
        const members = await redisClient.sMembers(indexedKey(sessaoId));
        return new Set(members);
    } catch {
        return new Set();
    }
}

async function markIndexed(sessaoId: number, entryId: string): Promise<void> {
    if (!redisClient?.isOpen) return;
    try {
        await redisClient.sAdd(indexedKey(sessaoId), entryId);
        await redisClient.expire(indexedKey(sessaoId), 60 * 60 * 24 * 90);
    } catch (error) {
        console.warn('[journalMemoryIndexer] Falha ao marcar journal indexado:', error);
    }
}

/**
 * Indexa entradas novas do journal do personagem no Qdrant (objetivos/quests).
 */
export async function indexNewJournalEntries(params: {
    sessaoId: number;
    characterId: number;
    apiKey: string;
    stateVersion: number;
    regionSlug?: string | null;
}): Promise<number> {
    const { sessaoId, characterId, apiKey, stateVersion, regionSlug } = params;
    if (!AppDataSource.isInitialized) return 0;

    const character = await AppDataSource.getRepository(Character).findOne({
        where: { id: characterId },
        select: ['id', 'journal'],
    });
    const journal = Array.isArray(character?.journal) ? (character!.journal as JournalEntry[]) : [];
    if (!journal.length) return 0;

    const indexed = await loadIndexedIds(sessaoId);
    const embed = shouldEmbedForOperation('store_journal', stateVersion, 0);
    let stored = 0;

    for (const entry of journal) {
        const id = typeof entry.id === 'string' ? entry.id : randomUUID();
        if (indexed.has(id)) continue;
        if (entry.looted) {
            await markIndexed(sessaoId, id);
            continue;
        }
        const name = entry.name?.trim() || 'Objetivo';
        const region = entry.region?.trim() || regionSlug || 'desconhecida';
        const summary = entry.summary?.trim() || name;
        const text = `Journal | ${name} (${region}): ${summary}`;

        await storeMemory(
            'session_memories',
            text,
            {
                id: randomUUID(),
                sessionId: String(sessaoId),
                type: 'journal',
                journalEntryId: id,
                timestamp: Date.now(),
                summary: `${name}: ${summary.slice(0, 120)}`,
            },
            apiKey,
            { embed, reason: embed ? 'journal_new' : 'journal_deferred' },
        );
        await markIndexed(sessaoId, id);
        stored += 1;
    }

    if (stored > 0) {
        console.log(`[journalMemoryIndexer] ${stored} entrada(s) de journal indexadas (sessão ${sessaoId}).`);
    }
    return stored;
}
