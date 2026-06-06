import type { PenaiStoryEntry } from '@/hooks/usePenaiTurnPipeline';

const SYSTEM_CONTENT_PREFIXES = ['[MUNDO]', '[PULSO]', '[FATO]'] as const;

export function isSystemStoryEntry(entry: PenaiStoryEntry): boolean {
    const kind = (entry.kind ?? '').toLowerCase();
    if (kind === 'system') return true;
    const content = entry.content.trim();
    return SYSTEM_CONTENT_PREFIXES.some(prefix => content.startsWith(prefix));
}

export function isVisibleStoryEntry(entry: PenaiStoryEntry): boolean {
    const kind = (entry.kind ?? entry.tone ?? '').toLowerCase();
    if (kind === 'opening') return false;
    if (isSystemStoryEntry(entry)) return false;
    return true;
}
