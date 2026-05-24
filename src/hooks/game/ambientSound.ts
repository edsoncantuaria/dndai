import { ambientSounds } from '@/data/ambient-sounds';

const normalizeText = (value: string) =>
    value
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

const tokenize = (value: string): string[] => normalizeText(value).split(/[^a-z0-9]+/g).filter(Boolean);

const soundLibrary = new Map(ambientSounds.map(sound => [sound.id, sound]));
const soundTagCache = new Map(
    ambientSounds.map(sound => [sound.id, sound.tags.map(tag => normalizeText(tag)).filter(Boolean)])
);

const KEYWORD_TAGS: Record<string, string[]> = {
    taverna: ['taverna', 'social', 'interior', 'cidade'],
    tavern: ['taverna', 'social', 'interior', 'cidade'],
    taberna: ['taverna', 'social', 'interior', 'cidade'],
    pousada: ['taverna', 'interior', 'social'],
    estalagem: ['taverna', 'interior', 'social'],
    mercado: ['mercado', 'cidade', 'social'],
    bazar: ['mercado', 'cidade', 'social'],
    feira: ['mercado', 'cidade', 'social'],
    porto: ['porto', 'agua', 'cidade'],
    doca: ['porto', 'agua', 'cidade'],
    docks: ['porto', 'agua', 'cidade'],
    navio: ['oceano', 'agua', 'navio'],
    barco: ['oceano', 'agua', 'navio'],
    ship: ['oceano', 'agua', 'navio'],
    mar: ['oceano', 'agua'],
    praia: ['oceano', 'agua'],
    costa: ['oceano', 'agua'],
    floresta: ['floresta', 'natureza'],
    bosque: ['floresta', 'natureza'],
    selva: ['selva', 'floresta', 'natureza'],
    campamento: ['acampamento', 'fogueira', 'exterior'],
    acampamento: ['acampamento', 'fogueira', 'exterior'],
    fogueira: ['fogueira', 'acampamento'],
    pantano: ['pantano', 'umido', 'natureza'],
    brejo: ['pantano', 'umido', 'natureza'],
    masmorra: ['masmorra', 'subterraneo', 'perigo'],
    dungeon: ['masmorra', 'subterraneo', 'perigo'],
    caverna: ['caverna', 'subterraneo', 'perigo'],
    catacumba: ['catacumbas', 'terror', 'subterraneo'],
    cripta: ['catacumbas', 'terror', 'subterraneo'],
    mina: ['mina', 'subterraneo'],
    ruina: ['ruina', 'perigo'],
    templo: ['templo', 'sagrado', 'interior'],
    catedral: ['templo', 'sagrado', 'interior'],
    igreja: ['templo', 'sagrado', 'interior'],
    santuario: ['templo', 'sagrado', 'interior'],
    castelo: ['castelo', 'interior'],
    fortaleza: ['castelo', 'guerra'],
    torre: ['castelo'],
    palacio: ['castelo', 'social'],
    biblioteca: ['biblioteca', 'interior', 'calmo'],
    laboratorio: ['laboratorio', 'magia', 'interior'],
    ferreiro: ['forja', 'cidade', 'interior'],
    forja: ['forja', 'cidade', 'interior'],
    festival: ['festival', 'social', 'cidade'],
    carnaval: ['festival', 'social'],
    cerco: ['guerra', 'combate'],
    batalha: ['combate', 'batalha'],
    guerra: ['combate', 'guerra'],
    deserto: ['deserto', 'areia'],
    duna: ['deserto', 'areia'],
    vulcao: ['vulcao', 'lava', 'fogo'],
    lava: ['lava', 'fogo'],
    gelo: ['gelo', 'neve', 'inverno', 'frio'],
    neve: ['neve', 'inverno', 'frio'],
    inverno: ['neve', 'inverno', 'frio'],
    cidade: ['cidade', 'social'],
    vila: ['cidade', 'social'],
    aldeia: ['cidade', 'social'],
};

const KEYWORD_ENTRIES = Object.entries(KEYWORD_TAGS);

const WEATHER_TAG_RULES = [
    { match: 'tempest', tags: ['tempestade', 'chuva'] },
    { match: 'tormenta', tags: ['tempestade', 'chuva'] },
    { match: 'chuva', tags: ['chuva', 'tempestade'] },
    { match: 'neve', tags: ['neve', 'inverno', 'frio'] },
    { match: 'geada', tags: ['inverno', 'frio'] },
    { match: 'inverno', tags: ['inverno', 'frio', 'neve'] },
    { match: 'areia', tags: ['deserto'] },
    { match: 'poeira', tags: ['deserto'] },
    { match: 'vento', tags: ['vento'] },
    { match: 'neblina', tags: ['neblina', 'mistico'] },
];

