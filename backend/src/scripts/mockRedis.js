// backend/src/scripts/mockRedis.js
// Simple in-memory mock so local scripts can bypass a real Redis dependency.

const normalizeIndex = (index, length) => {
  if (length === 0) return 0;
  if (index < 0) {
    return Math.max(length + index, 0);
  }
  return Math.min(index, length - 1);
};

class MockPipeline {
  constructor(client) {
    this.client = client;
    this.commands = [];
  }

  _enqueue(method, args) {
    this.commands.push(() => this.client[method](...args));
    return this;
  }

  set(...args) {
    return this._enqueue('set', args);
  }

  del(...args) {
    return this._enqueue('del', args);
  }

  rPush(...args) {
    return this._enqueue('rPush', args);
  }

  lTrim(...args) {
    return this._enqueue('lTrim', args);
  }

  exec() {
    return Promise.all(this.commands.map((command) => command()));
  }
}

class MockRedisClient {
  constructor() {
    this._isOpen = false;
    this.store = new Map();
    this.ttlTimers = new Map();
  }

  get isOpen() {
    return this._isOpen;
  }

  async connect() {
    this._isOpen = true;
    console.log('[MockRedis] connect');
  }

  async quit() {
    this._isOpen = false;
    this._clearAllTimers();
  }

  async disconnect() {
    return this.quit();
  }

  on() {
    return this;
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return entry.type === 'list' ? JSON.stringify(entry.value) : entry.value;
  }

  async set(key, value, options) {
    this.store.set(key, { type: 'string', value: value?.toString?.() ?? value });
    this._scheduleExpiry(key, options);
  }

  async del(...keys) {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted += 1;
      }
      this._clearTimer(key);
    }
    return deleted;
  }

  async rPush(key, values) {
    const entry = this.store.get(key);
    const list = entry && entry.type === 'list' ? [...entry.value] : [];
    const toInsert = Array.isArray(values) ? values.flat() : [values];
    list.push(...toInsert.map((val) => val?.toString?.() ?? val));
    this.store.set(key, { type: 'list', value: list });
    return list.length;
  }

  async lTrim(key, start, end) {
    const entry = this.store.get(key);
    if (!entry || entry.type !== 'list') return 0;
    const { value } = entry;
    if (!value.length) return 0;
    const from = normalizeIndex(start, value.length);
    const to = end === -1 ? value.length - 1 : normalizeIndex(end, value.length);
    const trimmed = from > to ? [] : value.slice(from, to + 1);
    this.store.set(key, { type: 'list', value: trimmed });
    return trimmed.length;
  }

  async lRange(key, start, end) {
    const entry = this.store.get(key);
    if (!entry || entry.type !== 'list') return [];
    const { value } = entry;
    if (!value.length) return [];
    const from = normalizeIndex(start, value.length);
    const to = end === -1 ? value.length - 1 : normalizeIndex(end, value.length);
    if (from > to) return [];
    return value.slice(from, to + 1);
  }

  multi() {
    return new MockPipeline(this);
  }

  _scheduleExpiry(key, options) {
    this._clearTimer(key);
    if (!options?.EX) return;
    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.ttlTimers.delete(key);
    }, options.EX * 1000);
    if (timeout.unref) {
      timeout.unref();
    }
    this.ttlTimers.set(key, timeout);
  }

  _clearTimer(key) {
    const timeout = this.ttlTimers.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.ttlTimers.delete(key);
    }
  }

  _clearAllTimers() {
    for (const key of this.ttlTimers.keys()) {
      this._clearTimer(key);
    }
  }
}

export const redisClient = new MockRedisClient();
export default redisClient;
