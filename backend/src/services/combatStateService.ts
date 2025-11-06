// backend/src/services/combatStateService.ts
import { In, QueryRunner } from 'typeorm';
import { AppDataSource } from '../database/data-source.js';
import { CombatEncounter } from '../entities/CombatEncounter.js';
import { CombatantState as CombatantStateEntity } from '../entities/CombatantState.js';
import { CombatCooldown as CombatCooldownEntity } from '../entities/CombatCooldown.js';
import { CombatStatusEffect as CombatStatusEffectEntity } from '../entities/CombatStatusEffect.js';
import { CombatLogEntry } from '../entities/CombatLogEntry.js';
import redisClient from '../database/redis-client.js';
import type { CombatState as SchemaCombatState, FullCombatant, CombatAttitude } from '../schemas/gameSchemas.js';

const COMBAT_CACHE_TTL_SECONDS = 300;
const combatCacheKey = (sessaoId: number) => `session:${sessaoId}:combat`;

type Attitude = CombatAttitude;
type PartialCombatant = Partial<FullCombatant> & Record<string, unknown>;
type PartialCombatState = Partial<SchemaCombatState> & Record<string, unknown>;

type CombatZone = 'perto' | 'medio' | 'longe' | 'coberto';

interface CooldownEntry {
    id: string;
    name: string;
    remainingRounds: number;
    totalRounds?: number;
    description?: string;
    resource?: string;
}

interface StatusEffectEntry {
    id: string;
    name: string;
    remainingRounds?: number;
    source?: string;
    description?: string;
    severity?: 'leve' | 'moderado' | 'grave';
}

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
    zone?: CombatZone;
    actionPoints: number;
    bonusActionPoints: number;
    readyAction?: string | null;
    tempModifiers?: Record<string, unknown> | null;
    rollHistory: FullCombatant['rollHistory'];
    cooldowns: CooldownEntry[];
    statusEffects: StatusEffectEntry[];
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

const normaliseZone = (value: unknown, fallback?: CombatZone, distance?: number): CombatZone | undefined => {
    if (typeof value === 'string' && value.trim()) {
        const normalized = value.trim().toLowerCase();
        if (['perto', 'curta', 'close', 'melee'].some(token => normalized.includes(token))) return 'perto';
        if (['medio', 'médio', 'medium', 'mid'].some(token => normalized.includes(token))) return 'medio';
        if (['longe', 'longa', 'long', 'distance'].some(token => normalized.includes(token))) return 'longe';
        if (['coberto', 'cover', 'cobertura'].some(token => normalized.includes(token))) return 'coberto';
    }

    if (distance !== undefined) {
        if (distance <= 5) return 'perto';
        if (distance <= 15) return 'medio';
        return 'longe';
    }

    return fallback;
};

const normaliseCooldowns = (value: unknown, fallback: CooldownEntry[] = []): CooldownEntry[] => {
    if (!Array.isArray(value)) return fallback;
    const sanitized: CooldownEntry[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const name = typeof (raw as any).name === 'string' ? (raw as any).name.trim() : '';
        if (!name) continue;
        const id = typeof (raw as any).id === 'string' && (raw as any).id.trim()
            ? (raw as any).id.trim()
            : slugify(name);
        const remaining = clampNumber((raw as any).remainingRounds, 0, 100);
        const total = (raw as any).totalRounds;
        sanitized.push({
            id,
            name,
            remainingRounds: remaining,
            totalRounds: typeof total === 'number' && Number.isFinite(total) ? clampNumber(total, 0, 100) : undefined,
            description: typeof (raw as any).description === 'string' ? (raw as any).description.slice(0, 180) : undefined,
            resource: typeof (raw as any).resource === 'string' ? (raw as any).resource.slice(0, 60) : undefined,
        });
    }
    return sanitized;
};

