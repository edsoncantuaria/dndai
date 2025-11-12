// backend/src/services/aiSanitizer.ts
import type { GameMasterResponse, GameMasterFlowInput } from "../schemas/gameSchemas.js";
import { HomebrewContentType } from "../entities/HomebrewContent.js";
import type { InventoryLike } from './inventoryService.js';
import { trackNormalization } from './normalizationRegistry.js';

const VALID_HOMEBREW_TYPES: HomebrewContentType[] = ['race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'];
export const VALID_RELATIONSHIP_STATUSES = new Set(['hostile', 'unfriendly', 'neutral', 'friendly', 'ally']);
const LOG_ENTRY_ALLOWED_TYPES = new Set(['narration', 'action', 'system', 'combat', 'insight', 'roll']);
export const LOG_ENTRY_TYPE_ALIASES: Record<string, string> = {
    gm: 'narration',
    game: 'narration',
    narrator: 'narration',
    mestre: 'narration',
    player: 'action',
    jogador: 'action',
    personagem: 'action',
    npc: 'action',
};
const COMBAT_ZONE_ALLOWED = new Set(['perto', 'medio', 'longe', 'coberto']);
export const COMBAT_ZONE_ALIASES: Record<string, string> = {
    melee: 'perto',
    close: 'perto',
    near: 'perto',
    short: 'perto',
    ranged: 'medio',
    range: 'medio',
    mid: 'medio',
    medium: 'medio',
    afar: 'longe',
    far: 'longe',
    long: 'longe',
    distant: 'longe',
    cover: 'coberto',
    covered: 'coberto',
};
export const COMBAT_ATTITUDE_ALLOWED = new Set(['ally', 'neutral', 'hostile']);
export const COMBAT_ATTITUDE_ALIASES: Record<string, 'ally' | 'neutral' | 'hostile'> = {
    amigo: 'ally',
    amiga: 'ally',
    aliado: 'ally',
    aliada: 'ally',
    friendly: 'ally',
    friend: 'ally',
    supporter: 'ally',
    supportive: 'ally',
    guard: 'ally',
    guardian: 'ally',
    player: 'ally',
    companion: 'ally',
    companionfriendly: 'ally',
    furious: 'hostile',
    enemy: 'hostile',
    foe: 'hostile',
    hostile: 'hostile',
    aggressor: 'hostile',
    aggressive: 'hostile',
    cultist: 'hostile',
    rival: 'hostile',
    neutralidade: 'neutral',
    indiferente: 'neutral',
    neutral: 'neutral',
};
const ROLL_TYPE_ALLOWED = new Set(['check', 'save', 'attack', 'damage', 'initiative']);
export const ROLL_TYPE_ALIASES: Record<string, string> = {
    skillcheck: 'check',
    'skill check': 'check',
    abilitycheck: 'check',
    ability: 'check',
    skill: 'check',
    savingthrow: 'save',
    'saving throw': 'save',
    attackroll: 'attack',
    'attack roll': 'attack',
    damageroll: 'damage',
    'damage roll': 'damage',
};
export const PROGRESSION_TYPE_ALLOWED = new Set(['xp_gain', 'level_up']);
export const PROGRESSION_TYPE_ALIASES: Record<string, 'xp_gain' | 'level_up'> = {
    xp: 'xp_gain',
    'xp_gain': 'xp_gain',
    'xp gain': 'xp_gain',
    'xp-gain': 'xp_gain',
    experience: 'xp_gain',
    reward: 'xp_gain',
    progress: 'xp_gain',
    progresso: 'xp_gain',
    level: 'level_up',
    'level_up': 'level_up',
    'level up': 'level_up',
    'level-up': 'level_up',
    levelup: 'level_up',
    subir: 'level_up',
};

const canonicalSlug = (value?: string | null) => {
    if (!value) return null;
    return value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || null;
};

const CURRENCY_ITEM_KEYS = new Set([
    'pp',
    'gp',
    'ep',
    'sp',
    'cp',
    'moedas',
    'moedas de ouro',
    'moedas de prata',
    'moedas de cobre',
    'moeda de ouro',
    'moeda de prata',
    'moeda de cobre',
    'peças de ouro',
    'peças de prata',
    'peças de cobre',
    'peça de ouro',
    'peça de prata',
    'peça de cobre',
    'gold pieces',
    'silver pieces',
    'copper pieces',
    'gold coin',
    'silver coin',
    'copper coin',
    'coin pouch',
    'coin purse',
    'bag of coins',
    'pouch of coins',
    'saco de moedas',
    'bolsa de moedas'
]);
const CURRENCY_TO_GP: Record<string, number> = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
const WEAPON_KEYWORDS = ['espada', 'arma', 'adaga', 'foice', 'lança', 'machado', 'arco', 'flecha', 'florete'];
const ARMOR_KEYWORDS = ['armadura', 'escudo', 'capacete', 'grevas', 'peitoral'];
const CONSUMABLE_KEYWORDS = ['poção', 'poçao', 'pocao', 'elixir', 'tonico', 'tônico'];
const TRINKET_KEYWORDS = ['amuleto', 'colar', 'anel', 'runa', 'talisman', 'talismã'];
const SKILL_KEYWORDS = new Set(
  [
    'acrobatics',
    'acrobacia',
    'animal handling',
    'lidar com animais',
    'arcana',
    'atlhetics',
    'athletics',
    'atletismo',
    'deception',
    'enganacao',
    'enganação',
    'history',
    'historia',
    'história',
    'insight',
    'intimidation',
    'intimidação',
    'investigation',
    'investigação',
    'medicine',
    'medicina',
    'nature',
    'natureza',
    'perception',
    'percepção',
    'performance',
    'persuasion',
    'persuasão',
    'religion',
    'religião',
    'sleight of hand',
    'prestidigitação',
    'stealth',
    'furtividade',
    'survival',
    'sobrevivência',
  ].map(keyword => keyword.toLowerCase())
);
const ABILITY_KEYWORDS = new Set(
  [
    'strength',
    'força',
    'str',
    'dexterity',
    'destreza',
    'dex',
    'constitution',
    'constituição',
    'con',
    'intelligence',
    'inteligência',
    'int',
    'wisdom',
    'sabedoria',
    'wis',
    'charisma',
    'carisma',
    'cha',
  ].map(keyword => keyword.toLowerCase())
);

const mergeTextField = (current?: string | null, addition?: string | null) => {
    const next = (addition ?? '').trim();
    if (!next) return current ?? null;
    if (!current || !current.trim()) return next;
    if (current.includes(next)) return current;
    return `${current}\n${next}`.trim();
};

export const TIME_OF_DAY_KEYWORDS: Array<{ keyword: string; normalized: string }> = [
    { keyword: 'manhã', normalized: 'Manhã' },
    { keyword: 'alvorecer', normalized: 'Manhã' },
    { keyword: 'tarde', normalized: 'Tarde' },
    { keyword: 'crepúsculo', normalized: 'Tarde' },
    { keyword: 'pôr do sol', normalized: 'Tarde' },
    { keyword: 'noite', normalized: 'Noite' },
    { keyword: 'meia-noite', normalized: 'Noite' },
];

export const WEATHER_KEYWORDS: Record<string, string> = {
    chuvoso: 'Chuva',
    chovendo: 'Chuva',
    nevando: 'Neve',
    tempestuoso: 'Tempestade',
    ensolarado: 'Ensolarado',
    ensonarado: 'Ensolarado',
    nublado: 'Nublado',
    nevoeiro: 'Nevoeiro',
};

const normalizeCombatAttitude = (
    value: any,
    fallback: 'ally' | 'neutral' | 'hostile' = 'neutral'
): 'ally' | 'neutral' | 'hostile' => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (COMBAT_ATTITUDE_ALLOWED.has(normalized)) {
            return normalized as 'ally' | 'neutral' | 'hostile';
        }
        const alias = COMBAT_ATTITUDE_ALIASES[normalized];
        if (alias) {
            trackNormalization('combat.attitude', value, alias);
            return alias;
        }
    }
    if (typeof value === 'boolean') {
        return value ? 'ally' : fallback;
    }
    return fallback;
};

