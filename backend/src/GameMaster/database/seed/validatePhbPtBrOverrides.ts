/**
 * Valida qualidade dos overrides PHB PT-BR antes do seed.
 * Uso: npm run penai:validate:phb-overrides --prefix backend
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { globSync } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../../../data/srdPtBr/overrides');

type Issue = { file: string; field: string; code: string; detail?: string };

const FIELD_MAX: Record<string, number> = {
    age: 450,
    alignment: 650,
    size_description: 450,
    language_desc: 750,
    desc: 4000,
};

function validateFile(relPath: string, data: Record<string, unknown>): Issue[] {
    const issues: Issue[] = [];
    for (const [field, value] of Object.entries(data)) {
        if (typeof value !== 'string') continue;
        const max = FIELD_MAX[field] ?? 5000;
        if (value.length > max) {
            issues.push({ file: relPath, field, code: 'too_long', detail: `${value.length} > ${max}` });
        }
        if (field === 'age' && /Richard|Salvatore|Cunningham|Baker|–R\.|MULHER das|CICATRIZES E FORÇA/i.test(value)) {
            issues.push({ file: relPath, field, code: 'author_in_trait_field' });
        }
        if (field === 'desc' && /^(?:MULHER|O COMANDANTE|FLINT OLHAVA|SEU PAI|EU NUNCA|levavam ao portal)/i.test(value.trim())) {
            issues.push({ file: relPath, field, code: 'fiction_in_desc' });
        }
        if (field === 'language_desc' && /tiefling|draconato|gnomo/i.test(value) && !relPath.includes('tiefling') && !relPath.includes('dragonborn') && !relPath.includes('gnome')) {
            issues.push({ file: relPath, field, code: 'cross_race_bleed' });
        }
        if (field === 'desc' && value.length > 180) {
            const trimmed = value.trim();
            const endsClean =
                /[.!?…"]$/.test(trimmed) || trimmed.endsWith('…') || trimmed.endsWith('..."');
            const isSubrace = relPath.startsWith('subraces/');
            if (!endsClean && !isSubrace) {
                issues.push({ file: relPath, field, code: 'desc_maybe_truncated' });
            }
        }
        if (/\b(the|and|your|with|ability score)\b/i.test(value) && field !== 'desc') {
            issues.push({ file: relPath, field, code: 'english_fragment' });
        }
    }
    return issues;
}

export function validatePhbPtBrOverrides(): { ok: boolean; issues: Issue[] } {
    if (!existsSync(OUT_DIR)) {
        return { ok: false, issues: [{ file: OUT_DIR, field: '-', code: 'missing_dir' }] };
    }
    const issues: Issue[] = [];
    for (const abs of globSync('**/*.json', { cwd: OUT_DIR, absolute: true })) {
        const rel = abs.slice(OUT_DIR.length + 1);
        const data = JSON.parse(readFileSync(abs, 'utf-8')) as Record<string, unknown>;
        issues.push(...validateFile(rel, data));
    }
    return { ok: issues.length === 0, issues };
}

const isMain =
    process.argv[1] != null &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
    const result = validatePhbPtBrOverrides();
    if (!result.ok) {
        console.error('[validatePhb] FALHOU —', result.issues.length, 'problema(s):');
        for (const i of result.issues) {
            console.error(`  ${i.file} → ${i.field}: ${i.code}${i.detail ? ` (${i.detail})` : ''}`);
        }
        process.exit(1);
    }
    console.log('[validatePhb] OK — overrides PHB consistentes');
}
