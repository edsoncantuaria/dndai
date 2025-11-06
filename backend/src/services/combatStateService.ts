// backend/src/services/combatStateService.ts
import { QueryRunner } from 'typeorm';
import { AppDataSource } from '../database/data-source.js';
import { CombatEncounter } from '../entities/CombatEncounter.js';
import redisClient from '../database/redis-client.js';
import type { CombatState as SchemaCombatState, FullCombatant, CombatAttitude } from '../schemas/gameSchemas.js';

const COMBAT_CACHE_TTL_SECONDS = 300;
const combatCacheKey = (sessaoId: number) => `session:${sessaoId}:combat`;

type Attitude = CombatAttitude;
type PartialCombatant = Partial<FullCombatant> & Record<string, unknown>;
type PartialCombatState = Partial<SchemaCombatState> & Record<string, unknown>;

interface CanonicalCombatant {
    id: string;
    name: string;
    hp: { current: number; max: number };
    ac?: number;
    initiative?: number;
    isPlayer: boolean;
    attitude: Attitude;
    conditions: string[];
    hasMoved: boolean;
    hasActed: boolean;
    isDead: boolean;
    distance?: number;
    actionPoints: number;
    bonusActionPoints: number;
    readyAction?: string | null;
    tempModifiers?: Record<string, unknown> | null;
    rollHistory: FullCombatant['rollHistory'];
}

interface CanonicalCombatState {
    isActive: boolean;
    round: number;
    turn: number;
    combatants: CanonicalCombatant[];
    initiativeOrder: string[];
    log: string[];
}

export type PublicCombatant = FullCombatant;
export type PublicCombatState = SchemaCombatState;

export interface LoadedCombatEncounter {
    encounterId: number | null;
    state: CanonicalCombatState | null;
}

export interface CombatReconciliationResult {
    canonicalState: CanonicalCombatState | null;
    publicState: PublicCombatState | null;
    changed: boolean;
    telemetry: string[];
}

const AP_REGEN_PER_TURN = 3;
const AP_REGEN_PER_ROUND = 3;
const AP_MAX = 30;

const ATTITUDE_KEYWORDS: Record<Attitude, string[]> = {
    hostile: ['hostile', 'enemy', 'enemigo', 'inimigo', 'foe'],
    neutral: ['neutral', 'neutro', 'indifferent'],
    ally: ['ally', 'friend', 'friendly', 'aliado', 'parceiro'],
};

const clampNumber = (value: unknown, min: number, max: number): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, num));
};

const toSafeInteger = (value: unknown, fallback: number, min: number, max: number): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return clampNumber(Math.round(num), min, max);
};

const normaliseId = (value: string): string => value.trim().toLowerCase();

const slugify = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40) || `combatant-${Math.random().toString(36).slice(2, 8)}`;

const dedupeId = (baseId: string, used: Set<string>): string => {
    let candidate = baseId || `combatant-${Math.random().toString(36).slice(2, 8)}`;
    let index = 1;
    while (used.has(normaliseId(candidate))) {
        candidate = `${baseId}-${index}`;
        index += 1;
    }
    used.add(normaliseId(candidate));
    return candidate;
};

const normaliseAttitude = (value: unknown, fallback: Attitude): Attitude => {
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        for (const [attitude, tokens] of Object.entries(ATTITUDE_KEYWORDS)) {
            if (tokens.some(token => lower.includes(token))) {
                return attitude as Attitude;
            }
        }
    }
    if (typeof value === 'boolean') {
        return value ? 'hostile' : fallback;
    }
    return fallback;
};

const extractConditions = (value: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(value)) return fallback;
    return value
        .map(entry => (typeof entry === 'string' ? entry.trim() : null))
        .filter(Boolean) as string[];
};

const coerceBoolean = (value: unknown, fallback: boolean): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (['true', 'yes', 'sim', '1'].includes(lower)) return true;
        if (['false', 'no', 'nao', '0'].includes(lower)) return false;
    }
    return fallback;
};

const arraysDiffer = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return true;
    return a.some((value, index) => value !== b[index]);
};

