import { appendWorldEvent } from '../events/store.js';

export async function appendJournalEntry(opts: {
    sessionId: number;
    heroEntityId?: string;
    title: string;
    body: string;
    tags?: string[];
}): Promise<void> {
    await appendWorldEvent({
        type: 'JOURNAL_ENTRY',
        sessionId: opts.sessionId,
        actorEntityId: opts.heroEntityId ?? null,
        payload: {
            title: opts.title,
            body: opts.body,
            tags: opts.tags ?? [],
        },
        canonCandidate: true,
    });
}

export async function appendFactionReputationDelta(opts: {
    sessionId: number;
    factionSlug: string;
    delta: number;
    reason: string;
}): Promise<void> {
    await appendWorldEvent({
        type: 'FACTION_REPUTATION',
        sessionId: opts.sessionId,
        payload: {
            factionSlug: opts.factionSlug,
            delta: opts.delta,
            reason: opts.reason,
        },
        canonCandidate: true,
    });
}
