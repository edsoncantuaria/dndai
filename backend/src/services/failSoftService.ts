import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import { attachResponseMetadata, ensureResponseSchemaHash } from './schemaIntegrityService.js';
import type { SessionSnapshot } from './sessionRecoveryCache.js';

const SYSTEM_NOTE = '[AUTO-RECOVERED] Estado restaurado após falhas consecutivas do modelo.';

export const buildFailSoftResponse = (
    input: GameMasterFlowInput,
    snapshot: SessionSnapshot | null,
    fallbackReason: string
): GameMasterResponse => {
    const template: GameMasterResponse = snapshot
        ? JSON.parse(JSON.stringify(snapshot.lastValidResponse))
        : {
            logEntries: [
                {
                    type: 'narration',
                    content: `O turno foi estabilizado automaticamente após falhas da IA. ${input.playerAction ?? ''}`.trim(),
                },
            ],
            actionOptions: [
                { text: 'Respire fundo e avalie o cenário.', action: 'avaliar' },
                { text: 'Observe os arredores em busca de oportunidades.', action: 'observar' },
                { text: 'Converse com alguém próximo para entender a situação.', action: 'conversar' },
            ],
            updatedCharacter: {},
        };

    const logEntries = Array.isArray(template.logEntries) ? [...template.logEntries] : [];
    logEntries.push({
        type: 'system',
        content: 'O sistema restaurou o último estado íntegro para manter a sessão fluindo.',
    });
    template.logEntries = logEntries;
    template.systemLog = template.systemLog
        ? `${template.systemLog}\n${SYSTEM_NOTE}\nMotivo: ${fallbackReason}`
        : `${SYSTEM_NOTE}\nMotivo: ${fallbackReason}`;

    ensureResponseSchemaHash(template);
    attachResponseMetadata(template, {
        recoveryStrategies: ['fail-soft'],
        integrityNotes: [
            ...(template._meta?.integrityNotes ?? []),
            'Resposta reconstituída via fail-soft.',
        ],
    });
    return template;
};