const sanitizeLogEntries = (existing: string[], proposed: unknown): string[] => {
    const result = [...existing];
    if (!Array.isArray(proposed)) return result;
    for (const entry of proposed) {
        if (typeof entry === 'string') {
            const trimmed = entry.trim();
            if (trimmed) result.push(trimmed);
        } else if (entry && typeof entry === 'object') {
            const text =
                'content' in entry && typeof (entry as Record<string, unknown>).content === 'string'
                    ? ((entry as Record<string, unknown>).content as string).trim()
                    : JSON.stringify(entry);
            if (text) result.push(text);
        }
    }
    return result.slice(-20);
};

const buildCanonicalCombatant = (
    candidate: PartialCombatant | undefined,
    usedIds: Set<string>,
    defaults?: Partial<CanonicalCombatant>,
): CanonicalCombatant | null => {
    if (!candidate || typeof candidate !== 'object') return null;

    const name = typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name.trim()
        : defaults?.name || 'Combatente';

    const requestedId = typeof candidate.id === 'string' ? candidate.id : slugify(name);
    const id = dedupeId(requestedId, usedIds);

    const fallbackMax = defaults?.hp?.max ?? 1;
    let maxHp = fallbackMax;
    if (typeof candidate?.hp?.max === 'number' && Number.isFinite(candidate.hp.max)) {
        maxHp = Math.max(1, Math.round(candidate.hp.max));
    } else if (typeof candidate.hp === 'number' && Number.isFinite(candidate.hp)) {
        maxHp = Math.max(1, Math.round(candidate.hp));
    } else {
        maxHp = Math.max(1, Math.round(fallbackMax));
    }

    const fallbackCurrent = defaults?.hp?.current ?? maxHp;
    let currentHpRaw = fallbackCurrent;
    if (typeof candidate?.hp?.current === 'number' && Number.isFinite(candidate.hp.current)) {
        currentHpRaw = candidate.hp.current;
    } else if (typeof candidate.hp === 'number' && Number.isFinite(candidate.hp)) {
        currentHpRaw = candidate.hp;
    }

    const currentHp = clampNumber(currentHpRaw, 0, maxHp);

    const isPlayer = candidate.isPlayer ?? defaults?.isPlayer ?? false;
    const attitude: Attitude = isPlayer
        ? 'ally'
        : normaliseAttitude(
            candidate.attitude ?? candidate.disposition ?? candidate.alignment ?? candidate.isEnemy,
            defaults?.attitude ?? 'neutral'
        );

    const canonical: CanonicalCombatant = {
        id,
        name,
        hp: { current: currentHp, max: maxHp },
        ac: typeof candidate.ac === 'number' ? clampNumber(candidate.ac, 0, 100) : defaults?.ac,
        initiative: typeof candidate.initiative === 'number' ? Math.round(candidate.initiative) : defaults?.initiative,
        isPlayer: Boolean(isPlayer),
        attitude,
        conditions: extractConditions(candidate.conditions, defaults?.conditions ?? []),
        hasMoved: coerceBoolean(candidate.hasMoved, defaults?.hasMoved ?? false),
        hasActed: coerceBoolean(candidate.hasActed, defaults?.hasActed ?? false),
        isDead: currentHp <= 0,
        distance: typeof candidate.distance === 'number' ? clampNumber(candidate.distance, 0, 1000) : defaults?.distance,
        actionPoints: typeof candidate.actionPoints === 'number'
            ? clampNumber(candidate.actionPoints, 0, AP_MAX)
            : clampNumber(defaults?.actionPoints ?? AP_REGEN_PER_TURN, 0, AP_MAX),
        bonusActionPoints: typeof candidate.bonusActionPoints === 'number'
            ? clampNumber(candidate.bonusActionPoints, 0, 3)
            : clampNumber(defaults?.bonusActionPoints ?? AP_REGEN_PER_TURN, 0, 3),
        readyAction: typeof candidate.readyAction === 'string' ? candidate.readyAction.slice(0, 280) : defaults?.readyAction ?? null,
        tempModifiers: typeof candidate.tempModifiers === 'object' && candidate.tempModifiers !== null
            ? candidate.tempModifiers as Record<string, unknown>
            : defaults?.tempModifiers ?? null,
        rollHistory: Array.isArray(candidate.rollHistory) ? candidate.rollHistory as FullCombatant['rollHistory'] : defaults?.rollHistory ?? [],
    };

    if (canonical.isPlayer) {
        canonical.attitude = 'ally';
    }

    return canonical;
};

