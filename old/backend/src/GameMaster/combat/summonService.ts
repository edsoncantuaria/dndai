import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { SessionCombatant } from '../database/entities/SessionCombatant.js';
import { SessionCombatEncounter } from '../database/entities/SessionCombatEncounter.js';
import { getSessionHeroEntityId } from '../character/heroStats.js';
import { applyCharacterStateDeltaPenai } from '../character/applyStateDelta.js';
import { buildSpellSlotCost } from '../../rules/spells.js';
import { loadPenaiCharacterSnapshot } from '../motor/characterSnapshot.js';
import { assertResourceAllowedForSession } from '../homebrew/moduleResolver.js';
import {
    SUMMON_SPELLS,
    SUMMON_TEMPLATES,
    isSummonSpellIndex,
    type SummonTemplate,
} from './summonCatalog.js';
import type { RuleCheckResult } from '../../rules/types.js';
import type { PlayerRollRequest } from '../../types.js';

export type SessionCompanion = {
    id: string;
    name: string;
    templateKey: string;
    source: string;
    hpMax: number;
    hpCurrent: number;
    ac: number;
    attackBonus: number;
    damageDice: string;
    canAttack: boolean;
    expiresAfterCombat?: boolean;
};

function companionFromTemplate(
    template: SummonTemplate,
    opts: { source: string; name?: string; expiresAfterCombat?: boolean },
): SessionCompanion {
    return {
        id: `summon-${randomUUID()}`,
        name: opts.name ?? template.displayName,
        templateKey: template.key,
        source: opts.source,
        hpMax: template.hpMax,
        hpCurrent: template.hpMax,
        ac: template.ac,
        attackBonus: template.attackBonus,
        damageDice: template.damageDice,
        canAttack: template.canAttack,
        expiresAfterCombat: opts.expiresAfterCombat,
    };
}

async function loadHeroSrdBuild(sessionId: number): Promise<{
    heroEntityId: string;
    srdBuild: Record<string, unknown>;
} | null> {
    const heroEntityId = await getSessionHeroEntityId(sessionId);
    if (!heroEntityId) return null;
    const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
        where: { id: heroEntityId },
    });
    if (!hero) return null;
    const stats = (hero.stats ?? {}) as Record<string, unknown>;
    const srdBuild = (stats.srdBuild ?? {}) as Record<string, unknown>;
    return { heroEntityId, srdBuild };
}

async function saveCompanions(
    heroEntityId: string,
    companions: SessionCompanion[],
): Promise<void> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const hero = await repo.findOne({ where: { id: heroEntityId } });
    if (!hero) return;
    const stats = (hero.stats ?? {}) as Record<string, unknown>;
    const srdBuild = { ...((stats.srdBuild ?? {}) as Record<string, unknown>), companions };
    hero.stats = { ...stats, srdBuild };
    await repo.save(hero);
}

export async function listSessionCompanions(sessionId: number): Promise<SessionCompanion[]> {
    const loaded = await loadHeroSrdBuild(sessionId);
    if (!loaded) return [];
    const raw = loaded.srdBuild.companions;
    return Array.isArray(raw) ? (raw as SessionCompanion[]) : [];
}

export async function getSessionCompanionById(
    sessionId: number,
    companionId: string,
): Promise<SessionCompanion | null> {
    const companions = await listSessionCompanions(sessionId);
    return companions.find(c => c.id === companionId) ?? null;
}

export async function getCurrentAllyCombatant(sessionId: number): Promise<{
    combatant: SessionCombatant;
    companion: SessionCompanion;
} | null> {
    const session = await PenaiDataSource.getRepository(
        (await import('../database/entities/GameSession.js')).GameSession,
    ).findOne({ where: { id: sessionId } });
    if (!session?.activeCombatEncounterId) return null;

    const enc = await PenaiDataSource.getRepository(SessionCombatEncounter).findOne({
        where: { id: session.activeCombatEncounterId, isActive: true },
        relations: ['combatants'],
    });
    if (!enc) return null;

    const order = enc.initiativeOrder ?? [];
    const currentKey = order[enc.turn];
    if (!currentKey) return null;

    const combatant = (enc.combatants ?? []).find(c => c.entityKey === currentKey);
    if (!combatant || combatant.side !== 'ally') return null;

    const companion = await getSessionCompanionById(sessionId, combatant.entityKey);
    if (!companion) return null;

    return { combatant, companion };
}

async function rollInitiativeForCompanion(companion: SessionCompanion): Promise<number> {
    const template = SUMMON_TEMPLATES[companion.templateKey];
    const dexGuess = template?.key === 'skeleton' ? 14 : 12;
    const mod = Math.floor((dexGuess - 10) / 2);
    return Math.floor(Math.random() * 20) + 1 + mod;
}

