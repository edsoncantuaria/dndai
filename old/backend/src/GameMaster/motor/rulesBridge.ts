import { randomUUID } from 'crypto';
import type { PlayerRollRequest } from '../../types.js';
import type { RuleCheckResult } from '../../rules/types.js';
import { validateWeaponAttack } from '../../rules/attack.js';
import { validateSkillCheck } from '../../rules/skills.js';
import { validateSpellAttack } from '../../rules/spellAttack.js';
import { loadPenaiCharacterSnapshot } from './characterSnapshot.js';
import { getPenaiCombatState } from '../combat/engine.js';
import { getCurrentAllyCombatant, buildCompanionAttackRollRequest } from '../combat/summonService.js';

export function ruleCheckToPlayerRollRequest(
    check: RuleCheckResult,
    context: string,
): PlayerRollRequest | null {
    if (check.status !== 'needs_roll' || !check.rollRequest) return null;
    const rr = check.rollRequest;
    const formula = rr.formula || '1d20';
    const dice = formula.match(/\d+d\d+/i)?.[0] ?? '1d20';
    const modifierMatch = formula.match(/[+-]\s*(\d+)/);
    const modifier =
        modifierMatch != null
            ? Number(modifierMatch[0].replace(/\s/g, ''))
            : 0;

    const rollType =
        rr.metadata?.effect === 'damage'
            ? 'damage'
            : rr.metadata?.effect === 'healing'
              ? 'healing'
              : 'attack';

    return {
        reason: rr.context || context,
        dice,
        modifier: Number.isFinite(modifier) ? modifier : 0,
        dc: rr.targetDc,
        rollType,
        requestId: randomUUID(),
        metadata: rr.metadata as PlayerRollRequest['metadata'],
    };
}

async function buildCombatTargets(sessionId: number, targetName?: string) {
    const combat = await getPenaiCombatState(sessionId);
    if (!combat.isActive || !combat.encounterId) return [];

    const heroKey = combat.combatants.find(c => c.side === 'hero')?.entityKey;
    const enemies = combat.combatants.filter(c => c.side === 'enemy' && c.hp > 0);
    const named = targetName
        ? enemies.find(e => e.displayName.toLowerCase().includes(targetName.toLowerCase()))
        : enemies[0];

    const target = named ?? enemies[0];
    if (!target) return [];

    return [
        {
            kind: 'entity' as const,
            id: target.entityKey,
            name: target.displayName,
            armorClass: target.armorClass,
            encounterId: combat.encounterId,
        },
    ];
}

export async function validatePenaiSkillIntent(opts: {
    sessionId: number;
    playerAction: string;
    payload: Record<string, unknown>;
}): Promise<{ ruleCheck: RuleCheckResult; playerRollRequest: PlayerRollRequest | null }> {
    const snapshot = await loadPenaiCharacterSnapshot(opts.sessionId);
    const context = opts.playerAction.slice(0, 120);
    const skillIndex = String(opts.payload.skillIndex ?? '');

    if (snapshot && skillIndex) {
        const result = await validateSkillCheck(snapshot, {
            skillIndex,
            dc: typeof opts.payload.dc === 'number' ? opts.payload.dc : 15,
        });
        return {
            ruleCheck: result,
            playerRollRequest: ruleCheckToPlayerRollRequest(result, context) ?? {
                reason: context,
                dice: '1d20',
                modifier: 0,
                rollType: 'check',
                requestId: randomUUID(),
            },
        };
    }

    return validatePenaiCombatIntent(opts);
}

export async function validatePenaiSpellIntent(opts: {
    sessionId: number;
    playerAction: string;
    payload: Record<string, unknown>;
}): Promise<{ ruleCheck: RuleCheckResult; playerRollRequest: PlayerRollRequest | null }> {
    const snapshot = await loadPenaiCharacterSnapshot(opts.sessionId);
    const context = opts.playerAction.slice(0, 120);
    const spellIndex = String(opts.payload.spellIndex ?? opts.payload.spell ?? '');
    const targets = await buildCombatTargets(
        opts.sessionId,
        opts.payload.targetName ? String(opts.payload.targetName) : undefined,
    );
    const targetAc =
        targets[0]?.armorClass ??
        (typeof opts.payload.targetArmorClass === 'number' ? opts.payload.targetArmorClass : 13);

    if (snapshot && spellIndex) {
        try {
            const result = await validateSpellAttack(snapshot, {
                spellIndex,
                ability: 'intelligence',
                targetArmorClass: targetAc,
                targetName: targets[0]?.name,
                targetId: targets[0]?.id,
                slotLevel: typeof opts.payload.slotLevel === 'number' ? opts.payload.slotLevel : undefined,
            });
            const rollReq = ruleCheckToPlayerRollRequest(result, context);
            if (rollReq?.metadata) {
                rollReq.metadata.targets = targets.length ? targets : rollReq.metadata.targets;
            }
            return { ruleCheck: result, playerRollRequest: rollReq };
        } catch (err) {
            return {
                ruleCheck: {
                    status: 'rejected',
                    reason: err instanceof Error ? err.message : 'Magia inválida.',
                },
                playerRollRequest: null,
            };
        }
    }

    const spellMod = snapshot
        ? Math.max(
              Math.floor((snapshot.abilities.intelligence - 10) / 2),
              Math.floor((snapshot.abilities.charisma - 10) / 2),
          ) + snapshot.proficiencyBonus
        : 0;

    const defaultCheck: RuleCheckResult = {
        status: 'needs_roll',
        reason: spellIndex
            ? `Conjurar ${spellIndex} (ataque de magia).`
            : 'Ataque de magia (PENAI_MOTOR).',
        rollRequest: {
            formula: '1d20',
            modifierBreakdown: [`modificador conjuração +${spellMod}`],
            context,
            targetDc: targetAc,
            metadata: {
                effect: 'attack',
                damageFormula: '2d6+3',
                source: { kind: 'spell', name: spellIndex || 'Magia' },
                targets: targets.length ? targets : undefined,
            },
        },
    };

    const playerRollRequest: PlayerRollRequest = {
        reason: context || 'Ataque de magia',
        dice: '1d20',
        modifier: spellMod,
        dc: targetAc,
        rollType: 'attack',
        requestId: randomUUID(),
        metadata: defaultCheck.rollRequest?.metadata as PlayerRollRequest['metadata'],
    };

    return { ruleCheck: defaultCheck, playerRollRequest };
}