const reconcileCombatant = (
    existing: CanonicalCombatant,
    candidate?: PartialCombatant
): { combatant: CanonicalCombatant; notes: string[]; changed: boolean } => {
    const notes: string[] = [];
    let changed = false;

    if (!candidate || typeof candidate !== 'object') {
        notes.push(`Combatente ${existing.name} não fornecido pela IA; mantendo estado anterior.`);
        return {
            combatant: {
                ...existing,
                hp: { current: clampNumber(existing.hp.current, 0, existing.hp.max), max: existing.hp.max },
                isDead: clampNumber(existing.hp.current, 0, existing.hp.max) <= 0,
            },
            notes,
            changed: false,
        };
    }

    const hpMax = existing.hp.max;
    const proposedCurrent = typeof candidate?.hp?.current === 'number'
        ? candidate.hp.current
        : typeof candidate.hp === 'number'
            ? candidate.hp
            : existing.hp.current;
    const clampedCurrent = clampNumber(proposedCurrent, 0, hpMax);
    if (clampedCurrent !== proposedCurrent) {
        notes.push(`PV ajustado (${existing.name}): ${proposedCurrent} → ${clampedCurrent}`);
        changed = true;
    }
    if (clampedCurrent !== existing.hp.current) {
        changed = true;
    }

    const attitude = existing.isPlayer
        ? 'ally'
        : normaliseAttitude(
            candidate.attitude ?? candidate.disposition ?? candidate.isEnemy,
            existing.attitude
        );
    if (attitude !== existing.attitude && !existing.isPlayer) {
        notes.push(`Atitude atualizada (${existing.name}): ${existing.attitude} → ${attitude}`);
        changed = true;
    }

    const nextConditions = extractConditions(candidate.conditions, existing.conditions);
    if (arraysDiffer(nextConditions, existing.conditions)) {
        notes.push(`Condições sincronizadas (${existing.name}).`);
        changed = true;
    }

    const nextActionPoints = typeof candidate.actionPoints === 'number'
        ? clampNumber(candidate.actionPoints, 0, AP_MAX)
        : existing.actionPoints;
    if (nextActionPoints !== existing.actionPoints) {
        notes.push(`Pontos de ação ajustados (${existing.name}): ${existing.actionPoints} → ${nextActionPoints}`);
        changed = true;
    }

    const nextBonusPoints = typeof candidate.bonusActionPoints === 'number'
        ? clampNumber(candidate.bonusActionPoints, 0, 3)
        : existing.bonusActionPoints;
    if (nextBonusPoints !== existing.bonusActionPoints) {
        notes.push(`Ações bônus ajustadas (${existing.name}): ${existing.bonusActionPoints} → ${nextBonusPoints}`);
        changed = true;
    }

    const nextTempModifiers = typeof candidate.tempModifiers === 'object' && candidate.tempModifiers !== null
        ? candidate.tempModifiers as Record<string, unknown>
        : existing.tempModifiers;
    if (nextTempModifiers !== existing.tempModifiers && nextTempModifiers) {
        notes.push(`Modificadores temporários sincronizados (${existing.name}).`);
        changed = true;
    }

    const nextRollHistory = Array.isArray(candidate.rollHistory)
        ? candidate.rollHistory as FullCombatant['rollHistory']
        : existing.rollHistory;

    const next: CanonicalCombatant = {
        ...existing,
        hp: { current: clampedCurrent, max: hpMax },
        ac: typeof candidate.ac === 'number' ? clampNumber(candidate.ac, 0, 100) : existing.ac,
        initiative: typeof candidate.initiative === 'number' ? Math.round(candidate.initiative) : existing.initiative,
        attitude,
        conditions: nextConditions,
        hasMoved: coerceBoolean(candidate.hasMoved, existing.hasMoved),
        hasActed: coerceBoolean(candidate.hasActed, existing.hasActed),
        distance: typeof candidate.distance === 'number' ? clampNumber(candidate.distance, 0, 1000) : existing.distance,
        actionPoints: nextActionPoints,
        bonusActionPoints: nextBonusPoints,
        readyAction: typeof candidate.readyAction === 'string' ? candidate.readyAction.slice(0, 280) : existing.readyAction,
        tempModifiers: nextTempModifiers,
        rollHistory: nextRollHistory,
        isDead: clampedCurrent <= 0,
    };

    if (next.hasMoved !== existing.hasMoved || next.hasActed !== existing.hasActed) {
        changed = true;
    }

    return { combatant: next, notes, changed };
};

