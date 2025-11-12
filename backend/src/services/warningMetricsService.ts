import { promises as fs } from 'fs';
import path from 'path';

const counters = new Map<string, number>();
const METRICS_DIR = path.join(process.cwd(), 'logs', 'metrics');
const METRICS_FILE = path.join(METRICS_DIR, 'warnings.log');

const ensureDir = async () => {
    await fs.mkdir(METRICS_DIR, { recursive: true });
};

export const trackWarningMetric = async (type: string, scenarioLabel?: string | null) => {
    const key = `${type}|${scenarioLabel ?? '*'}`;
    counters.set(key, (counters.get(key) ?? 0) + 1);
    await ensureDir();
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        type,
        scenario: scenarioLabel ?? null,
        total: counters.get(key) ?? 0,
    });
    await fs.appendFile(METRICS_FILE, line + '\n', 'utf8');
};

export const formatWarningMetrics = (): string => {
    const lines: string[] = [];
    counters.forEach((value, key) => {
        const [type, scenario] = key.split('|');
        const scenarioLabel = scenario === '*' ? '' : `{scenario="${scenario}"}`;
        lines.push(`ai_warning_${type}${scenarioLabel} ${value}`);
    });
    return lines.join('\n');
};

