'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Lista de modelos disponíveis
export const AVAILABLE_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-8b"
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
    const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(defaultGenerationConfig);

    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                if (parsed.model && AVAILABLE_MODELS.includes(parsed.model)) {
                    setModel(parsed.model);
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
                const settings = { model, generationConfig };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
            } catch (error) {
                console.error("Failed to save settings to localStorage:", error);
            }
        }
    }, [model, generationConfig, isLoaded]);

    const value = { model, setModel, generationConfig, setGenerationConfig };

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