/** Insere aliado vivo na ordem de iniciativa do encontro ativo. */
export async function addCompanionToActiveCombat(
    sessionId: number,
    companion: SessionCompanion,
): Promise<void> {
    const session = await PenaiDataSource.getRepository(
        (await import('../database/entities/GameSession.js')).GameSession,
    ).findOne({ where: { id: sessionId } });
    if (!session?.activeCombatEncounterId) return;

    const encRepo = PenaiDataSource.getRepository(SessionCombatEncounter);
    const combatantRepo = PenaiDataSource.getRepository(SessionCombatant);
    const enc = await encRepo.findOne({
        where: { id: session.activeCombatEncounterId, isActive: true },
        relations: ['combatants'],
    });
    if (!enc) return;

    const existing = (enc.combatants ?? []).find(c => c.entityKey === companion.id);
    if (existing) {
        existing.hpCurrent = companion.hpCurrent;
        existing.hpMax = companion.hpMax;
        await combatantRepo.save(existing);
        return;
    }

    const initiative = await rollInitiativeForCompanion(companion);
    await combatantRepo.save(
        combatantRepo.create({
            encounterId: enc.id,
            entityKey: companion.id,
            displayName: companion.name,
            side: 'ally',
            hpCurrent: companion.hpCurrent,
            hpMax: companion.hpMax,
            armorClass: companion.ac,
            initiative,
            conditions: [],
        }),
    );

    const all = await combatantRepo.find({ where: { encounterId: enc.id } });
    const living = all.filter(c => c.hpCurrent > 0);
    enc.initiativeOrder = [...living]
        .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
        .map(c => c.entityKey);
    await encRepo.save(enc);
}

/** Registra companheiros persistentes e os coloca no combate ativo. */
export async function deployCompanionsToCombat(sessionId: number): Promise<void> {
    const companions = await listSessionCompanions(sessionId);
    for (const c of companions.filter(c => c.hpCurrent > 0)) {
        await addCompanionToActiveCombat(sessionId, c);
    }
}

/** Patrulheiro nível 3+: garante um companheiro animal se ainda não houver. */
export async function ensureRangerCompanionIfEligible(sessionId: number): Promise<SessionCompanion | null> {
    const loaded = await loadHeroSrdBuild(sessionId);
    if (!loaded) return null;

    const classIndex = String(
        loaded.srdBuild.characterClass ?? loaded.srdBuild.class ?? '',
    ).toLowerCase();
    const level =
        typeof loaded.srdBuild.level === 'number'
            ? loaded.srdBuild.level
            : Number(loaded.srdBuild.level ?? 1);
    if (classIndex !== 'ranger' || level < 3) return null;

    const existing = await listSessionCompanions(sessionId);
    const hasCompanion = existing.some(c => c.source === 'ranger-companion' && c.hpCurrent > 0);
    if (hasCompanion) return existing.find(c => c.source === 'ranger-companion') ?? null;

    const template = SUMMON_TEMPLATES['ranger-companion'];
    const companion = companionFromTemplate(template, {
        source: 'ranger-companion',
        name: 'Companheiro animal',
        expiresAfterCombat: false,
    });
    await saveCompanions(loaded.heroEntityId, [...existing, companion]);
    return companion;
}

export async function registerCompanions(
    sessionId: number,
    newOnes: SessionCompanion[],
): Promise<SessionCompanion[]> {
    const loaded = await loadHeroSrdBuild(sessionId);
    if (!loaded) return [];

    const existing = await listSessionCompanions(sessionId);
    const merged = [...existing, ...newOnes];
    await saveCompanions(loaded.heroEntityId, merged);
    return merged;
}

export async function syncCompanionHpFromCombat(
    sessionId: number,
    companionId: string,
    hpCurrent: number,
): Promise<void> {
    const loaded = await loadHeroSrdBuild(sessionId);
    if (!loaded) return;
    const companions = await listSessionCompanions(sessionId);
    const idx = companions.findIndex(c => c.id === companionId);
    if (idx < 0) return;
    companions[idx] = {
        ...companions[idx],
        hpCurrent: Math.max(0, Math.min(companions[idx].hpMax, hpCurrent)),
    };
    await saveCompanions(loaded.heroEntityId, companions);
}

export async function purgeExpiredCombatCompanions(sessionId: number): Promise<void> {
    const loaded = await loadHeroSrdBuild(sessionId);
    if (!loaded) return;
    const companions = await listSessionCompanions(sessionId);
    const kept = companions.filter(c => !c.expiresAfterCombat);
    if (kept.length !== companions.length) {
        await saveCompanions(loaded.heroEntityId, kept);
    }
}

