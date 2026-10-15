// src/contexts/SettingsContext.tsx
'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as authService from '@/services/authService'; // Importa authService
import {
    migrateGeminiApiKeyFromLegacySettings,
    readGeminiApiKey,
    writeGeminiApiKey,
} from '@/lib/geminiApiKeyStorage';
import {
    defaultNarrationTts,
    isNarrationSpeedPreset,
    isPiperVoiceId,
    type NarrationSpeedPreset,
    type PiperVoiceId,
} from '@/lib/narrationTts';

/** PENAI — apenas modelos Gemini (PT-BR). */
export const GEMINI_GAME_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
] as const;

/** Modelos expostos no gameplay. */
export const GAMEPLAY_MODELS = [...GEMINI_GAME_MODELS] as const;

export const AVAILABLE_MODELS = [
    ...GEMINI_GAME_MODELS,
    "gemini-2.5-pro-preview-06-05",
    "gemini-2.5-flash-preview-09-2025",
    "gemini-flash-latest",
    "gemini-pro-latest",
] as const;
  

  export const AVAILABLE_TTS_MODELS = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts"
  ];
  

// NEW: Lista completa de vozes nativas do Gemini
export const AVAILABLE_TTS_VOICES = [
    "Charon", "Puck", "Zephyr"
];

export interface GenerationConfig {
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
}

export type ThemePreset = 'classic' | 'aurora' | 'midnight';
export type FontScale = 'normal' | 'reading';
const THEME_PRESETS: ThemePreset[] = ['classic', 'aurora', 'midnight'];
const FONT_SCALES: FontScale[] = ['normal', 'reading'];

interface SettingsContextType {
    isLoaded: boolean;
    loadSettings: (settings: any) => void;
    getSettingsObject: () => any;
    model: string;
    setModel: (model: string) => void;
    ttsModel: string;
    setTtsModel: (model: string) => void;
    ttsVoice: string;
    setTtsVoice: (voice: string) => void;
    narrationVoice: PiperVoiceId;
    setNarrationVoice: (voice: PiperVoiceId) => void;
    narrationSpeed: NarrationSpeedPreset;
    setNarrationSpeed: (speed: NarrationSpeedPreset) => void;
    apiKey: string;
    setApiKey: (key: string) => void;
    generationConfig: GenerationConfig;
    setGenerationConfig: (config: GenerationConfig | ((prev: GenerationConfig) => GenerationConfig)) => void;
    volume: number;
    setVolume: (volume: number) => void;
    isMuted: boolean;
    setIsMuted: (isMuted: boolean) => void;
    playMenuMusic: boolean;
    setPlayMenuMusic: (play: boolean) => void;
    playAmbientMusic: boolean;
    setPlayAmbientMusic: (play: boolean) => void;
    useAiHomebrew: boolean;
    setUseAiHomebrew: (use: boolean) => void;
    theme: ThemePreset;
    setTheme: (theme: ThemePreset) => void;
    fontScale: FontScale;
    setFontScale: (scale: FontScale) => void;
    reducedMotion: boolean;
    setReducedMotion: (value: boolean) => void;
    highContrast: boolean;
    setHighContrast: (value: boolean) => void;
    hasSeenGuidedTips: boolean;
    setHasSeenGuidedTips: (value: boolean) => void;
    eventCuesEnabled: boolean;
    setEventCuesEnabled: (value: boolean) => void;
    hapticsEnabled: boolean;
    setHapticsEnabled: (value: boolean) => void;
    getApiKey: () => string | undefined;
    saveSettingsToDB: (settings: Partial<Omit<SettingsContextType, 'saveSettingsToDB' | 'loadSettings' | 'isLoaded' | 'getApiKey' | 'getSettingsObject' | 'persistSettingsNow'>>) => Promise<void>;
    /** Grava localStorage + API imediatamente (ex.: ao fechar o modal). */
    persistSettingsNow: () => Promise<void>;
}

export const readStoredUserSettings = (): Record<string, unknown> | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('userSettings');
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
        return null;
    }
};

/** Preferência local (última sessão) sobre valores do servidor ao hidratar. */
export const mergeSettingsForHydration = (
    serverSettings: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
    const local = readStoredUserSettings();
    if (!serverSettings && !local) return null;
    if (!local) return serverSettings ?? null;
    if (!serverSettings) return local;
    return { ...serverSettings, ...local };
};

export const defaultGenerationConfig: GenerationConfig = {
    temperature: 0.9,
    topP: 0.9,
    topK: 64,
    maxOutputTokens: 1024,
};

