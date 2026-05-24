export type GameLoadingKind = 'idle' | 'thinking' | 'rules' | 'roll' | 'narration' | 'sync';

export interface ResolveLoadingMessageInput {
    isLoading: boolean;
    isRollPending: boolean;
    actionPhaseLabel: string | null;
}

export interface ResolvedLoadingState {
    kind: GameLoadingKind;
    banner: string | null;
    shortLabel: string | null;
}

const ROLL_HINTS = ['rolagem', 'rolar', 'dado'];
const NARRATION_HINTS = ['narrando', 'narrativa', 'mestre', 'gerando'];
const RULES_HINTS = ['validando', 'regras', 'enfileirando', 'motor'];

function matchesHint(label: string, hints: string[]) {
    const normalized = label.toLowerCase();
    return hints.some(h => normalized.includes(h));
}

/** Mensagem unificada para HUD, log e ActionOptions (Fase 6.5). */
export function resolveLoadingState(input: ResolveLoadingMessageInput): ResolvedLoadingState {
    const { isLoading, isRollPending, actionPhaseLabel } = input;

    if (isRollPending) {
        return {
            kind: 'roll',
            banner: 'Aguardando sua rolagem',
            shortLabel: 'Rolagem pendente',
        };
    }

    if (actionPhaseLabel) {
        if (matchesHint(actionPhaseLabel, ROLL_HINTS)) {
            return {
                kind: 'roll',
                banner: actionPhaseLabel,
                shortLabel: 'Aguardando rolagem',
            };
        }
        if (matchesHint(actionPhaseLabel, NARRATION_HINTS)) {
            return {
                kind: 'narration',
                banner: 'Mestre pensando...',
                shortLabel: actionPhaseLabel,
            };
        }
        if (matchesHint(actionPhaseLabel, RULES_HINTS)) {
            return {
                kind: 'rules',
                banner: actionPhaseLabel,
                shortLabel: 'Validando regras',
            };
        }
        if (actionPhaseLabel.toLowerCase().includes('conexão')) {
            return {
                kind: 'sync',
                banner: actionPhaseLabel,
                shortLabel: 'Sincronizando',
            };
        }
        return {
            kind: 'thinking',
            banner: actionPhaseLabel,
            shortLabel: actionPhaseLabel,
        };
    }

    if (isLoading) {
        return {
            kind: 'thinking',
            banner: 'Mestre pensando...',
            shortLabel: 'Processando ação',
        };
    }

    return { kind: 'idle', banner: null, shortLabel: null };
}
