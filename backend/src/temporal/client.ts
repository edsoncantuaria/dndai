import { Client, Connection } from '@temporalio/client';
import { penaiEnv } from '../config/penaiEnv.js';
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
    const client = await getTemporalClient();
    if (!client) {
        const { runTurnPipeline } = await import('../GameMaster/engine/turnPipeline.js');
        await runTurnPipeline(input);
        return { workflowId, started: false, sync: true };
    }
    await client.workflow.start('narrationWorkflow', {
        taskQueue: 'penai-narration',
        workflowId,
        args: [input],
        workflowIdConflictPolicy: 'USE_EXISTING',
    });
    return { workflowId, started: true };
}

export async function startMemoryCompactionWorkflow(input: {
    sessionId: number;
    fromActionSequence: number;
    toActionSequence: number;
}): Promise<{ workflowId: string; started: boolean }> {
    const workflowId = `memory:${input.sessionId}:${input.toActionSequence}`;
    const client = await getTemporalClient();
    if (!client) {
        const { compactSessionMemory } = await import('./activities/memoryCompactionActivity.js');
        await compactSessionMemory(input);
        return { workflowId, started: false };
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
    travel: 60_000,
    'long-rest': 60_000,
    manual: 30_000,
    turn: 3_600_000,
};
const pulseLastRun = new Map<string, number>();

export async function startWorldPulseWorkflow(
    sessionId: number,
    trigger: 'travel' | 'long-rest' | 'manual' | 'turn' = 'manual',
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
        const { projectWorldPulse } = await import('./activities/worldPulseActivity.js');
        await projectWorldPulse(sessionId);
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
