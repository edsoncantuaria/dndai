'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

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


const LOCAL_STORAGE_API_KEY = 'rpg-de-cria-api-key';

interface SettingsContextType {
    isLoaded: boolean;
    loadSettings: (settings: any) => void;
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
    getApiKey: () => string | undefined;
}

export const defaultGenerationConfig: GenerationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

const saveSettingsToDB = async (settings: Partial<SettingsContextType>) => {
    const token = localStorage.getItem('token');
    if (!token) return; // Don't save if not logged in

    // Don't save API key to DB
    const { apiKey, ...settingsToSave } = settings;

    try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071/api'}/users/me/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settingsToSave),
        });
    } catch (error) {
        console.error("Failed to save settings to DB:", error);
    }
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [model, setModel] = useState<string>(AVAILABLE_MODELS[0]);
    const [ttsModel, setTtsModel] = useState<string>(AVAILABLE_TTS_MODELS[0]);
    const [imageModel, setImageModel] = useState<string>(AVAILABLE_IMAGE_MODELS[0]);
    const [ttsVoice, setTtsVoice] = useState<string>(AVAILABLE_TTS_VOICES[0]);
    const [apiKey, setApiKey] = useState<string>('');
    const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(defaultGenerationConfig);
    const [volume, setVolume] = useState(0.3);
    const [isMuted, setIsMuted] = useState(false);
    const [playMenuMusic, setPlayMenuMusic] = useState(true);

    const getApiKey = useCallback(() => {
        return apiKey || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    }, [apiKey]);

    // Load API Key from localStorage on initial mount
    useEffect(() => {
        try {
            const savedApiKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
            if (savedApiKey) {
                setApiKey(savedApiKey);
            }
        } catch (error) {
            console.error("Failed to load API key from localStorage:", error);
        }
    }, []);
    
    // Persist API Key to localStorage when it changes
    useEffect(() => {
        if (isLoaded && apiKey) { // Only save after initial load and if there is a key
            try {
                localStorage.setItem(LOCAL_STORAGE_API_KEY, apiKey);
            } catch (error) {
                console.error("Failed to save API key to localStorage:", error);
            }
        }
    }, [apiKey, isLoaded]);


    // Function to load settings from AuthContext
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
        }
        setIsLoaded(true);
    }, []);

    // Save settings to DB when they change
    useEffect(() => {
        if(isLoaded) {
            const settingsToSave = { model, ttsModel, imageModel, generationConfig, ttsVoice, volume, isMuted, playMenuMusic };
            const handler = setTimeout(() => saveSettingsToDB(settingsToSave), 1000); // Debounce DB saves
            return () => clearTimeout(handler);
        }
    }, [model, ttsModel, imageModel, generationConfig, ttsVoice, volume, isMuted, playMenuMusic, isLoaded]);

    const value = { 
        isLoaded, loadSettings,
        model, setModel, 
        ttsModel, setTtsModel, 
        imageModel, setImageModel, 
        apiKey, setApiKey, 
        generationConfig, setGenerationConfig, 
        ttsVoice, setTtsVoice,
        volume, setVolume,
        isMuted, setIsMuted,
        playMenuMusic, setPlayMenuMusic,
        getApiKey,
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
