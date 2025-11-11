import { AppDataSource } from '../database/data-source.js';
import { primeNormalizationSeeds, type NormalizationSeed } from '../services/normalizationRegistry.js';
import {
    LOG_ENTRY_TYPE_ALIASES,
    COMBAT_ZONE_ALIASES,
    COMBAT_ATTITUDE_ALIASES,
    ROLL_TYPE_ALIASES,
    PROGRESSION_TYPE_ALIASES,
    TIME_OF_DAY_KEYWORDS,
    WEATHER_KEYWORDS,
} from '../services/aiSanitizer.js';

const buildSeeds = (): NormalizationSeed[] => {
    const seeds: NormalizationSeed[] = [];

    Object.entries(LOG_ENTRY_TYPE_ALIASES).forEach(([raw, normalized]) => {
        seeds.push({ category: 'logEntry.type', rawValue: raw, normalizedValue: normalized });
    });

    Object.entries(COMBAT_ZONE_ALIASES).forEach(([raw, normalized]) => {
        seeds.push({ category: 'combat.zone', rawValue: raw, normalizedValue: normalized });
    });

    Object.entries(COMBAT_ATTITUDE_ALIASES).forEach(([raw, normalized]) => {
        seeds.push({ category: 'combat.attitude', rawValue: raw, normalizedValue: normalized });
    });

    Object.entries(ROLL_TYPE_ALIASES).forEach(([raw, normalized]) => {
        seeds.push({ category: 'roll.type', rawValue: raw, normalizedValue: normalized });
    });

    Object.entries(PROGRESSION_TYPE_ALIASES).forEach(([raw, normalized]) => {
        seeds.push({ category: 'progression.type', rawValue: raw, normalizedValue: normalized });
    });

    TIME_OF_DAY_KEYWORDS.forEach(entry => {
        seeds.push({ category: 'world.timeOfDay', rawValue: entry.keyword, normalizedValue: entry.normalized });
    });

    Object.entries(WEATHER_KEYWORDS).forEach(([raw, normalized]) => {
        seeds.push({ category: 'world.weather', rawValue: raw, normalizedValue: normalized });
    });

    return seeds;
};

const run = async () => {
    const seeds = buildSeeds();
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    await primeNormalizationSeeds(seeds);
    console.log(`[normalization] ${seeds.length} padrões semeados no banco e no Redis.`);
};

run()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('[normalization] Falha ao executar seed:', error);
        process.exit(1);
    });
