import 'dotenv/config';
import { register } from 'tsx/esm/api';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';

await register({
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  experimentalTsImport: true,
});

const BASE_URL = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8071/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const TEST_API_KEY = process.env.GOOGLE_API_KEY || process.env.TEST_API_KEY || 'dummy';
const SCENARIO_PROMPT =
  process.env.SCENARIO_PROMPT ||
  'Ataque simples: investida direta contra o goblin mais próximo com a espada curta.';

const [, , sessionArg] = process.argv;

if (!sessionArg) {
  console.error('Usage: node scripts/runAttackScenario.js <sessionId>');
  process.exit(1);
}

const sessionId = Number(sessionArg);
if (!Number.isFinite(sessionId)) {
  console.error('sessionId must be a valid number.');
  process.exit(1);
}

const token = jwt.sign({ userId: 1, email: 'auditoria@dndai.local' }, JWT_SECRET, { expiresIn: '15m' });

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

const request = async (method, url, body) => {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { status: res.status, ok: res.ok, data };
};

const { AppDataSource } = await import('../src/database/data-source.ts');
const { SessaoIA } = await import('../src/entities/SessaoIA.ts');
const { ActionLog } = await import('../src/entities/ActionLog.ts');
const { SessionLog } = await import('../src/entities/SessionLog.ts');

const snapshotSessao = async () => {
  const repo = AppDataSource.getRepository(SessaoIA);
  const sessao = await repo.findOne({
    where: { id: sessionId },
    select: ['id', 'stateVersion', 'updatedAt'],
  });
  return sessao
    ? {
        id: sessao.id,
        stateVersion: sessao.stateVersion,
        updatedAt: sessao.updatedAt?.toISOString(),
      }
    : null;
};

const collectLogs = async () => {
  const actionRepo = AppDataSource.getRepository(ActionLog);
  const sessionRepo = AppDataSource.getRepository(SessionLog);
  const [actions, sessionLogs] = await Promise.all([
    actionRepo.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
      take: 15,
    }),
    sessionRepo.find({
      where: { sessaoId: sessionId },
      order: { timestamp: 'DESC' },
      take: 20,
    }),
  ]);

  return {
    actionLogs: actions.map(log => ({
      id: log.id,
      actionId: log.actionId,
      actionType: log.actionType,
      stateVersion: log.stateVersion,
      createdAt: log.createdAt?.toISOString(),
      delta: log.delta ?? null,
    })),
    sessionLogs: sessionLogs.map(log => ({
      id: log.id,
      type: log.type,
      prompt: log.prompt.slice(0, 160),
      timestamp: log.timestamp?.toISOString(),
      rollResult: log.rollResult ?? null,
    })),
  };
};

const runScenario = async () => {
  await AppDataSource.initialize();
  const startedAt = new Date().toISOString();
  const actionId = `scenario-${Date.now()}`;
  const beforeState = await snapshotSessao();

  await request('POST', '/roll-requests/clear', null);

  const payload = {
    actionId,
    prompt: SCENARIO_PROMPT,
    apiKey: TEST_API_KEY,
    useAiHomebrew: false,
    clientStateVersion: beforeState?.stateVersion,
  };

  console.log('[scenarioAttack] POST', `/sessions/${sessionId}/actions`);
  const actionResponse = await request('POST', `/sessions/${sessionId}/actions`, payload);
  console.log('[scenarioAttack] status', actionResponse.status);

  const afterState = await snapshotSessao();
  const logs = await collectLogs();

  const output = {
    scenario: 'simple-attack',
    startedAt,
    finishedAt: new Date().toISOString(),
    sessionId,
    actionId,
    prompt: payload.prompt,
    beforeState,
    afterState,
    actionResponse,
    logs,
  };

  const dir = path.join(process.cwd(), 'logs', 'scenario-tests');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(
    dir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-session-${sessionId}.json`
  );
  await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('[scenarioAttack] artifacts saved to', filePath);
};

try {
  await runScenario();
} catch (err) {
  console.error('[scenarioAttack] failed', err);
  process.exitCode = 1;
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