const defaultSettings = {
    model: 'gemini-2.5-flash',
    ttsModel: AVAILABLE_TTS_MODELS[0],
    ttsVoice: AVAILABLE_TTS_VOICES[0],
    narrationVoice: defaultNarrationTts.voice,
    narrationSpeed: defaultNarrationTts.speed,
    apiKey: '',
    generationConfig: defaultGenerationConfig,
    volume: 0.3,
   isMuted: false,
   playMenuMusic: true,
   playAmbientMusic: true,
   useAiHomebrew: true,
    theme: 'classic' as ThemePreset,
    fontScale: 'normal' as FontScale,
    reducedMotion: false,
    highContrast: false,
    hasSeenGuidedTips: false,
    eventCuesEnabled: true,
    hapticsEnabled: false,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

const clampGenerationConfigValues = (config: GenerationConfig): GenerationConfig => ({
    temperature: Math.min(Math.max(config.temperature ?? 0.7, 0), 1),
    topP: Math.min(Math.max(config.topP ?? 0.9, 0), 1),
    topK: Math.max(Math.min(config.topK ?? 64, 128), 1),
    maxOutputTokens: Math.max(Math.min(config.maxOutputTokens ?? 1024, 4096), 256),
});

const saveSettingsToDB = async (settings: Partial<any>) => {
    if (typeof window !== 'undefined' && localStorage.getItem('token')) {
        const payload = { ...settings };
        if (payload.generationConfig) {
            payload.generationConfig = clampGenerationConfigValues(payload.generationConfig);
        }
        await authService.saveUserSettings(payload);
    }
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [model, setModel] = useState<string>(defaultSettings.model);
    const [ttsModel, setTtsModel] = useState<string>(defaultSettings.ttsModel);
    const [ttsVoice, setTtsVoice] = useState<string>(defaultSettings.ttsVoice);
    const [narrationVoice, setNarrationVoice] = useState<PiperVoiceId>(defaultSettings.narrationVoice);
    const [narrationSpeed, setNarrationSpeed] = useState<NarrationSpeedPreset>(defaultSettings.narrationSpeed);
    const [apiKey, setApiKey] = useState<string>(() => {
        if (typeof window === 'undefined') return defaultSettings.apiKey;
        try {
            return (
                migrateGeminiApiKeyFromLegacySettings() ||
                readGeminiApiKey() ||
                defaultSettings.apiKey
            );
        } catch {
            return defaultSettings.apiKey;
        }
    });
    const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(clampGenerationConfigValues(defaultSettings.generationConfig));
    const [volume, setVolume] = useState(defaultSettings.volume);
    const [isMuted, setIsMuted] = useState(defaultSettings.isMuted);
    const [playMenuMusic, setPlayMenuMusic] = useState(defaultSettings.playMenuMusic);
    const [playAmbientMusic, setPlayAmbientMusic] = useState(defaultSettings.playAmbientMusic);
    const [useAiHomebrew, setUseAiHomebrew] = useState(defaultSettings.useAiHomebrew);
    const [theme, setTheme] = useState<ThemePreset>(defaultSettings.theme);
    const [fontScale, setFontScale] = useState<FontScale>(defaultSettings.fontScale);
    const [reducedMotion, setReducedMotion] = useState(defaultSettings.reducedMotion);
    const [highContrast, setHighContrast] = useState(defaultSettings.highContrast);
    const [hasSeenGuidedTips, setHasSeenGuidedTips] = useState(defaultSettings.hasSeenGuidedTips);
    const [eventCuesEnabled, setEventCuesEnabled] = useState(defaultSettings.eventCuesEnabled);
    const [hapticsEnabled, setHapticsEnabled] = useState(defaultSettings.hapticsEnabled);

    /** BYOK: chave Gemini no dispositivo; também sincronizada via saveInferenceApiKey. */
    const getApiKey = useCallback(() => {
        const trimmed = apiKey?.trim() || readGeminiApiKey().trim();
        return trimmed || undefined;
    }, [apiKey]);
    
    // Load from localStorage on initial mount
    useEffect(() => {
        try {
            const localSettings = localStorage.getItem('userSettings');
            if (localSettings) {
                const settings = JSON.parse(localSettings);
                loadSettings(settings);
            }
            // Storage dedicado prevalece sobre userSettings (evita chave vazia no JSON)
            const storedApiKey = readGeminiApiKey();
            if (storedApiKey) {
                setApiKey(storedApiKey);
            }
        } catch (error) {
            console.warn("Could not load settings from localStorage", error);
        } finally {
            setIsLoaded(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getSettingsObject = useCallback(() => {
        return {
            model,
            ttsModel,
            generationConfig,
            ttsVoice,
            narrationVoice,
            narrationSpeed,
            volume,
            isMuted,
            playMenuMusic,
            playAmbientMusic,
            apiKey,
            useAiHomebrew,
            theme,
            fontScale,
            reducedMotion,
            highContrast,
            hasSeenGuidedTips,
            eventCuesEnabled,
            hapticsEnabled,
        }
    }, [
        model,
        ttsModel,
        generationConfig,
        ttsVoice,
        narrationVoice,
        narrationSpeed,
        volume,
        isMuted,
        playMenuMusic,
        playAmbientMusic,
        apiKey,
        useAiHomebrew,
        theme,
        fontScale,
        reducedMotion,
        highContrast,
        hasSeenGuidedTips,
        eventCuesEnabled,
        hapticsEnabled,
    ]);

    // Persiste chave Gemini em storage dedicado — nunca apaga com string vazia na hidratação
    useEffect(() => {
        if (!isLoaded) return;
        const trimmed = apiKey.trim();
        if (trimmed) {
            writeGeminiApiKey(trimmed);
        }
    }, [apiKey, isLoaded]);

    // Save to localStorage whenever a setting changes
    useEffect(() => {
        if (isLoaded) {
            const settingsToSave = getSettingsObject();
            localStorage.setItem('userSettings', JSON.stringify(settingsToSave));
        }
    }, [getSettingsObject, isLoaded]);
    
    // Function to load settings from AuthContext or localStorage
    const loadSettings = useCallback((settings: any) => {
        if (settings) {
            if (settings.model && typeof settings.model === 'string') {
                setModel(settings.model);
            }
            if (settings.ttsModel && AVAILABLE_TTS_MODELS.includes(settings.ttsModel)) setTtsModel(settings.ttsModel);
            if (settings.ttsVoice && AVAILABLE_TTS_VOICES.includes(settings.ttsVoice)) setTtsVoice(settings.ttsVoice);
            if (isPiperVoiceId(settings.narrationVoice)) setNarrationVoice(settings.narrationVoice);
            if (isNarrationSpeedPreset(settings.narrationSpeed)) setNarrationSpeed(settings.narrationSpeed);
            if (settings.generationConfig) setGenerationConfig(prev => clampGenerationConfigValues({ ...prev, ...settings.generationConfig }));
            if (typeof settings.volume === 'number') setVolume(settings.volume);
            if (typeof settings.isMuted === 'boolean') setIsMuted(settings.isMuted);
            if (typeof settings.playMenuMusic === 'boolean') setPlayMenuMusic(settings.playMenuMusic);
            if (typeof settings.playAmbientMusic === 'boolean') setPlayAmbientMusic(settings.playAmbientMusic);
            if (typeof settings.useAiHomebrew === 'boolean') setUseAiHomebrew(settings.useAiHomebrew);
            if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
                setApiKey(settings.apiKey.trim());
            }
            if (settings.theme && THEME_PRESETS.includes(settings.theme as ThemePreset)) {
                setTheme(settings.theme as ThemePreset);
            }
            if (settings.fontScale && FONT_SCALES.includes(settings.fontScale as FontScale)) {
                setFontScale(settings.fontScale as FontScale);
            }
            if (typeof settings.reducedMotion === 'boolean') setReducedMotion(settings.reducedMotion);
            if (typeof settings.highContrast === 'boolean') setHighContrast(settings.highContrast);
            if (typeof settings.hasSeenGuidedTips === 'boolean') setHasSeenGuidedTips(settings.hasSeenGuidedTips);
            if (typeof settings.eventCuesEnabled === 'boolean') setEventCuesEnabled(settings.eventCuesEnabled);
            if (typeof settings.hapticsEnabled === 'boolean') setHapticsEnabled(settings.hapticsEnabled);
        }
    }, []);

    const persistSettingsNow = useCallback(async () => {
        if (!isLoaded) return;
        const settingsToSave = getSettingsObject();
        localStorage.setItem('userSettings', JSON.stringify(settingsToSave));
        await saveSettingsToDB(settingsToSave);
    }, [getSettingsObject, isLoaded]);

    // Save settings to DB when they change (debounced)
    useEffect(() => {
        if (isLoaded) {
            const settingsToSave = getSettingsObject();
            const handler = setTimeout(() => {
                void saveSettingsToDB(settingsToSave).catch(error => {
                    console.error('Failed to save settings to DB:', error);
                });
            }, 500);
            return () => clearTimeout(handler);
        }
    }, [getSettingsObject, isLoaded]);

    const setClampedGenerationConfig = useCallback((config: GenerationConfig | ((prev: GenerationConfig) => GenerationConfig)) => {
        setGenerationConfig(prev => {
            const next = typeof config === 'function' ? config(prev) : config;
            return clampGenerationConfigValues(next);
        });
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.dataset.theme = theme;
    }, [theme]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.dataset.fontScale = fontScale;
    }, [fontScale]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.dataset.reduceMotion = reducedMotion ? 'true' : 'false';
    }, [reducedMotion]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.dataset.contrast = highContrast ? 'high' : 'normal';
    }, [highContrast]);

    const value: any = {
        isLoaded, loadSettings, getSettingsObject,
        model, setModel,
        ttsModel, setTtsModel,
        ttsVoice, setTtsVoice,
        narrationVoice, setNarrationVoice,
        narrationSpeed, setNarrationSpeed,
        apiKey, setApiKey,
        generationConfig, setGenerationConfig: setClampedGenerationConfig,
        volume, setVolume,
        isMuted, setIsMuted,
        playMenuMusic, setPlayMenuMusic,
        playAmbientMusic, setPlayAmbientMusic,
        useAiHomebrew, setUseAiHomebrew,
        theme, setTheme,
        fontScale, setFontScale,
        reducedMotion, setReducedMotion,
        highContrast, setHighContrast,
        hasSeenGuidedTips, setHasSeenGuidedTips,
        eventCuesEnabled, setEventCuesEnabled,
        hapticsEnabled, setHapticsEnabled,
        getApiKey,
        saveSettingsToDB,
        persistSettingsNow,
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettingsContext = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettingsContext must be used within a SettingsProvider');
    }
    return context;
};
