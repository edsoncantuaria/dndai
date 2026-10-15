import assert from 'node:assert/strict';
import test from 'node:test';
import {
    evaluateTriggerConditions,
    getNarrativeTriggerCatalog,
} from '../GameMaster/narrative/triggerEngine.js';
import { buildNarrativeTriggerContext } from '../GameMaster/narrative/triggerContext.js';
import type { SessionAggregateView } from '../GameMaster/sessions/sessionAggregate.js';

const baseAggregate = (): SessionAggregateView => ({
    sessionId: 1,
    regionSlug: 'cidadela-do-aco-luz',
    regionState: { fear: 65, prosperity: 50, crime: 30, resources: {} },
    activeQuests: [],
    heroReputation: [],
    reputation: { region: null, factions: [{ factionSlug: 'guilda', score: -25, tierId: 'hostile', tierLabel: 'Hostil', displayName: 'Guilda', archetype: 'trade', discoveredAt: '' }] },
    knowledgeCount: 0,
});

test('narrativeTriggerEngine: politics-tense dispara com fear>=60 e goal expand', () => {
    const rule = getNarrativeTriggerCatalog().find(r => r.id === 'politics-tense');
    assert.ok(rule);
    const ctx = buildNarrativeTriggerContext({
        sessionId: 1,
        eventType: 'FACTION_TICK',
        eventPayload: { goal: 'expand', regionSlug: 'cidadela-do-aco-luz' },
        aggregate: baseAggregate(),
        shardId: 'shard-1',
        shardPoliticsState: 'stable',
    });
    assert.equal(evaluateTriggerConditions(ctx, rule!), true);
});

test('narrativeTriggerEngine: politics-tense não dispara com fear baixo', () => {
    const rule = getNarrativeTriggerCatalog().find(r => r.id === 'politics-tense');
    assert.ok(rule);
    const agg = baseAggregate();
    agg.regionState = { fear: 40, prosperity: 50, crime: 30, resources: {} };
    const ctx = buildNarrativeTriggerContext({
        sessionId: 1,
        eventType: 'FACTION_TICK',
        eventPayload: { goal: 'expand' },
        aggregate: agg,
        shardId: 'shard-1',
        shardPoliticsState: 'stable',
    });
    assert.equal(evaluateTriggerConditions(ctx, rule!), false);
});

test('narrativeTriggerEngine: hostile-faction-quest com reputação <= -20', () => {
    const rule = getNarrativeTriggerCatalog().find(r => r.id === 'hostile-faction-quest');
    assert.ok(rule);
    const ctx = buildNarrativeTriggerContext({
        sessionId: 1,
        eventType: 'FACTION_TICK',
        eventPayload: {},
        aggregate: baseAggregate(),
        shardId: null,
        shardPoliticsState: 'stable',
    });
    assert.equal(evaluateTriggerConditions(ctx, rule!), true);
});

test('narrativeTriggerEngine: high-fear-pulse com fear>=70', () => {
    const rule = getNarrativeTriggerCatalog().find(r => r.id === 'high-fear-pulse');
    assert.ok(rule);
    const agg = baseAggregate();
    agg.regionState = { fear: 72, prosperity: 50, crime: 30, resources: {} };
    const ctx = buildNarrativeTriggerContext({
        sessionId: 1,
        eventType: 'REGION_MOOD_CHANGED',
        eventPayload: {},
        aggregate: agg,
        shardId: null,
        shardPoliticsState: 'stable',
    });
    assert.equal(evaluateTriggerConditions(ctx, rule!), true);
});
