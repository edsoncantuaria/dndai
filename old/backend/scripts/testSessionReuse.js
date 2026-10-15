import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const BASE_URL = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8071/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const [, , characterArg, sessionNameArg] = process.argv;

if (!characterArg) {
  console.error('Usage: node scripts/testSessionReuse.js <characterId> [sessionName]');
  process.exit(1);
}

const characterId = Number(characterArg);
if (!Number.isFinite(characterId)) {
  console.error('characterId must be a valid number.');
  process.exit(1);
}

const sessionName =
  sessionNameArg ||
  process.env.TEST_SESSION_NAME ||
  `Sessão Automatizada ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;

const token = jwt.sign({ userId: 1, email: 'auditoria@dndai.local' }, JWT_SECRET, { expiresIn: '15m' });
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

const baseClientInstanceId =
  process.env.SESSION_REUSE_CLIENT_ID ||
  `session-reuse-${randomUUID().slice(0, 8)}`;

const createRequestPayload = (clientInstanceId = baseClientInstanceId) => ({
  nome: sessionName,
  characterId,
  clientInstanceId,
});

const callCreateSession = async (clientInstanceId = baseClientInstanceId) => {
  const response = await fetch(`${BASE_URL}/sessoes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(createRequestPayload(clientInstanceId)),
  });
  const bodyText = await response.text();
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = { raw: bodyText };
  }
  return { status: response.status, body: json };
};

try {
  console.log('[sessionReuse] POST /sessoes (primeira chamada)', { characterId, sessionName });
  const first = await callCreateSession();
  console.log('[sessionReuse] primeira resposta', first);
  if (first.status !== 201 || !first.body?.sessao?.id) {
    console.error('[sessionReuse] primeira chamada falhou, abortando.');
    process.exit(1);
  }

  console.log('[sessionReuse] POST /sessoes (segunda chamada - mesmo client)');
  const second = await callCreateSession(baseClientInstanceId);
  console.log('[sessionReuse] segunda resposta', second);
  if (second.status !== 201 || !second.body?.sessao?.id) {
    console.error('[sessionReuse] segunda chamada falhou.');
    process.exit(1);
  }

  const firstId = first.body.sessao.id;
  const secondId = second.body.sessao.id;
  if (firstId !== secondId) {
    console.error('[sessionReuse] ❌ API criou uma nova sessão em vez de reutilizar a existente.', {
      firstId,
      secondId,
    });
    process.exit(1);
  }

  console.log('[sessionReuse] ✅ Sessão reaberta sem clonar', { sessionId: firstId });

  const rivalClientId = `${baseClientInstanceId}-rival`;
  console.log('[sessionReuse] POST /sessoes (terceira chamada - cliente rival)');
  const rival = await callCreateSession(rivalClientId);
  console.log('[sessionReuse] terceira resposta', rival);
  if (rival.status !== 409) {
    console.error('[sessionReuse] ❌ Esperávamos conflito de lease, mas a API não bloqueou.', {
      rivalStatus: rival.status,
      rivalBody: rival.body,
    });
    process.exit(1);
  }
  console.log('[sessionReuse] ✅ Conflito de lease detectado com sucesso');
  process.exit(0);
} catch (err) {
  console.error('[sessionReuse] erro inesperado', err);
  process.exit(1);
}
