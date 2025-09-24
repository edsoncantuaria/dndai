'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LOCAL_STORAGE_KEY = 'rpg-ai-settings';

export type AiProvider = 'google' | 'openai' | 'anthropic';

export interface AiSettings {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export interface SettingsContextType {
  settings: AiSettings;
  isSettingsModalOpen: boolean;
  saveSettings: (newSettings: AiSettings) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

const defaultSettings: AiSettings = {
  provider: 'google',
  model: 'googleai/gemini-pro',
  apiKey: '',
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AiSettings>(defaultSettings);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // Ensure provider and model fields exist to avoid breaking old saves
        if (parsedSettings.provider && parsedSettings.model) {
            setSettings(parsedSettings);
        }
      }
    } catch (error) {
      console.error("Failed to load AI settings from local storage:", error);
    }
  }, []);

  const saveSettings = useCallback((newSettings: AiSettings) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      console.log("Settings saved! Reloading to apply...");
      window.location.reload();
    } catch (error) {
      console.error("Failed to save AI settings to local storage:", error);
    }
  }, []);
  
  const openSettingsModal = () => setIsSettingsModalOpen(true);
  const closeSettingsModal = () => setIsSettingsModalOpen(false);

  return (
    <SettingsContext.Provider value={{ settings, isSettingsModalOpen, saveSettings, openSettingsModal, closeSettingsModal }}>
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
