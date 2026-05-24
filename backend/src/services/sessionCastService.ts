import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessionCastMember, type CastRole, type CastVitals } from '../entities/SessionCastMember.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { Character } from '../entities/Character.js';
import { Relationship } from '../entities/Relationship.js';

export type WorldEchoDto = {
    name: string;
    kind: 'other_player';
    regionSlug?: string | null;
    note: string;
};

type CastSyncSource = 'relationship' | 'combat' | 'player';

type CombatantInput = {
    id?: string;
    name?: string;
    isPlayer?: boolean;
    isDead?: boolean;
    hp?: { current?: number; max?: number };
    attitude?: 'hostile' | 'neutral' | 'ally';
};

export type CreateCastMemberInput = {
    displayName: string;
    role: CastRole;
    vitals?: CastVitals;
    characterId?: number | null;
    sheetSnapshot?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    visibleToParty?: boolean;
};

async function assertSessionOwner(sessionId: number, userId: number): Promise<SessaoIA> {
    const repo = AppDataSource.getRepository(SessaoIA);
    const sessao = await repo.findOne({
        where: { id: sessionId, userId },
        relations: ['character'],
    });
    if (!sessao) {
        throw createError(404, 'Sessão não encontrada.');
    }
    return sessao;
}

function characterToSnapshot(character: Character): Record<string, unknown> {
    return {
        id: character.id,
        name: character.name,
        race: character.race,
        characterClass: character.characterClass,
        level: character.level,
        xp: character.xp,
        background: character.background,
        worldState: character.worldState,
    };
}

