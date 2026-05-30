import type { TurnPipelineInput } from '../../GameMaster/engine/turnPipeline.js';

export async function runTurnPipelineActivity(
    input: TurnPipelineInput,
): Promise<{ narration: string }> {
    const { runTurnPipeline } = await import('../../GameMaster/engine/turnPipeline.js');
    const result = await runTurnPipeline(input);
    return { narration: result.narration };
}