const sanitizeVisitedPoiEntry = (
    entry: any,
    fallbackRegionSlug?: string | null
): { regionSlug: string; poiSlug: string; name?: string } | null => {
    if (!entry) return null;
    if (typeof entry === 'string') {
        const poiSlug = canonicalSlug(entry);
        if (!poiSlug) return null;
        const regionSlug = canonicalSlug(fallbackRegionSlug) ?? null;
        if (!regionSlug) return null;
        return { regionSlug, poiSlug, name: entry };
    }
    const regionSlug = canonicalSlug(entry.regionSlug ?? fallbackRegionSlug ?? null);
    const poiSlug = canonicalSlug(entry.poiSlug ?? entry.slug ?? entry.name ?? null);
    if (!regionSlug || !poiSlug) return null;
    return {
        regionSlug,
        poiSlug,
        name: entry.name ?? entry.poiName ?? undefined,
    };
};

const sanitizeWorldStatePayload = (worldState: any, fallbackRegionSlug?: string | null) => {
    if (!worldState || typeof worldState !== 'object') return undefined;
    const sanitized: any = {};

    const assignString = (key: string, value: any, transform?: (value: string) => string | null) => {
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed) return;
        const normalized = transform ? transform(trimmed) : trimmed;
        if (!normalized) return;
        sanitized[key] = normalized;
    };

    assignString('timeOfDay', worldState.timeOfDay);
    assignString('weather', worldState.weather);
    assignString('currentRegion', worldState.currentRegion);
    const regionSlug =
        canonicalSlug(worldState.regionSlug) || canonicalSlug(worldState.currentRegion) || canonicalSlug(fallbackRegionSlug) || null;
    if (regionSlug) sanitized.regionSlug = regionSlug;
    assignString('poiName', worldState.poiName);
    const poiSlug = canonicalSlug(worldState.poiSlug ?? worldState.poiName ?? null);
    if (poiSlug) sanitized.poiSlug = poiSlug;

    if (Array.isArray(worldState.visitedRegions)) {
        const regions = Array.from(
            new Set(
                worldState.visitedRegions
                    .map((value: any) => (typeof value === 'string' ? canonicalSlug(value) : null))
                    .filter(Boolean)
            )
        ) as string[];
        if (regions.length) sanitized.visitedRegions = regions;
    }

    if (Array.isArray(worldState.visitedPois)) {
        const pois = worldState.visitedPois
            .map(entry => sanitizeVisitedPoiEntry(entry, regionSlug))
            .filter(Boolean) as Array<{ regionSlug: string; poiSlug: string; name?: string }>;
        if (poiSlug && regionSlug && !pois.some(poi => poi.regionSlug === regionSlug && poi.poiSlug === poiSlug)) {
            pois.push({ regionSlug, poiSlug, name: sanitized.poiName });
        }
        if (pois.length) sanitized.visitedPois = pois;
    } else if (poiSlug && regionSlug) {
        sanitized.visitedPois = [{ regionSlug, poiSlug, name: sanitized.poiName }];
    }

    if (Array.isArray(worldState.npcLocations)) {
        const locations = worldState.npcLocations
            .map((entry: any) => {
                if (!entry || typeof entry !== 'object') return null;
                const npcId = canonicalSlug(entry.npcId ?? entry.name);
                if (!npcId) return null;
                return {
                    npcId,
                    name: entry.name ?? undefined,
                    regionSlug: canonicalSlug(entry.regionSlug) ?? undefined,
                    poiSlug: canonicalSlug(entry.poiSlug) ?? undefined,
                    notes: typeof entry.notes === 'string' ? entry.notes : undefined,
                };
            })
            .filter(Boolean);
        if (locations.length) sanitized.npcLocations = locations;
    }

    return Object.keys(sanitized).length ? sanitized : undefined;
};

type CurrencyKey = 'pp' | 'gp' | 'ep' | 'sp' | 'cp';

const detectCurrencyKeyFromText = (raw?: string): CurrencyKey | undefined => {
    if (!raw) return undefined;
    const normalized = raw.toLowerCase();
    if (/\bpp\b/.test(normalized) || normalized.includes('platina') || normalized.includes('platinum')) return 'pp';
    if (/\bep\b/.test(normalized) || normalized.includes('electrum')) return 'ep';
    if (/\bsp\b/.test(normalized) || normalized.includes('prata') || normalized.includes('silver')) return 'sp';
    if (/\bcp\b/.test(normalized) || normalized.includes('cobre') || normalized.includes('copper')) return 'cp';
    if (/\bgp\b/.test(normalized) || normalized.includes('ouro') || normalized.includes('gold')) return 'gp';
    if (normalized.includes('coin') || normalized.includes('coins') || normalized.includes('moeda') || normalized.includes('moedas') || normalized.includes('peça') || normalized.includes('peças')) {
        return 'gp';
    }
    return undefined;
};

/**
 * Normaliza a string 'timeOfDay' para um valor de enumeração conhecido.
 * @param timeOfDayString A string de tempo vinda da IA.
 * @returns Um valor de enumeração ('Manhã', 'Tarde', 'Noite') ou o valor original se não houver correspondência.
 */
const normalizeTimeOfDay = (timeOfDayString: string): string => {
    if (!timeOfDayString) return 'Manhã';
    const lowerCaseTime = timeOfDayString.toLowerCase();
    for (const entry of TIME_OF_DAY_KEYWORDS) {
        if (lowerCaseTime.includes(entry.keyword)) {
            trackNormalization('world.timeOfDay', timeOfDayString, entry.normalized);
            return entry.normalized;
        }
    }
    return timeOfDayString;
};

/**
 * Normaliza a string 'weather' para um valor conhecido.
 * @param weatherString A string de clima vinda da IA.
 * @returns Um valor de enumeração ou o valor original se não houver correspondência.
 */
const normalizeWeather = (weatherString: string): string => {
    if (!weatherString) return 'Ensolarado';
    const lowerCaseWeather = weatherString.toLowerCase();
    for (const [keyword, normalized] of Object.entries(WEATHER_KEYWORDS)) {
        if (lowerCaseWeather.includes(keyword)) {
            trackNormalization('world.weather', weatherString, normalized);
            return normalized;
        }
    }
    const knownWeathers = ['Ensolarado', 'Nublado', 'Chuva', 'Tempestade', 'Neve', 'Nevoeiro'];
    const found = knownWeathers.find(w => lowerCaseWeather.includes(w.toLowerCase()));
    if (found) {
        trackNormalization('world.weather', weatherString, found);
        return found;
    }
    return 'Ensolarado';
};

const DEFAULT_WORLD_STATE = {
    timeOfDay: 'Manhã',
    weather: 'Ensolarado',
    currentRegion: 'Desconhecida',
};
const clampText = (value: any, limit = 320): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.length <= limit) return trimmed;
    return `${trimmed.slice(0, limit - 3)}...`;
};

const normalizeCombatZone = (zone: any): string | undefined => {
    if (!zone || typeof zone !== 'string') return undefined;
    const key = zone.trim().toLowerCase();
    if (COMBAT_ZONE_ALLOWED.has(key)) return key;
    const alias = COMBAT_ZONE_ALIASES[key];
    if (alias) {
        trackNormalization('combat.zone', zone, alias);
    }
    return alias;
};

