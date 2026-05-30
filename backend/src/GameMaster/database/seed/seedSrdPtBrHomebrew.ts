/**
 * Seed idempotente: bundle `srd-ptbr-core` com todo conteúdo PT de backend/data/.
 */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import bcrypt from 'bcryptjs';
import { PenaiDataSource } from '../data-source.js';
import { PenaiHomebrewContent } from '../entities/HomebrewContent.js';
import { PenaiHomebrewBundle } from '../entities/HomebrewBundle.js';
import { PenaiUser } from '../entities/PenaiUser.js';
import { TRANSLATIONS_SPELLS } from '../../../../data/TranslatorSpells.js';
import { TRANSLATIONS_EQUIPMENT } from '../../../../data/TranslatorEquipments.js';
import { TRANSLATIONS_BASE } from '../../../../data/TranslatorPTBR.js';
import { buildSrdPtBrRaceClassForks } from './buildSrdPtBrRaceClassForks.js';
import { buildSrdPtBrTraitForks } from './buildSrdPtBrTraitForks.js';
import {
    buildFoundrySrdPtBrTranslations,
    mergeTranslationContent,
} from './buildFoundrySrdPtBrTranslations.js';

export const SRD_PTBR_CORE_BUNDLE_NAME = 'srd-ptbr-core';
export const SYSTEM_AUTHOR_ID = 1;

const __dirname = dirname(fileURLToPath(import.meta.url));
const backgroundsPath = join(__dirname, '../../../../data/backgrounds.json');

type BackgroundsFile = { results: Array<Record<string, unknown>> };

function loadBackgrounds(): BackgroundsFile['results'] {
    const raw = readFileSync(backgroundsPath, 'utf-8');
    return (JSON.parse(raw) as BackgroundsFile).results ?? [];
}

async function ensureSystemUser(): Promise<void> {
    const repo = PenaiDataSource.getRepository(PenaiUser);
    let user = await repo.findOne({ where: { id: SYSTEM_AUTHOR_ID } });
    if (!user) {
        user = repo.create({
            id: SYSTEM_AUTHOR_ID,
            username: 'Sistema',
            email: 'system@cronicasdeaventuras.com',
            passwordHash: await bcrypt.hash('penai-system-seed', 12),
            settings: {},
            installedHomebrewIds: [],
        });
        await repo.save(user);
    }
}

async function upsertContent(opts: {
    type: PenaiHomebrewContent['type'];
    name: string;
    content: Record<string, unknown>;
    sourceKind?: PenaiHomebrewContent['sourceKind'];
    sourceIndex?: string;
    sourceResource?: string;
}): Promise<PenaiHomebrewContent> {
    const repo = PenaiDataSource.getRepository(PenaiHomebrewContent);
    const where =
        opts.type === 'translation'
            ? { type: opts.type, name: opts.name, authorId: SYSTEM_AUTHOR_ID }
            : opts.sourceIndex
              ? { type: opts.type, sourceIndex: opts.sourceIndex, authorId: SYSTEM_AUTHOR_ID }
              : { type: opts.type, name: opts.name, authorId: SYSTEM_AUTHOR_ID };

    let row = await repo.findOne({ where });
    if (!row) {
        row = repo.create({
            authorId: SYSTEM_AUTHOR_ID,
            type: opts.type,
            name: opts.name,
            isPublic: true,
            createdBy: 'user',
            locale: 'pt-BR',
        });
    }
    row.content = opts.content;
    row.sourceKind = opts.sourceKind ?? 'original';
    row.sourceIndex = opts.sourceIndex ?? null;
    row.sourceResource = opts.sourceResource ?? null;
    row.isPublic = true;
    row.locale = 'pt-BR';
    return repo.save(row);
}

