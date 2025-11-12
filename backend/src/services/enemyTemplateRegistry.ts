import { AppDataSource } from '../database/data-source.js';
import { EnemyTemplate as EnemyTemplateEntity } from '../entities/EnemyTemplate.js';
import { DEFAULT_ENEMY_TEMPLATES, EnemyTemplateDefinition, normalizeTemplateSlug } from '../data/enemyTemplates.js';

export type EnemyTemplateRecord = EnemyTemplateDefinition & {
    slug: string;
};

const registry = new Map<string, EnemyTemplateRecord>();

const registerTemplate = (template: EnemyTemplateRecord) => {
    registry.set(template.slug, template);
    registry.set(template.id, template);
};

const resetRegistry = () => {
    registry.clear();
    DEFAULT_ENEMY_TEMPLATES.forEach(def => {
        const slug = normalizeTemplateSlug(def.id) ?? normalizeTemplateSlug(def.name) ?? def.id;
        registerTemplate({ ...def, slug });
    });
};

resetRegistry();

export const refreshEnemyTemplatesFromDatabase = async (): Promise<void> => {
    resetRegistry();
    if (!AppDataSource.isInitialized) return;
    const repo = AppDataSource.getRepository(EnemyTemplateEntity);
    const rows = await repo.find();
    rows.forEach(row => {
        const slug = row.slug || normalizeTemplateSlug(row.name) || row.id?.toString();
        if (!slug) return;
        registerTemplate({
            id: slug,
            slug,
            name: row.name,
            stats: row.stats ?? {},
            hitPoints: row.hitPoints ?? undefined,
            armorClass: row.armorClass ?? undefined,
            actionPoints: row.actionPoints ?? undefined,
            bonusActionPoints: row.bonusActionPoints ?? undefined,
            damageProfile: row.damageProfile ?? undefined,
            tags: row.tags ?? undefined,
        });
    });
};

export const getEnemyTemplateByKey = (key?: string | null): EnemyTemplateRecord | undefined => {
    const slug = normalizeTemplateSlug(key) ?? key ?? undefined;
    if (!slug) return undefined;
    return registry.get(slug);
};

export const listCachedEnemyTemplates = (): EnemyTemplateRecord[] => {
    const unique = new Map<string, EnemyTemplateRecord>();
    registry.forEach(template => {
        if (!unique.has(template.slug)) {
            unique.set(template.slug, template);
        }
    });
    return Array.from(unique.values());
};