const normalizeRollType = (value: any): string | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return undefined;
    if (ROLL_TYPE_ALLOWED.has(trimmed)) return trimmed;
    if (ROLL_TYPE_ALIASES[trimmed]) {
        const alias = ROLL_TYPE_ALIASES[trimmed];
        trackNormalization('roll.type', value, alias);
        return alias;
    }

    const simplified = trimmed
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (simplified) {
        if (ROLL_TYPE_ALLOWED.has(simplified)) return simplified;
        if (ROLL_TYPE_ALIASES[simplified]) {
            const alias = ROLL_TYPE_ALIASES[simplified];
            trackNormalization('roll.type', value, alias);
            return alias;
        }
    }

    if (simplified && (SKILL_KEYWORDS.has(simplified) || ABILITY_KEYWORDS.has(simplified))) {
        trackNormalization('roll.type', value, 'check', { heuristic: 'skill-match' });
        return 'check';
    }
    if (SKILL_KEYWORDS.has(trimmed) || ABILITY_KEYWORDS.has(trimmed)) {
        trackNormalization('roll.type', value, 'check', { heuristic: 'skill-match' });
        return 'check';
    }

    const healingKeywords = ['healing', 'hp', 'hit_dice', 'hit dice', 'hp_recovery', 'hp recovery', 'cura'];
    if (healingKeywords.some(keyword => simplified.includes(keyword) || trimmed.includes(keyword))) {
        trackNormalization('roll.type', value, 'check', { heuristic: 'healing' });
        return 'check';
    }

    const containsSkill = Array.from(SKILL_KEYWORDS).some(keyword => simplified.includes(keyword) || trimmed.includes(keyword));
    const containsAbility = Array.from(ABILITY_KEYWORDS).some(keyword => simplified.includes(keyword) || trimmed.includes(keyword));
    if (containsSkill || containsAbility) {
        trackNormalization('roll.type', value, 'check', { heuristic: 'keyword' });
        return 'check';
    }

    return undefined;
};
const normalizeProgressionType = (value: any): 'xp_gain' | 'level_up' | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    const key = value.trim().toLowerCase();
    if (PROGRESSION_TYPE_ALLOWED.has(key)) return key as 'xp_gain' | 'level_up';
    const alias = PROGRESSION_TYPE_ALIASES[key];
    if (alias) {
        trackNormalization('progression.type', value, alias);
    }
    return alias;
};

const buildSafeWorldState = (source?: any, fallbackRegion?: string) => {
    const base = (source && typeof source === 'object') ? source : {};
    const timeOfDay = normalizeTimeOfDay(typeof base.timeOfDay === 'string' ? base.timeOfDay : '');
    const weather = normalizeWeather(typeof base.weather === 'string' ? base.weather : '');
    const currentRegion = base.currentRegion ?? fallbackRegion ?? DEFAULT_WORLD_STATE.currentRegion;
    return {
        ...base,
        timeOfDay,
        weather,
        currentRegion,
    };
};

/**
 * Sanitiza a resposta validada da IA para garantir consistência lógica e semântica.
 * Atua como a camada final de "senso de jogo" antes de retornar a resposta.
 * @param responseData A resposta da IA, que PODE conter campos nulos ou malformados.
 * @param currentCharacter O estado atual do personagem, para fallback.
 * @returns Um objeto GameMasterResponse logicamente coerente e seguro.
 */
export const sanitizeGameMasterResponse = (
    responseData: any,
    currentCharacter?: any,
    flowInput?: GameMasterFlowInput
): GameMasterResponse => {
  if (!responseData || typeof responseData !== 'object') {
    return {
      logEntries: [{ type: 'system', content: 'A resposta da IA foi inválida ou vazia.' }],
      actionOptions: [],
    };
  }

  const sanitized: Partial<GameMasterResponse> = { ...responseData };
  const sanitationLogs: string[] = [];
  const inventoryCurrency: Record<CurrencyKey, number> = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

  const toNumber = (value: any): number | undefined => {
    if (value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const addCurrencyAmount = (key: CurrencyKey | undefined, amount: number) => {
    if (!key) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    inventoryCurrency[key] = (inventoryCurrency[key] ?? 0) + amount;
  };

  const accumulateCurrency = (item?: InventoryLike): boolean => {
    if (!item) return false;
    const descriptor = `${item.index ?? ''} ${item.name ?? ''} ${item.id ?? ''}`;
    const currencyKey = detectCurrencyKeyFromText(descriptor);
    if (!currencyKey) return false;
    const quantity = Math.max(0, toNumber(item.quantity) ?? 1);
    if (quantity === 0) return true;
    addCurrencyAmount(currencyKey, quantity);
    return true;
  };

  const mergeCurrencyObject = (source?: any) => {
    if (!source || typeof source !== 'object') return;
    for (const [key, value] of Object.entries(source)) {
      const currencyKey = detectCurrencyKeyFromText(key);
      if (!currencyKey) continue;
      const amount = Math.max(0, toNumber(value) ?? 0);
      addCurrencyAmount(currencyKey, amount);
    }
  };

  const drainLooseCurrencyFields = (target?: any) => {
    if (!target || typeof target !== 'object') return;
    const looseFields: Array<[string, CurrencyKey]> = [
      ['gold', 'gp'],
      ['gp', 'gp'],
      ['silver', 'sp'],
      ['sp', 'sp'],
      ['copper', 'cp'],
      ['cp', 'cp'],
      ['platinum', 'pp'],
      ['pp', 'pp'],
      ['electrum', 'ep'],
      ['ep', 'ep'],
      ['coins', 'gp'],
    ];
    looseFields.forEach(([field, key]) => {
      if (target[field] === undefined) return;
      const amount = Math.max(0, toNumber(target[field]) ?? 0);
      addCurrencyAmount(key, amount);
      delete target[field];
    });
  };

  const normalizeInventoryItems = (items: InventoryLike[] | undefined): InventoryLike[] => {
    if (!Array.isArray(items)) return [];
    const normalized: InventoryLike[] = [];
    items.forEach(item => {
      if (!item) return;
      if (accumulateCurrency(item)) return;
      const quantity = Math.max(1, Math.floor(toNumber(item.quantity) ?? 1));
      const cleanItem: InventoryLike = { ...item, quantity };
      if ('stackSize' in cleanItem) delete cleanItem.stackSize;
      if ('stackInstance' in cleanItem) delete cleanItem.stackInstance;
      normalized.push(cleanItem);
    });
    return normalized;
  };
  const canonicalizeInventoryId = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return null;
    return normalized.replace(/-copy-\d+$/i, '');
  };
  const buildInventoryKey = (item: any): string | null => {
    if (!item) return null;
    const candidates = [item.index, item.id, item.name];
    for (const candidate of candidates) {
      const key = canonicalizeInventoryId(candidate);
      if (key) return key;
    }
    return null;
  };

  const mergeInventoryItems = (
    incoming: InventoryLike[],
    previous: InventoryLike[] | undefined
  ): InventoryLike[] => {
    const snapshot = new Map<string, InventoryLike>();

    if (Array.isArray(previous)) {
      for (const item of previous) {
        if (accumulateCurrency(item)) continue;
        const key = buildInventoryKey(item);
        if (!key) continue;
        const base = snapshot.get(key);
        const clampQuantity = (value: any) => Math.max(1, Math.floor(toNumber(value) ?? 1));
        if (base) {
          const combinedQuantity = clampQuantity(base.quantity) + clampQuantity(item.quantity);
          const merged = { ...base, ...item, quantity: combinedQuantity };
          delete merged.stackSize;
          delete merged.stackInstance;
          snapshot.set(key, merged);
        } else {
          const clean = { ...item };
          delete clean.stackSize;
          delete clean.stackInstance;
          clean.quantity = clampQuantity(clean.quantity);
          snapshot.set(key, clean);
        }
      }
    }

    if (!Array.isArray(incoming)) {
      return Array.from(snapshot.values());
    }

    for (const item of incoming) {
      if (!item) continue;
      if (accumulateCurrency(item)) continue;
      const key = buildInventoryKey(item);

      if (!key) {
        const generatedKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        snapshot.set(generatedKey, { ...item });
        continue;
      }

      if (item.remove === true || item._delete === true) {
        snapshot.delete(key);
        continue;
      }

      const previousItem = snapshot.get(key);
      if (previousItem) {
        const merged = { ...previousItem, ...item };
        delete merged.stackSize;
        delete merged.stackInstance;
        snapshot.set(key, merged);
      } else {
        const clean = { ...item };
        delete clean.stackSize;
        delete clean.stackInstance;
        snapshot.set(key, clean);
      }
    }

    return Array.from(snapshot.values());
  };

  const parseHitDieKey = (value: any): number | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const intValue = Math.floor(Math.abs(value));
      return intValue > 0 ? intValue : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      const dieMatch = trimmed.match(/d(\d+)/);
      if (dieMatch) {
        const dieValue = Number(dieMatch[1]);
        return Number.isFinite(dieValue) && dieValue > 0 ? dieValue : undefined;
      }
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.floor(numeric);
      }
    }
    return undefined;
  };

