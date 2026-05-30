import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BootstrapNpcDraft } from '../agents/worldBootstrapNpcAgent.js';
import { formatNpcDisplayName } from '../npcDisplayName.js';
import type { AutoCanonNpcMockEntry, AutoCanonNpcMockFile } from './autoCanonNpcMockTypes.js';
import type { NpcAiSheetInput } from '../npcAiSheet.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveAutoCanonNpcMockDir(): string {
    const cwd = process.cwd();
    const parent = path.resolve(cwd, '..');
    const candidates = [
        process.env.PENAI_AUTO_NPC_MOCK_DIR,
        path.join(cwd, 'data', 'penai-seed', 'auto-canon-npcs'),
        path.join(parent, 'data', 'penai-seed', 'auto-canon-npcs'),
    ].filter((p): p is string => Boolean(p?.trim()));
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return candidates[0]!;
}

export function loadAutoCanonNpcMockFile(regionSlug: string): AutoCanonNpcMockFile | null {
    const file = path.join(resolveAutoCanonNpcMockDir(), `${regionSlug}.json`);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as AutoCanonNpcMockFile;
    if (!raw?.npcs?.length) return null;
    return raw;
}

export function listAutoCanonNpcMockRegionSlugs(): string[] {
    const dir = resolveAutoCanonNpcMockDir();
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/, ''))
        .sort();
}

function entryToDraft(entry: AutoCanonNpcMockEntry): BootstrapNpcDraft {
    const aiSheet: NpcAiSheetInput = {
        atributos: { ...entry.atributos },
        level: entry.level,
        armorClass: entry.armorClass,
        characterClass: entry.characterClass,
        isSpellcaster: entry.isSpellcaster,
        spells: entry.spells ?? [],
        mainWeaponSlug: entry.mainWeaponSlug,
    };
    return {
        givenName: entry.givenName.trim(),
        roleTitle: entry.roleTitle.trim(),
        displayName: formatNpcDisplayName(entry.givenName, entry.roleTitle),
        role: entry.role.trim(),
        description: entry.description.trim(),
        goal: entry.goal.trim(),
        tier: entry.tier,
        maxHp: entry.maxHp,
        aiSheet,
    };
}

export function draftsFromAutoCanonMock(file: AutoCanonNpcMockFile): BootstrapNpcDraft[] {
    return file.npcs.map(entryToDraft);
}
