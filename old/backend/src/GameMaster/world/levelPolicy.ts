import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';

/** Somente heróis do jogador dono podem atualizar stats canônicos por nível. */
export async function updateHeroCanonicalStats(
    worldEntityId: string,
    userId: number,
    stats: Record<string, unknown>,
): Promise<{ ok: boolean; reason?: string }> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const entity = await repo.findOne({ where: { id: worldEntityId } });
    if (!entity) return { ok: false, reason: 'Entidade não encontrada' };
    if (entity.entityType !== 'hero') {
        return { ok: false, reason: 'Apenas heróis podem atualizar ficha canônica global' };
    }
    if (entity.createdByUserId !== userId) {
        return { ok: false, reason: 'Herói pertence a outro jogador' };
    }
    entity.stats = { ...entity.stats, ...stats };
    await repo.save(entity);
    return { ok: true };
}