const sanitiseStoredState = (raw: PartialCombatState | null | undefined): CanonicalCombatState | null => {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.combatants)) return null;

    const usedIds = new Set<string>();
    const combatants: CanonicalCombatant[] = [];
    for (const entry of raw.combatants) {
        if (!entry || typeof entry !== 'object') continue;
        const canonical = buildCanonicalCombatant(entry as PartialCombatant, usedIds);
        if (canonical) combatants.push(canonical);
    }

    if (!combatants.length) return null;

    return {
        isActive: Boolean(raw.isActive),
        round: toSafeInteger(raw.round, 1, 1, 1000),
        turn: toSafeInteger(raw.turn, 0, 0, Math.max(0, combatants.length - 1)),
        combatants,
        initiativeOrder: Array.isArray(raw.initiativeOrder)
            ? raw.initiativeOrder
                .map((id: unknown) => (typeof id === 'string' ? id : null))
                .filter((value): value is string => Boolean(value))
            : combatants.map(c => c.id),
        log: Array.isArray(raw.log)
            ? raw.log.map((entry: unknown) => (typeof entry === 'string' ? entry : JSON.stringify(entry))).slice(-20)
            : [],
    };
};

const buildNewCanonicalState = (proposed: PartialCombatState | null | undefined): CanonicalCombatState | null => {
    if (!proposed || typeof proposed !== 'object' || !Array.isArray(proposed.combatants)) {
        return null;
    }

    const usedIds = new Set<string>();
    const combatants: CanonicalCombatant[] = [];
    for (const candidate of proposed.combatants) {
        if (!candidate || typeof candidate !== 'object') continue;
        const canonical = buildCanonicalCombatant(candidate as PartialCombatant, usedIds, { attitude: 'neutral' });
        if (canonical) {
            combatants.push(canonical);
        }
    }

    if (!combatants.some(c => c.isPlayer)) {
        return null;
    }

    const round = toSafeInteger(proposed.round, 1, 1, 1000);
    const turn = toSafeInteger(proposed.turn, 0, 0, Math.max(0, combatants.length - 1));

    return {
        isActive: Boolean(proposed.isActive),
        round,
        turn,
        combatants,
        initiativeOrder: Array.isArray(proposed.initiativeOrder)
            ? proposed.initiativeOrder
                .map((entry: unknown) => (typeof entry === 'string' ? entry : null))
                .filter((value): value is string => Boolean(value))
            : combatants.map(c => c.id),
        log: sanitizeLogEntries([], proposed.log),
    };
};

const toPublicCombatant = (combatant: CanonicalCombatant): PublicCombatant => ({
    id: combatant.id,
    name: combatant.name,
    hp: { ...combatant.hp },
    ac: combatant.ac,
    initiative: combatant.initiative,
    isPlayer: combatant.isPlayer,
    attitude: combatant.attitude,
    conditions: combatant.conditions,
    hasMoved: combatant.hasMoved,
    hasActed: combatant.hasActed,
    isDead: combatant.isDead,
    distance: combatant.distance,
    actionPoints: combatant.actionPoints,
    bonusActionPoints: combatant.bonusActionPoints,
    readyAction: combatant.readyAction ?? undefined,
    tempModifiers: combatant.tempModifiers ?? undefined,
    rollHistory: combatant.rollHistory ?? [],
});

const toPublicCombatState = (canonical: CanonicalCombatState | null): PublicCombatState | null => {
    if (!canonical) return null;

    const combatants = canonical.combatants.map(toPublicCombatant);
    return {
        isActive: canonical.isActive,
        round: canonical.round,
        turn: clampNumber(canonical.turn, 0, Math.max(0, combatants.length - 1)),
        combatants,
        initiativeOrder: canonical.initiativeOrder,
        log: canonical.log,
    };
};

const cacheCombatState = async (sessaoId: number, payload: { encounterId: number | null; state: CanonicalCombatState | null }) => {
    if (!redisClient || !redisClient.isOpen) return;
    const key = combatCacheKey(sessaoId);
    if (!payload.state || !payload.state.isActive) {
        await redisClient.del(key);
        return;
    }
    await redisClient.set(
        key,
        JSON.stringify({
            encounterId: payload.encounterId,
            state: payload.state,
        }),
        { EX: COMBAT_CACHE_TTL_SECONDS },
    );
};