const normaliseStatusEffects = (value: unknown, fallback: StatusEffectEntry[] = []): StatusEffectEntry[] => {
    if (!Array.isArray(value)) return fallback;
    const sanitized: StatusEffectEntry[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const name = typeof (raw as any).name === 'string' ? (raw as any).name.trim() : '';
        if (!name) continue;
        const id = typeof (raw as any).id === 'string' && (raw as any).id.trim()
            ? (raw as any).id.trim()
            : slugify(name);
        const remaining = (raw as any).remainingRounds;
        const severity = (raw as any).severity;
        const normalizedSeverity = typeof severity === 'string'
            ? (['leve', 'moderado', 'grave'].includes(severity) ? severity as StatusEffectEntry['severity'] : undefined)
            : undefined;
        sanitized.push({
            id,
            name,
            remainingRounds: typeof remaining === 'number' && Number.isFinite(remaining)
                ? clampNumber(remaining, 0, 100)
                : undefined,
            source: typeof (raw as any).source === 'string' ? (raw as any).source.slice(0, 120) : undefined,
            description: typeof (raw as any).description === 'string' ? (raw as any).description.slice(0, 220) : undefined,
            severity: normalizedSeverity,
        });
    }
    return sanitized;
};

const tickTimerList = <T extends { remainingRounds?: number }>(entries: T[], delta: number): T[] => {
    if (!Array.isArray(entries) || delta <= 0) return entries;
    return entries
        .map(entry => {
            if (entry.remainingRounds === undefined || entry.remainingRounds === null) return entry;
            const next = Math.max(0, entry.remainingRounds - delta);
            return { ...entry, remainingRounds: next };
        })
        .filter(entry => entry.remainingRounds === undefined || entry.remainingRounds > 0);
};

const combatantEntityToCanonical = (entity: CombatantStateEntity): CanonicalCombatant => {
    const cooldowns = Array.isArray(entity.cooldowns)
        ? entity.cooldowns.map(cooldown => ({
              id: cooldown.cooldownKey,
              name: cooldown.name,
              remainingRounds: cooldown.remainingRounds,
              totalRounds: cooldown.totalRounds ?? undefined,
              description: cooldown.description ?? undefined,
              resource: cooldown.resource ?? undefined,
          }))
        : [];

    const statusEffects = Array.isArray(entity.statusEffects)
        ? entity.statusEffects.map(effect => ({
              id: effect.effectKey,
              name: effect.name,
              remainingRounds: effect.remainingRounds ?? undefined,
              source: effect.source ?? undefined,
              description: effect.description ?? undefined,
              severity: effect.severity ?? undefined,
          }))
        : [];

    return {
        id: entity.combatantId,
        name: entity.name,
        hp: { current: entity.hpCurrent, max: entity.hpMax },
        ac: entity.ac ?? undefined,
        initiative: entity.initiative ?? undefined,
        isPlayer: entity.isPlayer,
        attitude: (entity.attitude as Attitude) ?? 'neutral',
        conditions: Array.isArray(entity.conditions) ? entity.conditions : [],
        hasMoved: entity.hasMoved,
        hasActed: entity.hasActed,
        isDead: entity.isDead,
        distance: entity.distance ?? undefined,
        zone: entity.zone ?? undefined,
        actionPoints: entity.actionPoints,
        bonusActionPoints: entity.bonusActionPoints,
        readyAction: entity.readyAction ?? null,
        tempModifiers: entity.tempModifiers ?? undefined,
        rollHistory: Array.isArray(entity.rollHistory) ? (entity.rollHistory as any) : [],
        cooldowns,
        statusEffects,
    };
};

