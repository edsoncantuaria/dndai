export type SessionDebugDirection = 'in' | 'out';

export interface SessionDebugEvent {
  id: string;
  ts: number;
  direction: SessionDebugDirection;
  type: string;
  payload: unknown;
}

const MAX_EVENTS = 200;

let events: SessionDebugEvent[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(fn => fn());
}

export function pushSessionDebugEvent(
  direction: SessionDebugDirection,
  type: string,
  payload: unknown,
): void {
  if (typeof window === 'undefined') return;

  events = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      direction,
      type,
      payload,
    },
    ...events,
  ].slice(0, MAX_EVENTS);

  notify();
}

export function getSessionDebugEvents(): SessionDebugEvent[] {
  return events;
}

export function clearSessionDebugEvents(): void {
  events = [];
  notify();
}

export function subscribeSessionDebugEvents(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function previewPayload(payload: unknown): string {
  if (payload === undefined || payload === null) return '';
  try {
    const raw = JSON.stringify(payload, null, 0);
    return raw.length > 4000 ? `${raw.slice(0, 4000)}…` : raw;
  } catch {
    return String(payload);
  }
}

export function formatSessionDebugEvent(event: SessionDebugEvent): string {
  const time = new Date(event.ts).toLocaleTimeString('pt-BR');
  const arrow = event.direction === 'in' ? '←' : '→';
  if (event.type === 'error' && event.payload && typeof event.payload === 'object') {
    const p = event.payload as { code?: string; message?: string; expectedVersion?: number };
    if (p.code === 'STATE_DESYNC') {
      return `[${time}] ${arrow} ${event.type}\nSTATE_DESYNC (esperado v${p.expectedVersion ?? '?'}) — ${p.message ?? ''}`;
    }
  }
  if (event.type === 'processAction' && event.payload && typeof event.payload === 'object') {
    const p = event.payload as { prompt?: string; actionId?: string };
    const prompt = p.prompt?.slice(0, 120) ?? '';
    return `[${time}] ${arrow} processAction\n${prompt}${prompt.length >= 120 ? '…' : ''}\nactionId=${p.actionId ?? '?'}`;
  }
  const body = previewPayload(event.payload);
  return body
    ? `[${time}] ${arrow} ${event.type}\n${body}`
    : `[${time}] ${arrow} ${event.type}`;
}
