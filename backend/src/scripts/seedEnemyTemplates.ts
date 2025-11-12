import 'dotenv/config';
import { AppDataSource } from '../database/data-source.js';
import { EnemyTemplate as EnemyTemplateEntity } from '../entities/EnemyTemplate.js';
import { DEFAULT_ENEMY_TEMPLATES, normalizeTemplateSlug } from '../data/enemyTemplates.js';

const seed = async () => {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        const repo = AppDataSource.getRepository(EnemyTemplateEntity);
        for (const template of DEFAULT_ENEMY_TEMPLATES) {
            const slug = normalizeTemplateSlug(template.id) ?? normalizeTemplateSlug(template.name) ?? template.id;
            if (!slug) continue;
            const existing = await repo.findOne({ where: { slug } });
            if (existing) {
                continue;
            }
            const entity = repo.create({
                name: template.name,
                slug,
                stats: template.stats,
                hitPoints: template.hitPoints ?? null,
                armorClass: template.armorClass ?? null,
                actionPoints: template.actionPoints ?? null,
                bonusActionPoints: template.bonusActionPoints ?? null,
                damageProfile: template.damageProfile ?? null,
                tags: template.tags ?? null,
            });
            await repo.save(entity);
            console.log(`[seedEnemyTemplates] Inserido template ${slug}`);
        }
        console.log('[seedEnemyTemplates] Concluído.');
    } catch (error) {
        console.error('[seedEnemyTemplates] Falhou:', error);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
};

seed();

