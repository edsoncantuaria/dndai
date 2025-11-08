// backend/src/services/tokenMetricsService.ts
import redisClient, { ensureRedisConnection } from '../database/redis-client.js';
import { AI_INTERACTION_MODES, type AiInteractionMode } from '../types/ai.js';

interface TokenStats {
  before: number;
  after: number;
  samples: number;
}

const FALLBACK_STATS = new Map<string, TokenStats>();
let fallbackLastReportDate: string | null = null;
const LAST_REPORT_KEY = 'tokenStats:lastReportDate';

const todayStamp = () => new Date().toISOString().slice(0, 10);
const statsKey = (date: string, mode: AiInteractionMode) => `tokenStats:${date}:${mode}`;

const safeParseStats = (raw: string | null): TokenStats => {
  if (!raw) return { before: 0, after: 0, samples: 0 };
  try {
    const parsed = JSON.parse(raw) as TokenStats;
    return {
      before: Number(parsed.before) || 0,
      after: Number(parsed.after) || 0,
      samples: Number(parsed.samples) || 0,
    };
  } catch {
    return { before: 0, after: 0, samples: 0 };
  }
};

const getRedisClient = async () => {
  if (!redisClient) return null;
  await ensureRedisConnection();
  return redisClient;
};

const readStats = async (key: string): Promise<TokenStats> => {
  const client = await getRedisClient();
  if (!client) {
    return FALLBACK_STATS.get(key) ?? { before: 0, after: 0, samples: 0 };
  }
  const raw = await client.get(key);
  return safeParseStats(raw);
};

const writeStats = async (key: string, value: TokenStats) => {
  const client = await getRedisClient();
  if (!client) {
    FALLBACK_STATS.set(key, value);
    return;
  }
  await client.set(key, JSON.stringify(value));
};

const deleteStats = async (key: string) => {
  const client = await getRedisClient();
  if (!client) {
    FALLBACK_STATS.delete(key);
    return;
  }
  await client.del(key);
};

const getLastReportDate = async (): Promise<string | null> => {
  const client = await getRedisClient();
  if (!client) {
    return fallbackLastReportDate;
  }
  return client.get(LAST_REPORT_KEY);
};

const setLastReportDate = async (date: string) => {
  const client = await getRedisClient();
  if (!client) {
    fallbackLastReportDate = date;
    return;
  }
  await client.set(LAST_REPORT_KEY, date);
};

const emitReportForDate = async (date: string) => {
  let hasData = false;
  for (const mode of AI_INTERACTION_MODES) {
    const key = statsKey(date, mode);
    const stats = await readStats(key);
    if (!stats.samples) {
      await deleteStats(key);
      continue;
    }
    hasData = true;
    const avgBefore = stats.before / stats.samples;
    const avgAfter = stats.after / stats.samples;
    const delta = avgAfter - avgBefore;
    console.log(
      `[TokenMetrics][${date}] ${mode}: avgBefore=${avgBefore.toFixed(1)} avgAfter=${avgAfter.toFixed(
        1,
      )} delta=${delta.toFixed(1)} (samples=${stats.samples})`,
    );
    await deleteStats(key);
  }

  if (!hasData) {
    console.log(`[TokenMetrics][${date}] Nenhum dado de consumo coletado.`);
  }
};

const maybeEmitDailyReport = async (today: string) => {
  const lastReport = await getLastReportDate();
  if (!lastReport) {
    await setLastReportDate(today);
    return;
  }
  if (lastReport === today) {
    return;
  }
  await emitReportForDate(lastReport);
  await setLastReportDate(today);
};

export const recordTokenUsageSample = async (
  mode: AiInteractionMode,
  beforeTokens?: number,
  afterTokens?: number,
) => {
  if (beforeTokens === undefined && afterTokens === undefined) {
    return;
  }

  const date = todayStamp();
  await maybeEmitDailyReport(date);

  const key = statsKey(date, mode);
  const stats = await readStats(key);
  stats.samples += 1;
  stats.before += typeof beforeTokens === 'number' ? beforeTokens : afterTokens ?? 0;
  stats.after += typeof afterTokens === 'number' ? afterTokens : beforeTokens ?? 0;

  await writeStats(key, stats);
};
