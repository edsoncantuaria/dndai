import 'dotenv/config';
console.log('[applyTestDelta] script start');
import { AppDataSource } from '../database/data-source.js';
import { applyCharacterStateDelta } from '../services/characterStateService.js';

const [sessionIdArg, hpDeltaArg] = process.argv.slice(2);

if (!sessionIdArg || !hpDeltaArg) {
    console.error('Usage: tsx src/scripts/applyTestDelta.ts <sessionId> <hpDelta>');
    process.exit(1);
}

const sessionId = Number(sessionIdArg);
const hpDelta = Number(hpDeltaArg);

if (Number.isNaN(sessionId) || Number.isNaN(hpDelta)) {
    console.error('sessionId and hpDelta must be numbers.');
    process.exit(1);
}

const run = async () => {
    await AppDataSource.initialize();
    console.log(`[applyTestDelta] Applying delta to session ${sessionId} (hp delta ${hpDelta})`);
    const result = await applyCharacterStateDelta(
        sessionId,
        { hp: { delta: hpDelta } },
        { actionId: 'debug-delta', actionType: 'debug-script' }
    );
    console.log('[applyTestDelta] Result:', result);
    await AppDataSource.destroy();
};

run().catch(err => {
    console.error('[applyTestDelta] Failed:', err);
    process.exit(1);
});
