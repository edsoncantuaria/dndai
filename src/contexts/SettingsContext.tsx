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

const LOCAL_STORAGE_KEY = 'rpg-settings';

interface SettingsContextType {
    model: string;
    setModel: (model: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [model, setModel] = useState<string>(() => {
        if (typeof window === 'undefined') {
            return AVAILABLE_MODELS[0];
        }
        try {
            const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // Garante que o modelo salvo ainda é válido
                if (AVAILABLE_MODELS.includes(parsed.model)) {
                    return parsed.model;
                }
            }
        } catch (error) {
            console.error("Failed to load settings from localStorage:", error);
        }
        return AVAILABLE_MODELS[0];
    });

    useEffect(() => {
        try {
            const settings = { model };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save settings to localStorage:", error);
        }
    }, [model]);

    const value = { model, setModel };

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
