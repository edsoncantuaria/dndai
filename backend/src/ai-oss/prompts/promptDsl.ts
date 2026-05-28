import type { GameMasterFlowInput } from '../../schemas/gameSchemas.js';
import { buildCombatSystemInstruction } from '../combat/deterministicCombat.js';
import {
    appendPhaseTemplateToSystem,
    detectPromptPhase,
    type PromptPhase,
} from './phaseTemplates.js';
import { isOssMinimalNarrationEnabled } from '../../config/ossMinimalNarration.js';
import { OSS_FORMAT_SYSTEM } from './system/format.js';
import { OSS_MINIMAL_FORMAT_SYSTEM } from './system/formatMinimal.js';
import { buildNarrativeCharacterCard } from '../context/narrativeCharacterCard.js';
import { composeOssPrompt } from './promptComposer.js';

export type PromptOutputSchema = 'narration' | 'combat';

export type ComposePromptInput = {
    scene?: string;
    player: string;
    combat?: boolean;
    memory?: string;
    log?: string;
    characterName?: string;
    outputSchema?: PromptOutputSchema;
    flowInput?: GameMasterFlowInput;
    antiLoopHint?: string;
};

/**
 * DSL unificado de prompts OSS — delega ao composer runtime com system por domínio.
 */
export function composePrompt(input: ComposePromptInput): {
    systemInstruction: string;
    userPrompt: string;
    outputSchema: PromptOutputSchema;
    phase: PromptPhase;
} {
    const combatActive = Boolean(input.combat ?? input.flowInput?.combatState?.isActive);
    const phase: PromptPhase = detectPromptPhase({
        playerAction: input.player,
        combatActive,
        flowInput: input.flowInput,
    });
    const outputSchema: PromptOutputSchema =
        input.outputSchema ?? (phase === 'combat' ? 'combat' : 'narration');

    const memoryBlock = [input.memory, input.scene].filter(Boolean).join(' | ');

    const characterRecord = input.flowInput?.character as Record<string, unknown> | undefined;
    const characterCard =
        characterRecord && typeof characterRecord === 'object'
            ? buildNarrativeCharacterCard(characterRecord)
            : '';

    const composed = composeOssPrompt({
        playerAction: input.player,
        compactGameLog: input.log,
        combatActive: phase === 'combat',
        characterName: input.characterName ?? (typeof characterRecord?.name === 'string' ? characterRecord.name : undefined),
        characterCard: characterCard || undefined,
        sceneSummary: memoryBlock || input.scene,
        antiLoopHint: input.antiLoopHint,
        flowInput: input.flowInput,
    });

    const useMinimal = isOssMinimalNarrationEnabled();
    let systemInstruction = useMinimal
        ? OSS_MINIMAL_FORMAT_SYSTEM
        : outputSchema === 'combat'
          ? buildCombatSystemInstruction()
          : OSS_FORMAT_SYSTEM;
    if (!useMinimal) {
        systemInstruction = composed.systemInstruction || systemInstruction;
    }
    systemInstruction = appendPhaseTemplateToSystem(systemInstruction, phase);

    return {
        systemInstruction,
        userPrompt: composed.userPrompt,
        outputSchema,
        phase,
    };
}

/** Snapshot estável para testes (ordem de linhas fixa). */
export function composePromptSnapshot(input: ComposePromptInput): string {
    const { systemInstruction, userPrompt, outputSchema } = composePrompt(input);
    return [
        `schema=${outputSchema}`,
        '---system---',
        systemInstruction.trim(),
        '---user---',
        userPrompt.trim(),
    ].join('\n');
}
