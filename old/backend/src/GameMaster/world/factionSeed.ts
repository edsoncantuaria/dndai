import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../database/data-source.js';
import { Faction } from '../database/entities/Faction.js';
import { FACTION_CATALOG } from './factionCatalog.js';

/** Sincroniza catálogo fixo → tabela `factions` (admin pode editar nomes depois). */
export async function ensureFactionCatalogInDatabase(): Promise<void> {
    const repo = PenaiDataSource.getRepository(Faction);
    for (const entry of FACTION_CATALOG) {
        const existing = await repo.findOne({ where: { slug: entry.slug } });
        if (existing) {
            if (!existing.description && entry.description) {
                existing.description = entry.description;
                await repo.save(existing);
            }
            continue;
        }
        await repo.save(
            repo.create({
                id: randomUUID(),
                slug: entry.slug,
                displayName: entry.displayName,
                description: entry.description,
                alignment: entry.alignment,
                archetype: entry.archetype,
                locale: 'pt-BR',
            }),
        );
    }
}
