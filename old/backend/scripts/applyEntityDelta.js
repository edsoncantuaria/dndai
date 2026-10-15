import 'dotenv/config';
import { register } from 'tsx/esm/api';

await register({
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  experimentalTsImport: true,
});

const [, , sessionIdArg, encounterIdArg, entityId, hpDeltaArg] = process.argv;

if (!sessionIdArg || !encounterIdArg || !entityId || !hpDeltaArg) {
  console.error('Usage: node scripts/applyEntityDelta.js <sessionId> <encounterId> <entityId> <hpDelta>');
  process.exit(1);
}

const sessionId = Number(sessionIdArg);
const encounterId = Number(encounterIdArg);
const hpDelta = Number(hpDeltaArg);

if ([sessionId, encounterId, hpDelta].some(Number.isNaN)) {
  console.error('sessionId, encounterId and hpDelta must be numbers.');
  process.exit(1);
}

const { AppDataSource } = await import('../src/database/data-source.ts');
const { upsertCombatEntity, applyEntityDeltaWithLog } = await import('../src/services/combatEntityService.ts');
const { CombatEncounter } = await import('../src/entities/CombatEncounter.ts');

try {
  await AppDataSource.initialize();
  const encounterRepo = AppDataSource.getRepository(CombatEncounter);
  let encounter = await encounterRepo.findOne({ where: { id: encounterId } });
  if (!encounter) {
    encounter = encounterRepo.create({
      id: encounterId,
      sessaoId: sessionId,
      name: `Debug Encounter ${encounterId}`,
      status: 'active',
      round: 1,
      log: [],
    });
    await encounterRepo.save(encounter);
  }
  await upsertCombatEntity(encounterId, {
    entityId,
    name: entityId,
    hpMax: 20,
    hpCurrent: 20,
  });
  const result = await applyEntityDeltaWithLog(
    sessionId,
    encounterId,
    entityId,
    { hp: { delta: hpDelta } },
    { actionId: 'entity-debug', actionType: 'entity-script' }
  );
  console.log('[applyEntityDelta] result', result);
} catch (err) {
  console.error('[applyEntityDelta] failed', err);
  process.exitCode = 1;
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
