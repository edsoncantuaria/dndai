import { publishWorldPulse } from './publishWorldPulse.js';
import { penaiPipelineLog } from '../infra/pipelineLog.js';
import { startWorldPulseWorkflow } from '../../temporal/client.js';

export type WorldPulseBootstrapResult = {
    workflowId: string;
    started: boolean;
};

/** Agenda pulso inicial da sessão (simulação + WS). Logs detalhados em publishWorldPulse. */
export async function bootstrapSessionWorldPulse(sessionId: number): Promise<WorldPulseBootstrapResult> {
    const ctx = { sessionId };
    penaiPipelineLog('WORLD_PULSE', 'bootstrap — agendando pulso inicial…', undefined, ctx);

    const wf = await startWorldPulseWorkflow(sessionId, 'manual');
    if (!wf.started) {
        await publishWorldPulse(sessionId, { bootstrap: true });
    }

    penaiPipelineLog(
        'WORLD_PULSE',
        wf.started ? 'workflow enfileirado' : 'pulso síncrono concluído',
        { workflowId: wf.workflowId },
        ctx,
    );

    return { workflowId: wf.workflowId, started: wf.started };
}
