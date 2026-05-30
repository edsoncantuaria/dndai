import type { PenaiActionIntent } from './types.js';

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/** Classifica só pelo texto — usado para validar coerência com `payload.intent`. */
export function classifyPenaiIntentFromText(playerAction: string): PenaiActionIntent['type'] {
    const lower = playerAction.toLowerCase();
    const travelVerbs = /\b(viajar|ir para|partir|seguir para|caminhar até)\b/;
    const regionMatch = lower.match(
        /(?:para|até|em)\s+(?:a\s+)?(?:região\s+)?([a-zà-ú0-9\s-]+)/i,
    );
    if (travelVerbs.test(lower) && regionMatch?.[1]) {
        const guessedSlug = slugify(regionMatch[1]);
        if (guessedSlug.length >= 3) return 'travel';
    }
    if (/\b(atacar|golpear|disparar|lançar feitiço|ataco|golpeio)\b/.test(lower)) {
        return 'combat';
    }
    if (/\b(conversar|persuadir|intimidar|enganar|pergunto|falo com)\b/.test(lower)) {
        return 'social';
    }
    return 'free';
}

const STRUCTURED_INTENTS = new Set([
    'rest',
    'claim-loot',
    'equip-item',
    'drop-item',
    'open-shop',
    'buy-item',
    'sell-item',
    'close-shop',
    'start-encounter',
    'damage',
]);

export function classifyPenaiIntent(
    playerAction: string,
    payload: Record<string, unknown>,
): PenaiActionIntent {
    const structured = payload.structuredIntent as { type?: string } | undefined;
    const structuredType = structured?.type ?? (payload.intent as string | undefined);
    if (structuredType && STRUCTURED_INTENTS.has(structuredType)) {
        return { type: 'free', payload: { structuredIntent: structuredType, ...payload } };
    }

    const explicit = payload.intent as string | undefined;
    if (explicit === 'travel' || payload.targetRegionSlug) {
        return {
            type: 'travel',
            payload: {
                targetRegionSlug: String(payload.targetRegionSlug ?? ''),
                targetPoiSlug: payload.targetPoiSlug
                    ? String(payload.targetPoiSlug)
                    : undefined,
                travelMode: payload.travelMode ? String(payload.travelMode) : 'walk',
            },
        };
    }
    if (explicit === 'combat' || payload.attackType || payload.weaponIndex) {
        return { type: 'combat', payload };
    }
    if (explicit === 'social') {
        return { type: 'social', payload };
    }

    const textType = classifyPenaiIntentFromText(playerAction);
    if (textType === 'travel') {
        const lower = playerAction.toLowerCase();
        const regionMatch = lower.match(
            /(?:para|até|em)\s+(?:a\s+)?(?:região\s+)?([a-zà-ú0-9\s-]+)/i,
        );
        const guessedSlug = regionMatch?.[1] ? slugify(regionMatch[1]) : '';
        if (guessedSlug.length >= 3) {
            return {
                type: 'travel',
                payload: {
                    targetRegionSlug: guessedSlug,
                    travelMode: payload.travelMode ? String(payload.travelMode) : 'walk',
                },
            };
        }
    }
    if (textType === 'combat') return { type: 'combat', payload };
    if (textType === 'social') return { type: 'social', payload };

    return { type: 'free', payload };
}
