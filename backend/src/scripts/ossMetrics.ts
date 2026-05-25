import { config } from 'dotenv';
import { resolve } from 'path';
import { getOpenRouterManager } from '../ai-oss/providers/OpenRouterManager.js';
import { buildGlobalSnapshot } from '../ai-oss/telemetry/requestMetrics.js';

config({ path: resolve(process.cwd(), '../.env') });
config({ path: resolve(process.cwd(), '.env') });

const manager = getOpenRouterManager();
const snapshot = buildGlobalSnapshot(manager.getMetricsSnapshot());
console.log(JSON.stringify(snapshot, null, 2));
console.log(`\n[oss-metrics] ${manager.size} chave(s) no pool do servidor.`);