export type SummonSpellResult = {
    companions: SessionCompanion[];
    spellIndex: string;
};

export async function validateSummonSpellIntent(opts: {
    sessionId: number;
    spellIndex: string;
    slotLevel?: number;
}): Promise<RuleCheckResult> {
    const spellIndex = opts.spellIndex.trim().toLowerCase();
    if (!isSummonSpellIndex(spellIndex)) {
        return { status: 'rejected', reason: `Magia "${spellIndex}" não é uma invocação suportada.` };
    }

    const hb = await assertResourceAllowedForSession(opts.sessionId, 'spell', spellIndex);
    if (!hb.allowed) {
        return { status: 'rejected', reason: hb.reason ?? 'Magia não permitida nesta campanha.' };
    }

    const snapshot = await loadPenaiCharacterSnapshot(opts.sessionId);
    if (!snapshot) {
        return { status: 'rejected', reason: 'Ficha do herói indisponível.' };
    }

    const loaded = await loadHeroSrdBuild(opts.sessionId);
    const known = Array.isArray(loaded?.srdBuild.spells)
        ? (loaded!.srdBuild.spells as string[]).map(s => String(s).toLowerCase())
        : [];
    if (known.length && !known.includes(spellIndex)) {
        return { status: 'rejected', reason: `Você não conhece a magia ${spellIndex}.` };
    }

    const config = SUMMON_SPELLS[spellIndex];
    const slotLevel = opts.slotLevel ?? config.slotLevel;
    const key = `level-${slotLevel}`;
    const slot = snapshot.resources?.find(r => r.type === 'spell-slot' && r.key === key);
    if (!slot || slot.current <= 0) {
        return {
            status: 'rejected',
            reason: `Sem slot de magia de nível ${slotLevel} disponível.`,
        };
    }

    return { status: 'accepted', reason: `Invocar via ${spellIndex}.` };
}

export async function executeSummonSpell(opts: {
    sessionId: number;
    spellIndex: string;
    slotLevel?: number;
}): Promise<SummonSpellResult> {
    const spellIndex = opts.spellIndex.trim().toLowerCase();
    const config = SUMMON_SPELLS[spellIndex];
    const slotLevel = opts.slotLevel ?? config.slotLevel;
    const templateKey = config.templateKeys[0];
    const template = SUMMON_TEMPLATES[templateKey];
    if (!template) {
        throw new Error(`Template de invocação ausente: ${templateKey}`);
    }

    await applyCharacterStateDeltaPenai(opts.sessionId, {
        resources: [
            {
                type: 'spell-slot',
                key: `level-${slotLevel}`,
                delta: -1,
            },
        ],
    });

    const spawned: SessionCompanion[] = [];
    for (let i = 0; i < config.count; i++) {
        const suffix = config.count > 1 ? ` ${i + 1}` : '';
        spawned.push(
            companionFromTemplate(template, {
                source: spellIndex,
                name: `${template.displayName}${suffix}`,
                expiresAfterCombat: config.expiresAfterCombat,
            }),
        );
    }

    await registerCompanions(opts.sessionId, spawned);

    for (const c of spawned) {
        await addCompanionToActiveCombat(opts.sessionId, c);
    }

    return { companions: spawned, spellIndex };
}

export async function resolveSummonFromPlayerText(
    sessionId: number,
    playerAction: string,
    spellIndex: string,
): Promise<{ ok: true; result: SummonSpellResult } | { ok: false; reason: string }> {
    const check = await validateSummonSpellIntent({ sessionId, spellIndex });
    if (check.status === 'rejected') {
        return { ok: false, reason: check.reason ?? 'Invocação rejeitada.' };
    }
    const result = await executeSummonSpell({ sessionId, spellIndex });
    return { ok: true, result };
}

export function buildCompanionAttackRollRequest(
    companion: SessionCompanion,
    target: { id: string; name: string; armorClass: number; encounterId: number },
    context: string,
): PlayerRollRequest {
    return {
        reason: context || `${companion.name} ataca ${target.name}`,
        dice: '1d20',
        modifier: companion.attackBonus,
        dc: target.armorClass,
        rollType: 'attack',
        requestId: randomUUID(),
        metadata: {
            effect: 'attack',
            damageFormula: companion.damageDice,
            source: { name: companion.name, kind: 'feature', index: companion.templateKey },
            targets: [
                {
                    kind: 'entity',
                    id: target.id,
                    name: target.name,
                    armorClass: target.armorClass,
                    encounterId: target.encounterId,
                },
            ],
            attackerEntityId: companion.id,
        } as PlayerRollRequest['metadata'],
    };
}

export { buildSpellSlotCost };
