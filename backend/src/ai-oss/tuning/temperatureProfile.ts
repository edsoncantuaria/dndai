import fs from 'fs';
import path from 'path';
import { OSS_COMBAT_CONFIG } from '../configs/combat.js';
import { OSS_NARRATIVE_CONFIG } from '../configs/narrative.js';
import type { PromptPhase } from '../prompts/phaseTemplates.js';

export type TemperatureProfile = Partial<
    Record<PromptPhase | 'narrative' | 'combat', { temperature?: number; topP?: number }>
>;

const DEFAULTS: Required<Record<PromptPhase, { temperature: number; topP: number }>> = {
    exploration: {
        temperature: OSS_NARRATIVE_CONFIG.temperature ?? 0.78,
        topP: OSS_NARRATIVE_CONFIG.topP ?? 0.9,
    },
    combat: {
        temperature: OSS_COMBAT_CONFIG.temperature ?? 0.45,
        topP: OSS_COMBAT_CONFIG.topP ?? 0.85,
    },
    social: {
        temperature: 0.72,
        topP: 0.88,
    },
};

let cachedProfile: TemperatureProfile | null = null;
let cachedMtime = 0;

function profilePath(): string | null {
    const fromEnv = process.env.OSS_TEMP_PROFILE_PATH?.trim();
    if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv);
    const defaultPath = path.join(process.cwd(), 'logs', 'oss-temperature-profile.json');
    return fs.existsSync(defaultPath) ? defaultPath : null;
}

export function loadTemperatureProfile(): TemperatureProfile {
    const inline = process.env.OSS_TEMP_PROFILE_JSON?.trim();
    if (inline) {
        try {
            return JSON.parse(inline) as TemperatureProfile;
        } catch {
            console.warn('[temperatureProfile] OSS_TEMP_PROFILE_JSON inválido.');
        }
    }

    const file = profilePath();
    if (!file) return {};

    try {
        const stat = fs.statSync(file);
        if (cachedProfile && stat.mtimeMs === cachedMtime) {
            return cachedProfile;
        }
        const raw = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(raw) as TemperatureProfile & { profile?: TemperatureProfile };
        cachedProfile = parsed.profile ?? parsed;
        cachedMtime = stat.mtimeMs;
        return cachedProfile;
    } catch (err) {
        console.warn('[temperatureProfile] Falha ao ler perfil:', err);
        return {};
    }
}

export function resolveOssTemperature(
    phase: PromptPhase,
    overrides?: { temperature?: number; topP?: number },
): { temperature: number; topP: number } {
    const profile = loadTemperatureProfile();
    const phaseRow = profile[phase] ?? profile[phase === 'combat' ? 'combat' : 'narrative'];
    const base = DEFAULTS[phase];

    return {
        temperature:
            overrides?.temperature ??
            phaseRow?.temperature ??
            base.temperature,
        topP: overrides?.topP ?? phaseRow?.topP ?? base.topP,
    };
}

/** Deriva perfil sugerido a partir de relatório de benchmark (auto-tuning manual/semanal). */
export function suggestProfileFromBenchmarkReport(report: {
    passRatePercent: number;
    results: Array<{ id: string; ok: boolean }>;
}): TemperatureProfile {
    const rate = report.passRatePercent;
    const explorationTemp = rate >= 90 ? 0.8 : rate >= 70 ? 0.76 : 0.7;
    const combatTemp = rate >= 90 ? 0.48 : 0.42;
    const socialTemp = rate >= 90 ? 0.74 : 0.68;
    return {
        exploration: { temperature: explorationTemp },
        combat: { temperature: combatTemp },
        social: { temperature: socialTemp },
    };
}

export function resetTemperatureProfileCacheForTests(): void {
    cachedProfile = null;
    cachedMtime = 0;
}
