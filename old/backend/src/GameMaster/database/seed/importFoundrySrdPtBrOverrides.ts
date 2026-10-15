/**
 * Importa overrides PT a partir do compendium SRD traduzido (Foundry VTT).
 * Fonte: https://github.com/decito/dnd5e-pt-br (CC BY 4.0 — SRD Wizards + tradução comunitária).
 *
 * Preferível ao extrator PHB (pdftotext) — textos já revisados, sem bleed de colunas do PDF.
 *
 * Uso: npm run penai:import:foundry-overrides --prefix backend
 */
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
    FOUNDRY_REPO,
    FOUNDRY_REF,
    htmlToPlain,
    loadFoundryCompendium,
    type FoundryCompendium,
} from './foundrySrdPtBrClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../../../data/srdPtBr/overrides');

const RACE_ENTRIES: Record<string, { resource: 'races' | 'subraces'; index: string }> = {
    Human: { resource: 'races', index: 'human' },
    Dwarf: { resource: 'races', index: 'dwarf' },
    Elf: { resource: 'races', index: 'elf' },
    Halfling: { resource: 'races', index: 'halfling' },
    Gnome: { resource: 'races', index: 'gnome' },
    Dragonborn: { resource: 'races', index: 'dragonborn' },
    'Half-Elf': { resource: 'races', index: 'half-elf' },
    'Half-Orc': { resource: 'races', index: 'half-orc' },
    Tiefling: { resource: 'races', index: 'tiefling' },
    'Hill Dwarf': { resource: 'subraces', index: 'hill-dwarf' },
    'High Elf': { resource: 'subraces', index: 'high-elf' },
    'Lightfoot Halfling': { resource: 'subraces', index: 'lightfoot-halfling' },
    'Rock Gnome': { resource: 'subraces', index: 'rock-gnome' },
};

const TRAIT_FIELD_STOPS = [
    'Tendência',
    'Alinhamento',
    'Tamanho',
    'Deslocamento',
    'Visão no Escuro',
    'Visão',
    'Sentidos',
    'Idiomas',
    'Aumento no Valor de Habilidade',
    'Ancestral Dracônico',
    'Arma de Sopro',
    'Resistência',
    'Legado Infernal',
    'Ameaçador',
    'Perícia',
    'Talento',
    'Idade',
    'Sub-raça',
    'Sub-raças',
    'Tenacidade Anã',
    'Treinamento',
    'Truque',
    'Conhecimento',
    'Ilusionista',
    'Falar com',
    'Engenhoqueiro',
];

function traitStops(excluding: string): string[] {
    return TRAIT_FIELD_STOPS.filter(label => label !== excluding);
}

function extractLabeled(block: string, label: string, stopLabels: string[]): string {
    const stops = stopLabels.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp(`(?:^|\\n)${label}\\.\\s*([\\s\\S]*?)(?=\\n(?:${stops})\\.|$)`, 'i');
    const m = block.match(re);
    return m?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
}

function extractIntro(block: string): string {
    const idx = block.search(/\nAumento no Valor de Habilidade/i);
    const head = idx >= 0 ? block.slice(0, idx) : block;
    return head.replace(/\s+/g, ' ').trim();
}

function parseRaceDescription(html: string, kind: 'race' | 'subrace'): Record<string, string> {
    const plain = htmlToPlain(html);
    const out: Record<string, string> = {};

    const intro = extractIntro(plain);
    if (kind === 'race' && intro.length >= 40) {
        out.desc = intro.length > 600 ? `${intro.slice(0, 597).trim()}…` : intro;
    } else if (kind === 'subrace' && intro.length >= 40) {
        const cut = intro.search(/\nAumento no Valor/i);
        const desc = (cut >= 0 ? intro.slice(0, cut) : intro).replace(/\s+/g, ' ').trim();
        if (desc.length >= 40) out.desc = desc.length > 900 ? `${desc.slice(0, 897).trim()}…` : desc;
    }

    const age = extractLabeled(plain, 'Idade', traitStops('Idade'));
    const alignment =
        extractLabeled(plain, 'Tendência', traitStops('Tendência')) ||
        extractLabeled(plain, 'Alinhamento', traitStops('Alinhamento'));
    const sizeBlock = extractLabeled(plain, 'Tamanho', traitStops('Tamanho'));
    const languageDesc = extractLabeled(plain, 'Idiomas', traitStops('Idiomas'));

    if (age && age.length <= 400) out.age = age;
    if (alignment && alignment.length <= 650) out.alignment = alignment;
    if (sizeBlock && sizeBlock.length <= 450) {
        out.size_description = sizeBlock;
        if (/médio/i.test(sizeBlock)) out.size = 'Médio';
        if (/pequeno/i.test(sizeBlock)) out.size = 'Pequeno';
    }
    if (languageDesc && languageDesc.length <= 750) out.language_desc = languageDesc;

    return out;
}

function writeOverride(resource: string, index: string, patch: Record<string, string>): void {
    const dir = join(OUT_DIR, resource);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${index}.json`), `${JSON.stringify(patch, null, 2)}\n`, 'utf-8');
}

/** Remove overrides PHB legados (classes + sub-raças sem tradução Foundry). */
function pruneLegacyOverrides(imported: Set<string>): void {
    const dropSubraces = ['mountain-dwarf', 'wood-elf', 'stout-halfling', 'forest-gnome'];
    for (const index of dropSubraces) {
        const path = join(OUT_DIR, 'subraces', `${index}.json`);
        if (existsSync(path)) rmSync(path);
    }
    const classesDir = join(OUT_DIR, 'classes');
    if (existsSync(classesDir)) rmSync(classesDir, { recursive: true, force: true });
}

export async function importFoundrySrdPtBrOverrides(options?: {
    skipFetch?: boolean;
}): Promise<{ written: number; source: string }> {
    const raw = await loadFoundryCompendium('dnd5e.races.json', options);
    const imported = new Set<string>();
    let written = 0;

    for (const [entryName, spec] of Object.entries(RACE_ENTRIES)) {
        const entry = raw.entries?.[entryName];
        if (!entry?.description) continue;

        const patch = parseRaceDescription(entry.description, spec.resource === 'subraces' ? 'subrace' : 'race');
        if (Object.keys(patch).length === 0) continue;

        writeOverride(spec.resource, spec.index, patch);
        imported.add(`${spec.resource}/${spec.index}`);
        written += 1;
    }

    pruneLegacyOverrides(imported);

    return {
        written,
        source: `${FOUNDRY_REPO}@${FOUNDRY_REF}`,
    };
}

const isMain =
    process.argv[1] != null &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
    importFoundrySrdPtBrOverrides()
        .then(result => {
            console.log(
                `[importFoundry] ${result.written} overrides gravados (${result.source}) em ${OUT_DIR}`,
            );
        })
        .catch(err => {
            console.error('[importFoundry] falhou:', err);
            process.exit(1);
        });
}
