import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getRuntimeApiUrl, getRuntimeWsUrl } from '../lib/runtimeApiConfig';

describe('runtimeApiConfig', () => {
  it('usa NEXT_PUBLIC_API_URL quando window não tem override', () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://192.168.1.10:8071/api';
    assert.equal(getRuntimeApiUrl(), 'http://192.168.1.10:8071/api');
    process.env.NEXT_PUBLIC_API_URL = prev;
  });

  it('getRuntimeWsUrl lê env PENAI/WS', () => {
    const prev = process.env.NEXT_PUBLIC_WS_URL;
    process.env.NEXT_PUBLIC_WS_URL = 'ws://192.168.1.10:8071/';
    assert.equal(getRuntimeWsUrl(), 'ws://192.168.1.10:8071');
    process.env.NEXT_PUBLIC_WS_URL = prev;
  });
});
