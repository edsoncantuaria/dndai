import { AppDataSource } from '../database/data-source.js';
import { AiFeedbackNote } from '../entities/AiFeedbackNote.js';

export type FeedbackFocus = 'narrative' | 'state' | 'full';

const WARNING_HINTS: Record<string, string> = {
    state_guard_retry: 'Mantenha somente os deltas esperados (combate ativo, loot fechado etc.).',
    semantic_validator: 'Revise coerência: descreva a perícia no motivo da rolagem e mantenha hostis vivos.',
    schema_drift_retry: 'Obedeça ao schema v2 (sem campos extras).',
    phase_sanitization: 'Evite replicar snapshots completos; envie apenas mudanças reais.',
    zod_validation_failure: 'Respeite os tipos do schema ao serializar o JSON.',
};

const ensureRepo = () => {
    if (!AppDataSource.isInitialized) return null;
    return AppDataSource.getRepository(AiFeedbackNote);
};

export const recordFeedbackWarning = async (
    sessionId: string,
    scenarioLabel: string | undefined,
    focus: FeedbackFocus,
    warningType: string,
    details?: Record<string, any> | string | null
) => {
    const repo = ensureRepo();
    if (!repo) return;
    const key = {
        sessionId,
        scenarioLabel: scenarioLabel ?? null,
        focus,
    };
    let note = await repo.findOne({ where: key });
    if (!note) {
        note = repo.create({ ...key, counts: {}, lastDetails: null });
    }
    const counts = { ...(note.counts ?? {}) };
    counts[warningType] = (counts[warningType] ?? 0) + 1;
    note.counts = counts;
    if (details && typeof details === 'object') {
        note.lastDetails = details as Record<string, unknown>;
    }
    await repo.save(note);
};

export const buildFeedbackHint = async (
    sessionId: string | undefined,
    scenarioLabel: string | undefined,
    focus: FeedbackFocus
): Promise<string | null> => {
    if (!sessionId) return null;
    const repo = ensureRepo();
    if (!repo) return null;
    const note = await repo.findOne({
        where: [
            { sessionId, scenarioLabel: scenarioLabel ?? null, focus },
            { sessionId, scenarioLabel: null, focus },
        ],
        order: { updatedAt: 'DESC' },
    });
    if (!note || !note.counts) return null;
    const ranked = Object.entries(note.counts)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .slice(0, 2)
        .map(([type, count]) => {
            const hint = WARNING_HINTS[type] ?? type;
            return `${type} x${count}: ${hint}`;
        });
    if (!ranked.length) return null;
    return `Histórico recente: ${ranked.join(' | ')}`;
};
