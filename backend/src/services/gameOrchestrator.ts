// backend/src/services/gameOrchestrator.ts
import { GameMasterResponse } from '../schemas/gameSchemas.js';

export interface OrchestratorContext {
    character?: {
        name?: string;
        attributes?: Record<string, number>;
    };
}

export interface OrchestratorResult {
    response: GameMasterResponse;
    adjustments: string[];
}

const appendSystemLog = (response: GameMasterResponse, message: string) => {
    if (!message) return;
    response.systemLog = response.systemLog ? `${response.systemLog}\n${message}` : message;
};

export const orchestrateGameMasterResponse = (
    originalResponse: GameMasterResponse,
    context: OrchestratorContext = {}
): OrchestratorResult => {
    const response: GameMasterResponse = JSON.parse(JSON.stringify(originalResponse));
    const adjustments: string[] = [];

    if (response.updatedCharacter?.hp) {
        const hp = response.updatedCharacter.hp as { current?: number; max?: number };
        if (hp.max !== undefined && hp.current !== undefined) {
            const clamped = Math.max(0, Math.min(hp.current, hp.max));
            if (clamped !== hp.current) {
                adjustments.push(`PV do personagem ajustado de ${hp.current} para ${clamped}.`);
                hp.current = clamped;
            }
        }
    }

    if (response.updatedCharacter?.attributes && context.character?.attributes) {
        const updatedAttrs = response.updatedCharacter.attributes as Record<string, number>;
        for (const [key, value] of Object.entries(updatedAttrs)) {
            if (typeof value === 'number' && Number.isFinite(value)) continue;
            const fallback = context.character.attributes?.[key] ?? 0;
            adjustments.push(`Atributo ${key} inválido (${value}). Revertido para ${fallback}.`);
            updatedAttrs[key] = fallback;
        }
    }

    if (response.combatState?.combatants?.length) {
        for (const combatant of response.combatState.combatants) {
            if (!combatant.hp) continue;
            const hp = combatant.hp as { current?: number; max?: number };
            if (hp.max !== undefined && hp.current !== undefined) {
                const clamped = Math.max(0, Math.min(hp.current, hp.max));
                if (clamped !== hp.current) {
                    adjustments.push(`HP de ${combatant.name || combatant.id} ajustado de ${hp.current} para ${clamped}.`);
                    hp.current = clamped;
                }
            }
        }
    }

    if (!response.actionOptions || response.actionOptions.length === 0) {
        response.actionOptions = ["(Aguardando orientação do Mestre)"];
        adjustments.push('Nenhuma actionOption fornecida. Opção padrão adicionada.');
    }

    if (adjustments.length > 0) {
        appendSystemLog(response, `[Orquestrador] Ajustes aplicados automaticamente: ${adjustments.join(' | ')}`);
    }

    return { response, adjustments };
};

export const generateFallbackResponse = (
    context: { character?: { name?: string } },
    playerAction: string,
    issues: string[]
): GameMasterResponse => {
    const summary = issues.length
        ? `Detectamos inconsistências: ${issues.join('; ')}.`
        : 'Houve um problema ao processar sua ação.';

    return {
        logEntries: [
            {
                type: 'system',
                content: `${summary} O Mestre pede um momento para recalibrar a cena antes de prosseguir.`,
            },
        ],
        actionOptions: [
            "Reformular minha ação com mais clareza.",
            "Perguntar ao Mestre qual informação está faltando.",
        ],
        systemLog: `[Fallback] A resposta anterior do modelo foi substituída automaticamente. Ação original: "${playerAction}".`,
    };
};
