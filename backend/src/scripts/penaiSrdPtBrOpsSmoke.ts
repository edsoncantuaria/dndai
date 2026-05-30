/**
 * Smoke operacional SRD PT-BR — valida forks offline e, com DATABASE_URL, seed + bundle.
 *
 * Uso: npm run penai:smoke:srd-ptbr --prefix backend
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const humanOverride = join(__dirname, '../../data/srdPtBr/overrides/races/human.json');

async function main() {
    const human = JSON.parse(readFileSync(humanOverride, 'utf-8')) as Record<string, string>;
    if (!human.desc || human.desc.length < 80) {
        throw new Error('human.json override inválido ou vazio');
    }
    if (/draconato|gnomo/i.test(human.desc)) {
        throw new Error('human.json ainda contém texto de outras raças');
    }
    if (human.language_desc && /draconato|gnomo/i.test(human.language_desc)) {
        throw new Error('human.json language_desc poluído');
    }

    const halfOrcPath = join(__dirname, '../../data/srdPtBr/overrides/races/half-orc.json');
    if (existsSync(halfOrcPath)) {
        const halfOrc = JSON.parse(readFileSync(halfOrcPath, 'utf-8')) as Record<string, string>;
        if (halfOrc.age && /Richard|MULHER das|CICATRIZES E FORÇA/i.test(halfOrc.age)) {
            throw new Error('half-orc.json age ainda corrompido — rode penai:import:foundry-overrides');
        }
        if (halfOrc.desc && /^MULHER/i.test(halfOrc.desc)) {
            throw new Error('half-orc.json desc ainda é ficção PHB');
        }
    }

    const { buildSrdPtBrRaceClassForks } = await import(
        '../GameMaster/database/seed/buildSrdPtBrRaceClassForks.js'
    );
    const { buildSrdPtBrTraitForks } = await import(
        '../GameMaster/database/seed/buildSrdPtBrTraitForks.js'
    );
    const forks = buildSrdPtBrRaceClassForks();
    const elf = forks.find(f => f.sourceIndex === 'elf' && f.type === 'race');
    if (!elf || String(elf.content.name) !== 'Elfo') {
        throw new Error('fork elf PT ausente');
    }
    const highElf = forks.find(f => f.sourceIndex === 'high-elf');
    if (!highElf) throw new Error('fork high-elf ausente');

    const traits = buildSrdPtBrTraitForks();
    const darkvision = traits.find(t => t.sourceIndex === 'darkvision');
    if (!darkvision || !String(darkvision.content.name).includes('Escuro')) {
        throw new Error('trait darkvision PT ausente');
    }

    console.log('[penai:smoke:srd-ptbr] OK — human override limpo, elf/high-elf, traits PT');

    const { validatePhbPtBrOverrides } = await import(
        '../GameMaster/database/seed/validatePhbPtBrOverrides.js'
    );
    const validation = validatePhbPtBrOverrides();
    if (!validation.ok) {
        throw new Error(`overrides PHB inválidos: ${validation.issues.length} problema(s)`);
    }
    console.log('[penai:smoke:srd-ptbr] overrides PHB validados');

    if (!process.env.DATABASE_URL) {
        console.log('[penai:smoke:srd-ptbr] DATABASE_URL ausente — pulando seed Postgres');
        return;
    }

    const { PenaiDataSource, initPenaiDatabase } = await import('../GameMaster/database/data-source.js');
    await initPenaiDatabase();
    const { seedSrdPtBrHomebrew, getSrdPtBrCoreBundleId } = await import(
        '../GameMaster/database/seed/seedSrdPtBrHomebrew.js'
    );
    const result = await seedSrdPtBrHomebrew();
    const bundleId = await getSrdPtBrCoreBundleId();
    if (!bundleId || result.contentCount < 900) {
        throw new Error(`seed incompleto: bundle=${bundleId} count=${result.contentCount}`);
    }
    console.log(`[penai:smoke:srd-ptbr] Postgres OK — bundle=${bundleId} contents=${result.contentCount}`);
    await PenaiDataSource.destroy();
}

main().catch(err => {
    console.error('[penai:smoke:srd-ptbr] FALHOU:', err);
    process.exit(1);
});
