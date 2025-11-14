import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE_URL = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8071/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const TEST_API_KEY = process.env.GOOGLE_API_KEY || process.env.TEST_API_KEY || 'dummy';

const [, , sessionArg, actionIdArg] = process.argv;

if (!sessionArg) {
  console.error('Usage: node scripts/testRestAction.js <sessionId> [actionId]');
  process.exit(1);
}

const sessionId = Number(sessionArg);
if (!Number.isFinite(sessionId)) {
  console.error('sessionId must be a number.');
  process.exit(1);
}

const actionId = actionIdArg || `rest-test-${Date.now()}`;

const payload = {
  actionId,
  prompt: process.env.TEST_PROMPT || 'Teste automatizado via script REST.',
  apiKey: TEST_API_KEY || 'dummy-key',
  useAiHomebrew: false,
  clientStateVersion: process.env.TEST_CLIENT_STATE_VERSION ? Number(process.env.TEST_CLIENT_STATE_VERSION) : undefined,
};

const url = `${BASE_URL}/sessions/${sessionId}/actions`;

const token = jwt.sign({ userId: 1, email: 'user@example.com' }, JWT_SECRET, { expiresIn: '1h' });

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

console.log('[testRestAction] POST', url);
console.log('[testRestAction] payload', payload);

try {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  console.log('[testRestAction] status', response.status);
  console.log('[testRestAction] response', json);
  if (response.ok && json?.actionResolution?.actionId) {
    if (json.actionResolution.actionId === actionId) {
      console.log('[testRestAction] ✅ actionId preserved');
    } else {
      console.warn('[testRestAction] ⚠️ actionId mismatch', json.actionResolution.actionId);
    }
  }
} catch (err) {
  console.error('[testRestAction] failed', err);
  process.exit(1);
}
