import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { SessionCombatant } from '../database/entities/SessionCombatant.js';
import createError from 'http-errors';
import { createGameSession } from '../sessions/sessionService.js';
import { getPenaiCombatState } from '../combat/combatPenai.js';

async function assertSessionOwner(sessionId: number, userId: number): Promise<GameSession> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId, userId },
    });
    if (!session) throw createError(404, 'Sessão não encontrada.');
    return session;
}

export async function clonePenaiSession(
    sessionId: number,
    userId: number,
): Promise<Record<string, unknown>> {
    const source = await assertSessionOwner(sessionId, userId);
    const cloneName = `${source.nome} (cópia)`.slice(0, 100);

    let heroName = 'Herói';
    if (source.heroWorldEntityId) {
        const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
            where: { id: source.heroWorldEntityId },
        });
        if (hero) heroName = hero.displayName;
    }

    const created = await createGameSession({
        userId,
        nome: cloneName,
        heroName,
    });

    const newSessionId = Number(created.id);
    const repo = PenaiDataSource.getRepository(GameSession);
    const newSession = await repo.findOne({ where: { id: newSessionId } });
    if (newSession) {
        newSession.currentRegionSlug = source.currentRegionSlug;
        newSession.gameClock = source.gameClock;
        if (source.heroWorldEntityId) {
            newSession.heroWorldEntityId = source.heroWorldEntityId;
        }
        await repo.save(newSession);
    }

    const { SessionInstalledModule } = await import('../database/entities/SessionInstalledModule.js');
    const moduleRepo = PenaiDataSource.getRepository(SessionInstalledModule);
    const modules = await moduleRepo.find({ where: { sessionId } });
    for (const mod of modules) {
        await moduleRepo.save(
            moduleRepo.create({
                sessionId: newSessionId,
                moduleId: mod.moduleId,
                version: mod.version,
                kind: mod.kind,
                payload: mod.payload,
            }),
        );
    }

    const entityStates = await PenaiDataSource.getRepository(SessionEntityState).find({
        where: { sessionId },
    });
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    for (const st of entityStates) {
        if (st.worldEntityId === source.heroWorldEntityId) continue;
        await stateRepo.save(
            stateRepo.create({
                sessionId: newSessionId,
                worldEntityId: st.worldEntityId,
                appeared: st.appeared,
                sessionAlive: st.sessionAlive,
                canAppear: st.canAppear,
                relationshipToHero: st.relationshipToHero,
                sessionStatsSnapshot: st.sessionStatsSnapshot,
                sessionOverlay: st.sessionOverlay,
                lastSeenAt: st.lastSeenAt,
            }),
        );
    }

    if (source.heroWorldEntityId) {
        const { listHeroInventory, addHeroInventoryItem } = await import('../character/heroInventory.js');
        const items = await listHeroInventory(sessionId, source.heroWorldEntityId);
        for (const item of items) {
            await addHeroInventoryItem({
                sessionId: newSessionId,
                heroEntityId: source.heroWorldEntityId,
                itemKey: item.itemKey,
                name: item.name,
                quantity: item.quantity,
                equipped: item.equipped,
                itemData: item.itemData,
            });
        }
        const sourceHeroState = entityStates.find(s => s.worldEntityId === source.heroWorldEntityId);
        if (sourceHeroState?.sessionStatsSnapshot) {
            await stateRepo.save(
                stateRepo.create({
                    sessionId: newSessionId,
                    worldEntityId: source.heroWorldEntityId,
                    appeared: true,
                    sessionAlive: true,
                    canAppear: true,
                    relationshipToHero: {},
                    sessionStatsSnapshot: sourceHeroState.sessionStatsSnapshot,
                    lastSeenAt: new Date(),
                }),
            );
        }
    }

    return created;
}

