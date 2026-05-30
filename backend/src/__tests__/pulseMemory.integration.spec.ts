import test from 'node:test';
import assert from 'node:assert/strict';

const dbUrl = process.env.DATABASE_URL ?? process.env.PENAI_DATABASE_URL;

test(
    'pulseMemory: bootstrap quest → FACT_RECORDED → recall no turno',
    { skip: !dbUrl || dbUrl.includes('mock') ? 'DATABASE_URL ausente' : false },
    async () => {
        const { initPenaiDatabase, PenaiDataSource } = await import(
            '../GameMaster/database/data-source.js'
        );
        await initPenaiDatabase();

        const { recordProvenanceFact } = await import('../GameMaster/memory/provenanceMemory.js');
        const { buildNarrativeWorldConsult } = await import(
            '../GameMaster/memory/narrativeContextDto.js'
        );
        const { GameSession } = await import('../GameMaster/database/entities/GameSession.js');

        const repo = PenaiDataSource.getRepository(GameSession);
        const session = await repo.save(
            repo.create({
                userId: 1,
                nome: 'Teste P9 memória',
                locale: 'pt-BR',
                currentRegionSlug: 'porto-verde',
            }),
        );

        await recordProvenanceFact({
            sessionId: session.id,
            text: 'Um mercador desapareceu na estrada.',
            regionSlug: 'porto-verde',
            sourceEventType: 'FACT_RECORDED',
        });

        const consult = await buildNarrativeWorldConsult(session.id);
        assert.ok(
            consult.mandatedFacts.some(f => f.includes('[FATO]') && f.includes('mercador')),
            'fato com proveniência deve aparecer nos mandatos',
        );

        await repo.delete({ id: session.id });
    },
);
