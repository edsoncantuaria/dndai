'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as authService from '@/services/authService'; // Importa authService

// Lista de modelos disponíveis
export const AVAILABLE_MODELS = [
    "gemini-2.5-pro",
    "gemini-2.5-pro-preview-06-05",
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-pro-preview-03-25",
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.5-flash-preview-09-2025",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite-preview-09-2025",
    "gemini-2.5-flash-lite-preview-06-17",
    "gemini-2.0-pro-exp",
    "gemini-2.0-pro-exp-02-05",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-lite-001",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-pro-latest",
    "gemini-exp-1206",
    "gemini-robotics-er-1.5-preview",
    "gemini-2.5-computer-use-preview-10-2025"
  ];
  

  export const AVAILABLE_TTS_MODELS = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts"
  ];
  

  export const AVAILABLE_IMAGE_MODELS = [
    "imagen-3.0-generate-002",
    "imagen-4.0-generate-preview-06-06",
    "gemini-2.5-flash-image-preview",
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.0-flash-preview-image-generation"
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
