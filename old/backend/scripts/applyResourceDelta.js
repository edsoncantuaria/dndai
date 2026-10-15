import 'dotenv/config';
import { register } from 'tsx/esm/api';

await register({
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  experimentalTsImport: true,
});

const [, , sessionIdArg, type, key, deltaArg] = process.argv;

if (!sessionIdArg || !type || !key || !deltaArg) {
  console.error('Usage: node scripts/applyResourceDelta.js <sessionId> <type> <key> <delta>');
  process.exit(1);
}

const sessionId = Number(sessionIdArg);
const delta = Number(deltaArg);

if (Number.isNaN(sessionId) || Number.isNaN(delta)) {
  console.error('sessionId and delta must be numbers.');
  process.exit(1);
}

const { AppDataSource } = await import('../src/database/data-source.ts');
const { applyCharacterStateDelta } = await import('../src/services/characterStateService.ts');
const { CharacterResource } = await import('../src/entities/CharacterResource.ts');
const { SessaoIA } = await import('../src/entities/SessaoIA.ts');

try {
  await AppDataSource.initialize();
  const sessaoRepo = AppDataSource.getRepository(SessaoIA);
  const sessao = await sessaoRepo.findOne({ where: { id: sessionId }, relations: ['character'] });
  if (!sessao?.characterId) {
    throw new Error('Sessão não encontrada ou sem personagem.');
  }
  const resourceRepo = AppDataSource.getRepository(CharacterResource);
  let resource = await resourceRepo.findOne({ where: { characterId: sessao.characterId, type, resourceKey: key } });
  if (!resource) {
    resource = resourceRepo.create({ characterId: sessao.characterId, type, resourceKey: key, current: 5, max: 5 });
  }
  resource.current = resource.current ?? 0;
  resource.current += delta;
  if (resource.max == null || resource.current > resource.max) {
    resource.max = resource.current;
  }
  await resourceRepo.save(resource);

  console.log('[applyResourceDelta] before', resource);
  const result = await applyCharacterStateDelta(
    sessionId,
    { resources: [{ type, key, delta }] },
    { actionId: 'resource-debug', actionType: 'resource-script' }
  );
  console.log('[applyResourceDelta] result', result);
  const updated = await resourceRepo.findOne({ where: { id: resource.id } });
  console.log('[applyResourceDelta] after', updated);
} catch (err) {
  console.error('[applyResourceDelta] failed', err);
  process.exitCode = 1;
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
