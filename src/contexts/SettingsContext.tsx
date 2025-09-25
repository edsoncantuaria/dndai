'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Lista de modelos disponíveis
export const AVAILABLE_MODELS = [
    "gemini-2.5-pro",
    "gemini-1.5-pro",        
    "gemini-2.5-flash",     
    "gemini-1.5-flash",     
    "gemini-1.5-flash-8b",   
    "gemini-2.0-flash-lite", 
    "gemini-1.0-pro",
    "gemma-7b",
    "gemini-latest"         
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
    "gemini-2.5-flash-image-preview",
    "imagen-4.0-fast-generate-001",
    "image-generation-002"
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


const LOCAL_STORAGE_KEY = 'rpg-settings';

interface SettingsContextType {
    model: string;
    setModel: (model: string) => void;
    ttsModel: string;
    setTtsModel: (model: string) => void;
    imageModel: string;
    setImageModel: (model: string) => void;
    ttsVoice: string; // NEW
    setTtsVoice: (voice: string) => void; // NEW
    apiKey: string;
    setApiKey: (key: string) => void;
    generationConfig: GenerationConfig;
    setGenerationConfig: (config: GenerationConfig | ((prev: GenerationConfig) => GenerationConfig)) => void;
}

const defaultGenerationConfig: GenerationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [model, setModel] = useState<string>(AVAILABLE_MODELS[0]);
    const [ttsModel, setTtsModel] = useState<string>(AVAILABLE_TTS_MODELS[0]);
    const [imageModel, setImageModel] = useState<string>(AVAILABLE_IMAGE_MODELS[0]);
    const [ttsVoice, setTtsVoice] = useState<string>(AVAILABLE_TTS_VOICES[0]); // NEW
    const [apiKey, setApiKey] = useState<string>('');
    const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(defaultGenerationConfig);

    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                if (parsed.model && AVAILABLE_MODELS.includes(parsed.model)) {
                    setModel(parsed.model);
                }
                 if (parsed.ttsModel && AVAILABLE_TTS_MODELS.includes(parsed.ttsModel)) {
                    setTtsModel(parsed.ttsModel);
                }
                if (parsed.imageModel && AVAILABLE_IMAGE_MODELS.includes(parsed.imageModel)) {
                    setImageModel(parsed.imageModel);
                }
                 if (parsed.ttsVoice && AVAILABLE_TTS_VOICES.includes(parsed.ttsVoice)) { // NEW
                    setTtsVoice(parsed.ttsVoice);
                }
                if(parsed.apiKey) {
                    setApiKey(parsed.apiKey);
                }
                if (parsed.generationConfig) {
                    setGenerationConfig(prev => ({ ...prev, ...parsed.generationConfig }));
                }
            }
        } catch (error) {
            console.error("Failed to load settings from localStorage:", error);
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if(isLoaded) {
            try {
                const settings = { model, ttsModel, imageModel, apiKey, generationConfig, ttsVoice }; // NEW
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
            } catch (error) {
                console.error("Failed to save settings to localStorage:", error);
            }
        }
    }, [model, ttsModel, imageModel, apiKey, generationConfig, ttsVoice, isLoaded]); // NEW

    const value = { model, setModel, ttsModel, setTtsModel, imageModel, setImageModel, apiKey, setApiKey, generationConfig, setGenerationConfig, ttsVoice, setTtsVoice }; // NEW

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
