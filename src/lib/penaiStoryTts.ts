import { apiClient } from '@/services/apiClient';

const audioCache = new Map<string, string>();

function cacheKey(text: string): string {
    return text.trim().slice(0, 200);
}

/** TTS v2 — POST /api/v2/tts/generate + playback via /api/v2/tts/audio */
export async function speakStoryParagraph(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    const key = cacheKey(trimmed);
    let url = audioCache.get(key);
    if (!url) {
        const res = await apiClient<{ audioUrl?: string; audioKey?: string }>('/v2/tts/generate', {
            method: 'POST',
            body: JSON.stringify({ text: trimmed }),
        });
        url =
            res.audioUrl ??
            (res.audioKey
                ? `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ?? 'http://localhost:8071'}/api/v2/tts/audio?key=${encodeURIComponent(res.audioKey)}`
                : '');
        if (!url) throw new Error('TTS indisponível');
        audioCache.set(key, url);
    }

    const audio = new Audio(url);
    await audio.play();
}
