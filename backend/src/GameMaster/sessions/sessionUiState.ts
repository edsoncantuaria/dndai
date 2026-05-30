import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import type { MotorActionOption } from '../motor/actionOptionTypes.js';

export type WorldBootstrapStepId =
    | 'region'
    | 'factions'
    | 'npcs'
    | 'quests'
    | 'economy'
    | 'simulation'
    | 'pulse';

export type WorldBootstrapStepStatus = 'pending' | 'running' | 'done' | 'failed';

export type WorldBootstrapState = {
    status: 'pending' | 'running' | 'ready' | 'failed';
    step: WorldBootstrapStepId | null;
    steps: Record<WorldBootstrapStepId, WorldBootstrapStepStatus>;
    startedAt?: string;
    finishedAt?: string;
    error?: string;
};

export type WorldPulseSnapshot = {
    headline: string | null;
    events: string[];
    updatedAt: string;
};

export const DEFAULT_WORLD_BOOTSTRAP: WorldBootstrapState = {
    status: 'pending',
    step: null,
    steps: {
        region: 'pending',
        factions: 'pending',
        npcs: 'pending',
        quests: 'pending',
        economy: 'pending',
        simulation: 'pending',
        pulse: 'pending',
    },
};

export const WORLD_BOOTSTRAP_STEP_LABELS: Record<WorldBootstrapStepId, string> = {
    region: 'Preparando região',
    factions: 'Gerando facções',
    npcs: 'Gerando NPCs',
    quests: 'Gerando missões',
    economy: 'Gerando economia',
    simulation: 'Simulando o mundo',
    pulse: 'Ativando pulso do mundo',
};

function parseBootstrap(raw: unknown): WorldBootstrapState {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_WORLD_BOOTSTRAP };
    const o = raw as Record<string, unknown>;
    const steps = { ...DEFAULT_WORLD_BOOTSTRAP.steps, ...(o.steps as object) };
    const status = o.status;
    if (
        status === 'pending' ||
        status === 'running' ||
        status === 'ready' ||
        status === 'failed'
    ) {
        return {
            status,
            step: (o.step as WorldBootstrapStepId | null) ?? null,
            steps,
            startedAt: typeof o.startedAt === 'string' ? o.startedAt : undefined,
            finishedAt: typeof o.finishedAt === 'string' ? o.finishedAt : undefined,
            error: typeof o.error === 'string' ? o.error : undefined,
        };
    }
    return { ...DEFAULT_WORLD_BOOTSTRAP };
}

export async function loadSessionUiState(sessionId: number): Promise<{
    actionOptions: MotorActionOption[];
    worldPulse: WorldPulseSnapshot | null;
    worldBootstrap: WorldBootstrapState;
}> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) {
        return {
            actionOptions: [],
            worldPulse: null,
            worldBootstrap: { ...DEFAULT_WORLD_BOOTSTRAP },
        };
    }

    const actionOptions = Array.isArray(session.lastActionOptions)
        ? (session.lastActionOptions as MotorActionOption[])
        : [];

    let worldPulse: WorldPulseSnapshot | null = null;
    const snap = session.worldPulseSnapshot as Record<string, unknown> | null;
    if (snap && Array.isArray(snap.events)) {
        worldPulse = {
            headline: typeof snap.headline === 'string' ? snap.headline : null,
            events: snap.events.map(String),
            updatedAt: typeof snap.updatedAt === 'string' ? snap.updatedAt : new Date().toISOString(),
        };
    }

    return {
        actionOptions,
        worldPulse,
        worldBootstrap: parseBootstrap(session.worldBootstrap),
    };
}

export async function saveLastActionOptions(
    sessionId: number,
    options: MotorActionOption[],
): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    await repo.update({ id: sessionId }, { lastActionOptions: options as unknown as Record<string, unknown>[] });
}

export async function saveWorldPulseSnapshot(
    sessionId: number,
    snapshot: Omit<WorldPulseSnapshot, 'updatedAt'> & { updatedAt?: string },
): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    await repo.update(
        { id: sessionId },
        {
            worldPulseSnapshot: {
                headline: snapshot.headline,
                events: snapshot.events,
                updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
            },
        },
    );
}

export async function updateWorldBootstrap(
    sessionId: number,
    patch: Partial<WorldBootstrapState>,
): Promise<WorldBootstrapState> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return { ...DEFAULT_WORLD_BOOTSTRAP };

    const current = parseBootstrap(session.worldBootstrap);
    const next: WorldBootstrapState = {
        ...current,
        ...patch,
        steps: { ...current.steps, ...(patch.steps ?? {}) },
    };
    session.worldBootstrap = next as unknown as Record<string, unknown>;
    await repo.save(session);
    return next;
}

export async function initWorldBootstrapPending(sessionId: number): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return;
    const current = parseBootstrap(session.worldBootstrap);
    if (current.status === 'ready') return;
    session.worldBootstrap = { ...DEFAULT_WORLD_BOOTSTRAP } as unknown as Record<string, unknown>;
    await repo.save(session);
}

/** Permite reexecutar bootstrap após falha Gemini (fallback offline). */
export async function resetFailedWorldBootstrap(sessionId: number): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return;
    const current = parseBootstrap(session.worldBootstrap);
    if (current.status === 'ready') return;
    session.worldBootstrap = {
        ...DEFAULT_WORLD_BOOTSTRAP,
        status: 'pending',
    } as unknown as Record<string, unknown>;
    await repo.save(session);
}

/** Sessões antigas sem coluna preenchida: marcar pronto se já há conteúdo de mundo. */
export async function ensureLegacyWorldBootstrapReady(sessionId: number): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return;
    const current = parseBootstrap(session.worldBootstrap);
    if (current.status === 'ready') return;

    const hasPulse =
        session.worldPulseSnapshot != null &&
        Array.isArray((session.worldPulseSnapshot as { events?: unknown }).events) &&
        ((session.worldPulseSnapshot as { events: unknown[] }).events?.length ?? 0) > 0;

    if (hasPulse) {
        await updateWorldBootstrap(sessionId, {
            status: 'ready',
            step: null,
            steps: Object.fromEntries(
                Object.keys(DEFAULT_WORLD_BOOTSTRAP.steps).map(k => [k, 'done']),
            ) as WorldBootstrapState['steps'],
            finishedAt: new Date().toISOString(),
        });
    }
}