export async function seedSrdPtBrHomebrew(options?: {
    skipFoundryFetch?: boolean;
}): Promise<{ bundleId: string; contentCount: number }> {
    await ensureSystemUser();

    const contentRepo = PenaiDataSource.getRepository(PenaiHomebrewContent);
    const bundleRepo = PenaiDataSource.getRepository(PenaiHomebrewBundle);
    const allContents: PenaiHomebrewContent[] = [];

    const foundryRows = await buildFoundrySrdPtBrTranslations({
        skipFetch: options?.skipFoundryFetch ?? process.env.SRD_PTBR_SKIP_FOUNDRY_FETCH === 'true',
    });
    const foundryByKey = new Map(
        foundryRows.map(row => [`${row.type}:${row.sourceIndex}`, row]),
    );
    const foundrySpellByEn = new Map(
        foundryRows
            .filter(row => row.type === 'spell' && row.englishKey)
            .map(row => [row.englishKey!.toLowerCase(), row]),
    );
    const foundryItemByEn = new Map(
        foundryRows
            .filter(row => row.type === 'item' && row.englishKey)
            .map(row => [row.englishKey!.toLowerCase(), row]),
    );

    for (const [englishName, translation] of Object.entries(TRANSLATIONS_SPELLS)) {
        const officialIndex = englishName.toLowerCase().replace(/\s+/g, '-');
        const foundry =
            foundrySpellByEn.get(englishName.toLowerCase()) ??
            foundryByKey.get(`spell:${officialIndex}`);
        const resolvedIndex = foundry?.sourceIndex ?? officialIndex;
        const merged = foundry
            ? mergeTranslationContent(translation as Record<string, unknown>, foundry.content)
            : (translation as Record<string, unknown>);
        const row = await upsertContent({
            type: 'spell',
            name: String(merged.name ?? englishName),
            content: {
                ...merged,
                index: resolvedIndex,
                official_index: resolvedIndex,
            },
            sourceKind: 'translation',
            sourceIndex: resolvedIndex,
            sourceResource: 'spells',
        });
        allContents.push(row);
    }

    for (const [englishIndex, translation] of Object.entries(TRANSLATIONS_EQUIPMENT)) {
        const foundry =
            foundryItemByEn.get(englishIndex.toLowerCase()) ??
            foundryByKey.get(`item:${englishIndex}`);
        const merged = foundry
            ? mergeTranslationContent(translation as Record<string, unknown>, foundry.content)
            : (translation as Record<string, unknown>);
        const row = await upsertContent({
            type: 'item',
            name: String(merged.name ?? englishIndex),
            content: {
                ...merged,
                index: englishIndex,
                official_index: englishIndex,
            },
            sourceKind: 'translation',
            sourceIndex: englishIndex,
            sourceResource: 'equipment',
        });
        allContents.push(row);
    }

    const foundryOnlyTypes = new Set(['monster', 'feature']);
    for (const foundryRow of foundryRows) {
        if (!foundryOnlyTypes.has(foundryRow.type)) continue;
        const row = await upsertContent({
            type: foundryRow.type,
            name: foundryRow.name,
            content: foundryRow.content,
            sourceKind: 'translation',
            sourceIndex: foundryRow.sourceIndex,
            sourceResource: foundryRow.sourceResource,
        });
        allContents.push(row);
    }

    for (const background of loadBackgrounds()) {
        const index = String(background.index ?? background.name ?? 'background');
        const row = await upsertContent({
            type: 'background',
            name: index,
            content: { ...background, index },
            sourceKind: 'fork',
            sourceIndex: index,
            sourceResource: 'backgrounds',
        });
        allContents.push(row);
    }

    for (const [category, map] of Object.entries(TRANSLATIONS_BASE)) {
        const row = await upsertContent({
            type: 'translation',
            name: category,
            content: map as Record<string, unknown>,
            sourceKind: 'translation',
            sourceResource: 'ui-map',
        });
        allContents.push(row);
    }

    for (const fork of buildSrdPtBrRaceClassForks()) {
        const foundryClass = foundryByKey.get(`class:${fork.sourceIndex}`);
        const content =
            fork.type === 'class' && foundryClass
                ? mergeTranslationContent(fork.content, foundryClass.content)
                : fork.content;
        const row = await upsertContent({
            type: fork.type,
            name: fork.name,
            content,
            sourceKind: 'translation',
            sourceIndex: fork.sourceIndex,
            sourceResource: fork.sourceResource,
        });
        allContents.push(row);
    }

    for (const fork of buildSrdPtBrTraitForks()) {
        const row = await upsertContent({
            type: fork.type,
            name: fork.name,
            content: fork.content,
            sourceKind: 'translation',
            sourceIndex: fork.sourceIndex,
            sourceResource: fork.sourceResource,
        });
        allContents.push(row);
    }

    let bundle = await bundleRepo.findOne({
        where: { name: SRD_PTBR_CORE_BUNDLE_NAME, authorId: SYSTEM_AUTHOR_ID },
        relations: ['contents'],
    });
    if (!bundle) {
        bundle = bundleRepo.create({
            authorId: SYSTEM_AUTHOR_ID,
            name: SRD_PTBR_CORE_BUNDLE_NAME,
            description:
                'SRD PT-BR completo: magias, equipamentos, antecedentes e mapa de tradução (perícias, raças, classes).',
            isPublic: true,
        });
    } else {
        await contentRepo.update({ bundleId: bundle.id }, { bundleId: null });
    }
    bundle.description =
        'SRD PT-BR: magias, equipamentos, monstros, features, antecedentes, raças/classes (Foundry decito), mapas UI e perícias.';
    bundle.isPublic = true;
    bundle = await bundleRepo.save(bundle);

    const ids = new Set(allContents.map(c => c.id));
    for (const c of allContents) {
        c.bundleId = bundle.id;
        await contentRepo.save(c);
    }

    return { bundleId: bundle.id, contentCount: ids.size };
}

export async function getSrdPtBrCoreBundleId(): Promise<string | null> {
    if (!PenaiDataSource.isInitialized) return null;
    const bundle = await PenaiDataSource.getRepository(PenaiHomebrewBundle).findOne({
        where: { name: SRD_PTBR_CORE_BUNDLE_NAME, authorId: SYSTEM_AUTHOR_ID },
    });
    return bundle?.id ?? null;
}

export async function ensureUserHasSrdPtBrBundle(userId: number): Promise<void> {
    const bundleId = await getSrdPtBrCoreBundleId();
    if (!bundleId) return;
    const repo = PenaiDataSource.getRepository(PenaiUser);
    const user = await repo.findOne({ where: { id: userId } });
    if (!user) return;
    const ids = new Set(user.installedHomebrewIds ?? []);
    if (!ids.has(bundleId)) {
        ids.add(bundleId);
        user.installedHomebrewIds = Array.from(ids);
        await repo.save(user);
    }
}

async function main() {
    if (!PenaiDataSource.isInitialized) {
        await PenaiDataSource.initialize();
    }
    const result = await seedSrdPtBrHomebrew();
    console.log(`[seedSrdPtBr] bundle=${result.bundleId} contents=${result.contentCount}`);
    if (PenaiDataSource.isInitialized) {
        await PenaiDataSource.destroy();
    }
}

const isMain =
    process.argv[1] != null &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
    main().catch(err => {
        console.error('[seedSrdPtBr] falhou:', err);
        process.exit(1);
    });
}