const encounterEntitiesToCanonical = (encounter: CombatEncounter): CanonicalCombatState | null => {
    if (!encounter) return null;

    const combatantsEntities = encounter.combatants ?? [];
    if (!combatantsEntities.length) return null;

    const mapped = combatantsEntities.map(combatantEntityToCanonical);
    const initiativeOrder: string[] = Array.isArray(encounter.initiativeOrder) && encounter.initiativeOrder.length
        ? encounter.initiativeOrder
        : mapped.map(combatant => combatant.id);

    const orderMap = new Map(initiativeOrder.map((id, index) => [id, index]));
    mapped.sort((a, b) => {
        const aOrder = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
        if (aOrder === bOrder) return a.name.localeCompare(b.name);
        return aOrder - bOrder;
    });

    const logEntries = (encounter.logs ?? [])
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(entry => entry.message)
        .slice(-20);

    return {
        isActive: encounter.isActive,
        round: encounter.round ?? 1,
        turn: encounter.turn ?? 0,
        combatants: mapped,
        initiativeOrder,
        log: logEntries,
    };
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

    const distanceValue = typeof candidate.distance === 'number'
        ? clampNumber(candidate.distance, 0, 1000)
        : defaults?.distance;

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
        distance: distanceValue,
        zone: normaliseZone((candidate as any).zone, defaults?.zone, distanceValue),
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
        cooldowns: normaliseCooldowns((candidate as any).cooldowns, defaults?.cooldowns ?? []),
        statusEffects: normaliseStatusEffects((candidate as any).statusEffects, defaults?.statusEffects ?? []),
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

    const distanceValue = typeof candidate?.distance === 'number'
        ? clampNumber(candidate.distance, 0, 1000)
        : existing.distance;

    const nextZone = normaliseZone(
        candidate ? (candidate as any).zone : undefined,
        existing.zone,
        distanceValue,
    );
    if (nextZone !== existing.zone) {
        changed = true;
        if (candidate && (candidate as any).zone !== undefined) {
            notes.push(`Zona tática atualizada (${existing.name}): ${existing.zone ?? 'desconhecida'} → ${nextZone}`);
        }
    }

    const nextCooldowns = normaliseCooldowns(candidate ? (candidate as any).cooldowns : undefined, existing.cooldowns);
    if (nextCooldowns.length !== existing.cooldowns.length ||
        nextCooldowns.some((entry, index) => {
            const prev = existing.cooldowns[index];
            if (!prev) return true;
            return entry.id !== prev.id || entry.remainingRounds !== prev.remainingRounds;
        })) {
        changed = true;
        notes.push(`Cooldowns sincronizados (${existing.name}).`);
    }

    const nextStatusEffects = normaliseStatusEffects(candidate ? (candidate as any).statusEffects : undefined, existing.statusEffects);
    if (nextStatusEffects.length !== existing.statusEffects.length ||
        nextStatusEffects.some((entry, index) => {
            const prev = existing.statusEffects[index];
            if (!prev) return true;
            return entry.id !== prev.id || entry.remainingRounds !== prev.remainingRounds;
        })) {
        changed = true;
        notes.push(`Efeitos em andamento atualizados (${existing.name}).`);
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
        distance: distanceValue,
        zone: nextZone,
        actionPoints: nextActionPoints,
        bonusActionPoints: nextBonusPoints,
        readyAction: typeof candidate.readyAction === 'string' ? candidate.readyAction.slice(0, 280) : existing.readyAction,
        tempModifiers: nextTempModifiers,
        rollHistory: nextRollHistory,
        isDead: clampedCurrent <= 0,
        cooldowns: nextCooldowns,
        statusEffects: nextStatusEffects,
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
    zone: combatant.zone,
    actionPoints: combatant.actionPoints,
    bonusActionPoints: combatant.bonusActionPoints,
    readyAction: combatant.readyAction ?? undefined,
    tempModifiers: combatant.tempModifiers ?? undefined,
    rollHistory: combatant.rollHistory ?? [],
    cooldowns: combatant.cooldowns,
    statusEffects: combatant.statusEffects,
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
                const parsed = JSON.parse(cachedRaw) as { encounterId: number | null; state: CanonicalCombatState | null };
                if (parsed.state) {
                    return parsed;
                }
            }
        } catch (error) {
            console.warn('[combatStateService] Falha ao ler cache de combate:', error);
        }
    }

    const repository = AppDataSource.getRepository(CombatEncounter);
    const encounter = await repository.findOne({
        where: { sessaoId },
        relations: ['combatants', 'combatants.cooldowns', 'combatants.statusEffects', 'logs'],
        order: {
            updatedAt: 'DESC',
            logs: { orderIndex: 'ASC' },
        },
    });

    if (!encounter) {
        return { encounterId: null, state: null };
    }

    let canonical = encounterEntitiesToCanonical(encounter);
    if (!canonical && encounter.legacyState) {
        const legacy = sanitiseStoredState(encounter.legacyState as PartialCombatState);
        canonical = legacy;
    }

    if (canonical && redisClient && redisClient.isOpen) {
        await cacheCombatState(sessaoId, { encounterId: encounter.id, state: canonical });
    }

    return {
        encounterId: encounter.id,
        state: canonical ?? null,
    };
};

