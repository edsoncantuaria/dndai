'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as authService from '@/services/authService'; // Importa authService

// Lista de modelos disponíveis
export const AVAILABLE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-lite",
    "gemini-1.0-pro",
    "gemini-1.5-flash",
    "gemma-3-27b-it",
    "gemma-7b-it",
];

export const AVAILABLE_TTS_MODELS = [
    "gemini-2.5-flash-native-audio-preview-09-2025",
    "gemini-2.5-pro-preview-tts",
    "gemini-2.5-flash-preview-tts",
    "gemini-live-2.5-flash-preview",
    "gemini-2.0-flash-live-001",
    "gemini-2.5-flash-preview-native-audio-dialog",
    "gemini-2.5-flash-exp-native-audio-thinking-dialog",
];

export const AVAILABLE_IMAGE_MODELS = [
    "imagen-4.0-fast-generate-001",
    "gemini-2.5-flash-image-preview",
    "imagen-3.0-generate-002",
    "gemini-2.5-flash-image"
];

// NEW: Lista completa de vozes nativas do Gemini
export const AVAILABLE_TTS_VOICES = [
    "Charon", "Puck", "Zephyr", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
    "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
    "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
    "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
    "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"
];

export interface GenerationConfig {
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
}

interface SettingsContextType {
    isLoaded: boolean;
    loadSettings: (settings: any) => void;
    getSettingsObject: () => any;
    model: string;
    setModel: (model: string) => void;
    ttsModel: string;
    setTtsModel: (model: string) => void;
    imageModel: string;
    setImageModel: (model: string) => void;
    ttsVoice: string;
    setTtsVoice: (voice: string) => void;
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
    useAiHomebrew: boolean;
    setUseAiHomebrew: (use: boolean) => void;
    getApiKey: () => string | undefined;
    saveSettingsToDB: (settings: Partial<Omit<SettingsContextType, 'saveSettingsToDB' | 'loadSettings' | 'isLoaded' | 'getApiKey' | 'getSettingsObject'>>) => Promise<void>;
}

export const defaultGenerationConfig: GenerationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
};

const defaultSettings = {
    model: AVAILABLE_MODELS[0],
    ttsModel: AVAILABLE_TTS_MODELS[0],
    imageModel: AVAILABLE_IMAGE_MODELS[0],
    ttsVoice: AVAILABLE_TTS_VOICES[0],
    apiKey: '',
    generationConfig: defaultGenerationConfig,
    volume: 0.3,
    isMuted: false,
    playMenuMusic: true,
    useAiHomebrew: true,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

const saveSettingsToDB = async (settings: Partial<any>) => {
    try {
        await authService.saveUserSettings(settings);
    } catch (error) {
        console.error("Failed to save settings to DB:", error);
    }
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [model, setModel] = useState<string>(defaultSettings.model);
    const [ttsModel, setTtsModel] = useState<string>(defaultSettings.ttsModel);
    const [imageModel, setImageModel] = useState<string>(defaultSettings.imageModel);
    const [ttsVoice, setTtsVoice] = useState<string>(defaultSettings.ttsVoice);
    const [apiKey, setApiKey] = useState<string>(defaultSettings.apiKey);
    const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(defaultSettings.generationConfig);
    const [volume, setVolume] = useState(defaultSettings.volume);
    const [isMuted, setIsMuted] = useState(defaultSettings.isMuted);
    const [playMenuMusic, setPlayMenuMusic] = useState(defaultSettings.playMenuMusic);
    const [useAiHomebrew, setUseAiHomebrew] = useState(defaultSettings.useAiHomebrew);

    const getApiKey = useCallback(() => apiKey, [apiKey]);
    
    // Load from localStorage on initial mount
    useEffect(() => {
        try {
            const localSettings = localStorage.getItem('userSettings');
            if (localSettings) {
                const settings = JSON.parse(localSettings);
                loadSettings(settings);
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
            model, ttsModel, imageModel, generationConfig, ttsVoice, volume, isMuted, playMenuMusic, apiKey, useAiHomebrew
        }
    }, [model, ttsModel, imageModel, generationConfig, ttsVoice, volume, isMuted, playMenuMusic, apiKey, useAiHomebrew]);

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
            if (settings.model && AVAILABLE_MODELS.includes(settings.model)) setModel(settings.model);
            if (settings.ttsModel && AVAILABLE_TTS_MODELS.includes(settings.ttsModel)) setTtsModel(settings.ttsModel);
            if (settings.imageModel && AVAILABLE_IMAGE_MODELS.includes(settings.imageModel)) setImageModel(settings.imageModel);
            if (settings.ttsVoice && AVAILABLE_TTS_VOICES.includes(settings.ttsVoice)) setTtsVoice(settings.ttsVoice);
            if (settings.generationConfig) setGenerationConfig(prev => ({ ...prev, ...settings.generationConfig }));
            if (typeof settings.volume === 'number') setVolume(settings.volume);
            if (typeof settings.isMuted === 'boolean') setIsMuted(settings.isMuted);
            if (typeof settings.playMenuMusic === 'boolean') setPlayMenuMusic(settings.playMenuMusic);
            if (typeof settings.useAiHomebrew === 'boolean') setUseAiHomebrew(settings.useAiHomebrew);
            if (settings.apiKey) setApiKey(settings.apiKey);
        }
    }, []);

    // Save settings to DB when they change (debounced)
    useEffect(() => {
        if(isLoaded) {
            const settingsToSave = getSettingsObject();
            const handler = setTimeout(() => saveSettingsToDB(settingsToSave), 1500); // Debounce DB saves
            return () => clearTimeout(handler);
        }
    }, [getSettingsObject, isLoaded]);

    const value = {
        isLoaded, loadSettings, getSettingsObject,
        model, setModel,
        ttsModel, setTtsModel,
        imageModel, setImageModel,
        apiKey, setApiKey,
        generationConfig, setGenerationConfig,
        ttsVoice, setTtsVoice,
        volume, setVolume,
        isMuted, setIsMuted,
        playMenuMusic, setPlayMenuMusic,
        useAiHomebrew, setUseAiHomebrew,
        getApiKey,
        saveSettingsToDB,
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
