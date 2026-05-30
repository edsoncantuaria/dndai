/**
 * Extrai textos PT do Livro do Jogador (Biblioteca Élfica) para overrides SRD.
 * Fonte local: backend/.tmp/phb-ptbr.txt (gerado via pdftotext do PDF autorizado).
 *
 * Uso: npm run penai:extract:phb-overrides --prefix backend
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHB_TEXT = join(__dirname, '../../../../.tmp/phb-ptbr.txt');
const OUT_DIR = join(__dirname, '../../../../data/srdPtBr/overrides');

type SectionSpec = {
    resource: string;
    index: string;
    start: string;
    end: string;
    kind: 'race' | 'subrace' | 'class';
};

/** Marcadores de fim exclusivos — ordem importa para evitar bleed de colunas do PDF. */
const RACE_SECTIONS: SectionSpec[] = [
    { resource: 'races', index: 'human', start: 'HUMANO\n', end: 'TRAÇOS RACIAIS ALTERNATIVOS', kind: 'race' },
    { resource: 'races', index: 'dwarf', start: 'ANÃO\n', end: 'ANÃO DA COLINA', kind: 'race' },
    { resource: 'subraces', index: 'hill-dwarf', start: 'ANÃO DA COLINA', end: 'ANÃO DA MONTANHA', kind: 'subrace' },
    { resource: 'subraces', index: 'mountain-dwarf', start: 'ANÃO DA MONTANHA', end: 'DUERGAR', kind: 'subrace' },
    { resource: 'races', index: 'elf', start: 'ELFO\n', end: 'ALTO ELFO', kind: 'race' },
    { resource: 'subraces', index: 'high-elf', start: 'ALTO ELFO', end: 'ELFO DA FLORESTA', kind: 'subrace' },
    { resource: 'subraces', index: 'wood-elf', start: 'ELFO DA FLORESTA', end: 'ELFO NEGRO', kind: 'subrace' },
    { resource: 'races', index: 'halfling', start: 'HALFLING\n', end: 'PÉS LEVES', kind: 'race' },
    { resource: 'subraces', index: 'lightfoot-halfling', start: 'PÉS LEVES', end: 'ROBUSTO', kind: 'subrace' },
    { resource: 'subraces', index: 'stout-halfling', start: 'ROBUSTO', end: 'GNOMO\n', kind: 'subrace' },
    { resource: 'races', index: 'gnome', start: 'GNOMO\n', end: 'GNOMO DA FLORESTA', kind: 'race' },
    { resource: 'subraces', index: 'forest-gnome', start: 'GNOMO DA FLORESTA', end: 'GNOMO DAS ROCHAS', kind: 'subrace' },
    { resource: 'subraces', index: 'rock-gnome', start: 'GNOMO DAS ROCHAS', end: 'DRACONATO', kind: 'subrace' },
    { resource: 'races', index: 'dragonborn', start: 'DRACONATO\n', end: 'GNOMO\nMAGRELO', kind: 'race' },
    { resource: 'races', index: 'half-elf', start: 'MEIO-ELFO\n', end: 'MEIO-ORC', kind: 'race' },
    { resource: 'races', index: 'half-orc', start: 'MEIO-ORC\n', end: 'TRAÇOS RACIAIS DOS MEIO-ORCS', kind: 'race' },
    {
        resource: 'races',
        index: 'tiefling',
        start: 'Ser recebido com olhares e cochichos',
        end: 'CAPÍTULO 3: CLASSES',
        kind: 'race',
    },
];

const CLASS_SECTIONS: SectionSpec[] = [
    { resource: 'classes', index: 'barbarian', start: 'BÁRBARO\n', end: 'BARDO\n', kind: 'class' },
    { resource: 'classes', index: 'bard', start: 'BARDO\n', end: 'CLÉRIGO\n', kind: 'class' },
    { resource: 'classes', index: 'cleric', start: 'CLÉRIGO\n', end: 'DRUIDA\n', kind: 'class' },
    { resource: 'classes', index: 'druid', start: 'DRUIDA\n', end: 'GUERREIRO\n', kind: 'class' },
    { resource: 'classes', index: 'fighter', start: 'GUERREIRO\n', end: 'MONGE\n', kind: 'class' },
    { resource: 'classes', index: 'monk', start: 'MONGE\n', end: 'PALADINO\n', kind: 'class' },
    { resource: 'classes', index: 'paladin', start: 'PALADINO\n', end: 'PATRULHEIRO\n', kind: 'class' },
    { resource: 'classes', index: 'ranger', start: 'PATRULHEIRO\n', end: 'LADINO\n', kind: 'class' },
    { resource: 'classes', index: 'rogue', start: 'LADINO\n', end: 'FEITICEIRO\n', kind: 'class' },
    { resource: 'classes', index: 'sorcerer', start: 'FEITICEIRO\n', end: 'BRUXO\n', kind: 'class' },
    { resource: 'classes', index: 'warlock', start: 'BRUXO\n', end: 'MAGO\n', kind: 'class' },
    { resource: 'classes', index: 'wizard', start: 'MAGO\n', end: 'APÊNDICE', kind: 'class' },
];

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
];

