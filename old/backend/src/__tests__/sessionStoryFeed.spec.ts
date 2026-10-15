import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { penaiIntegrationDescribe } from './helpers/penaiIntegrationDescribe.js';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';
import { SessionMemory } from '../GameMaster/database/entities/SessionMemory.js';
import { createGameSession } from '../GameMaster/sessions/sessionService.js';
import {
    listSessionStoryFeed,
    listSessionWorldRegistro,
} from '../GameMaster/sessions/sessionStoryFeed.js';

penaiIntegrationDescribe('sessionStoryFeed (integration)', () => {
    it('listSessionStoryFeed exclui system; listSessionWorldRegistro inclui system', async () => {
        const userId = 90100;
        const created = await createGameSession({
            userId,
            nome: 'Story Feed Filter',
            heroName: 'Test Hero',
        });
        const sessionId = Number(created.id);
        assert.ok(Number.isFinite(sessionId));

        const repo = PenaiDataSource.getRepository(SessionMemory);
        await repo.delete({ sessionId });

        const narration = await repo.save(
            repo.create({
                sessionId,
                text: 'O vento sopra nas colinas.',
                storyKind: 'narration',
                locale: 'pt-BR',
            }),
        );
        const system = await repo.save(
            repo.create({
                sessionId,
                text: '[MUNDO] Aurathis: economia estável na região.',
                storyKind: 'system',
                locale: 'pt-BR',
            }),
        );

        const feed = await listSessionStoryFeed(sessionId, userId);
        const feedIds = feed.entries.map(e => e.id);
        assert.ok(feedIds.includes(narration.id));
        assert.ok(!feedIds.includes(system.id));

        const registro = await listSessionWorldRegistro(sessionId, userId);
        const registroIds = registro.entries.map(e => e.id);
        assert.ok(!registroIds.includes(narration.id));
        assert.ok(registroIds.includes(system.id));
        assert.match(registro.entries[0]?.content ?? '', /\[MUNDO\]/);
    });
});
