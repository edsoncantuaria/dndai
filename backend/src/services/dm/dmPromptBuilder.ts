import type { AutomatedRollResult } from './autoRollService.js';
import { formatRollOutcomeForDm } from './autoRollService.js';
import type { PlayerRollRequest } from '../../types.js';

export type DmTurnPhase = 'scene' | 'action' | 'roll_outcome' | 'combat';

export function buildDmPlayerActionPrompt(params: {
    phase: DmTurnPhase;
    playerAction: string;
    rollRequest?: PlayerRollRequest;
    automatedRoll?: AutomatedRollResult;
    motorHints?: string[];
    castSummary?: string;
    combatActive?: boolean;
}): string {
    const lines: string[] = [];

    if (params.castSummary?.trim()) {
        lines.push(params.castSummary.trim());
    }

    if (params.combatActive) {
        lines.push('[Combate] Turno em andamento — priorize ações táticas, posição e consequências imediatas.');
    }

    switch (params.phase) {
        case 'scene':
            lines.push(
                '[Fase: abertura de cena]',
                'Descreva o cenário atual de forma imersiva (2–4 parágrafos curtos).',
                'Termine com 3–5 actionOptions que convidem exploração, social, perigo ou descanso.',
                'Não peça rolagens — o motor cuida das mecânicas.',
            );
            break;
        case 'roll_outcome':
            if (params.rollRequest && params.automatedRoll) {
                lines.push(formatRollOutcomeForDm(params.rollRequest, params.automatedRoll));
            }
            lines.push(
                '[Fase: desfecho após rolagem]',
                `Ação do jogador: ${params.playerAction}`,
                'Narre o resultado já resolvido (sucesso ou falha). Não solicite nova rolagem neste turno.',
            );
            break;
        case 'combat':
            lines.push(
                '[Fase: combate]',
                `Ação do jogador: ${params.playerAction}`,
                'Narre o beat de combate; HP e efeitos vêm do motor.',
            );
            break;
        case 'action':
        default:
            lines.push(
                '[Fase: ação livre]',
                `Ação do jogador: ${params.playerAction}`,
                'Se a ação não exigiu rolagem, narre consequências diretas e ofereça opções coerentes.',
            );
            break;
    }

    if (params.motorHints?.length) {
        lines.push(...params.motorHints.map(h => h.startsWith('[') ? h : `[Motor] ${h}`));
    }

    return lines.join('\n');
}