const EXPOSITORY_ANCHORS =
    /(?:^|\n)(Nos confins|Elfos são|Draconatos parecem|Os tieflings|A pigmentação|Vagando entre|Os anões|Os halflings|Os gnomos|Meio-elfos combinam|Com sua propensão|Humanos são|Ser recebido com olhares)/i;

const LORE_CUT_PATTERNS = [
    /\nTRAÇOS RACIAIS (?:DOS|DO|DA|DE)/i,
    /\nAumento no Valor de Habilidade/i,
    /\nNOMES DE /i,
    /\nNomes (?:Humanos|Orcs|Élficos|Tieflings)/i,
];

const CLASS_TABLE_HEADERS =
    /(?:\f|\n)\s*O (?:BÁRBARO|BARDO|CLÉRIGO|DRUIDA|GUERREIRO|MONGE|PALADINO|PATRULHEIRO|LADINO|FEITICEIRO|BRUXO|MAGO)\s*\n/;

function normalizeText(text: string): string {
    return text.replace(/\r\n/g, '\n');
}

function sliceSection(text: string, start: string, end: string): string {
    const normalized = normalizeText(text);
    const from = normalized.indexOf(start);
    if (from < 0) return '';
    const rest = normalized.slice(from + start.length);
    const to = rest.indexOf(end);
    return (to >= 0 ? rest.slice(0, to) : rest).trim();
}

function trimIncompleteTail(text: string): string {
    const t = text.replace(/\s+/g, ' ').trim();
    if (/[.!?…"]$/.test(t)) return t;
    const lastPeriod = Math.max(t.lastIndexOf('. '), t.lastIndexOf('! '), t.lastIndexOf('? '));
    if (lastPeriod > t.length * 0.45) return t.slice(0, lastPeriod + 1).trim();
    return `${t}…`;
}

function truncateAtSentence(text: string, maxLen: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLen) return trimIncompleteTail(normalized);
    const slice = normalized.slice(0, maxLen);
    const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
    const cut = lastPeriod > maxLen * 0.55 ? slice.slice(0, lastPeriod + 1).trim() : `${slice.trim()}…`;
    return trimIncompleteTail(cut);
}

function isPageNumberLine(line: string): boolean {
    return /^\d{1,3}$/.test(line.trim());
}

function isSectionHeader(line: string): boolean {
    const t = line.trim();
    if (!t || isPageNumberLine(t)) return true;
    if (/^[\f]+$/.test(t)) return true;
    if (/^[""''–—-]/.test(t)) return true;
    if (/^NOMES DE /i.test(t)) return true;
    if (/^LINHAGEM /i.test(t)) return true;
    return /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s–\-–—/]{6,}$/.test(t) && t.length < 120 && !/[,.;]/.test(t);
}

function isDialogueOrEpigraph(line: string): boolean {
    const t = line.trim();
    return /^[""''―]/.test(t) || /^–[^\n]+,\s/.test(t);
}

function stripEpigraphs(text: string): string {
    let lore = text;
    const authorMatches = [...lore.matchAll(/\n–[^\n]+\n/g)];
    if (authorMatches.length > 0) {
        const last = authorMatches[authorMatches.length - 1];
        lore = lore.slice(last.index! + last[0].length);
    }
    const anchorIdx = lore.search(EXPOSITORY_ANCHORS);
    if (anchorIdx >= 0) {
        const lineStart = lore.lastIndexOf('\n', anchorIdx);
        lore = lore.slice(lineStart >= 0 ? lineStart + 1 : anchorIdx);
    }
    return lore;
}

function anchorExpositoryParagraphs(paragraphs: string[]): string[] {
    for (let i = 0; i < paragraphs.length; i++) {
        if (EXPOSITORY_ANCHORS.test(`\n${paragraphs[i]}`) || EXPOSITORY_ANCHORS.test(paragraphs[i])) {
            return paragraphs.slice(i);
        }
    }
    return paragraphs.filter(
        p =>
            !/^(?:SEU PAI|EU NUNCA|O COMANDANTE|FLINT OLHAVA|MULHER das|levavam ao portal|Dragões do Crepúsculo)/i.test(
                p,
            ),
    );
}

