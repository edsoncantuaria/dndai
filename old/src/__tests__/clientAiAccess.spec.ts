import assert from 'node:assert/strict';
import test from 'node:test';
import { clientCanInfer, isLikelyGeminiKey } from '../lib/clientAiAccess';
import type { AiAccessStatus } from '../types/aiAccess';

const baseAccess = (over: Partial<AiAccessStatus>): AiAccessStatus => ({
  engine: 'gemini',
  billingMode: 'unavailable',
  canInfer: false,
  hasByok: false,
  platformKeyConfigured: true,
  creditsRemaining: 0,
  creditsUsed: 0,
  platformBillingEnabled: false,
  includedCreditsPerSignup: 30,
  ...over,
});

test('clientCanInfer: BYOK local válido', () => {
  assert.equal(isLikelyGeminiKey('AIzaSyD' + 'x'.repeat(30)), true);
  assert.equal(clientCanInfer(null, 'AIzaSyD' + 'x'.repeat(30)), true);
});

test('clientCanInfer: sem billing exige chave local', () => {
  assert.equal(
    clientCanInfer(baseAccess({ canInfer: false, platformKeyConfigured: false }), ''),
    false,
  );
});

test('clientCanInfer: servidor com chave (canInfer)', () => {
  assert.equal(
    clientCanInfer(baseAccess({ canInfer: true, platformKeyConfigured: true }), ''),
    true,
  );
});

test('clientCanInfer: servidor com BYOK salvo (hasByok)', () => {
  assert.equal(
    clientCanInfer(baseAccess({ hasByok: true, billingMode: 'byok' }), ''),
    true,
  );
});