export async function validatePenaiCombatIntent(opts: {
    sessionId: number;
    playerAction: string;
    payload: Record<string, unknown>;
}): Promise<{ ruleCheck: RuleCheckResult; playerRollRequest: PlayerRollRequest | null }> {
    const snapshot = await loadPenaiCharacterSnapshot(opts.sessionId);
    const context = opts.playerAction.slice(0, 120);
    const targetName = opts.payload.targetName ? String(opts.payload.targetName) : undefined;
    const targets = await buildCombatTargets(opts.sessionId, targetName);

    const allyTurn = await getCurrentAllyCombatant(opts.sessionId);
    if (allyTurn?.companion.canAttack && targets[0]) {
        const target = targets[0];
        const defaultCheck: RuleCheckResult = {
            status: 'needs_roll',
            reason: `${allyTurn.companion.name} ataca ${target.name ?? 'o alvo'}.`,
            rollRequest: {
                formula: `1d20+${allyTurn.companion.attackBonus}`,
                modifierBreakdown: [`bônus de ataque +${allyTurn.companion.attackBonus}`],
                context,
                targetDc: target.armorClass,
                metadata: {
                    effect: 'attack',
                    damageFormula: allyTurn.companion.damageDice,
                    source: {
                        name: allyTurn.companion.name,
                        kind: 'feature',
                        index: allyTurn.companion.templateKey,
                    },
                    targets: [target],
                    attackerEntityId: allyTurn.companion.id,
                },
            },
        };
        return {
            ruleCheck: defaultCheck,
            playerRollRequest: buildCompanionAttackRollRequest(
                allyTurn.companion,
                {
                    id: target.id!,
                    name: target.name ?? 'Alvo',
                    armorClass: target.armorClass ?? 13,
                    encounterId: target.encounterId!,
                },
                context,
            ),
        };
    }

    const structuredType = opts.payload.structuredIntent as string | undefined;

    if (snapshot && structuredType === 'weapon-attack' && opts.payload.weaponIndex) {
        const targetAc =
            targets[0]?.armorClass ??
            (typeof opts.payload.targetArmorClass === 'number' ? opts.payload.targetArmorClass : 13);
        const result = await validateWeaponAttack(snapshot, {
            weaponIndex: String(opts.payload.weaponIndex),
            targetArmorClass: targetAc,
            targetName: targets[0]?.name ?? targetName ?? 'Alvo',
        });
        const rollReq = ruleCheckToPlayerRollRequest(result, context);
        if (rollReq?.metadata) {
            rollReq.metadata.targets = targets.length ? targets : rollReq.metadata.targets;
        }
        return { ruleCheck: result, playerRollRequest: rollReq };
    }

    if (snapshot && structuredType === 'skill-check' && opts.payload.skillIndex) {
        const result = await validateSkillCheck(snapshot, {
            skillIndex: String(opts.payload.skillIndex),
            dc: typeof opts.payload.dc === 'number' ? opts.payload.dc : 15,
        });
        return {
            ruleCheck: result,
            playerRollRequest: ruleCheckToPlayerRollRequest(result, context),
        };
    }

    const targetAc =
        targets[0]?.armorClass ??
        (typeof opts.payload.targetArmorClass === 'number' ? opts.payload.targetArmorClass : 13);

    const defaultCheck: RuleCheckResult = {
        status: 'needs_roll',
        reason: 'Rolagem de ataque (PENAI_MOTOR).',
        rollRequest: {
            formula: '1d20',
            modifierBreakdown: snapshot
                ? [`modificador +${Math.max(0, Math.floor((snapshot.abilities.strength - 10) / 2))}`]
                : [],
            context,
            targetDc: targetAc,
            metadata: {
                effect: 'attack',
                damageFormula: '1d8+3',
                source: { kind: 'weapon', name: 'Ataque' },
                targets: targets.length ? targets : undefined,
            },
        },
    };

    const playerRollRequest: PlayerRollRequest = {
        reason: context || 'Rolagem de ataque',
        dice: '1d20',
        modifier: snapshot
            ? Math.max(0, Math.floor((snapshot.abilities.strength - 10) / 2)) +
              snapshot.proficiencyBonus
            : 0,
        dc: targetAc,
        rollType: 'attack',
        requestId: randomUUID(),
        metadata: defaultCheck.rollRequest?.metadata as PlayerRollRequest['metadata'],
    };

    return { ruleCheck: defaultCheck, playerRollRequest };
}