export const saveCombatEncounterState = async (
    queryRunner: QueryRunner,
    sessaoId: number,
    encounterId: number | null,
    state: CanonicalCombatState | null,
): Promise<void> => {
    const encounterRepo = queryRunner.manager.getRepository(CombatEncounter);
    const combatantRepo = queryRunner.manager.getRepository(CombatantStateEntity);
    const cooldownRepo = queryRunner.manager.getRepository(CombatCooldownEntity);
    const statusRepo = queryRunner.manager.getRepository(CombatStatusEffectEntity);
    const logRepo = queryRunner.manager.getRepository(CombatLogEntry);

    let encounter = encounterId
        ? await encounterRepo.findOne({
              where: { id: encounterId },
              relations: ['combatants', 'combatants.cooldowns', 'combatants.statusEffects', 'logs'],
          })
        : null;

    if (!state || !state.isActive) {
        if (encounter) {
            encounter.isActive = false;
            encounter.round = state?.round ?? encounter.round;
            encounter.turn = state?.turn ?? encounter.turn;
            encounter.initiativeOrder = state?.initiativeOrder ?? encounter.initiativeOrder ?? [];
            encounter.legacyState = state ?? null;
            await encounterRepo.save(encounter);
            await combatantRepo.delete({ encounterId: encounter.id });
            await logRepo.delete({ encounterId: encounter.id });
        }
        if (redisClient && redisClient.isOpen) {
            await redisClient.del(combatCacheKey(sessaoId));
        }
        return;
    }

    if (!encounter) {
        encounter = encounterRepo.create({
            sessaoId,
            isActive: true,
            round: state.round,
            turn: state.turn,
            initiativeOrder: state.initiativeOrder ?? state.combatants.map(c => c.id),
            legacyState: null,
        });
    } else {
        encounter.isActive = true;
        encounter.round = state.round;
        encounter.turn = state.turn;
        encounter.initiativeOrder = state.initiativeOrder ?? encounter.initiativeOrder ?? [];
        encounter.legacyState = null;
    }

    encounter = await encounterRepo.save(encounter);

    const existingCombatants = await combatantRepo.find({
        where: { encounterId: encounter.id },
        relations: ['cooldowns', 'statusEffects'],
    });
    const existingMap = new Map(existingCombatants.map(entity => [entity.combatantId, entity]));

    const seenCombatantIds = new Set<string>();

    for (const combatant of state.combatants) {
        const combatantId = combatant.id;
        seenCombatantIds.add(combatantId);

        let entity = existingMap.get(combatantId);
        if (!entity) {
            entity = combatantRepo.create({
                encounterId: encounter.id,
                combatantId,
            });
        }

        entity.name = combatant.name;
        entity.hpCurrent = clampNumber(combatant.hp.current, 0, Math.max(1, combatant.hp.max));
        entity.hpMax = Math.max(1, combatant.hp.max);
        entity.ac = combatant.ac ?? null;
        entity.initiative = combatant.initiative ?? null;
        entity.initiativeRoll = (combatant as any).initiativeRoll ?? null;
        entity.isPlayer = Boolean(combatant.isPlayer);
        entity.attitude = (combatant.attitude as any) ?? 'neutral';
        entity.conditions = Array.isArray(combatant.conditions) ? combatant.conditions : [];
        entity.hasMoved = Boolean(combatant.hasMoved);
        entity.hasActed = Boolean(combatant.hasActed);
        entity.isDead = Boolean(combatant.isDead);
        entity.distance = combatant.distance ?? null;
        entity.zone = combatant.zone ?? null;
        entity.actionPoints = clampNumber(combatant.actionPoints ?? 0, 0, AP_MAX);
        entity.bonusActionPoints = clampNumber(combatant.bonusActionPoints ?? 0, 0, 3);
        entity.readyAction = combatant.readyAction ?? null;
        entity.tempModifiers = combatant.tempModifiers ?? null;
        entity.rollHistory = Array.isArray(combatant.rollHistory) ? combatant.rollHistory : [];

        entity = await combatantRepo.save(entity);

        await cooldownRepo.delete({ combatantStateId: entity.id });
        if (Array.isArray(combatant.cooldowns) && combatant.cooldowns.length) {
            const cooldownEntities = combatant.cooldowns
                .filter(entry => entry && entry.name)
                .map(entry =>
                    cooldownRepo.create({
                        combatantStateId: entity.id,
                        cooldownKey: entry.id || slugify(`${combatantId}-${entry.name}`),
                        name: entry.name,
                        remainingRounds: clampNumber(entry.remainingRounds ?? 0, 0, 100),
                        totalRounds: entry.totalRounds != null ? clampNumber(entry.totalRounds, 0, 100) : null,
                        description: entry.description ?? null,
                        resource: entry.resource ?? null,
                    }),
                );
            if (cooldownEntities.length) {
                await cooldownRepo.save(cooldownEntities);
            }
        }

        await statusRepo.delete({ combatantStateId: entity.id });
        if (Array.isArray(combatant.statusEffects) && combatant.statusEffects.length) {
            const statusEntities = combatant.statusEffects
                .filter(entry => entry && entry.name)
                .map(entry =>
                    statusRepo.create({
                        combatantStateId: entity.id,
                        effectKey: entry.id || slugify(`${combatantId}-${entry.name}`),
                        name: entry.name,
                        remainingRounds: entry.remainingRounds != null ? clampNumber(entry.remainingRounds, 0, 100) : null,
                        source: entry.source ?? null,
                        description: entry.description ?? null,
                        severity: entry.severity ?? null,
                    }),
                );
            if (statusEntities.length) {
                await statusRepo.save(statusEntities);
            }
        }
    }

    const combatantIdsToDelete = existingCombatants
        .filter(entity => !seenCombatantIds.has(entity.combatantId))
        .map(entity => entity.id);

    if (combatantIdsToDelete.length) {
        await cooldownRepo.delete({ combatantStateId: In(combatantIdsToDelete) });
        await statusRepo.delete({ combatantStateId: In(combatantIdsToDelete) });
        await combatantRepo.delete(combatantIdsToDelete);
    }

    await logRepo.delete({ encounterId: encounter.id });
    if (Array.isArray(state.log) && state.log.length) {
        const trimmedLog = state.log.slice(-20);
        const logEntities = trimmedLog.map((message, index) =>
            logRepo.create({
                encounterId: encounter.id,
                orderIndex: index,
                round: state.round,
                turn: state.turn,
                message,
            }),
        );
        await logRepo.save(logEntities);
    }

    if (redisClient && redisClient.isOpen) {
        await cacheCombatState(sessaoId, { encounterId: encounter.id, state });
    }
};

