import type { LogEntry } from '@/types';

export function extractLogText(content: LogEntry['content']): string {
  if (typeof content === 'string') return content.trim();
  if (content && typeof content === 'object') {
    if ('content' in content && typeof content.content === 'string') return content.content.trim();
    if ('text' in content && typeof content.text === 'string') return content.text.trim();
  }
  return '';
}

/** Prompts de smoke/dev — não exibir como ação do jogador. */
export function isDevOrSmokeAction(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return (
    /^teste localhost/i.test(t) ||
    /^post-deploy:/i.test(t) ||
    /^(validate|reval|local|post-deploy)-/i.test(t) ||
    /^validate-/i.test(t)
  );
}

/** Prompt interno do DM — não mostrar na UI. */
export function isInternalActionContent(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (isDevOrSmokeAction(t)) return true;
  return (
    t.includes('[Elenco da sessão') ||
    t.includes('[Fase:') ||
    t.includes('Se a ação não exigiu rolagem') ||
    t.startsWith('Recarregar estado atual') ||
    t.startsWith('A aventura começa.')
  );
}

export function formatActionForDisplay(content: LogEntry['content']): string | null {
  const raw = extractLogText(content);
  if (!raw || isInternalActionContent(raw)) return null;
  const match = raw.match(/Ação do jogador:\s*([^\n]+)/i);
  if (match?.[1]?.trim()) return match[1].trim();
  if (raw.length > 220) return null;
  return raw;
}

function entryFingerprint(entry: LogEntry): string {
  const text =
    entry.type === 'action'
      ? formatActionForDisplay(entry.content) ?? extractLogText(entry.content)
      : extractLogText(entry.content);
  return `${entry.type}:${text.slice(0, 240)}`;
}

/** Evita duplicar a mesma linha ao mesclar log otimista + resposta WS. */
export function mergeLogEntries(prev: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  if (!incoming.length) return prev;
  const seen = new Set(prev.map(entryFingerprint));
  const merged = [...prev];
  for (const entry of incoming) {
    if (entry.type === 'action' && !formatActionForDisplay(entry.content)) continue;
    const fp = entryFingerprint(entry);
    if (!fp.endsWith(':') && seen.has(fp)) continue;
    seen.add(fp);
    merged.push(entry);
  }
  return merged;
}

export function shouldRenderLogEntry(entry: LogEntry): boolean {
  if (entry.type === 'action') {
    return Boolean(formatActionForDisplay(entry.content));
  }
  return Boolean(extractLogText(entry.content));
}
