import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE_URL = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8071/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const [, , sessionArg] = process.argv;

if (!sessionArg) {
  console.error('Usage: node scripts/testStateVersion.js <sessionId>');
  process.exit(1);
}

const sessionId = Number(sessionArg);
if (!Number.isFinite(sessionId)) {
  console.error('sessionId must be a number.');
  process.exit(1);
}

const token = jwt.sign({ userId: 1, email: 'user@example.com' }, JWT_SECRET, { expiresIn: '1h' });

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

const getSession = async () => {
  const res = await fetch(`${BASE_URL}/sessoes/${sessionId}`, { headers });
  if (!res.ok) {
    throw new Error(`GET /sessoes/${sessionId} failed: ${res.status}`);
  }
  return res.json();
};

(async () => {
  const before = await getSession();
  console.log('[testStateVersion] before', { stateVersion: before.stateVersion });

  const response = await fetch(`${BASE_URL}/sessions/${sessionId}/actions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      actionId: `state-test-${Date.now()}`,
      prompt: 'Teste stateVersion via REST',
      apiKey: process.env.GOOGLE_API_KEY || 'dummy',
      useAiHomebrew: false,
      clientStateVersion: before.stateVersion,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  console.log('[testStateVersion] action status', response.status);
  console.log('[testStateVersion] action response', payload);

  const after = await getSession();
  console.log('[testStateVersion] after', { stateVersion: after.stateVersion });
})();