export const clearCombatEncounterState = async (
    queryRunner: QueryRunner,
    encounterId: number | null
): Promise<void> => {
    if (!encounterId) return;
    const encounterRepo = queryRunner.manager.getRepository(CombatEncounter);
    const encounter = await encounterRepo.findOne({ where: { id: encounterId } });
    if (!encounter) return;

    await encounterRepo.delete({ id: encounterId });

    if (redisClient && redisClient.isOpen) {
        await redisClient.del(combatCacheKey(encounter.sessaoId));
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
        const roundDelta = round - stored.round;
        for (const combatant of canonical.combatants) {
            if (combatant.isDead) continue;

            const updatedCooldowns = tickTimerList(combatant.cooldowns, roundDelta);
            if (updatedCooldowns.length !== combatant.cooldowns.length ||
                updatedCooldowns.some((entry, index) => entry.remainingRounds !== combatant.cooldowns[index]?.remainingRounds)) {
                combatant.cooldowns = updatedCooldowns;
                telemetry.push(`Cooldowns avançados (${combatant.name}) em ${roundDelta} rodada(s).`);
                changed = true;
            }

            const updatedStatus = tickTimerList(combatant.statusEffects, roundDelta);
            if (updatedStatus.length !== combatant.statusEffects.length ||
                updatedStatus.some((entry, index) => entry.remainingRounds !== combatant.statusEffects[index]?.remainingRounds)) {
                combatant.statusEffects = updatedStatus;
                telemetry.push(`Efeitos atualizados (${combatant.name}); expiração automática aplicada.`);
                changed = true;
            }

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
