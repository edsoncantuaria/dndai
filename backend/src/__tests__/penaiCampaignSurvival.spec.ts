import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { isGoapEligibleTier } from '../GameMaster/database/entities/types/EntityTier.js';
import { defaultEntityTierForType } from '../GameMaster/world/campaignGc.js';
import { ensurePenaiTestDb } from './helpers/penaiTestDb.js';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';
import { SessionMemory } from '../GameMaster/database/entities/SessionMemory.js';
import { SessionKnowledge } from '../GameMaster/database/entities/SessionKnowledge.js';
import { SessionSnapshot } from '../GameMaster/database/entities/SessionSnapshot.js';
import { createGameSession } from '../GameMaster/sessions/sessionService.js';
import { decaySessionMemories } from '../GameMaster/memory/decayPolicy.js';
import { runCampaignGc } from '../GameMaster/world/campaignGc.js';
import { WorldEntity } from '../GameMaster/database/entities/WorldEntity.js';
import { SessionEntityState } from '../GameMaster/database/entities/SessionEntityState.js';
import { randomUUID } from 'crypto';
import { getOrCreateRegionState, adjustRegionResource } from '../GameMaster/world/campaignState.js';
import { applyEventProjection } from '../GameMaster/events/projector.js';
import { loadSessionCampaignView } from '../GameMaster/sessions/sessionCampaignView.js';
import { runRumorTick } from '../GameMaster/world/simulation/ticks/rumorTick.js';
import { saveSessionGameClock } from '../GameMaster/world/gameClock.js';
import { saveSessionAggregateSnapshot } from '../GameMaster/sessions/sessionAggregate.js';
import { startSessionQuest } from '../GameMaster/world/sessionQuests.js';

describe('P7 campaign survival (unit)', () => {
    it('isGoapEligibleTier aceita só HERO e MAJOR', () => {
        assert.equal(isGoapEligibleTier('HERO'), true);
        assert.equal(isGoapEligibleTier('MAJOR'), true);
        assert.equal(isGoapEligibleTier('SECONDARY'), false);
        assert.equal(isGoapEligibleTier('INCIDENTAL'), false);
    });

    it('defaultEntityTierForType mapeia tipos base', () => {
        assert.equal(defaultEntityTierForType('hero'), 'HERO');
        assert.equal(defaultEntityTierForType('monster'), 'CREATURE');
        assert.equal(defaultEntityTierForType('npc'), 'INCIDENTAL');
    });
});

const dbDescribe = process.env.DATABASE_URL ? describe : describe.skip;