export const loadCombatEncounterState = async (sessaoId: number): Promise<LoadedCombatEncounter> => {
    if (redisClient && redisClient.isOpen) {
        try {
            const cachedRaw = await redisClient.get(combatCacheKey(sessaoId));
            if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw) as { encounterId: number | null; state: PartialCombatState };
                const sanitised = sanitiseStoredState(parsed.state);
                if (sanitised) {
                    return { encounterId: parsed.encounterId ?? null, state: sanitised };
                }
            }
        } catch (error) {
            console.warn('[combatStateService] Falha ao ler cache de combate:', error);
        }
    }

    const repository = AppDataSource.getRepository(CombatEncounter);
    const encounter = await repository.findOne({
        where: { sessaoId },
        order: { updatedAt: 'DESC' },
    });

    if (!encounter) {
        return { encounterId: null, state: null };
    }

    const sanitised = sanitiseStoredState(encounter.state);
    if (sanitised && redisClient && redisClient.isOpen) {
        await cacheCombatState(sessaoId, { encounterId: encounter.id, state: sanitised });
    }

    return {
        encounterId: encounter.id,
        state: sanitised,
    };
};

export const saveCombatEncounterState = async (
    queryRunner: QueryRunner,
    sessaoId: number,
    encounterId: number | null,
    state: CanonicalCombatState | null,
): Promise<void> => {
    const repository = queryRunner.manager.getRepository(CombatEncounter);

    if (!state || !state.isActive) {
        if (encounterId) {
            const existing = await repository.findOne({ where: { id: encounterId } });
            if (existing) {
                existing.state = state
                    ? { ...state, isActive: false }
                    : {
                        isActive: false,
                        round: 0,
                        turn: 0,
                        combatants: [],
                        initiativeOrder: [],
                        log: [],
                    };
                existing.isActive = false;
                await repository.save(existing);
            }
        }
        if (redisClient && redisClient.isOpen) {
            await redisClient.del(combatCacheKey(sessaoId));
        }
        return;
    }

    if (encounterId) {
        const existing = await repository.findOne({ where: { id: encounterId } });
        if (existing) {
            existing.state = state;
            existing.isActive = state.isActive;
            await repository.save(existing);
            await cacheCombatState(sessaoId, { encounterId, state });
            return;
        }
    }

    const newEncounter = repository.create({
        sessaoId,
        isActive: state.isActive,
        state,
    });
    const saved = await repository.save(newEncounter);
    await cacheCombatState(sessaoId, { encounterId: saved.id, state });
};

export const clearCombatEncounterState = async (
    queryRunner: QueryRunner,
    encounterId: number | null
): Promise<void> => {
    if (!encounterId) return;
    const repository = queryRunner.manager.getRepository(CombatEncounter);
    const existing = await repository.findOne({ where: { id: encounterId } });
    if (!existing) return;
    await repository.delete({ id: encounterId });
    if (redisClient && redisClient.isOpen) {
        await redisClient.del(combatCacheKey(existing.sessaoId));
    }
};

