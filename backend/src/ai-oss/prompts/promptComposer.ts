import { OSS_FORMAT_SYSTEM } from './system/format.js';
import { buildCombatSystemInstruction, buildCombatSceneHint } from '../combat/deterministicCombat.js';
import type { GameMasterFlowInput } from '../../schemas/gameSchemas.js';

export type ComposePromptInput = {
    playerAction: string;
    sceneSummary?: string;
    combatActive?: boolean;
    compactGameLog?: string;
    characterName?: string;
    antiLoopHint?: string;
    flowInput?: GameMasterFlowInput;
};

/**
 * Monta prompt runtime compacto (evita mega-prompt legado).
 */
export function composeOssPrompt(input: ComposePromptInput): {
    systemInstruction: string;
    userPrompt: string;
} {
    const lines: string[] = [];
    if (input.characterName) lines.push(`PJ=${input.characterName}`);
    if (input.combatActive) {
        lines.push('MODO=combate (narre consequências; não resolva dados)');
        if (input.flowInput) {
            const hint = buildCombatSceneHint(input.flowInput);
            if (hint) lines.push(hint);
        }
    }
    if (input.sceneSummary) lines.push(`CENA=${input.sceneSummary.slice(0, 600)}`);
    if (input.compactGameLog) {
        lines.push(`LOG_RECENTE=${input.compactGameLog.slice(-2000)}`);
    }
    lines.push(`ACAO_JOGADOR=${input.playerAction.slice(0, 1200)}`);
    if (input.antiLoopHint) {
        lines.push(`ANTI_LOOP=${input.antiLoopHint}`);
    }

    const systemInstruction = input.combatActive
        ? buildCombatSystemInstruction()
        : OSS_FORMAT_SYSTEM;

    return {
        systemInstruction,
        userPrompt: lines.join('\n'),
    };
}
