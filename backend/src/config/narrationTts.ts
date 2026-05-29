/** Vozes Piper pt-BR disponíveis no container (docker/piper). */
export const PIPER_VOICE_IDS = ['faber', 'razo', 'miro', 'dii'] as const;
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
        label: 'Faber (padrão)',
        description: 'Voz masculina Piper oficial pt-BR — equilibrada.',
    },
    {
        id: 'razo',
        label: 'Razo',
        description: 'Masculina conversacional — termos técnicos em pt-BR.',
    },
    {
        id: 'miro',
        label: 'Miro',
        description: 'OpenVoiceOS pt-BR — tom sintético treinado.',
    },
    {
        id: 'dii',
        label: 'Dii',
        description: 'OpenVoiceOS pt-BR — alternativa ao Miro.',
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
    { id: 'rapido', label: 'Rápido', description: 'Narração ágil.', lengthScale: 0.82, playbackRate: 1.15 },
    { id: 'normal', label: 'Normal', description: 'Ritmo equilibrado.', lengthScale: 1.0, playbackRate: 1.0 },
    { id: 'lento', label: 'Lento', description: 'Mais tempo entre frases.', lengthScale: 1.22, playbackRate: 0.95 },
    { id: 'pausado', label: 'Pausado', description: 'Fala deliberada, ideal para ouvir com calma.', lengthScale: 1.45, playbackRate: 0.88 },
];

const DEFAULT_VOICE: PiperVoiceId = 'faber';
const DEFAULT_SPEED: NarrationSpeedPreset = 'normal';

export const isPiperVoiceId = (value: unknown): value is PiperVoiceId =>
    typeof value === 'string' && (PIPER_VOICE_IDS as readonly string[]).includes(value);

export const isNarrationSpeedPreset = (value: unknown): value is NarrationSpeedPreset =>
    typeof value === 'string' && (NARRATION_SPEED_PRESETS as readonly string[]).includes(value);

export const resolvePiperVoiceId = (value: unknown): PiperVoiceId =>
    isPiperVoiceId(value) ? value : DEFAULT_VOICE;

export const resolveNarrationSpeedPreset = (value: unknown): NarrationSpeedPreset =>
    isNarrationSpeedPreset(value) ? value : DEFAULT_SPEED;

export const getNarrationSpeedMeta = (preset: NarrationSpeedPreset): NarrationSpeedMeta =>
    NARRATION_SPEEDS.find(s => s.id === preset) ?? NARRATION_SPEEDS.find(s => s.id === DEFAULT_SPEED)!;

export type NarrationTtsOptions = {
    voice: PiperVoiceId;
    lengthScale: number;
    playbackRate: number;
};

export const resolveNarrationTtsOptions = (settings?: {
    narrationVoice?: unknown;
    narrationSpeed?: unknown;
} | null): NarrationTtsOptions => {
    const voice = resolvePiperVoiceId(settings?.narrationVoice);
    const speed = getNarrationSpeedMeta(resolveNarrationSpeedPreset(settings?.narrationSpeed));
    return {
        voice,
        lengthScale: speed.lengthScale,
        playbackRate: speed.playbackRate,
    };
};
