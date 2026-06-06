/** Voz única do narrador — Piper pt-BR Faber. */
export const PIPER_VOICE_IDS = ['faber'] as const;
export const NARRATION_PLAYBACK_RATE = 1.2;
export const NARRATION_LENGTH_SCALE = Number((1 / NARRATION_PLAYBACK_RATE).toFixed(3));
export type PiperVoiceId = (typeof PIPER_VOICE_IDS)[number];

export const NARRATION_SPEED_PRESETS = ['rapido', 'normal', 'lento', 'pausado'] as const;
export type NarrationSpeedPreset = (typeof NARRATION_SPEED_PRESETS)[number];

export type PiperVoiceMeta = {
    id: PiperVoiceId;
    label: string;
    description: string;
};

export const PIPER_VOICES: PiperVoiceMeta[] = [
    {
        id: 'faber',
        label: 'Faber',
        description: 'Voz masculina Piper oficial pt-BR — equilibrada.',
    },
];

export type NarrationSpeedMeta = {
    id: NarrationSpeedPreset;
    label: string;
    description: string;
    lengthScale: number;
    playbackRate: number;
};

/** length_scale Piper: maior = fala mais devagar (1.0 ≈ ritmo natural). playbackRate no `<audio>`. */
export const NARRATION_SPEEDS: NarrationSpeedMeta[] = [
    {
        id: 'normal',
        label: 'Padrão (1,20×)',
        description: 'Ritmo atual da mesa.',
        lengthScale: NARRATION_LENGTH_SCALE,
        playbackRate: NARRATION_PLAYBACK_RATE,
    },
];

const DEFAULT_VOICE: PiperVoiceId = 'faber';
const DEFAULT_SPEED: NarrationSpeedPreset = 'normal';

export const isPiperVoiceId = (value: unknown): value is PiperVoiceId =>
    typeof value === 'string' && (PIPER_VOICE_IDS as readonly string[]).includes(value);

export const isNarrationSpeedPreset = (value: unknown): value is NarrationSpeedPreset =>
    typeof value === 'string' && (NARRATION_SPEED_PRESETS as readonly string[]).includes(value);

export const resolvePiperVoiceId = (_value: unknown): PiperVoiceId => DEFAULT_VOICE;

export const resolveNarrationSpeedPreset = (value: unknown): NarrationSpeedPreset =>
    isNarrationSpeedPreset(value) ? value : DEFAULT_SPEED;

export const getNarrationSpeedMeta = (preset: NarrationSpeedPreset): NarrationSpeedMeta =>
    NARRATION_SPEEDS.find(s => s.id === preset) ?? NARRATION_SPEEDS.find(s => s.id === DEFAULT_SPEED)!;

export type NarrationTtsOptions = {
    voice: PiperVoiceId;
    lengthScale: number;
    playbackRate: number;
};

export const resolveNarrationTtsOptions = (_settings?: {
    narrationVoice?: unknown;
    narrationSpeed?: unknown;
} | null): NarrationTtsOptions => ({
    voice: DEFAULT_VOICE,
    lengthScale: NARRATION_LENGTH_SCALE,
    playbackRate: NARRATION_PLAYBACK_RATE,
});
