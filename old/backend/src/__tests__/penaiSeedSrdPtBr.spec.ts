import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TRANSLATIONS_SPELLS } from '../../data/TranslatorSpells.js';
import { TRANSLATIONS_EQUIPMENT } from '../../data/TranslatorEquipments.js';
import { TRANSLATIONS_BASE } from '../../data/TranslatorPTBR.js';
import { SRD_PTBR_CORE_BUNDLE_NAME } from '../GameMaster/database/seed/seedSrdPtBrHomebrew.js';
import { penaiIntegrationReady } from './helpers/penaiIntegrationDescribe.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backgroundsPath = join(__dirname, '../../data/backgrounds.json');

test('fontes srd-ptbr-core têm volume mínimo esperado', () => {
    const backgrounds = JSON.parse(readFileSync(backgroundsPath, 'utf-8')) as { results: unknown[] };
    assert.ok(Object.keys(TRANSLATIONS_SPELLS).length >= 200, 'magias PT');
    assert.ok(Object.keys(TRANSLATIONS_EQUIPMENT).length >= 50, 'equipamentos PT');
    assert.ok((backgrounds.results?.length ?? 0) >= 13, 'antecedentes PT');
    assert.ok(TRANSLATIONS_BASE['Skills & Proficiencies'], 'mapa de perícias');
    assert.equal(SRD_PTBR_CORE_BUNDLE_NAME, 'srd-ptbr-core');
});

test('buildSrdPtBrRaceClassForks gera overlays SRD', async () => {
    const { buildSrdPtBrRaceClassForks } = await import(
        '../GameMaster/database/seed/buildSrdPtBrRaceClassForks.js'
    );
    const forks = buildSrdPtBrRaceClassForks();
    assert.ok(forks.length >= 37, `esperado >=37 forks, got ${forks.length}`);
    const elf = forks.find(f => f.sourceIndex === 'elf' && f.type === 'race');
    assert.ok(elf);
    assert.equal(String(elf?.content.name ?? elf?.name), 'Elfo');
});

test('buildFoundrySrdPtBrTranslations mapeia conteúdo Foundry', async () => {
    const { buildFoundrySrdPtBrTranslations } = await import(
        '../GameMaster/database/seed/buildFoundrySrdPtBrTranslations.js'
    );
    const rows = await buildFoundrySrdPtBrTranslations({ skipFetch: true });
    assert.ok(rows.length >= 800, `esperado >=800 rows Foundry, got ${rows.length}`);
    const monsters = rows.filter(r => r.type === 'monster');
    const features = rows.filter(r => r.type === 'feature');
    assert.ok(monsters.length >= 300, `monstros PT >=300, got ${monsters.length}`);
    assert.ok(features.length >= 120, `features PT >=120, got ${features.length}`);
    const fireball = rows.find(r => r.type === 'spell' && r.englishKey === 'Fireball');
    assert.ok(fireball);
    assert.equal(String(fireball?.content.name), 'Bola de Fogo');
});

test('buildSrdPtBrTraitForks gera overlays PT', async () => {
    const { buildSrdPtBrTraitForks } = await import(
        '../GameMaster/database/seed/buildSrdPtBrTraitForks.js'
    );
    const traits = buildSrdPtBrTraitForks();
    assert.ok(traits.length >= 20, `esperado >=20 traits, got ${traits.length}`);
    const brave = traits.find(t => t.sourceIndex === 'brave');
    assert.ok(brave);
    assert.equal(String(brave?.content.name), 'Bravura');
});

test('seedSrdPtBrHomebrew popula bundle no Postgres (integração)', async t => {
    if (!penaiIntegrationReady) {
        t.skip('PostgreSQL PENAI indisponível');
        return;
    }
    const { seedSrdPtBrHomebrew, getSrdPtBrCoreBundleId } = await import(
        '../GameMaster/database/seed/seedSrdPtBrHomebrew.js'
    );
    const { PenaiDataSource } = await import('../GameMaster/database/data-source.js');
    const { PenaiHomebrewContent } = await import('../GameMaster/database/entities/HomebrewContent.js');

    const result = await seedSrdPtBrHomebrew();
    assert.ok(result.bundleId);
    assert.ok(result.contentCount > 900);

    const bundleId = await getSrdPtBrCoreBundleId();
    assert.equal(bundleId, result.bundleId);

    const spellCount = await PenaiDataSource.getRepository(PenaiHomebrewContent).count({
        where: { type: 'spell', authorId: 1 },
    });
    const bgCount = await PenaiDataSource.getRepository(PenaiHomebrewContent).count({
        where: { type: 'background', authorId: 1 },
    });
    const raceCount = await PenaiDataSource.getRepository(PenaiHomebrewContent).count({
        where: { type: 'race', authorId: 1 },
    });
    const monsterCount = await PenaiDataSource.getRepository(PenaiHomebrewContent).count({
        where: { type: 'monster', authorId: 1 },
    });
    const featureCount = await PenaiDataSource.getRepository(PenaiHomebrewContent).count({
        where: { type: 'feature', authorId: 1 },
    });

    assert.ok(spellCount >= 200);
    assert.ok(bgCount >= 13);
    assert.ok(raceCount >= 8);
    assert.ok(monsterCount >= 300);
    assert.ok(featureCount >= 120);
});
