/**
 * Migra homebrew MySQL legado → Postgres PENAI (one-shot produção).
 * Requer MYSQL_* (AppDataSource) e DATABASE_URL (PenaiDataSource).
 *
 * Uso: npm run penai:migrate:homebrew-mysql --prefix backend
 */
import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from '../database/data-source.js';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';
import { HomebrewContent as MysqlHomebrew } from '../entities/HomebrewContent.js';
import { HomebrewBundle as MysqlBundle } from '../entities/HomebrewBundle.js';
import { PenaiHomebrewContent } from '../GameMaster/database/entities/HomebrewContent.js';
import { PenaiHomebrewBundle } from '../GameMaster/database/entities/HomebrewBundle.js';

async function migrateHomebrew(): Promise<void> {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL (Postgres PENAI) é obrigatório.');
    }

    await AppDataSource.initialize();
    await PenaiDataSource.initialize();

    const mysqlContents = await AppDataSource.getRepository(MysqlHomebrew).find();
    const penaiRepo = PenaiDataSource.getRepository(PenaiHomebrewContent);
    let upserted = 0;

    for (const row of mysqlContents) {
        const where = row.sourceIndex
            ? { authorId: row.authorId, type: row.type, sourceIndex: row.sourceIndex }
            : { authorId: row.authorId, type: row.type, name: row.name };

        let target = await penaiRepo.findOne({ where: where as never });
        if (!target) {
            target = penaiRepo.create({
                authorId: row.authorId,
                type: row.type as PenaiHomebrewContent['type'],
                name: row.name,
            });
        }
        target.content = row.content;
        target.isPublic = row.isPublic;
        target.createdBy = row.createdBy;
        target.dependencies = row.dependencies ?? null;
        target.sourceKind = row.sourceKind ?? 'original';
        target.sourceResource = row.sourceResource ?? null;
        target.sourceIndex = row.sourceIndex ?? null;
        target.locale = row.locale ?? 'pt-BR';
        await penaiRepo.save(target);
        upserted += 1;
    }

    const mysqlBundles = await AppDataSource.getRepository(MysqlBundle).find({ relations: ['contents'] });
    const bundleRepo = PenaiDataSource.getRepository(PenaiHomebrewBundle);
    for (const bundle of mysqlBundles) {
        let penaiBundle = await bundleRepo.findOne({
            where: { name: bundle.name, authorId: bundle.authorId },
        });
        if (!penaiBundle) {
            penaiBundle = bundleRepo.create({
                authorId: bundle.authorId,
                name: bundle.name,
                description: bundle.description,
                isPublic: bundle.isPublic,
            });
        } else {
            penaiBundle.description = bundle.description;
            penaiBundle.isPublic = bundle.isPublic;
        }
        penaiBundle = await bundleRepo.save(penaiBundle);

        for (const c of bundle.contents ?? []) {
            const content = await penaiRepo.findOne({
                where: { authorId: c.authorId, type: c.type as PenaiHomebrewContent['type'], name: c.name },
            });
            if (content) {
                content.bundleId = penaiBundle.id;
                await penaiRepo.save(content);
            }
        }
    }

    console.log(`[migrate-homebrew] ${upserted} conteúdos MySQL → Postgres PENAI`);
    await AppDataSource.destroy();
    await PenaiDataSource.destroy();
}

migrateHomebrew().catch(err => {
    console.error('[migrate-homebrew] falhou:', err);
    process.exit(1);
});
