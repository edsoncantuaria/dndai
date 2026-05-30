import type { PenaiStoryEntry } from '@/hooks/usePenaiTurnPipeline';
import type { NarrativeBeatVisual } from '@/lib/cinematicAssets';

const TONE_LABEL: Record<string, string> = {
    opening: 'Abertura',
    cinematic: 'Cena',
    neutral: 'Narração',
    combat: 'Combate',
    social: 'Diálogo',
    exploration: 'Exploração',
};

export function storyEntryLabel(entry: PenaiStoryEntry): string {
    const key = (entry.kind ?? entry.tone ?? 'narration').toLowerCase();
    return TONE_LABEL[key] ?? 'Crônica';
}

export function storyBeatVisual(entry: PenaiStoryEntry): NarrativeBeatVisual {
    const key = (entry.kind ?? entry.tone ?? '').toLowerCase();
    if (key === 'opening' || key === 'cinematic' || key === 'narration') return 'narration';
    if (key === 'combat') return 'combat';
    if (key === 'system') return 'system';
    return 'narration';
}

/** Normaliza timestamp para marcador [HH:mm] na crônica. */
export function formatStoryTimestamp(timestamp: string): string {
    const raw = timestamp.trim();
    if (/^\[\d{1,2}:\d{2}\]$/.test(raw)) return raw;
    if (/^\d{1,2}:\d{2}$/.test(raw)) return `[${raw}]`;
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
        const d = new Date(parsed);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `[${hh}:${mm}]`;
    }
    return raw.startsWith('[') ? raw : `[${raw}]`;
}

/** Quebra parágrafos vindos do backend (\n\n) ou bloco único. */
export function splitStoryParagraphs(content: string): string[] {
    const trimmed = content.trim();
    if (!trimmed) return [];
    if (trimmed.includes('\n\n')) {
        return trimmed
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(Boolean);
    }
    return [trimmed];
}
