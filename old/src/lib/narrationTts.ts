export const PIPER_VOICE_IDS = ['faber'] as const;
export type PiperVoiceId = (typeof PIPER_VOICE_IDS)[number];

/** Voz única do narrador — Piper pt-BR Faber. */
export const NARRATION_VOICE: PiperVoiceId = 'faber';

/** Velocidade fixa de reprodução e síntese (playbackRate no `<audio>`). */
export const NARRATION_PLAYBACK_RATE = 1.2;

/** length_scale Piper inverso ao playbackRate (menor = fala mais rápida). */
export const NARRATION_LENGTH_SCALE = Number((1 / NARRATION_PLAYBACK_RATE).toFixed(3));

export const NARRATION_SPEED_PRESETS = ['rapido', 'normal', 'lento', 'pausado'] as const;
export type NarrationSpeedPreset = (typeof NARRATION_SPEED_PRESETS)[number];

export const PIPER_VOICES = [
    { id: 'faber' as const, label: 'Faber', description: 'Voz masculina Piper oficial pt-BR.' },
];

export const NARRATION_SPEEDS = [
    { id: 'normal' as const, label: 'Padrão (1,20×)', description: 'Ritmo atual da mesa.', playbackRate: NARRATION_PLAYBACK_RATE },
];

export type NarrationTtsRequest = {
    voice: PiperVoiceId;
    speed: NarrationSpeedPreset;
};

export const defaultNarrationTts: NarrationTtsRequest = {
    voice: NARRATION_VOICE,
    speed: 'normal',
};

export const isPiperVoiceId = (v: unknown): v is PiperVoiceId =>
    v === NARRATION_VOICE || (typeof v === 'string' && v === 'faber');

export const isNarrationSpeedPreset = (v: unknown): v is NarrationSpeedPreset =>
    typeof v === 'string' && (NARRATION_SPEED_PRESETS as readonly string[]).includes(v);

export const resolveNarrationTtsRequest = (settings?: {
    narrationVoice?: unknown;
    narrationSpeed?: unknown;
} | null): NarrationTtsRequest => ({
    voice: NARRATION_VOICE,
    speed: 'normal',
});

export const getPlaybackRateForSpeed = (_speed?: NarrationSpeedPreset): number => NARRATION_PLAYBACK_RATE;

/** Pausa entre trechos de áudio no player (ms). */
export const getInterSegmentGapMs = (speed: NarrationSpeedPreset): number => {
    switch (speed) {
        case 'rapido':
            return 60;
        case 'normal':
            return 100;
        case 'lento':
            return 180;
        case 'pausado':
            return 280;
        default:
            return 100;
    }
};

/** Pausa após vírgula / fim de frase entre chunks TTS (ms). */
export const getPunctuationPauseMs = (
    speed: NarrationSpeedPreset,
    kind: 'comma' | 'sentence',
): number => {
    const base = kind === 'comma' ? 90 : 160;
    switch (speed) {
        case 'rapido':
            return Math.round(base * 0.55);
        case 'normal':
            return base;
        case 'lento':
            return Math.round(base * 1.35);
        case 'pausado':
            return Math.round(base * 1.75);
        default:
            return base;
    }
};

/** Bump ao alterar lengthScale/playback — invalida áudio em cache no cliente. */
const TTS_CACHE_REVISION = 'faber120';

export const buildNarrationTtsCacheKey = (
    entryId: string,
    voice: PiperVoiceId,
    speed: NarrationSpeedPreset,
): string => `${entryId}:${voice}:${speed}:${TTS_CACHE_REVISION}`;