dbDescribe('P7 campaign survival (integration)', () => {
    before(async () => {
        const ok = await ensurePenaiTestDb();
        if (!ok) throw new Error('PostgreSQL indisponível');
    });

    it('decaySessionMemories marca memórias abaixo do limiar', async () => {
        const sessionId = 99001;
        const repo = PenaiDataSource.getRepository(SessionMemory);
        await repo.delete({ sessionId });

        await repo.save(
            repo.create({
                sessionId,
                text: 'Memória efêmera',
                importanceScore: 12,
                locale: 'pt-BR',
            }),
        );

        const decayed = await decaySessionMemories(sessionId);
        assert.ok(decayed >= 1);

        const alive = await repo.find({ where: { sessionId } });
        assert.ok(alive.every(r => r.decayedAt != null));
    });

    it('runCampaignGc arquiva NPC INCIDENTAL ocioso (wall clock fallback)', async () => {
        const sessionId = 99002;
        const entityRepo = PenaiDataSource.getRepository(WorldEntity);
        const stateRepo = PenaiDataSource.getRepository(SessionEntityState);

        const entityId = randomUUID();
        await entityRepo.save(
            entityRepo.create({
                id: entityId,
                entityType: 'npc',
                entityTier: 'INCIDENTAL',
                canonical: false,
                slug: `gc-test-${entityId.slice(0, 8)}`,
                displayName: 'Camponês Ocioso',
                stats: {},
                personality: {},
                visual: {},
                source: 'ai_generated',
                locale: 'pt-BR',
            }),
        );

        const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
        await stateRepo.save(
            stateRepo.create({
                sessionId,
                worldEntityId: entityId,
                appeared: false,
                canAppear: true,
                sessionAlive: true,
                lastSeenAt: oldDate,
            }),
        );

        const result = await runCampaignGc(sessionId, { idleDays: 90 });
        assert.ok(result.archived >= 1);

        const st = await stateRepo.findOne({ where: { sessionId, worldEntityId: entityId } });
        assert.equal(st?.canAppear, false);
    });

    it('runCampaignGc usa lastSeenGameDay in-game', async () => {
        const created = await createGameSession({
            userId: 99012,
            nome: 'GC GameDay',
            heroName: 'Ranger',
        });
        const sessionId = Number(created.id);
        await saveSessionGameClock(sessionId, { day: 100, hour: 8, weather: 'clear' });

        const entityRepo = PenaiDataSource.getRepository(WorldEntity);
        const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
        const entityId = randomUUID();
        await entityRepo.save(
            entityRepo.create({
                id: entityId,
                entityType: 'npc',
                entityTier: 'INCIDENTAL',
                canonical: false,
                slug: `gc-day-${entityId.slice(0, 8)}`,
                displayName: 'Viajante Esquecido',
                stats: {},
                personality: {},
                visual: {},
                source: 'ai_generated',
                locale: 'pt-BR',
            }),
        );
        await stateRepo.save(
            stateRepo.create({
                sessionId,
                worldEntityId: entityId,
                appeared: false,
                canAppear: true,
                sessionAlive: true,
                lastSeenGameDay: 1,
            }),
        );

        const result = await runCampaignGc(sessionId, { idleDays: 90 });
        assert.ok(result.archived >= 1);
    });

    it('runRumorTick popula session_knowledge quando há presentes', async () => {
        const created = await createGameSession({
            userId: 99013,
            nome: 'Rumor Test',
            heroName: 'Bardo',
        });
        const sessionId = Number(created.id);
        const entityId = randomUUID();
        const entityRepo = PenaiDataSource.getRepository(WorldEntity);
        const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
        await entityRepo.save(
            entityRepo.create({
                id: entityId,
                entityType: 'npc',
                entityTier: 'SECONDARY',
                canonical: false,
                slug: `rumor-${entityId.slice(0, 8)}`,
                displayName: 'Taverneiro',
                stats: {},
                personality: {},
                visual: {},
                source: 'ai_generated',
                locale: 'pt-BR',
            }),
        );
        await stateRepo.save(
            stateRepo.create({
                sessionId,
                worldEntityId: entityId,
                appeared: true,
                sessionAlive: true,
                canAppear: true,
            }),
        );

        await PenaiDataSource.getRepository(SessionKnowledge).delete({ sessionId });
        await runRumorTick(sessionId, 'vales-do-norte');

        const rows = await PenaiDataSource.getRepository(SessionKnowledge).find({
            where: { sessionId, source: 'rumor' },
        });
        assert.ok(rows.length >= 1);
    });

    it('projector CREATURE_SLAIN reduz wolfStock na campanha', async () => {
        const sessionId = 99003;
        const regionSlug = 'test-region-p7';
        await getOrCreateRegionState(sessionId, regionSlug);
        await adjustRegionResource(sessionId, regionSlug, 'wolfStock', 20);

        await applyEventProjection({
            id: 1,
            sessionId,
            type: 'CREATURE_SLAIN',
            payload: { regionSlug, qty: 3, creatureSlug: 'wolf' },
            actorEntityId: null,
            createdAt: new Date(),
        } as never);

        const row = await getOrCreateRegionState(sessionId, regionSlug);
        assert.equal(row.resources?.wolfStock, 17);
    });

    it('loadSessionCampaignView retorna visão enriquecida', async () => {
        const sessionId = 99003;
        await startSessionQuest({
            sessionId,
            questSlug: 'test-quest',
            title: 'Quest de teste',
        });
        const view = await loadSessionCampaignView(sessionId);
        assert.equal(view.sessionId, sessionId);
        assert.ok(Array.isArray(view.knowledgeSnippets));
        assert.ok(view.gameClock.day >= 1);
    });

    it('saveSessionAggregateSnapshot persiste snapshot', async () => {
        const sessionId = 99014;
        const repo = PenaiDataSource.getRepository(SessionSnapshot);
        await repo.delete({ sessionId });
        await saveSessionAggregateSnapshot(sessionId, 5);
        const count = await repo.count({ where: { sessionId } });
        assert.ok(count >= 1);
    });
});
