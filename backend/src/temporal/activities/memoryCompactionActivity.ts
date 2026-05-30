import { PenaiDataSource } from '../../GameMaster/database/data-source.js';
import { SessionMemory } from '../../GameMaster/database/entities/SessionMemory.js';
import { NarrativeSummary } from '../../GameMaster/database/entities/NarrativeSummary.js';
import { decaySessionMemories } from '../../GameMaster/memory/decayPolicy.js';

export async function compactSessionMemory(input: {
    sessionId: number;
    fromActionSequence: number;
    toActionSequence: number;
}): Promise<string> {
    const decayed = await decaySessionMemories(input.sessionId);
    const memRepo = PenaiDataSource.getRepository(SessionMemory);
    const rows = await memRepo.find({
        where: { sessionId: input.sessionId },
        order: { createdAt: 'ASC' },
        take: 24,
    });

    if (!rows.length) return 'sem_memorias';

    const summaryText = rows
        .map(r => r.text)
        .join(' ')
        .slice(0, 1200);

    const summaryRepo = PenaiDataSource.getRepository(NarrativeSummary);
    await summaryRepo.save(
        summaryRepo.create({
            sessionId: input.sessionId,
            summary: summaryText,
            fromActionSequence: input.fromActionSequence,
            toActionSequence: input.toActionSequence,
            locale: 'pt-BR',
        }),
    );

    return `compactado:${rows.length}:decayed:${decayed}`;
}