export const reconcileCombatStateUpdate = (
    stored: CanonicalCombatState | null,
    proposed: PartialCombatState | null | undefined
): CombatReconciliationResult => {
    if (!stored || !stored.isActive) {
        const initial = buildNewCanonicalState(proposed);
        if (!initial || !initial.isActive) {
            return { canonicalState: null, publicState: null, changed: false, telemetry: [] };
        }
        return {
            canonicalState: initial,
            publicState: toPublicCombatState(initial),
            changed: true,
            telemetry: [`Estado de combate inicializado com ${initial.combatants.length} combatentes.`],
        };
    }

    if (!proposed || typeof proposed !== 'object' || !proposed.isActive) {
        const updated: CanonicalCombatState = {
            ...stored,
            isActive: false,
            log: sanitizeLogEntries(stored.log, proposed?.log),
        };
        return {
            canonicalState: updated,
            publicState: toPublicCombatState(updated),
            changed: true,
            telemetry: ['Combate sinalizado como encerrado pela IA; marcando como finalizado.'],
        };
    }

    const proposedCombatants: Record<string, PartialCombatant> = Array.isArray(proposed.combatants)
        ? proposed.combatants.reduce<Record<string, PartialCombatant>>((acc, combatant) => {
            if (!combatant || typeof combatant !== 'object') return acc;
            const key =
                typeof combatant.id === 'string'
                    ? normaliseId(combatant.id)
                    : typeof combatant.name === 'string'
                        ? normaliseId(combatant.name)
                        : null;
            if (!key) return acc;
            acc[key] = combatant as PartialCombatant;
            return acc;
        }, {})
        : {};

    const telemetry: string[] = [];
    let changed = false;

    const reconciledCombatants = stored.combatants.map(existing => {
        const key = normaliseId(existing.id);
        const candidate = proposedCombatants[key];
        if (candidate) {
            delete proposedCombatants[key];
        }
        const { combatant, notes, changed: combatantChanged } = reconcileCombatant(existing, candidate);
        telemetry.push(...notes);
        if (combatantChanged) {
            changed = true;
        }
        return combatant;
    });

    const ignoredCombatants = Object.values(proposedCombatants);
    if (ignoredCombatants.length) {
        telemetry.push(
            `Combatentes extras ignorados: ${ignoredCombatants
                .map(entry => (entry.name as string | undefined) ?? (entry.id as string | undefined) ?? 'desconhecido')
                .join(', ')}`,
        );
    }

    const proposedRound = toSafeInteger(proposed.round, stored.round, stored.round, stored.round + 100);
    const round = Math.max(stored.round, proposedRound);
    if (round !== stored.round) {
        changed = true;
        telemetry.push(`Rodada ajustada: ${stored.round} → ${round}`);
    }

    const proposedTurn = toSafeInteger(proposed.turn, stored.turn, 0, Math.max(0, reconciledCombatants.length - 1));
    const turn = clampNumber(proposedTurn, 0, Math.max(0, reconciledCombatants.length - 1));
    if (turn !== stored.turn) {
        changed = true;
        telemetry.push(`Índice de turno atualizado: ${stored.turn} → ${turn}`);
    }

    const log = sanitizeLogEntries(stored.log, proposed.log);
    if (log.length !== stored.log.length || log.some((value, index) => value !== stored.log[index])) {
        changed = true;
    }

    const canonical: CanonicalCombatState = {
        isActive: Boolean(proposed.isActive),
        round,
        turn,
        combatants: reconciledCombatants,
        initiativeOrder: Array.isArray(proposed.initiativeOrder)
            ? proposed.initiativeOrder
                .map((id: unknown) => (typeof id === 'string' ? id : null))
                .filter((value): value is string => Boolean(value))
            : stored.initiativeOrder,
        log,
    };

    if (round > stored.round) {
        for (const combatant of canonical.combatants) {
            if (combatant.isDead) continue;
            const before = combatant.actionPoints;
            const after = Math.min(AP_MAX, before + AP_REGEN_PER_ROUND);
            if (after !== before) {
                combatant.actionPoints = after;
                telemetry.push(`AP regenerados por rodada (${combatant.name}): +${after - before}`);
                changed = true;
            }
        }
    }

    if (canonical.isActive && turn !== stored.turn) {
        const activeCombatant = canonical.combatants[turn];
        if (activeCombatant && !activeCombatant.isDead) {
            const before = activeCombatant.actionPoints;
            const after = Math.min(AP_MAX, before + AP_REGEN_PER_TURN);
            if (after !== before) {
                activeCombatant.actionPoints = after;
                telemetry.push(`AP regenerados no início do turno (${activeCombatant.name}): +${after - before}`);
                changed = true;
            }
        }
    }

    const anyHostileAlive = canonical.combatants.some(c => c.attitude === 'hostile' && c.hp.current > 0);
    const playerAlive = canonical.combatants.some(c => c.isPlayer && c.hp.current > 0);
    if (!anyHostileAlive) {
        canonical.isActive = false;
        telemetry.push('Combate encerrado automaticamente: nenhum inimigo hostil permanece em pé.');
        changed = true;
    } else if (!playerAlive) {
        canonical.isActive = false;
        telemetry.push('Combate encerrado automaticamente: o personagem do jogador caiu ou se retirou.');
        changed = true;
    }

    return {
        canonicalState: canonical,
        publicState: toPublicCombatState(canonical),
        changed,
        telemetry,
    };
};

export const projectPublicCombatState = (state: CanonicalCombatState | null): PublicCombatState | null => {
    return toPublicCombatState(state);
};
