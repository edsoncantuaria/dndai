export const PIPER_VOICE_IDS = ['faber', 'razo', 'miro', 'dii'] as const;
export type PiperVoiceId = (typeof PIPER_VOICE_IDS)[number];

export const NARRATION_SPEED_PRESETS = ['rapido', 'normal', 'lento', 'pausado'] as const;
export type NarrationSpeedPreset = (typeof NARRATION_SPEED_PRESETS)[number];

export const PIPER_VOICES = [
    { id: 'faber' as const, label: 'Faber (padrão)', description: 'Voz masculina Piper oficial pt-BR.' },
    { id: 'razo' as const, label: 'Razo', description: 'Masculina conversacional — termos técnicos.' },
    { id: 'miro' as const, label: 'Miro', description: 'OpenVoiceOS pt-BR.' },
    { id: 'dii' as const, label: 'Dii', description: 'OpenVoiceOS pt-BR (alternativa).' },
];

export const NARRATION_SPEEDS = [
    { id: 'rapido' as const, label: 'Rápido', description: 'Narração ágil.', playbackRate: 1.15 },
    { id: 'normal' as const, label: 'Normal', description: 'Ritmo equilibrado (Piper 1.0).', playbackRate: 1.0 },
    { id: 'lento' as const, label: 'Lento', description: 'Mais tempo entre frases.', playbackRate: 0.95 },
    { id: 'pausado' as const, label: 'Pausado', description: 'Fala deliberada.', playbackRate: 0.88 },
];

export type NarrationTtsRequest = {
    voice: PiperVoiceId;
    speed: NarrationSpeedPreset;
};

export const defaultNarrationTts: NarrationTtsRequest = {
    voice: 'faber',
    speed: 'normal',
};

export const isPiperVoiceId = (v: unknown): v is PiperVoiceId =>
    typeof v === 'string' && (PIPER_VOICE_IDS as readonly string[]).includes(v);

export const isNarrationSpeedPreset = (v: unknown): v is NarrationSpeedPreset =>
    typeof v === 'string' && (NARRATION_SPEED_PRESETS as readonly string[]).includes(v);

export const resolveNarrationTtsRequest = (settings?: {
    narrationVoice?: unknown;
    narrationSpeed?: unknown;
} | null): NarrationTtsRequest => ({
    voice: isPiperVoiceId(settings?.narrationVoice) ? settings.narrationVoice : defaultNarrationTts.voice,
    speed: isNarrationSpeedPreset(settings?.narrationSpeed) ? settings.narrationSpeed : defaultNarrationTts.speed,
});

export const getPlaybackRateForSpeed = (speed: NarrationSpeedPreset): number =>
    NARRATION_SPEEDS.find(s => s.id === speed)?.playbackRate ?? 1.0;

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
const TTS_CACHE_REVISION = 'ls1';

export const buildNarrationTtsCacheKey = (
    entryId: string,
    voice: PiperVoiceId,
    speed: NarrationSpeedPreset,
): string => `${entryId}:${voice}:${speed}:${TTS_CACHE_REVISION}`;