const TIME_TAG_RULES = [
    { match: 'noite', tags: ['noite'] },
    { match: 'madrugada', tags: ['noite'] },
    { match: 'crepuscu', tags: ['noite'] },
    { match: 'amanhecer', tags: ['dia'] },
    { match: 'manh', tags: ['dia'] },
    { match: 'tarde', tags: ['dia'] },
    { match: 'dia', tags: ['dia'] },
];

const REGION_TYPE_TAGS: Record<string, string[]> = {
    city: ['cidade', 'social'],
    world: ['cidade'],
    dungeon: ['masmorra', 'subterraneo', 'perigo'],
    wild: ['floresta', 'natureza'],
    instance: [],
};

const COMBAT_KEYWORDS = ['combate', 'batalha', 'guerra', 'cerco', 'escaramu', 'skirmish', 'ataque', 'invasao', 'siege'];

export type AmbientContext = {
    isCombatActive?: boolean;
    currentAmbientId?: string;
};

export const deriveAmbientSoundFromWorld = (
    worldState?: { [key: string]: unknown } | null,
    context: AmbientContext = {}
): string => {
    if (!worldState) return 'none';

    const overrideCandidates = [
        worldState.ambientSoundId,
        worldState.ambientTrack,
        worldState.musicTrack,
        (worldState.music as { id?: string } | undefined)?.id,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    for (const candidate of overrideCandidates) {
        if (soundLibrary.has(candidate)) {
            return candidate;
        }
    }

    const tokens = new Set<string>();
    const pushTokens = (value?: string | string[]) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(pushTokens);
            return;
        }
        tokenize(value).forEach(token => tokens.add(token));
    };

    [
        'currentRegion',
        'regionSlug',
        'regionType',
        'poiSlug',
        'poiName',
        'location',
        'biome',
        'terrain',
        'environment',
        'zone',
        'storyArc',
        'keywords',
        'weather',
        'timeOfDay',
    ].forEach(key => pushTokens(worldState[key] as string | string[] | undefined));

    pushTokens(worldState.ongoingEvents as string | string[] | undefined);
    pushTokens(worldState.environmentTags as string | string[] | undefined);
    pushTokens(worldState.tags as string | string[] | undefined);

    const derivedTags = new Set<string>();
    tokens.forEach(token => {
        derivedTags.add(token);
        KEYWORD_ENTRIES.forEach(([keyword, mappedTags]) => {
            if (token.includes(keyword)) {
                mappedTags.forEach(tag => derivedTags.add(tag));
            }
        });
    });

    const regionType = normalizeText(String(worldState.regionType ?? ''));
    if (regionType && REGION_TYPE_TAGS[regionType]) {
        REGION_TYPE_TAGS[regionType].forEach(tag => derivedTags.add(tag));
    }

    const normalizedWeather = normalizeText(String(worldState.weather ?? ''));
    WEATHER_TAG_RULES.forEach(rule => {
        if (rule.tags && normalizedWeather.includes(rule.match)) {
            rule.tags.forEach(tag => derivedTags.add(tag));
        }
    });

    const normalizedTime = normalizeText(String(worldState.timeOfDay ?? ''));
    TIME_TAG_RULES.forEach(rule => {
        if (normalizedTime.includes(rule.match)) {
            rule.tags.forEach(tag => derivedTags.add(tag));
        }
    });

    const hasCombatKeyword = Array.from(tokens).some(token =>
        COMBAT_KEYWORDS.some(keyword => token.includes(keyword))
    );
    const normalizedAlert = normalizeText(String(worldState.alertLevel ?? worldState.dangerLevel ?? ''));
    const isCombatContext = context.isCombatActive || hasCombatKeyword || normalizedAlert.includes('combate');
    if (isCombatContext) {
        ['combate', 'batalha', 'epico'].forEach(tag => derivedTags.add(tag));
    }

    const scoreSound = (soundId: string): number => {
        const tags = soundTagCache.get(soundId) ?? [];
        let score = 0;
        tags.forEach(tag => {
            if (derivedTags.has(tag)) {
                score += 3;
            }
        });
        if (isCombatContext) {
            if (tags.includes('combate') || tags.includes('batalha')) {
                score += 5;
            } else if (tags.includes('epico')) {
                score += 2;
            } else {
                score -= 3;
            }
        } else if (tags.includes('combate') || tags.includes('batalha')) {
            score -= 2;
        } else if (tags.includes('calmo')) {
            score += 0.5;
        }
        if (context.currentAmbientId && soundId === context.currentAmbientId) {
            score += 0.25;
        }
        return score;
    };

    let bestSoundId = 'none';
    let bestScore = 0;
    ambientSounds.forEach(sound => {
        if (!sound.url) return;
        const score = scoreSound(sound.id);
        if (score > bestScore) {
            bestScore = score;
            bestSoundId = sound.id;
        }
    });

    if (bestScore > 0) {
        return bestSoundId;
    }

    const fallback = isCombatContext ? 'monster_attack' : 'windswept_plains';
    if (soundLibrary.has(fallback)) {
        return fallback;
    }
    return 'none';
};
