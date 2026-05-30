import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { humanizeWorldEvent } from '../GameMaster/events/eventHumanizer.js';

const at = new Date('2026-05-29T12:00:00Z');

describe('humanizeWorldEvent', () => {
    it('SESSION_CREATED em português com região', () => {
        const h = humanizeWorldEvent({
            id: '1',
            type: 'SESSION_CREATED',
            payload: {
                nome: 'Crônica do Norte',
                spawnRegionName: 'Porto Corsário',
                spawnRegionSlug: 'porto-corsario',
            },
            createdAt: at,
        });
        assert.ok(h);
        assert.equal(h!.category, 'Início');
        assert.match(h!.summary, /Porto Corsário/);
    });

    it('PLAYER_ACTION_SUBMITTED usa texto do jogador', () => {
        const h = humanizeWorldEvent({
            id: '2',
            type: 'PLAYER_ACTION_SUBMITTED',
            payload: { playerAction: 'Examino as marcas na porta.', actionSequence: 3 },
            createdAt: at,
        });
        assert.ok(h);
        assert.equal(h!.category, 'Ação');
        assert.match(h!.summary, /Examino/);
    });

    it('esconde eventos técnicos', () => {
        const h = humanizeWorldEvent({
            id: '3',
            type: 'TURN_NARRATED',
            payload: {},
            createdAt: at,
        });
        assert.equal(h, null);
    });

    it('HERO_CREATED com nome', () => {
        const h = humanizeWorldEvent({
            id: '4',
            type: 'HERO_CREATED',
            payload: { displayName: 'Aldric' },
            createdAt: at,
        });
        assert.ok(h);
        assert.equal(h!.subject, 'Aldric');
        assert.match(h!.summary, /Aldric/);
    });
});
