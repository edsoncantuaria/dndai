import 'dotenv/config';
import { register } from 'tsx/esm/api';

// Force Redis to use the in-memory mock so this script does not depend on an external instance.
process.env.REDIS_URL = 'mock';

await register({
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  experimentalTsImport: true,
});

const { AppDataSource } = await import('../src/database/data-source.ts');
const narrarService = await import('../src/services/narrarService.ts');
const { setGameUpdateOverride } = await import('../src/services/aiService.ts');
await import('../src/database/redis-client.ts');

let capturedHints;
setGameUpdateOverride(async (input) => {
  capturedHints = input.stateHints ? [...input.stateHints] : undefined;
  const mockResponse = {
    logEntries: [
      { type: 'narration', text: 'O narrador sintetiza apenas a última dica recebida.' },
      { type: 'system', text: 'Teste de hints executado via script.' },
    ],
    actionOptions: [
      { text: 'Inspecionar o altar', action: { type: 'explore', target: 'altar' } },
      { text: 'Consultar memórias antigas', action: { type: 'insight', target: 'memories' } },
      { text: 'Observar o ambiente', action: { type: 'observe', target: 'sala' } },
    ],
    updatedCharacter: {
      attributes: { hp: 12, maxHp: 12 },
    },
    combatState: null,
    playerRollRequest: {
      reason: 'Confirme a última dica de estado recebida',
      dice: '1d20',
      modifier: 0,
      dc: 10,
      rollType: 'check',
      advantage: false,
      disadvantage: false,
      requestId: 'state-hints-test',
    },
    systemLog: '[mock] resposta gerada pelo teste de hints.',
    lootOffer: null,
    worldState: { timeOfDay: 'Manhã', weather: 'Ensolarado' },
    newHomebrewContent: [],
    gameClock: { day: 0, hour: 12, weather: 'Ensolarado' },
    memoryContext: { summary: 'mock', references: [] },
    _meta: { version: 1, schemaVersion: 1, hash: 'mock', migratedFrom: null, createdAt: Date.now(), integrityNotes: [] },
  };
  return {
    response: mockResponse,
    rawText: JSON.stringify(mockResponse),
    warnings: [],
  };
});

await AppDataSource.initialize();
try {
  const response = await narrarService.processPlayerTurn(
    -1,
    1,
    'Teste automatizado dos hints',
    process.env.GOOGLE_API_KEY || 'dummy',
    undefined,
    false,
    ['-7 HP', 'Slot nível 1 consumido', '+3 HP']
  );
  console.log('[testStateHints] capturedHints', capturedHints);
  console.log('[testStateHints] AI systemLog', response.systemLog);
} catch (err) {
  console.error('[testStateHints] failed', err);
  process.exitCode = 1;
} finally {
  setGameUpdateOverride(null);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
