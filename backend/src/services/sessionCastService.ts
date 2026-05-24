import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessionCastMember, type CastRole, type CastVitals } from '../entities/SessionCastMember.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { Character } from '../entities/Character.js';

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
    const sessao = await repo.findOne({ where: { id: sessionId, userId } });
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

export async function listSessionCast(sessionId: number, userId: number): Promise<SessionCastMember[]> {
    await assertSessionOwner(sessionId, userId);
    return AppDataSource.getRepository(SessionCastMember).find({
        where: { sessionId },
        order: { role: 'ASC', displayName: 'ASC' },
    });
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
    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
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
