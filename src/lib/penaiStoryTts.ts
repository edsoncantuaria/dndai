import { apiClient } from '@/services/apiClient';
import {
    buildNarrationAudioUrl,
    withPlaybackAuthToken,
} from '@/services/ttsService';
import {
    NARRATION_LENGTH_SCALE,
    NARRATION_PLAYBACK_RATE,
    NARRATION_VOICE,
} from '@/lib/narrationTts';

const audioCache = new Map<string, string>();

function cacheKey(text: string): string {
    return `${NARRATION_VOICE}:${NARRATION_PLAYBACK_RATE}:${text.trim().slice(0, 200)}`;
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
            body: JSON.stringify({
                text: trimmed,
                voice: NARRATION_VOICE,
                narrationVoice: NARRATION_VOICE,
                lengthScale: NARRATION_LENGTH_SCALE,
            }),
        });
        url = res.audioKey
            ? buildNarrationAudioUrl(res.audioKey)
            : res.audioUrl
              ? withPlaybackAuthToken(res.audioUrl)
              : '';
        if (!url) throw new Error('TTS indisponível');
        audioCache.set(key, url);
    }

    const audio = new Audio(url);
    audio.playbackRate = NARRATION_PLAYBACK_RATE;
    await audio.play();
}