function mergeParagraphs(text: string): string[] {
    const paragraphs: string[] = [];
    let current = '';

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || isPageNumberLine(line) || /^[\f]+$/.test(line)) {
            if (current.trim()) {
                paragraphs.push(current.replace(/\s+/g, ' ').trim());
                current = '';
            }
            continue;
        }
        if (isSectionHeader(line)) {
            if (current.trim()) {
                paragraphs.push(current.replace(/\s+/g, ' ').trim());
                current = '';
            }
            continue;
        }
        if (isDialogueOrEpigraph(line)) continue;
        current += (current ? ' ' : '') + line;
    }
    if (current.trim()) paragraphs.push(current.replace(/\s+/g, ' ').trim());
    return paragraphs;
}

function isNameListParagraph(p: string): boolean {
    return (
        /Nomes (?:Masculinos|Femininos|Humanos|Orcs|Élficos|Tieflings)/i.test(p) ||
        /(?:Masculinos|Femininos):\s+[A-Z]/i.test(p) ||
        /^[A-Z][a-z]+(?:,\s+[A-Z][a-z]+){4,}/.test(p)
    );
}

function extractExpositoryLore(block: string): string {
    let lore = block;
    for (const re of LORE_CUT_PATTERNS) {
        const idx = lore.search(re);
        if (idx >= 0) lore = lore.slice(0, idx);
    }

    lore = stripEpigraphs(lore);

    const paragraphs = anchorExpositoryParagraphs(
        mergeParagraphs(lore).filter(
            p => p.length >= 60 && !isNameListParagraph(p) && !/^Cada (?:meio-orc|tiefling)/i.test(p),
        ),
    );

    if (paragraphs.length === 0) return '';
    return truncateAtSentence(paragraphs.join(' '), 2800);
}