function normalizeSlug(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function relationshipToRole(status: Relationship['status']): CastRole {
    if (status === 'hostile' || status === 'unfriendly') return 'enemy';
    if (status === 'ally' || status === 'friendly') return 'ally';
    return 'npc';
}

function combatantToRole(c: CombatantInput): CastRole {
    if (c.isPlayer) return 'pc';
    if (c.attitude === 'ally') return 'ally';
    if (c.attitude === 'hostile') return 'enemy';
    return 'enemy';
}

function combatantToVitals(c: CombatantInput): CastVitals {
    if (c.isDead) return 'dead';
    const current = c.hp?.current;
    if (typeof current === 'number' && current <= 0) return 'unconscious';
    return 'alive';
}

function castSyncKey(source: CastSyncSource, id: string): string {
    return `${source}:${id}`;
}

async function upsertAutoCastMember(
    sessionId: number,
    userId: number,
    key: string,
    input: CreateCastMemberInput & { metadata: Record<string, unknown> },
): Promise<void> {
    const repo = AppDataSource.getRepository(SessionCastMember);
    const members = await repo.find({ where: { sessionId } });
    const existing = members.find(m => {
        const meta = m.metadata as { syncKey?: string } | null;
        return meta?.syncKey === key;
    });

    if (existing) {
        existing.displayName = input.displayName;
        existing.role = input.role;
        existing.vitals = input.vitals ?? existing.vitals;
        if (input.sheetSnapshot) existing.sheetSnapshot = input.sheetSnapshot;
        existing.metadata = { ...(existing.metadata ?? {}), ...input.metadata, syncKey: key, auto: true };
        await repo.save(existing);
        return;
    }

    await addSessionCastMember(sessionId, userId, {
        ...input,
        metadata: { ...input.metadata, syncKey: key, auto: true },
    });
}

async function pruneAutoCastMembers(sessionId: number, activeKeys: Set<string>): Promise<void> {
    const repo = AppDataSource.getRepository(SessionCastMember);
    const members = await repo.find({ where: { sessionId } });
    const toRemove = members.filter(m => {
        if (m.role === 'pc') return false;
        const meta = m.metadata as { auto?: boolean; syncKey?: string } | null;
        if (!meta?.auto || !meta.syncKey) return false;
        return !activeKeys.has(meta.syncKey);
    });
    if (toRemove.length) {
        await repo.delete(toRemove.map(m => m.id));
    }
}

export type SyncSessionCastOptions = {
    combatState?: { isActive?: boolean; combatants?: CombatantInput[] } | null;
};

/** Sincroniza elenco com ficha, NPCs das relações e combatentes ativos (mundo vivo). */
export async function syncSessionCastFromWorld(
    sessionId: number,
    userId: number,
    options: SyncSessionCastOptions = {},
): Promise<void> {
    const sessao = await assertSessionOwner(sessionId, userId);
    const activeKeys = new Set<string>();

    if (sessao.characterId) {
        const charRepo = AppDataSource.getRepository(Character);
        const character = await charRepo.findOne({
            where: { id: sessao.characterId, userId },
            relations: ['relationships', 'relationships.quests'],
        });
        if (character) {
            await ensurePlayerInCast(sessionId, userId, character);
            activeKeys.add(castSyncKey('player', String(character.id)));

            for (const rel of character.relationships ?? []) {
                if (!rel?.name?.trim()) continue;
                const key = castSyncKey('relationship', rel.npcId || String(rel.id));
                activeKeys.add(key);
                await upsertAutoCastMember(sessionId, userId, key, {
                    displayName: rel.name.trim(),
                    role: relationshipToRole(rel.status),
                    vitals: 'alive',
                    metadata: {
                        source: 'relationship',
                        npcId: rel.npcId,
                        status: rel.status,
                        description: rel.description ?? null,
                        regionSlug: rel.regionSlug ?? null,
                    },
                });
            }
        }
    }

    const combat = options.combatState;
    if (combat?.isActive && Array.isArray(combat.combatants)) {
        for (const c of combat.combatants) {
            if (!c?.name?.trim()) continue;
            const id = c.id || c.name;
            const key = castSyncKey('combat', id);
            activeKeys.add(key);
            if (c.isPlayer) continue;
            await upsertAutoCastMember(sessionId, userId, key, {
                displayName: c.name.trim(),
                role: combatantToRole(c),
                vitals: combatantToVitals(c),
                metadata: { source: 'combat', combatantId: id },
            });
        }
    }

    await pruneAutoCastMembers(sessionId, activeKeys);
}

export async function listWorldEchoes(sessionId: number, userId: number): Promise<WorldEchoDto[]> {
    const sessao = await assertSessionOwner(sessionId, userId);
    const charRepo = AppDataSource.getRepository(Character);
    const worldState = (sessao.character?.worldState ?? {}) as Record<string, unknown>;
    const regionSlug =
        normalizeSlug(worldState.regionSlug ?? worldState.currentRegionSlug ?? worldState.currentRegion) ||
        normalizeSlug(sessao.character?.currentRegion);
    if (!regionSlug) return [];

    const strangers = await charRepo
        .createQueryBuilder('c')
        .innerJoin(SessaoIA, 's', 's.characterId = c.id')
        .where('c.userId != :userId', { userId })
        .andWhere('s.id != :sessionId', { sessionId })
        .andWhere("JSON_UNQUOTE(JSON_EXTRACT(c.worldState, '$.regionSlug')) = :slug", {
            slug: regionSlug,
        })
        .limit(8)
        .getMany();

    return strangers.map(c => ({
        name: c.name,
        kind: 'other_player' as const,
        regionSlug,
        note: 'Eco de outra mesa nesta região — rumor ou rastro, não diálogo em tempo real.',
    }));
}

export type SessionCastListResult = {
    cast: SessionCastMember[];
    worldEchoes: WorldEchoDto[];
};

export async function listSessionCast(
    sessionId: number,
    userId: number,
    options?: { skipSync?: boolean },
): Promise<SessionCastListResult> {
    await assertSessionOwner(sessionId, userId);
    if (!options?.skipSync) {
        await syncSessionCastFromWorld(sessionId, userId);
    }
    const cast = await AppDataSource.getRepository(SessionCastMember).find({
        where: { sessionId },
        order: { role: 'ASC', displayName: 'ASC' },
    });
    const worldEchoes = await listWorldEchoes(sessionId, userId);
    return { cast, worldEchoes };
}

export async function addSessionCastMember(
    sessionId: number,
    userId: number,
    input: CreateCastMemberInput,
): Promise<SessionCastMember> {
    await assertSessionOwner(sessionId, userId);
    const repo = AppDataSource.getRepository(SessionCastMember);
    let sheetSnapshot = input.sheetSnapshot ?? null;

    if (input.characterId) {
        const charRepo = AppDataSource.getRepository(Character);
        const character = await charRepo.findOne({
            where: { id: input.characterId, userId },
        });
        if (!character) {
            throw createError(404, 'Personagem do cofre não encontrado.');
        }
        sheetSnapshot = sheetSnapshot ?? characterToSnapshot(character);
    }

    const member = repo.create({
        sessionId,
        ownerUserId: userId,
        characterId: input.characterId ?? null,
        displayName: input.displayName.trim(),
        role: input.role,
        vitals: input.vitals ?? 'alive',
        sheetSnapshot,
        metadata: input.metadata ?? null,
        visibleToParty: input.visibleToParty ?? true,
    });
    return repo.save(member);
}

export async function updateSessionCastMember(
    sessionId: number,
    userId: number,
    memberId: number,
    patch: Partial<CreateCastMemberInput>,
): Promise<SessionCastMember> {
    await assertSessionOwner(sessionId, userId);
    const repo = AppDataSource.getRepository(SessionCastMember);
    const member = await repo.findOne({ where: { id: memberId, sessionId } });
    if (!member) throw createError(404, 'Membro do elenco não encontrado.');

    if (patch.displayName !== undefined) member.displayName = patch.displayName.trim();
    if (patch.role !== undefined) member.role = patch.role;
    if (patch.vitals !== undefined) member.vitals = patch.vitals;
    if (patch.visibleToParty !== undefined) member.visibleToParty = patch.visibleToParty;
    if (patch.metadata !== undefined) member.metadata = patch.metadata;
    if (patch.sheetSnapshot !== undefined) member.sheetSnapshot = patch.sheetSnapshot;

    return repo.save(member);
}

export async function removeSessionCastMember(
    sessionId: number,
    userId: number,
    memberId: number,
): Promise<void> {
    await assertSessionOwner(sessionId, userId);
    const repo = AppDataSource.getRepository(SessionCastMember);
    await repo.delete({ id: memberId, sessionId });
}

const ROLE_LABEL: Record<CastRole, string> = {
    pc: 'PJ',
    npc: 'NPC',
    ally: 'aliado',
    enemy: 'inimigo',
};

/** Bloco de prompt com elenco da sessão (mundo vivo local). */
export async function getCastSummaryForSession(sessionId: number): Promise<string> {
    const repo = AppDataSource.getRepository(SessionCastMember);
    const members = await repo.find({
        where: { sessionId, visibleToParty: true },
        order: { role: 'ASC', displayName: 'ASC' },
        take: 24,
    });
    if (!members.length) return '';

    const lines = members.map(m => {
        const vit =
            m.vitals === 'alive'
                ? 'vivo'
                : m.vitals === 'dead'
                  ? 'morto'
                  : m.vitals === 'unconscious'
                    ? 'inconsciente'
                    : 'desconhecido';
        const cls =
            m.sheetSnapshot && typeof m.sheetSnapshot.characterClass === 'string'
                ? `, ${m.sheetSnapshot.characterClass}`
                : '';
        return `- ${m.displayName} (${ROLE_LABEL[m.role]}, ${vit}${cls})`;
    });

    return `[Elenco da sessão — use estes nomes com consistência; não invente mortes sem motivo]\n${lines.join('\n')}`;
}

/** Garante que o PJ da sessão está no elenco (role pc). */
export async function ensurePlayerInCast(
    sessionId: number,
    userId: number,
    character: Character,
): Promise<void> {
    const repo = AppDataSource.getRepository(SessionCastMember);
    const existing = await repo.findOne({
        where: { sessionId, characterId: character.id, role: 'pc' },
    });
    if (existing) return;
    await addSessionCastMember(sessionId, userId, {
        displayName: character.name,
        role: 'pc',
        vitals: 'alive',
        characterId: character.id,
        sheetSnapshot: characterToSnapshot(character),
    });
}

export async function getWorldPresenceHints(
    sessionId: number,
    userId: number,
    regionSlug?: string | null,
): Promise<string[]> {
    if (!regionSlug?.trim()) return [];
    const hints: string[] = [];
    const charRepo = AppDataSource.getRepository(Character);
    const ownOthers = await charRepo
        .createQueryBuilder('c')
        .innerJoin(SessaoIA, 's', 's.characterId = c.id AND s.id != :sessionId', { sessionId })
        .where('c.userId = :userId', { userId })
        .andWhere("JSON_UNQUOTE(JSON_EXTRACT(c.worldState, '$.regionSlug')) = :slug", {
            slug: regionSlug,
        })
        .limit(5)
        .getMany();

    if (ownOthers.length) {
        hints.push(
            `[Mundo — passagem] Outros heróis seus já estiveram aqui: ${ownOthers.map(c => c.name).join(', ')}. Mencione como rastros ou encontros passados.`,
        );
    }

    const strangers = await charRepo
        .createQueryBuilder('c')
        .innerJoin(SessaoIA, 's', 's.characterId = c.id')
        .where('c.userId != :userId', { userId })
        .andWhere('s.id != :sessionId', { sessionId })
        .andWhere("JSON_UNQUOTE(JSON_EXTRACT(c.worldState, '$.regionSlug')) = :slug", {
            slug: regionSlug,
        })
        .limit(5)
        .getMany();

    if (strangers.length) {
        hints.push(
            `[Mundo — ecos de outros jogadores] Aventureiros de outras mesas deixaram marcas nesta região: ${strangers.map(c => c.name).join(', ')}. Trate como NPCs/rumores — não diálogo em tempo real.`,
        );
    }

    return hints;
}
