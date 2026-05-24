import type { LogEntry } from '@/types';
import type { NarrativeEntry } from './components/NarrativeStage';

function extractText(content: LogEntry['content']): string | null {
  if (typeof content === 'string') {
    const t = content.trim();
    return t || null;
  }
  if (content && typeof content === 'object') {
    if ('content' in content && typeof content.content === 'string') return content.content;
    if ('text' in content && typeof content.text === 'string') return content.text;
  }
  return null;
}

/** Mapeia entradas do log para cartas simples (preview / fallback). */
export function mapLogToNarrativeEntries(log: LogEntry[]): NarrativeEntry[] {
  return log
    .map((entry) => {
      const text = extractText(entry.content);
      if (!text && entry.type !== 'roll') return null;

      if (entry.type === 'action') {
        return { id: entry.id, text: text ?? '', kind: 'dialogue' as const };
      }
      if (entry.type === 'system' || entry.type === 'insight') {
        return { id: entry.id, text: text ?? '', kind: 'system' as const };
      }
      if (entry.type === 'roll' && entry.rollResult) {
        const r = entry.rollResult;
        return {
          id: entry.id,
          text: r.description || `${r.dice}: ${r.total}`,
          kind: 'system' as const,
        };
      }
      return { id: entry.id, text: text ?? '', kind: 'narration' as const };
    })
    .filter((e): e is NarrativeEntry => e !== null && Boolean(e.text?.trim()));
}
