import { Client, Connection } from '@temporalio/client';
import { penaiEnv } from '../config/penaiEnv.js';
import { penaiPipelineLog } from '../GameMaster/infra/pipelineLog.js';
import type { NarrationWorkflowInput } from './workflows/narrationWorkflow.js';

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client | null> {
    if (penaiEnv.TEMPORAL_DISABLED) return null;
    if (client) return client;
    try {
        const connection = await Connection.connect({ address: penaiEnv.TEMPORAL_ADDRESS });
        client = new Client({ connection, namespace: penaiEnv.TEMPORAL_NAMESPACE });
        return client;
    } catch (e) {
        console.warn('[PENAI][Temporal] Cliente indisponível:', e);
        return null;
    }
}

export async function checkTemporalHealth(): Promise<{ ok: boolean; message: string }> {
    if (penaiEnv.TEMPORAL_DISABLED) return { ok: true, message: 'desabilitado (dev)' };
    const c = await getTemporalClient();
    if (!c) return { ok: false, message: 'cliente não conectou' };
    return { ok: true, message: 'Temporal OK' };
}

export async function startNarrationWorkflow(
    input: NarrationWorkflowInput,
): Promise<{ workflowId: string; started: boolean; sync?: boolean }> {
    const workflowId = `narration:${input.sessionId}:${input.actionSequence}`;
    const ctx = {
        sessionId: input.sessionId,
        userId: input.userId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
    };

    if (penaiEnv.TEMPORAL_DISABLED) {
        const { runTurnPipeline } = await import('../GameMaster/engine/turnPipeline.js');
        penaiPipelineLog('TEMPORAL', 'TEMPORAL_DISABLED — narração síncrona (testes)', undefined, ctx);
        await runTurnPipeline(input);
        return { workflowId, started: false, sync: true };
    }

    const client = await getTemporalClient();
    if (!client) {
        const msg =
            'Temporal indisponível. Suba o servidor Temporal e o worker (npm run worker:temporal ou serviço temporal-worker-dev).';
        penaiPipelineLog('TEMPORAL', msg, undefined, ctx);
        throw new Error(msg);
    }
    try {
        penaiPipelineLog('TEMPORAL', `iniciando workflow ${workflowId}`, undefined, ctx);
        await client.workflow.start('narrationWorkflow', {
            taskQueue: 'penai-narration',
            workflowId,
            args: [input],
            workflowIdConflictPolicy: 'USE_EXISTING',
        });
        penaiPipelineLog('TEMPORAL', 'workflow enfileirado no worker', { workflowId }, ctx);
        return { workflowId, started: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Namespace not found') || msg.includes('NamespaceNotFound')) {
            throw new Error(
                `Namespace Temporal "${penaiEnv.TEMPORAL_NAMESPACE}" ausente. Crie o namespace ou ajuste TEMPORAL_NAMESPACE.`,
            );
        }
        throw e;
    }
}

export async function startMemoryCompactionWorkflow(input: {
    sessionId: number;
    fromActionSequence: number;
    toActionSequence: number;
}): Promise<{ workflowId: string; started: boolean }> {
    const workflowId = `memory:${input.sessionId}:${input.toActionSequence}`;
    if (penaiEnv.TEMPORAL_DISABLED) {
        const { compactSessionMemory } = await import('./activities/memoryCompactionActivity.js');
        await compactSessionMemory(input);
        return { workflowId, started: false };
    }

    const client = await getTemporalClient();
    if (!client) {
        throw new Error(
            'Temporal indisponível para compactação de memória. Inicie o worker Temporal.',
        );
    }
    await client.workflow.start('memoryCompactionWorkflow', {
        taskQueue: 'penai-narration',
        workflowId,
        args: [input],
        workflowIdConflictPolicy: 'USE_EXISTING',
    });
    return { workflowId, started: true };
}

export async function startCanonApprovalWorkflow(proposalId: string): Promise<{ workflowId: string }> {
    const workflowId = `canon:${proposalId}`;
    const client = await getTemporalClient();
    if (!client) {
        const { persistCanonApproval } = await import('./activities/canonApprovalActivity.js');
        await persistCanonApproval(proposalId);
        return { workflowId: `sync:${workflowId}` };
    }
    await client.workflow.start('canonApprovalWorkflow', {
        taskQueue: 'penai-narration',
        workflowId,
        args: [proposalId],
        workflowIdConflictPolicy: 'USE_EXISTING',
    });
    return { workflowId };
}

export async function startHealthWorkflow(name: string): Promise<string> {
    const client = await getTemporalClient();
    if (!client) return `sync:${name}`;
    const handle = await client.workflow.execute('healthWorkflow', {
        taskQueue: 'penai-narration',
        workflowId: `health:${Date.now()}`,
        args: [name],
    });
    return handle as string;
}