function extractRaceTraitsBlock(block: string): string {
    const traitsHeaderIdx = block.search(/\nTRAÇOS RACIAIS (?:DOS|DO|DA|DE)/i);
    const searchBlock = traitsHeaderIdx >= 0 ? block.slice(traitsHeaderIdx) : block;

    const idadeIdx = searchBlock.search(/\nIdade\./);
    if (idadeIdx >= 0) {
        let chunk = searchBlock.slice(idadeIdx);
        const idiomasMatch = chunk.match(/\nIdiomas\.\s+([\s\S]*?)(?=\n\n|\n\d+\n|\nAumento|\nCAPÍTULO|$)/);
        if (idiomasMatch && idiomasMatch.index !== undefined) {
            chunk = chunk.slice(0, idiomasMatch.index + idiomasMatch[0].length);
            const after = searchBlock.slice(idadeIdx + chunk.length);
            const aumentoMatch = after.match(/\nAumento no Valor de Habilidade\.[^\n]+(?:\n[^\n]+){0,3}/);
            if (aumentoMatch) chunk += aumentoMatch[0];
        }
        return chunk.trim();
    }

    const matches = [...searchBlock.matchAll(/\nAumento no Valor de Habilidade\./g)];
    if (matches.length === 0) return '';

    let bestIdx = matches[matches.length - 1].index!;
    for (const m of matches) {
        const snippet = searchBlock.slice(m.index!, m.index! + 700);
        if (/\nIdade\./.test(snippet) && /\n(?:Tendência|Alinhamento)\./.test(snippet)) {
            bestIdx = m.index!;
            break;
        }
    }

    let traits = searchBlock.slice(bestIdx);
    const idiomasMatch = traits.match(
        /\nIdiomas\.\s+([\s\S]*?)(?=\n\n[\f]?|\n\d+\n|\n[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}\n|$)/,
    );
    if (idiomasMatch && idiomasMatch.index !== undefined) {
        traits = traits.slice(0, idiomasMatch.index + idiomasMatch[0].length);
    } else {
        const hardCut = traits.search(/\n\n[\f]?[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/);
        if (hardCut >= 0) traits = traits.slice(0, hardCut);
    }
    return traits.trim();
}

function traitStops(excluding: string): string[] {
    return TRAIT_FIELD_STOPS.filter(label => label !== excluding);
}

function extractLabeled(block: string, label: string, stopLabels: string[]): string {
    const stops = stopLabels.map(l => `(?:${l})`).join('|');
    const re = new RegExp(`(?:^|\\n)${label}\\.\\s*([\\s\\S]*?)(?=\\n(?:${stops})\\.|$)`);
    const m = block.match(re);
    return m?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
}

function parseRaceSection(block: string): Record<string, string> {
    const out: Record<string, string> = {};
    const traitsBlock = extractRaceTraitsBlock(block);
    const lore = extractRaceLore(block);

    if (lore.length >= 80) out.desc = lore;

    if (!traitsBlock) return out;

    const age = extractLabeled(traitsBlock, 'Idade', traitStops('Idade'));
    const alignment =
        extractLabeled(traitsBlock, 'Tendência', traitStops('Tendência')) ||
        extractLabeled(traitsBlock, 'Alinhamento', traitStops('Alinhamento'));
    const sizeBlock = extractLabeled(traitsBlock, 'Tamanho', traitStops('Tamanho'));
    const languageDesc = extractLabeled(traitsBlock, 'Idiomas', traitStops('Idiomas'));

    if (age && age.length <= 400) out.age = age;
    if (alignment && alignment.length <= 600) out.alignment = alignment;
    if (sizeBlock && sizeBlock.length <= 400) {
        out.size_description = sizeBlock;
        if (/médio/i.test(sizeBlock)) out.size = 'Médio';
        if (/pequeno/i.test(sizeBlock)) out.size = 'Pequeno';
    }
    if (languageDesc && languageDesc.length <= 700) out.language_desc = languageDesc;

    return out;
}

function extractRaceLore(block: string): string {
    return extractExpositoryLore(block);
}

function parseSubraceBlock(block: string): Record<string, string> {
    const aumentoIdx = block.search(/\nAumento no Valor de Habilidade/i);
    const lore = aumentoIdx >= 0 ? block.slice(0, aumentoIdx) : block;
    const paragraphs = mergeParagraphs(stripEpigraphs(lore)).filter(p => p.length >= 40 && !isNameListParagraph(p));
    const desc = paragraphs.find(p => p.length >= 40 && p.length <= 900) ?? paragraphs[0] ?? '';
    return desc.length >= 40 ? { desc: truncateAtSentence(desc.replace(/\s+/g, ' ').trim(), 900) } : {};
}

function parseClassBlock(block: string): Record<string, string> {
    const tableIdx = block.search(CLASS_TABLE_HEADERS);
    const introBlock = tableIdx >= 0 ? block.slice(0, tableIdx) : block;

    const paragraphs = mergeParagraphs(introBlock).filter(
        p => p.length >= 60 && !/Nível Proficiência/.test(p) && !/^PROFICIÊNCIAS$/i.test(p),
    );

    const intro = paragraphs.join(' ');
    return intro.length >= 80 ? { desc: truncateAtSentence(intro, 3600) } : {};
}

function writeOverride(resource: string, index: string, patch: Record<string, string>): void {
    if (Object.keys(patch).length === 0) return;
    const dir = join(OUT_DIR, resource);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${index}.json`);
    writeFileSync(path, `${JSON.stringify(patch, null, 2)}\n`, 'utf-8');
}

export function extractPhbPtBrOverrides(textPath = PHB_TEXT): { written: number } {
    if (!existsSync(textPath)) {
        throw new Error(
            `Texto PHB não encontrado em ${textPath}. Baixe o PDF e rode: pdftotext backend/.tmp/phb-ptbr.pdf backend/.tmp/phb-ptbr.txt`,
        );
    }
    const text = normalizeText(readFileSync(textPath, 'utf-8'));
    let written = 0;

    for (const spec of RACE_SECTIONS) {
        const block = sliceSection(text, spec.start, spec.end);
        if (!block) continue;
        const patch = spec.kind === 'subrace' ? parseSubraceBlock(block) : parseRaceSection(block);
        if (Object.keys(patch).length === 0) continue;
        writeOverride(spec.resource, spec.index, patch);
        written += 1;
    }

    for (const spec of CLASS_SECTIONS) {
        const block = sliceSection(text, spec.start, spec.end);
        if (!block) continue;
        const patch = parseClassBlock(block);
        if (Object.keys(patch).length === 0) continue;
        writeOverride(spec.resource, spec.index, patch);
        written += 1;
    }

    return { written };
}

const isMain =
    process.argv[1] != null &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
    try {
        const result = extractPhbPtBrOverrides();
        console.log(`[extractPhb] ${result.written} overrides gravados em ${OUT_DIR}`);
    } catch (err) {
        console.error('[extractPhb] falhou:', err);
        process.exit(1);
    }
}
