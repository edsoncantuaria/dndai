import 'dotenv/config';
import { register } from 'tsx/esm/api';

await register({
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  experimentalTsImport: true,
});

const [, , sessionIdArg, hpDeltaArg] = process.argv;

if (!sessionIdArg || !hpDeltaArg) {
  console.error('Usage: node scripts/applyTestDelta.js <sessionId> <hpDelta>');
  process.exit(1);
}

const sessionId = Number(sessionIdArg);
const hpDelta = Number(hpDeltaArg);

if (Number.isNaN(sessionId) || Number.isNaN(hpDelta)) {
  console.error('sessionId and hpDelta must be numbers.');
  process.exit(1);
}

const { AppDataSource } = await import('../src/database/data-source.ts');
const { applyCharacterStateDelta } = await import('../src/services/characterStateService.ts');

try {
  await AppDataSource.initialize();
  console.log('[applyTestDelta] applying delta', { sessionId, hpDelta });
  const result = await applyCharacterStateDelta(
    sessionId,
    { hp: { delta: hpDelta } },
    { actionId: 'debug-delta', actionType: 'debug-script' }
  );
  console.log('[applyTestDelta] result:', result);
} catch (err) {
  console.error('[applyTestDelta] failed:', err);
  process.exitCode = 1;
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
