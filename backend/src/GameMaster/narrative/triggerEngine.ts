import triggerCatalogJson from '../../../data/narrativeTriggers.pt-BR.json' with { type: 'json' };
import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { appendWorldEvent } from '../events/store.js';
import { loadSessionAggregate } from '../sessions/sessionAggregate.js';
import { recordProvenanceFact } from '../memory/provenanceMemory.js';
import { startSessionQuest } from '../world/sessionQuests.js';
import { maybeScheduleWorldPulse } from '../world/simulation/pulseSchedule.js';
import {
    getShardPoliticsState,
    setShardPoliticsState,
    type ShardPoliticsState,
} from '../world/politicsState.js';
import { resolveSessionShardId } from '../world/shardResolver.js';
import {
    buildNarrativeTriggerContext,
    readTriggerPath,
    type NarrativeTriggerContext,
} from './triggerContext.js';
import {
    narrativeTriggerCatalogSchema,
    type NarrativeTriggerRule,
    type TriggerAction,
    type TriggerCondition,
} from './triggerSchema.js';

const TRIGGER_CATALOG = narrativeTriggerCatalogSchema.parse(triggerCatalogJson);

let evaluating = false;

function compareValues(left: unknown, op: TriggerCondition['op'], right: unknown): boolean {
    if (left === undefined || left === null) return false;
    if (typeof left === 'number' && typeof right === 'number') {
        switch (op) {
            case 'eq':
                return left === right;
            case 'neq':
                return left !== right;
            case 'gt':
                return left > right;
            case 'gte':
                return left >= right;
            case 'lt':
                return left < right;
            case 'lte':
                return left <= right;
        }
    }
    if (typeof left === 'string' && typeof right === 'string') {
        if (op === 'eq') return left === right;
        if (op === 'neq') return left !== right;
    }
    if (op === 'eq') return left === right;
    if (op === 'neq') return left !== right;
    return false;
}

export function evaluateTriggerConditions(
    ctx: NarrativeTriggerContext,
    rule: NarrativeTriggerRule,
): boolean {
    return rule.when.all.every(cond => {
        const value = readTriggerPath(ctx, cond.path);
        return compareValues(value, cond.op, cond.value);
    });
}

export async function hasTriggerFired(sessionId: number, ruleId: string): Promise<boolean> {
    const repo = PenaiDataSource.getRepository(WorldEvent);
    const row = await repo
        .createQueryBuilder('e')
        .where('e.sessionId = :sessionId', { sessionId })
        .andWhere('e.type = :type', { type: 'NARRATIVE_TRIGGER_FIRED' })
        .andWhere("e.payload->>'ruleId' = :ruleId", { ruleId })
        .getOne();
    return Boolean(row);
}

async function executeTriggerAction(
    sessionId: number,
    ctx: NarrativeTriggerContext,
    action: TriggerAction,
): Promise<void> {
    switch (action.action) {
        case 'startQuest':
            await startSessionQuest({
                sessionId,
                questSlug: action.questSlug,
                title: action.title,
                payload: {
                    ...(action.payload ?? {}),
                    regionSlug: ctx.regionSlug ?? undefined,
                },
            });
            break;
        case 'schedulePulse':
            await maybeScheduleWorldPulse(sessionId, action.trigger, {
                source: 'narrative_trigger',
            });
            break;
        case 'setShardPolitics': {
            if (!ctx.shardId) return;
            const current = await getShardPoliticsState(ctx.shardId);
            const next = action.state as ShardPoliticsState;
            if (current === next) return;
            await setShardPoliticsState(ctx.shardId, next);
            await appendWorldEvent({
                type: 'POLITICS_STATE_CHANGED',
                sessionId,
                payload: {
                    shardId: ctx.shardId,
                    from: current,
                    to: next,
                    regionSlug: ctx.regionSlug ?? '',
                    source: 'narrative_trigger',
                },
            });
            break;
        }
        case 'recordFact':
            await recordProvenanceFact({ sessionId, text: action.text });
            break;
        default:
            break;
    }
}

async function fireTriggerRule(
    sessionId: number,
    ctx: NarrativeTriggerContext,
    rule: NarrativeTriggerRule,
): Promise<void> {
    if (rule.once?.perSession && (await hasTriggerFired(sessionId, rule.id))) {
        return;
    }
    if (!evaluateTriggerConditions(ctx, rule)) return;

    for (const action of rule.then) {
        await executeTriggerAction(sessionId, ctx, action);
    }

    await appendWorldEvent({
        type: 'NARRATIVE_TRIGGER_FIRED',
        sessionId,
        payload: {
            ruleId: rule.id,
            eventType: ctx.eventType,
        },
    });
}

export async function evaluateNarrativeTriggers(opts: {
    sessionId: number;
    eventType: string;
    eventPayload?: Record<string, unknown>;
}): Promise<void> {
    if (evaluating) return;
    if (opts.eventType === 'NARRATIVE_TRIGGER_FIRED') return;

    evaluating = true;
    try {
        const aggregate = await loadSessionAggregate(opts.sessionId);
        const shardId = await resolveSessionShardId(opts.sessionId);
        const shardPoliticsState = shardId
            ? await getShardPoliticsState(shardId)
            : ('stable' as ShardPoliticsState);

        const ctx = buildNarrativeTriggerContext({
            sessionId: opts.sessionId,
            eventType: opts.eventType,
            eventPayload: opts.eventPayload ?? {},
            aggregate,
            shardId,
            shardPoliticsState,
        });

        const rules = TRIGGER_CATALOG.filter(
            r => r.on.includes(opts.eventType) || r.on.includes('*'),
        );

        for (const rule of rules) {
            await fireTriggerRule(opts.sessionId, ctx, rule);
        }
    } finally {
        evaluating = false;
    }
}

/** Exporta catálogo parseado para testes unitários. */
export function getNarrativeTriggerCatalog(): NarrativeTriggerRule[] {
    return TRIGGER_CATALOG;
}
