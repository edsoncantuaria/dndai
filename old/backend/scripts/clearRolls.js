import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE_URL = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8071/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const token = jwt.sign({ userId: 1, email: 'user@example.com' }, JWT_SECRET, { expiresIn: '1h' });

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

const url = `${BASE_URL}/roll-requests/clear`;
console.log('[clearRolls] POST', url);

try {
  const res = await fetch(url, { method: 'POST', headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  console.log('[clearRolls] status', res.status);
  console.log('[clearRolls] response', data);
  if (!res.ok) process.exit(1);
} catch (err) {
  console.error('[clearRolls] failed', err);
  process.exit(1);
}