const normalizeUseHitDice = (value: any): { maxDice: number; hitDieValue: number } | undefined => {
    if (!value || typeof value !== 'object') return undefined;

    const clampPositiveInt = (input: any): number | undefined => {
      const parsed = toNumber(input);
      if (parsed === undefined) return undefined;
      const intValue = Math.floor(parsed);
      return intValue > 0 ? intValue : undefined;
    };

    const directMax = clampPositiveInt(value.maxDice ?? value.availableDice ?? value.quantity ?? value.remainingDice);
    const directDie = clampPositiveInt(value.hitDieValue ?? value.hitDie ?? value.dieValue ?? value.die);
    const parsedDie = parseHitDieKey(value.hitDie ?? value.die ?? value.hitDieValue ?? value.dieValue);
    if (directMax && (directDie || parsedDie)) {
      return { maxDice: directMax, hitDieValue: (directDie ?? parsedDie)! };
    }

    if (value.availableHitDice && typeof value.availableHitDice === 'object') {
      for (const [dieKey, qty] of Object.entries(value.availableHitDice)) {
        const dieValue = parseHitDieKey(dieKey);
        const maxDice = clampPositiveInt(qty);
        if (dieValue && maxDice) {
          return { maxDice, hitDieValue: dieValue };
        }
      }
    }

    if (Array.isArray(value.diceOptions)) {
      for (const option of value.diceOptions) {
        if (!option || typeof option !== 'object') continue;
        const dieValue = parseHitDieKey(option.die ?? option.size ?? option.type);
        const maxDice = clampPositiveInt(option.max ?? option.quantity ?? option.count);
        if (dieValue && maxDice) {
          return { maxDice, hitDieValue: dieValue };
        }
      }
    }

  if (value.hitDice && typeof value.hitDice === 'object') {
      const dieValue = parseHitDieKey(value.hitDice.die ?? value.hitDice.type);
      const maxDice = clampPositiveInt(value.hitDice.available ?? value.hitDice.remaining);
      if (dieValue && maxDice) {
        return { maxDice, hitDieValue: dieValue };
      }
  }

  return undefined;
};

  const guessItemCategory = (name: string, rawType?: string): string => {
    const lower = `${rawType ?? ''} ${name}`.toLowerCase();
    if (WEAPON_KEYWORDS.some(keyword => lower.includes(keyword))) return 'weapon';
    if (ARMOR_KEYWORDS.some(keyword => lower.includes(keyword))) return 'armor';
    if (CONSUMABLE_KEYWORDS.some(keyword => lower.includes(keyword))) return 'consumable';
    if (TRINKET_KEYWORDS.some(keyword => lower.includes(keyword))) return 'trinket';
    return rawType?.toLowerCase() || 'artifact';
  };

  const buildItemTags = (name: string, existing?: string[]): string[] => {
    const tags = new Set<string>();
    (existing ?? []).forEach(tag => typeof tag === 'string' && tags.add(tag));
    const lower = name.toLowerCase();
    if (lower.includes('ritual')) tags.add('ritual');
    if (lower.includes('arcano') || lower.includes('mágic') || lower.includes('magia')) tags.add('magical');
    if (lower.includes('cur')) tags.add('healing');
    return Array.from(tags).slice(0, 8);
  };

  const normalizeLootItem = (item: any) => {
    const name = String(item?.name ?? item?.title ?? 'Item sem nome').trim().slice(0, 120) || 'Item sem nome';
    const description = String(item?.description ?? item?.details ?? 'Descrição indisponível.').trim().slice(0, 600);
    const quantity = Math.max(1, Math.floor(toNumber(item?.quantity ?? item?.count) ?? 1));
    const rarity = String(item?.rarity ?? 'common').toLowerCase();
    const weight = toNumber(item?.weight) ?? 0;
    const category = guessItemCategory(name, item?.type);
    const value = toNumber(item?.value);
    return {
      name,
      description,
      quantity,
      rarity,
      category,
      properties: {
        weight,
        value,
        tags: buildItemTags(name, item?.tags),
        source: item?.source ?? 'loot',
      },
    };
  };

  const extractHpPair = (source: any): { current?: number; max?: number } | undefined => {
    if (!source || typeof source !== 'object') return undefined;
    let current = undefined;
    let max = undefined;

    const objectCandidates = [
      source.hp,
      source.attributes?.hp,
      source.stats?.hp,
      source.health,
    ];
    for (const candidate of objectCandidates) {
      if (typeof candidate === 'number') {
        current = current ?? toNumber(candidate);
      } else if (candidate && typeof candidate === 'object') {
        if (candidate.current !== undefined) current = current ?? toNumber(candidate.current);
        if (candidate.value !== undefined) current = current ?? toNumber(candidate.value);
        if (candidate.remaining !== undefined) current = current ?? toNumber(candidate.remaining);
        if (candidate.max !== undefined) max = max ?? toNumber(candidate.max);
        if (candidate.maximum !== undefined) max = max ?? toNumber(candidate.maximum);
        if (candidate.total !== undefined) max = max ?? toNumber(candidate.total);
      }
    }

    const currentCandidates = [
      source.hpCurrent,
      source.currentHp,
      source.remainingHp,
      source.current_health,
      source.healthCurrent,
    ];
    for (const candidate of currentCandidates) {
      const value = toNumber(candidate);
      if (value !== undefined) {
        current = current ?? value;
        break;
      }
    }

    const maxCandidates = [
      source.hpMax,
      source.maxHp,
      source.totalHp,
      source.healthMax,
      source.max_health,
    ];
    for (const candidate of maxCandidates) {
      const value = toNumber(candidate);
      if (value !== undefined) {
        max = max ?? value;
        break;
      }
    }

    if (current === undefined && max === undefined) return undefined;
    if (current === undefined) current = max ?? 0;
    if (max === undefined) max = current;
    return { current, max };
  };

  const getPlayerFallbackHp = () => {
    const updatedAttrs = sanitized.updatedCharacter?.attributes;
    const charAttrs = currentCharacter?.attributes;
    const current = toNumber(updatedAttrs?.hp) ?? toNumber(charAttrs?.hp);
    const max = toNumber(updatedAttrs?.maxHp) ?? toNumber(charAttrs?.maxHp) ?? toNumber(charAttrs?.hp);
    return current !== undefined || max !== undefined
      ? { current: current ?? max ?? 0, max: max ?? current ?? 0 }
      : undefined;
  };

  if (sanitized.updatedCharacter && Array.isArray(sanitized.updatedCharacter.inventory)) {
    const previousItems = Array.isArray(currentCharacter?.inventory) ? currentCharacter!.inventory : [];
    sanitized.updatedCharacter.inventory = mergeInventoryItems(
      sanitized.updatedCharacter.inventory,
      previousItems
    );
  } else if (!sanitized.updatedCharacter?.inventory && Array.isArray(currentCharacter?.inventory)) {
    sanitized.updatedCharacter = {
      ...(sanitized.updatedCharacter || {}),
      inventory: currentCharacter.inventory.slice(),
    };
  }

  if (sanitized.updatedCharacter && Array.isArray(sanitized.updatedCharacter.inventory)) {
    sanitized.updatedCharacter.inventory = normalizeInventoryItems(sanitized.updatedCharacter.inventory);
  }

  if (sanitized.updatedCharacter) {
    drainLooseCurrencyFields(sanitized.updatedCharacter);
    if (sanitized.updatedCharacter.currency) {
      mergeCurrencyObject(sanitized.updatedCharacter.currency);
    }
  }

  const totalCurrencyUnits = Object.values(inventoryCurrency).reduce((sum, value) => sum + value, 0);
  if (totalCurrencyUnits > 0) {
    sanitized.updatedCharacter = {
      ...(sanitized.updatedCharacter || {}),
      currency: { ...inventoryCurrency },
    };
  }

  if (sanitized.updatedCharacter) {
    console.log('[aiSanitizer] updatedCharacter após merge', sanitized.updatedCharacter);
  }



  // Sanitize logEntries
  if (Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = sanitized.logEntries
      .map((entry: any) => {
        if (!entry || typeof entry !== 'object' || !entry.content) return null;
        let content = typeof entry.content === 'object' ? JSON.stringify(entry.content) : String(entry.content);
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed.content === 'string') {
            content = parsed.content;
          }
        } catch (e) { /* Ignore */ }

        content = content.replace(/<\/?narration>/g, '').trim();
        if (!content) return null;

        let type = typeof entry.type === 'string' ? entry.type.toLowerCase().trim() : 'narration';
        if (!LOG_ENTRY_ALLOWED_TYPES.has(type)) {
          const alias = LOG_ENTRY_TYPE_ALIASES[type];
          if (alias) {
            trackNormalization('logEntry.type', entry.type ?? type, alias, { scope: 'logEntries' });
            type = alias;
          } else {
            trackNormalization('logEntry.type', entry.type ?? type, 'narration', { scope: 'logEntries', reason: 'fallback' });
            type = 'narration';
          }
        }

        return { type, content, rollResult: entry.rollResult };
      })
      .filter(Boolean);
  } else {
    sanitized.logEntries = [];
    sanitationLogs.push('logEntries não era um array, resetado para [].');
  }
  if (sanitized.logEntries.length === 0) {
    sanitized.logEntries.push({
      type: 'narration',
      content: 'O tempo passa calmamente enquanto o herói considera suas próximas ações.',
    });
    sanitationLogs.push('logEntries estava vazio, adicionada narração padrão.');
  }
  
  // Sanitize actionOptions
  if (Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = sanitized.actionOptions.map(option => {
        if (typeof option === 'string') {
            return option;
        }
        if (typeof option === 'object' && option !== null && option.text) {
            // If it's an object with `text` but missing `action`, create a default action.
            if (!option.action) {
                option.action = option.text.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
                sanitationLogs.push(`actionOption "${option.text}" teve um campo 'action' gerado automaticamente.`);
            }
            return option;
        }
        return null; // Discard invalid options
    }).filter(Boolean);
  } else {
    sanitized.actionOptions = [];
    sanitationLogs.push('actionOptions não era um array, resetado para [].');
  }
  if (sanitized.actionOptions.length === 0) {
    sanitized.actionOptions = [
      'Observar o ambiente em busca de algo incomum.',
      'Ouvir conversas próximas para recolher boatos.',
      'Conversar com o NPC mais próximo.',
    ];
    sanitationLogs.push('actionOptions estava vazio, adicionadas opções padrão.');
  }

  if (!sanitized.gameClock || typeof sanitized.gameClock !== 'object') {
    sanitized.gameClock = { day: 0, hour: 12, weather: sanitized.worldState?.weather ?? 'clear' };
  } else {
    sanitized.gameClock.day = toNumber(sanitized.gameClock.day) ?? 0;
    sanitized.gameClock.hour = toNumber(sanitized.gameClock.hour) ?? 12;
    sanitized.gameClock.weather = typeof sanitized.gameClock.weather === 'string'
      ? sanitized.gameClock.weather
      : (sanitized.worldState?.weather ?? 'clear');
  }

  if (!sanitized.memoryContext || typeof sanitized.memoryContext !== 'object') {
    sanitized.memoryContext = { summary: '', references: [] };
  } else {
    if (typeof sanitized.memoryContext.summary !== 'string') {
      sanitized.memoryContext.summary = '';
    } else {
      sanitized.memoryContext.summary = sanitized.memoryContext.summary.slice(0, 500);
    }
    if (!Array.isArray(sanitized.memoryContext.references)) {
      sanitized.memoryContext.references = [];
    } else {
      sanitized.memoryContext.references = sanitized.memoryContext.references
        .map((item: any) => (typeof item === 'string' ? item.slice(0, 120) : null))
        .filter(Boolean);
    }
  }

  const fallbackMemorySummary =
    sanitized.logEntries?.[0]?.content ??
    sanitized.logEntries?.[sanitized.logEntries.length - 1]?.content ??
    'Eventos recentes registrados na aventura.';
  if (!sanitized.memoryContext.summary?.trim()) {
    sanitized.memoryContext.summary = fallbackMemorySummary.slice(0, 500);
  }
  if (!Array.isArray(sanitized.memoryContext.references) || sanitized.memoryContext.references.length === 0) {
    const referenceSet = new Set<string>();
    if (sanitized.worldState?.currentRegion) referenceSet.add(sanitized.worldState.currentRegion);
    if (currentCharacter?.worldState?.currentRegion) referenceSet.add(currentCharacter.worldState.currentRegion);
    if (Array.isArray(currentCharacter?.relationships)) {
      currentCharacter.relationships.forEach((rel: any) => rel?.name && referenceSet.add(rel.name));
    }
    sanitized.memoryContext.references = Array.from(referenceSet).slice(0, 5);
  }

  if (sanitized.shopState && typeof sanitized.shopState === 'object') {
    sanitized.shopState.isOpen = Boolean(sanitized.shopState.isOpen ?? true);
    sanitized.shopState.isHaggling = Boolean(sanitized.shopState.isHaggling ?? false);
    sanitized.shopState.name = sanitized.shopState.name ?? sanitized.shopState.merchant?.name ?? 'Empório';
    sanitized.shopState.inventory = Array.isArray(sanitized.shopState.inventory)
      ? sanitized.shopState.inventory
      : [];
    sanitized.shopState.sellPrices = sanitized.shopState.sellPrices && typeof sanitized.shopState.sellPrices === 'object'
      ? sanitized.shopState.sellPrices
      : {};
    if (sanitized.shopState.inventory.length === 0 && typeof sanitized.shopState.inventorySummary === 'string') {
      sanitized.shopState.inventory.push({
        id: 'summary',
        name: sanitized.shopState.inventorySummary,
        description: sanitized.shopState.inventorySummary,
      });
    }
  }
  if (!sanitized.shopState && currentCharacter?.shopState) {
    sanitized.shopState = { ...currentCharacter.shopState };
  }

  const normalizeCurrency = (source: any): { gp: number } => {
    let gpValue = 0;
    if (source && typeof source === 'object') {
      for (const key of Object.keys(source)) {
        const lower = key.toLowerCase();
        const value = Math.max(0, toNumber(source[key]) ?? 0);
        const rate = CURRENCY_TO_GP[lower] ?? (lower.includes('ouro') ? 1 : lower.includes('prata') ? 0.1 : lower.includes('cobre') ? 0.01 : undefined);
        if (rate !== undefined) gpValue += value * rate;
      }
    } else {
      gpValue = Math.max(0, toNumber(source) ?? 0);
    }
    return { gp: gpValue };
  };

  const existingHomebrewNames = new Set(
    Array.isArray(sanitized.newHomebrewContent)
      ? sanitized.newHomebrewContent
          .map((entry: any) => entry?.name?.toLowerCase?.())
          .filter(Boolean)
      : []
  );
  const pendingHomebrewEntries: any[] = [];

  if (sanitized.lootOffer && typeof sanitized.lootOffer === 'object') {
    const normalizedLoot: { items: any[]; currency: { gp: number } } = {
      items: [],
      currency: { gp: 0 },
    };

    if (Array.isArray((sanitized.lootOffer as any).items)) {
      normalizedLoot.items = (sanitized.lootOffer as any).items;
    } else if ((sanitized.lootOffer as any).item) {
      normalizedLoot.items = [(sanitized.lootOffer as any).item];
    }

    if ((sanitized.lootOffer as any).currency) {
      normalizedLoot.currency = normalizeCurrency((sanitized.lootOffer as any).currency);
    } else if ((sanitized.lootOffer as any).gold !== undefined || (sanitized.lootOffer as any).gp !== undefined) {
      normalizedLoot.currency = normalizeCurrency({
        gp: (sanitized.lootOffer as any).gp,
        gold: (sanitized.lootOffer as any).gold,
      });
    } else {
      normalizedLoot.currency = { gp: 0 };
    }

    const normalizedItems: any[] = [];
    for (const rawItem of normalizedLoot.items) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const descriptor = `${rawItem.name ?? rawItem.type ?? ''}`.toLowerCase();
      const currencyKey = detectCurrencyKeyFromText(descriptor);
      if (CURRENCY_ITEM_KEYS.has(descriptor) || currencyKey) {
        const resolvedKey =
          currencyKey ??
          (descriptor.includes('ouro')
            ? 'gp'
            : descriptor.includes('prata')
              ? 'sp'
              : descriptor.includes('cobre')
                ? 'cp'
                : undefined);
        const rate =
          (resolvedKey && CURRENCY_TO_GP[resolvedKey]) ??
          (descriptor.includes('ouro') ? 1 : descriptor.includes('prata') ? 0.1 : descriptor.includes('cobre') ? 0.01 : 1);
        const amount = Math.max(0, toNumber(rawItem.quantity ?? rawItem.amount) ?? 0);
        normalizedLoot.currency.gp += amount * rate;
        continue;
      }
      const normalizedItem = normalizeLootItem(rawItem);
      normalizedItems.push(normalizedItem);
      const lowerName = normalizedItem.name.toLowerCase();
      if (!existingHomebrewNames.has(lowerName)) {
        pendingHomebrewEntries.push({
          type: 'item',
          name: normalizedItem.name,
          content: normalizedItem,
          createdBy: 'ai',
        });
        existingHomebrewNames.add(lowerName);
      }
    }
    normalizedLoot.items = normalizedItems;

    sanitized.lootOffer = normalizedLoot as any;
  } else {
    sanitized.lootOffer = { currency: { gp: 0 }, items: [] } as any;
  }

  if (pendingHomebrewEntries.length) {
    sanitized.newHomebrewContent = [
      ...(Array.isArray(sanitized.newHomebrewContent) ? sanitized.newHomebrewContent : []),
      ...pendingHomebrewEntries,
    ];
  }

  if (Array.isArray((sanitized as any).xpEvents)) {
    (sanitized as any).xpEvents = (sanitized as any).xpEvents
      .map((event: any) => {
        if (!event || typeof event !== 'object') return null;
        const { type } = event;
        if (type !== 'skill' && type !== 'quest' && type !== 'combat') return null;
        const xpEvent: Record<string, any> = { type };
        if (type === 'skill' || type === 'combat') {
            if (typeof event.dc === 'number' && Number.isFinite(event.dc)) xpEvent.dc = event.dc;
            if (typeof event.difficulty === 'string') xpEvent.difficulty = event.difficulty;
        }
        if (type === 'quest') {
            if (typeof event.dc === 'number' && Number.isFinite(event.dc)) xpEvent.dc = event.dc;
            if (typeof event.difficulty === 'string') xpEvent.difficulty = event.difficulty;
            if (typeof event.questLevel === 'number' && Number.isFinite(event.questLevel)) xpEvent.questLevel = event.questLevel;
        }
        if (event.description && typeof event.description === 'string') xpEvent.description = event.description.slice(0, 140);
        return xpEvent;
      })
      .filter(Boolean);
  } else if ((sanitized as any).xpEvents !== undefined) {
    delete (sanitized as any).xpEvents;
    sanitationLogs.push('xpEvents inválido removido.');
  }

  if (Array.isArray((sanitized as any).progressionFeed)) {
    const normalizedProgression = (sanitized as any).progressionFeed
      .map((entry: any, index: number) => {
        if (!entry || typeof entry !== 'object') {
          sanitationLogs.push(`progressionFeed[${index}] removido por formato inválido.`);
          return null;
        }
        const normalizedType = normalizeProgressionType(entry.type);
        if (!normalizedType) {
          sanitationLogs.push(`progressionFeed[${index}] teve tipo inválido "${entry.type}" e foi descartado.`);
          return null;
        }
        const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
        if (!summary) {
          sanitationLogs.push(`progressionFeed[${index}] sem summary válido foi removido.`);
          return null;
        }
        const normalizedEntry: Record<string, any> = {
          type: normalizedType,
          summary: summary.slice(0, 240),
        };
        if (typeof entry.source === 'string' && entry.source.trim()) {
          normalizedEntry.source = entry.source.trim().slice(0, 160);
        }
        if (typeof entry.detail === 'string' && entry.detail.trim()) {
          normalizedEntry.detail = entry.detail.trim().slice(0, 280);
        }
        const xpValue = toNumber(entry.xp ?? entry.reward);
        if (xpValue !== undefined) {
          normalizedEntry.xp = xpValue;
        }
        const levelValue = toNumber(entry.level ?? entry.levelReached ?? entry.newLevel);
        if (levelValue !== undefined) {
          normalizedEntry.level = levelValue;
        }
        return normalizedEntry;
      })
      .filter(Boolean);
    if (normalizedProgression.length > 0) {
      (sanitized as any).progressionFeed = normalizedProgression;
    } else {
      delete (sanitized as any).progressionFeed;
      sanitationLogs.push('progressionFeed removido por não conter entradas válidas.');
    }
  } else if ((sanitized as any).progressionFeed !== undefined) {
    delete (sanitized as any).progressionFeed;
    sanitationLogs.push('progressionFeed inválido removido.');
  }
  
  // Sanitize worldState
  const characterWorldState = buildSafeWorldState(currentCharacter?.worldState, currentCharacter?.currentRegion);
  if (!sanitized.worldState || typeof sanitized.worldState !== 'object' || Object.keys(sanitized.worldState).length === 0) {
    sanitized.worldState = characterWorldState;
    sanitationLogs.push('worldState era inválido, restaurado para o estado anterior ou padrão.');
  } else {
    const mergedWorldState = {
        ...characterWorldState,
        ...sanitized.worldState,
    };
    const originalTimeOfDay = mergedWorldState.timeOfDay;
    const originalWeather = mergedWorldState.weather;
    mergedWorldState.timeOfDay = normalizeTimeOfDay(mergedWorldState.timeOfDay);
    mergedWorldState.weather = normalizeWeather(mergedWorldState.weather);
    sanitized.worldState = mergedWorldState;
    if(mergedWorldState.timeOfDay !== originalTimeOfDay) {
        sanitationLogs.push(`worldState.timeOfDay normalizado de "${originalTimeOfDay}" para "${mergedWorldState.timeOfDay}".`);
    }
    if(mergedWorldState.weather !== originalWeather) {
        sanitationLogs.push(`worldState.weather normalizado de "${originalWeather}" para "${mergedWorldState.weather}".`);
    }
  }

  // previous duplicate merge block removed

  // **NOVO**: Sanitize combatState de forma agressiva
  if (sanitized.combatState) {
      if (!sanitized.combatState.isActive) {
          sanitized.combatState = undefined;
          sanitationLogs.push(`combatState.isActive é falso, definindo combatState como undefined.`);
      } else {
          const normalizeNumber = (value: any, fallback: number) => {
              const num = Number(value);
              return Number.isFinite(num) ? num : fallback;
          };

          const rawRound = sanitized.combatState.round ?? sanitized.combatState.currentRound ?? 1;
          const rawTurn = sanitized.combatState.turn ?? sanitized.combatState.currentTurn ?? sanitized.combatState.activeCombatantIndex ?? 0;
          sanitized.combatState.round = normalizeNumber(rawRound, 1);
          sanitized.combatState.turn = normalizeNumber(rawTurn, 0);

          if (!Array.isArray(sanitized.combatState.initiativeOrder)) {
              if (Array.isArray(sanitized.combatState.combatants)) {
                  sanitized.combatState.initiativeOrder = sanitized.combatState.combatants
                      .map((c: any) => c?.id)
                      .filter(Boolean);
              } else {
                  sanitized.combatState.initiativeOrder = [];
              }
          } else {
              sanitized.combatState.initiativeOrder = sanitized.combatState.initiativeOrder
                  .map(entry => entry ? String(entry) : null)
                  .filter(Boolean) as string[];
          }

          let combatantsSource: any = sanitized.combatState.combatants;
          if (!Array.isArray(combatantsSource) && combatantsSource && typeof combatantsSource === 'object') {
              combatantsSource = Object.values(combatantsSource);
          }
          if (!Array.isArray(combatantsSource)) {
              combatantsSource = [];
          }

          const playerHpFallback = getPlayerFallbackHp();
          const combatantIdRemap = new Map<string, string>();

          sanitized.combatState.combatants = combatantsSource.map((c: any) => {
              if (!c || typeof c !== 'object') return null; // Descarta combatentes inválidos

              const originalId = String(c.id ?? c.name ?? '');
              let normalizedId = originalId;
              if (c.id === 'player' || c.name === currentCharacter?.name || c.isPlayer) {
                  const playerCombatant = { ...c };
                  playerCombatant.id = 'player';
                  normalizedId = 'player';
                  playerCombatant.name = currentCharacter?.name || c.name || 'Player';
                  playerCombatant.isPlayer = true;
                  const derivedHp = extractHpPair(c) || playerHpFallback || { current: 0, max: 0 };
                  playerCombatant.hp = { current: derivedHp.current ?? 0, max: derivedHp.max ?? derivedHp.current ?? 0 };
                  if (playerCombatant.ac === undefined) {
                      playerCombatant.ac = toNumber(currentCharacter?.attributes?.ac) ?? 10;
                  }
                  if (playerCombatant.actionPoints === undefined) {
                      playerCombatant.actionPoints = 30;
                  }
                  if (playerCombatant.bonusActionPoints === undefined) {
                      playerCombatant.bonusActionPoints = 1;
                  }
                  if (playerCombatant.initiative === null) {
                      playerCombatant.initiative = undefined;
                  }
                  if (typeof playerCombatant.notes === 'string') {
                      const truncated = clampText(playerCombatant.notes, 360);
                      if (truncated) {
                          playerCombatant.notes = truncated;
                      } else {
                          delete playerCombatant.notes;
                      }
                  }
                  const zone = normalizeCombatZone(c.zone ?? c.position ?? c.distanceCategory);
                  if (zone) {
                      playerCombatant.zone = zone;
                  } else {
                      delete playerCombatant.zone;
                  }
                  playerCombatant.attitude = 'ally';
                  combatantIdRemap.set(originalId.toLowerCase(), normalizedId);
                  return playerCombatant;
              }

              const derivedHp = extractHpPair(c);
              normalizedId = originalId || `npc-${Math.random().toString(36).slice(2, 8)}`;
              combatantIdRemap.set(originalId.toLowerCase(), normalizedId);

              const normalizedZone = normalizeCombatZone(c.zone ?? c.position ?? c.distanceCategory);
              const npcCombatant = {
                  ...c,
                  id: normalizedId,
                  ac: toNumber(c.ac) ?? 10,
                  hp: derivedHp ? { current: derivedHp.current ?? 0, max: derivedHp.max ?? derivedHp.current ?? 0 } : { current: 0, max: 0 },
                  initiative: c.initiative === null ? undefined : c.initiative,
              };
              if (typeof (npcCombatant as any).notes === 'string') {
                  const truncated = clampText((npcCombatant as any).notes, 360);
                  if (truncated) {
                      (npcCombatant as any).notes = truncated;
                  } else {
                      delete (npcCombatant as any).notes;
                  }
              }
              if (normalizedZone) {
                  (npcCombatant as any).zone = normalizedZone;
              } else {
                  delete (npcCombatant as any).zone;
              }
              const fallbackAttitude = c.isPlayer ? 'ally' : 'hostile';
              (npcCombatant as any).attitude = normalizeCombatAttitude(c.attitude, fallbackAttitude);
              return npcCombatant;
          }).filter(Boolean); // Remove quaisquer entradas nulas

          const combatantIds = new Set(sanitized.combatState.combatants.map((c: any) => c.id));

          if (Array.isArray(sanitized.combatState.initiativeOrder)) {
              sanitized.combatState.initiativeOrder = sanitized.combatState.initiativeOrder
                  .map(id => {
                      if (!id) return null;
                      const remapped = combatantIdRemap.get(String(id).toLowerCase());
                      return remapped || String(id);
                  })
                  .filter(id => combatantIds.has(id!)) as string[];
          } else {
              sanitized.combatState.initiativeOrder = sanitized.combatState.combatants.map((c: any) => c.id);
          }

          if (sanitized.combatState.currentCombatantId) {
              const remapped = combatantIdRemap.get(String(sanitized.combatState.currentCombatantId).toLowerCase());
              if (remapped) {
                  sanitized.combatState.currentCombatantId = remapped;
              }
          }

          const playerExists = sanitized.combatState.combatants.some((c: any) => c.id === 'player');
          if (playerExists && !sanitized.combatState.initiativeOrder.includes('player')) {
              sanitized.combatState.initiativeOrder.splice(
                  Math.min(1, sanitized.combatState.initiativeOrder.length),
                  0,
                  'player'
              );
          }
          if (playerExists && !sanitized.combatState.currentCombatantId) {
              sanitized.combatState.currentCombatantId = 'player';
          }

          const currentIndex = sanitized.combatState.initiativeOrder.indexOf(
              sanitized.combatState.currentCombatantId || 'player'
          );
          if (currentIndex >= 0) {
              sanitized.combatState.turn = currentIndex;
          }
      }
  }

  // **NOVO**: Sanitize newHomebrewContent
  if (Array.isArray(sanitized.newHomebrewContent)) {
    sanitized.newHomebrewContent = sanitized.newHomebrewContent.map((content: any) => {
        if (!content || typeof content !== 'object' || !content.name) return null;
        
        let type = content.type;

        // Se o tipo é inválido ou ausente, tenta inferir.
        if (!type || !VALID_HOMEBREW_TYPES.includes(type)) {
            // Heurística: se tiver 'hit_points' e 'armor_class', é provavelmente um monstro.
            if (('hit_points' in content || 'hit_dice' in content) && 'armor_class' in content) {
                 sanitationLogs.push(`Conteúdo Homebrew "${content.name}" tinha tipo inválido '${type}', corrigido para "monster".`);
                 type = 'monster';
            } 
            // Heurística para itens/armas
            else if (['weapon', 'armor', 'gear', 'adventuring-gear'].includes(type) || 'cost' in content) {
                 sanitationLogs.push(`Conteúdo Homebrew "${content.name}" tinha tipo inválido '${type}', corrigido para "item".`);
                 type = 'item';
            }
            else {
                 return null; // Descarta se não for possível corrigir
            }
        }
        return {...content, type: type};
    }).filter(Boolean);
  }

  if (sanitized.updatedCharacter && typeof sanitized.updatedCharacter === 'object') {
    if (Array.isArray((sanitized.updatedCharacter as any).xpEvents) && !(sanitized as any).xpEvents) {
        (sanitized as any).xpEvents = (sanitized.updatedCharacter as any).xpEvents;
        delete (sanitized.updatedCharacter as any).xpEvents;
    }
    if (Array.isArray((sanitized.updatedCharacter as any).quests)) {
        (sanitized.updatedCharacter as any).quests = (sanitized.updatedCharacter as any).quests.filter((quest: any) => quest && quest.id);
    }

    if (Array.isArray((sanitized.updatedCharacter as any).relationships)) {
        const dedupMap = new Map<string, any>();
        (sanitized.updatedCharacter as any).relationships
            .map((rel: any) => {
                if (!rel || typeof rel !== 'object') return null;
                const normalized: any = { ...rel };
                const slug =
                    canonicalSlug(normalized.npcId) ||
                    canonicalSlug(normalized.name) ||
                    null;
                if (!slug) return null;
                normalized.npcId = slug;
                normalized.regionSlug = canonicalSlug(normalized.regionSlug);
                normalized.poiSlug = canonicalSlug(normalized.poiSlug);
                if (typeof normalized.status === 'string') {
                    const statusValue = normalized.status.toLowerCase().trim();
                    if (!VALID_RELATIONSHIP_STATUSES.has(statusValue)) {
                        const note = normalized.status;
                        normalized.status = 'neutral';
                        trackNormalization('relationship.status', statusValue, 'neutral', {
                            source: 'relationships',
                            npc: normalized.name || normalized.npcId,
                        });
                        normalized.description = mergeTextField(normalized.description, note);
                        sanitationLogs.push(
                            `Relacionamento "${normalized.name || normalized.npcId}" teve status inválido e foi normalizado para 'neutral'.`
                        );
                    } else {
                        normalized.status = statusValue;
                    }
                } else if (!normalized.status) {
                    normalized.status = 'neutral';
                }
                if (normalized.locationNotes && typeof normalized.locationNotes !== 'object') {
                    normalized.locationNotes = { note: String(normalized.locationNotes) };
                }
                return normalized;
            })
            .filter(Boolean)
            .forEach((rel: any) => {
                const key = rel.npcId;
                if (!key) return;
                const existing = dedupMap.get(key);
                if (!existing) {
                    dedupMap.set(key, rel);
                    return;
                }
                existing.name = existing.name || rel.name;
                existing.description = mergeTextField(existing.description, rel.description);
                existing.status = rel.status || existing.status;
                if (typeof rel.affinity === 'number') existing.affinity = rel.affinity;
                existing.regionSlug = rel.regionSlug ?? existing.regionSlug;
                existing.poiSlug = rel.poiSlug ?? existing.poiSlug;
                if (rel.locationNotes) {
                    existing.locationNotes = { ...(existing.locationNotes ?? {}), ...rel.locationNotes };
                }
            });

        (sanitized.updatedCharacter as any).relationships = Array.from(dedupMap.values());
    }

    if ((sanitized.updatedCharacter as any).worldState) {
        const sanitizedWorldState = sanitizeWorldStatePayload(
            (sanitized.updatedCharacter as any).worldState,
            canonicalSlug((sanitized.updatedCharacter as any).worldState?.regionSlug ?? (sanitized.updatedCharacter as any).worldState?.currentRegion)
        );
        if (sanitizedWorldState) {
            (sanitized.updatedCharacter as any).worldState = sanitizedWorldState;
        } else {
            delete (sanitized.updatedCharacter as any).worldState;
        }
    }
  }

  if ((sanitized as any).worldState) {
    const sanitizedWorldState = sanitizeWorldStatePayload((sanitized as any).worldState);
    if (sanitizedWorldState) {
        (sanitized as any).worldState = sanitizedWorldState;
    } else {
        delete (sanitized as any).worldState;
    }
  }

  if ('ambientSound' in sanitized) {
    delete (sanitized as any).ambientSound;
    sanitationLogs.push('ambientSound removido (controlado pelo motor do jogo).');
  }

  // Sanitize campos opcionais para serem undefined em vez de null/vazios.
  const fieldsToMakeUndefinedIfEmpty: (keyof GameMasterResponse)[] = [
    'playerRollRequest', 'levelUpState', 'shopState', 'lootOffer', 'useHitDiceRequest'
  ];

  fieldsToMakeUndefinedIfEmpty.forEach(field => {
      if (sanitized[field] === null || (typeof sanitized[field] === 'object' && Object.keys(sanitized[field]!).length === 0)) {
           (sanitized as any)[field] = undefined;
           sanitationLogs.push(`${String(field)} era nulo ou vazio, definido como undefined.`);
      }
  });

  if (sanitized.playerRollRequest && typeof sanitized.playerRollRequest === 'object') {
      if (sanitized.playerRollRequest.dc === null) {
          delete sanitized.playerRollRequest.dc;
          sanitationLogs.push('playerRollRequest.dc nulo removido.');
      }
      const modifierValue = Number(sanitized.playerRollRequest.modifier);
      if (!Number.isFinite(modifierValue)) {
          sanitized.playerRollRequest.modifier = 0;
          sanitationLogs.push('playerRollRequest.modifier ausente ou inválido, definido como 0.');
      } else {
          sanitized.playerRollRequest.modifier = modifierValue;
      }
      if (typeof sanitized.playerRollRequest.reason !== 'string' || !sanitized.playerRollRequest.reason.trim()) {
          sanitized.playerRollRequest.reason = 'Resolver a próxima ação arriscada.';
          sanitationLogs.push('playerRollRequest.reason ausente, gerado motivo padrão.');
      }
      if (typeof sanitized.playerRollRequest.dice !== 'string' || !sanitized.playerRollRequest.dice.trim()) {
          sanitized.playerRollRequest.dice = '1d20';
          sanitationLogs.push('playerRollRequest.dice ausente, definido como "1d20".');
      }
      if (sanitized.playerRollRequest.rollType) {
          const normalizedRoll = normalizeRollType(sanitized.playerRollRequest.rollType);
          if (normalizedRoll) {
              sanitized.playerRollRequest.rollType = normalizedRoll as any;
          } else {
              sanitized.playerRollRequest.rollType = 'check';
              sanitationLogs.push('playerRollRequest.rollType inválido substituído por "check".');
          }
      } else {
          sanitized.playerRollRequest.rollType = 'check';
          sanitationLogs.push('playerRollRequest.rollType ausente, definido como "check".');
      }
      sanitized.playerRollRequest.advantage = Boolean(sanitized.playerRollRequest.advantage);
      sanitized.playerRollRequest.disadvantage = Boolean(sanitized.playerRollRequest.disadvantage);
  }

  const suppressRollFallback = Boolean(flowInput?.suppressRollRequest);
  const combinedLogText = sanitized.logEntries
    ?.map(entry => (typeof entry?.content === 'string' ? entry.content.toLowerCase() : ''))
    .join(' ') ?? '';
  const restKeywordsDetected = /descanso curto|descansar|dados de vida|hit dice|hp/.test(combinedLogText);
  const combatActive = Boolean(
    sanitized.combatState?.isActive ||
    flowInput?.combatState?.isActive
  );
  const allowRestFallback = restKeywordsDetected && !combatActive;
  const rollMissing = !sanitized.playerRollRequest && (
    allowRestFallback ||
    Boolean(sanitized.combatState?.isActive) ||
    sanitized.actionOptions?.some(option => typeof option === 'object' && option?.skill)
  );

  if (rollMissing) {
      if (suppressRollFallback) {
          sanitationLogs.push('playerRollRequest ausente, mas suppressRollRequest=true; mantido vazio.');
      } else if (allowRestFallback) {
          const hitDiceEntries = currentCharacter?.hitDice ? Object.entries(currentCharacter.hitDice) : [];
          const [dieKey, dieCount] = hitDiceEntries.length ? hitDiceEntries[0] : ['d8', 1];
          sanitized.playerRollRequest = {
              reason: 'Recuperar pontos de vida durante o descanso curto.',
              dice: `${Math.max(1, Number(dieCount) || 1)}${dieKey}`,
              modifier: 0,
              rollType: 'check',
              advantage: false,
              disadvantage: false,
          };
          sanitationLogs.push('playerRollRequest ausente durante descanso, criado fallback padrão.');
      } else {
          sanitized.playerRollRequest = {
              reason: 'Resolver a próxima ação arriscada.',
              dice: '1d20',
              modifier: 0,
              rollType: 'check',
              advantage: false,
              disadvantage: false,
          };
          sanitationLogs.push('playerRollRequest ausente, criado fallback padrão.');
      }
  }

  if (!sanitized.useHitDiceRequest && allowRestFallback && !suppressRollFallback) {
      const hitDiceEntries = currentCharacter?.hitDice ? Object.entries(currentCharacter.hitDice) : [];
      const [dieKey, dieCount] = hitDiceEntries.length ? hitDiceEntries[0] : ['d8', 1];
      const parsedDie = parseHitDieKey(typeof dieKey === 'string' && dieKey.includes('d') ? dieKey : `d${dieKey}`);
      sanitized.useHitDiceRequest = {
          maxDice: Math.max(1, Number(dieCount) || 1),
          hitDieValue: parsedDie ?? 8,
      } as any;
      sanitationLogs.push('useHitDiceRequest ausente durante descanso, gerado automaticamente.');
  }

  if (sanitized.useHitDiceRequest && typeof sanitized.useHitDiceRequest === 'object') {
      const normalizedHitDice = normalizeUseHitDice(sanitized.useHitDiceRequest);
      if (normalizedHitDice) {
          sanitized.useHitDiceRequest = normalizedHitDice as any;
      } else {
          delete sanitized.useHitDiceRequest;
          sanitationLogs.push('useHitDiceRequest inválido removido.');
      }
  }

  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer Lógico] Correções: ${sanitationLogs.join(', ')}${existingLog}`;
  }

  return sanitized as GameMasterResponse;
};
