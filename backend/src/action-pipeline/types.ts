import type { WebSocket } from 'ws';
import type { ActionIntent } from '../rules/actionIntentService.js';

/** P0.5 — contexto compartilhado do pipeline de ação WS. */
export type ActionPipelineWs = WebSocket & { userId?: number };

export type ProcessActionPayload = {
    contractVersion?: number;
    sessionId: number;
    prompt?: string;
    intent?: ActionIntent;
    combatState?: unknown;
    apiKey?: string;
    useAiHomebrew?: boolean;
    model?: string;
    clientStateVersion?: number;
    actionId?: string;
    clientInstanceId?: string;
    actionCursor?: number;
    narrationVoice?: string;
    narrationSpeed?: string;
};

export type ActionPipelineDeps = {
    bumpSessionStateVersion: (sessionId: number) => Promise<number>;
    getSessionStateVersion: (sessionId: number) => number;
};

export type SubmitRollResultPayload = {
    sessionId: number;
    requestId: string;
    rolls: unknown;
    apiKey?: string;
    combatState?: unknown;
    useAiHomebrew?: boolean;
    clientStateVersion?: number;
    narrationVoice?: string;
    narrationSpeed?: string;
};

/** P0.5.1 — contexto mutável por mensagem processAction. */
export type ProcessActionContext = {
    activeActions: Set<string>;
    resolvedActionId?: string;
    currentSessionId?: number;
    phaseLockAcquired: boolean;
};