export async function buildPenaiSessionCast(sessionId: number, userId: number) {
    await assertSessionOwner(sessionId, userId);
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const members: Array<Record<string, unknown>> = [];

    if (session?.heroWorldEntityId) {
        const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
            where: { id: session.heroWorldEntityId },
        });
        if (hero) {
            members.push({
                id: hero.id,
                displayName: hero.displayName,
                role: 'pc',
                vitals: 'alive',
                source: 'hero',
            });
        }
    }

    const entityStates = await PenaiDataSource.getRepository(SessionEntityState).find({
        where: { sessionId },
    });
    for (const st of entityStates) {
        if (st.worldEntityId === session?.heroWorldEntityId) continue;
        const entity = await PenaiDataSource.getRepository(WorldEntity).findOne({
            where: { id: st.worldEntityId },
        });
        if (!entity || entity.entityType === 'faction') continue;
        members.push({
            id: entity.id,
            displayName: entity.displayName,
            role: entity.entityType === 'monster' ? 'enemy' : 'npc',
            vitals: 'alive',
            source: 'session_state',
        });
    }

    const combat = await getPenaiCombatState(sessionId);
    for (const c of combat.combatants) {
        if (members.some(m => m.id === c.entityKey)) continue;
        members.push({
            id: c.entityKey,
            displayName: c.displayName,
            role: c.side === 'hero' ? 'pc' : 'enemy',
            vitals: c.hp <= 0 ? 'dead' : 'alive',
            source: 'combat',
            hp: c.hp,
            hpMax: c.hpMax,
        });
    }

    return { sessionId, members };
}

export async function updatePenaiCastMember(
    sessionId: number,
    userId: number,
    memberId: string,
    patch: Partial<{ displayName: string; role: string; vitals: string }>,
): Promise<Record<string, unknown>> {
    await assertSessionOwner(sessionId, userId);
    const entityRepo = PenaiDataSource.getRepository(WorldEntity);
    const entity = await entityRepo.findOne({ where: { id: memberId } });

    if (patch.displayName && entity) {
        entity.displayName = patch.displayName.slice(0, 120);
        await entityRepo.save(entity);
    }

    if (patch.vitals) {
        const combatantRepo = PenaiDataSource.getRepository(SessionCombatant);
        const row = await combatantRepo.findOne({
            where: { sessionId, entityKey: memberId },
        });
        if (row) {
            if (patch.vitals === 'dead') row.hpCurrent = 0;
            if (patch.vitals === 'alive' && row.hpCurrent <= 0) row.hpCurrent = Math.max(1, row.hpMax);
            await combatantRepo.save(row);
        }
    }

    const cast = await buildPenaiSessionCast(sessionId, userId);
    const updated = cast.members.find(m => String(m.id) === memberId);
    if (!updated) throw createError(404, 'Membro do elenco não encontrado.');
    return updated;
}

export async function buildPenaiSessionReplayMarkdown(
    sessionId: number,
    userId: number,
): Promise<string> {
    const session = await assertSessionOwner(sessionId, userId);
    const events = await PenaiDataSource.getRepository(WorldEvent).find({
        where: { sessionId },
        order: { createdAt: 'ASC' },
    });

    const lines = [
        `# Replay — ${session.nome}`,
        '',
        `_Sessão #${sessionId} · motor PENAI_`,
        '',
    ];

    for (const ev of events) {
        const ts = ev.createdAt.toISOString();
        const payload = JSON.stringify(ev.payload ?? {});
        lines.push(`- **${ev.type}** (${ts}) ${payload.length > 120 ? payload.slice(0, 117) + '…' : payload}`);
    }

    if (events.length === 0) {
        lines.push('_Nenhum evento registrado ainda._');
    }

    return lines.join('\n');
}

export async function executeNpcTurnAttack(sessionId: number): Promise<{
    hit: boolean;
    damage: number;
    targetName: string;
    attackerName: string;
} | null> {
    const combat = await getPenaiCombatState(sessionId);
    if (!combat.isActive || !combat.currentEntityKey) return null;

    const attacker = combat.combatants.find(c => c.entityKey === combat.currentEntityKey);
    if (!attacker || attacker.side === 'hero') return null;

    const hero = combat.combatants.find(c => c.side === 'hero');
    if (!hero) return null;

    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const hit = attackRoll + 3 >= hero.armorClass;
    const damage = hit ? Math.floor(Math.random() * 6) + 1 + 2 : 0;

    if (hit && damage > 0) {
        const combatantRepo = PenaiDataSource.getRepository(SessionCombatant);
        const row = await combatantRepo.findOne({
            where: { entityKey: hero.entityKey },
        });
        if (row) {
            row.hpCurrent = Math.max(0, row.hpCurrent - damage);
            await combatantRepo.save(row);
        }
        const { syncHeroHpPenai } = await import('../character/syncHeroHpPenai.js');
        await syncHeroHpPenai(sessionId);
    }

    return {
        hit,
        damage,
        targetName: hero.displayName,
        attackerName: attacker.displayName,
    };
}