const pulseDebounceMsByTrigger: Record<string, number> = {
    travel: 30_000,
    'long-rest': 30_000,
    manual: 20_000,
    combat_end: 45_000,
    quest_major: 60_000,
    game_day: 120_000,
};
const pulseLastRun = new Map<string, number>();

export async function startWorldPulseWorkflow(
    sessionId: number,
    trigger:
        | 'travel'
        | 'long-rest'
        | 'manual'
        | 'combat_end'
        | 'quest_major'
        | 'game_day' = 'manual',
    _meta?: Record<string, unknown>,
): Promise<{ workflowId: string; started: boolean }> {
    const now = Date.now();
    const key = `${sessionId}:${trigger}`;
    const debounce = pulseDebounceMsByTrigger[trigger] ?? 120_000;
    const last = pulseLastRun.get(key) ?? 0;
    if (now - last < debounce) {
        return { workflowId: `debounced:${sessionId}:${trigger}`, started: false };
    }
    pulseLastRun.set(key, now);

    const workflowId = `worldPulse:${sessionId}:${trigger}:${now}`;
    const client = await getTemporalClient();
    if (!client) {
        const { publishWorldPulse } = await import('../GameMaster/world/publishWorldPulse.js');
        await publishWorldPulse(sessionId, { bootstrap: true });
        return { workflowId, started: false };
    }
    await client.workflow.start('worldPulseWorkflow', {
        taskQueue: 'penai-narration',
        workflowId,
        args: [sessionId],
        workflowIdConflictPolicy: 'USE_EXISTING',
    });
    return { workflowId, started: true };
}

export async function startWorldBootstrapWorkflow(
    sessionId: number,
): Promise<{ workflowId: string; started: boolean; sync?: boolean }> {
    const workflowId = `worldBootstrap:${sessionId}`;
    const ctx = { sessionId };

    if (penaiEnv.TEMPORAL_DISABLED) {
        const { runSessionWorldBootstrap } = await import('../GameMaster/world/buildSessionWorld.js');
        penaiPipelineLog('TEMPORAL', 'bootstrap síncrono (TEMPORAL_DISABLED)', undefined, ctx);
        await runSessionWorldBootstrap(sessionId);
        return { workflowId, started: false, sync: true };
    }

    const client = await getTemporalClient();
    if (!client) {
        const { runSessionWorldBootstrap } = await import('../GameMaster/world/buildSessionWorld.js');
        penaiPipelineLog('TEMPORAL', 'Temporal off — bootstrap síncrono', undefined, ctx);
        await runSessionWorldBootstrap(sessionId);
        return { workflowId, started: false, sync: true };
    }

    try {
        await client.workflow.start('worldBootstrapWorkflow', {
            taskQueue: 'penai-narration',
            workflowId,
            args: [sessionId],
            workflowIdConflictPolicy: 'USE_EXISTING',
        });
        penaiPipelineLog('TEMPORAL', 'worldBootstrap enfileirado', { workflowId }, ctx);
        return { workflowId, started: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Workflow execution already started') || msg.includes('USE_EXISTING')) {
            return { workflowId, started: true };
        }
        throw e;
    }
}

export async function startCampaignGcWorkflow(
    sessionId: number,
): Promise<{ workflowId: string; started: boolean }> {
    const workflowId = `campaignGc:${sessionId}:${Date.now()}`;
    const client = await getTemporalClient();
    if (!client) {
        const { runCampaignGcActivity } = await import('./activities/campaignGcActivity.js');
        await runCampaignGcActivity(sessionId);
        return { workflowId, started: false };
    }
    await client.workflow.start('campaignGcWorkflow', {
        taskQueue: 'penai-narration',
        workflowId,
        args: [sessionId],
        workflowIdConflictPolicy: 'USE_EXISTING',
    });
    return { workflowId, started: true };
}

const shardTickLastRun = new Map<string, number>();
const SHARD_TICK_DEBOUNCE_MS = 300_000;

export async function startShardBackgroundWorkflow(
    shardId: string,
): Promise<{ workflowId: string; started: boolean }> {
    const now = Date.now();
    const last = shardTickLastRun.get(shardId) ?? 0;
    if (now - last < SHARD_TICK_DEBOUNCE_MS) {
        return { workflowId: `debounced:shard:${shardId}`, started: false };
    }
    shardTickLastRun.set(shardId, now);

    const workflowId = `shardBackground:${shardId}:${now}`;
    const client = await getTemporalClient();
    if (!client) {
        const { runShardBackgroundTickActivity } = await import('./activities/shardBackgroundTick.js');
        await runShardBackgroundTickActivity(shardId);
        return { workflowId, started: false };
    }
    await client.workflow.start('shardBackgroundWorkflow', {
        taskQueue: 'penai-narration',
        workflowId,
        args: [shardId],
        workflowIdConflictPolicy: 'USE_EXISTING',
    });
    return { workflowId, started: true };
}
