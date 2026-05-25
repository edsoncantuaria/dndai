/**
 * Ficha narrativa compacta para o prompt OSS (~80–150 tokens).
 * Inspirado em MOM: summary curto no recall, substance longa fora do hot path.
 */

const DEFAULT_MAX_CHARS = 520;

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function clip(text: string, max: number): string {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

/** Monta card narrativo do PJ — sem inventário completo nem spells (motor decide). */
export function buildNarrativeCharacterCard(
    character: Record<string, unknown> | null | undefined,
    maxChars = DEFAULT_MAX_CHARS,
): string {
    if (!character) return '';

    const segments: string[] = [];

    const name = String(character.name ?? 'Herói').trim();
    const race = String(character.race ?? '').trim();
    const cls = String(character.characterClass ?? '').trim();
    const level = character.level ?? '?';
    const identity = [name, race, cls ? `${cls}` : '', `Lv${level}`].filter(Boolean).join(' ');
    segments.push(identity);

    const worldState = asRecord(character.worldState);
    const region = String(
        worldState?.currentRegion ?? character.currentRegion ?? worldState?.regionSlug ?? '',
    ).trim();
    if (region) segments.push(`em ${region}`);

    const attrs = asRecord(character.attributes);
    if (attrs) {
        const hp = attrs.hp ?? '?';
        const maxHp = attrs.maxHp ?? hp;
        const ac = attrs.ac ?? '?';
        const conditions = Array.isArray(attrs.conditions)
            ? attrs.conditions.map(String).filter(Boolean).slice(0, 3)
            : [];
        const condPart = conditions.length ? conditions.join(', ') : 'ok';
        segments.push(`PV ${hp}/${maxHp} CA ${ac} (${condPart})`);
    }

    const story = String(character.storySoFar ?? '').trim();
    if (story) {
        segments.push(`gancho: ${clip(story, 100)}`);
    }

    const relationships = Array.isArray(character.relationships) ? character.relationships : [];
    const relParts = relationships.slice(0, 2).map(r => {
        const rel = asRecord(r);
        if (!rel) return null;
        const who = String(rel.name ?? rel.npcName ?? rel.target ?? '?').trim();
        const mood = String(rel.disposition ?? rel.status ?? rel.relation ?? '').trim();
        return mood ? `${who}(${mood})` : who;
    }).filter(Boolean) as string[];
    if (relParts.length) segments.push(`laços: ${relParts.join('; ')}`);

    const journal = Array.isArray(character.journal) ? character.journal : [];
    const lastEntry = journal[journal.length - 1];
    const lastObj = asRecord(lastEntry);
    if (lastObj) {
        const note = String(lastObj.text ?? lastObj.content ?? lastObj.summary ?? '').trim();
        if (note) segments.push(`nota: ${clip(note, 70)}`);
    }

    const inventory = Array.isArray(character.inventory) ? character.inventory : [];
    const equipped = inventory
        .filter(item => asRecord(item)?.equipped)
        .slice(0, 3)
        .map(item => String(asRecord(item)?.name ?? '?').trim())
        .filter(n => n && n !== '?');
    if (equipped.length) segments.push(`equip: ${equipped.join(', ')}`);

    const passives: string[] = [];
    if (typeof character.passivePerception === 'number') {
        passives.push(`percepção ${character.passivePerception}`);
    }
    if (passives.length) segments.push(passives.join(', '));

    return clip(segments.join(' | '), maxChars);
}

export function estimateCharacterCardTokens(card: string): number {
    return Math.ceil(card.length / 4);
}
