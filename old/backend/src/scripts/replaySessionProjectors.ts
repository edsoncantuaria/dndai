#!/usr/bin/env tsx
import { initPenaiDatabase } from '../GameMaster/database/data-source.js';
import { replaySessionProjectors } from '../GameMaster/replay/replayFromEvents.js';

const sessionId = Number(process.argv[2]);
if (!Number.isFinite(sessionId) || sessionId < 1) {
    console.error('Uso: npm run penai:replay-projectors -- <sessionId>');
    process.exit(1);
}

await initPenaiDatabase();
const result = await replaySessionProjectors(sessionId);
console.log(JSON.stringify(result, null, 2));
