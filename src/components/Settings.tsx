'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsContext, AiSettings, AiProvider } from '@/contexts/SettingsContext';
import { Sparkles } from 'lucide-react';


const AI_MODELS: Record<AiProvider, { name: string, value: string }[]> = {
    google: [
        { name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
        { name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
        { name: 'Gemini 1.0 Pro', value: 'gemini-pro' },
    ],
    openai: [
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
    ],
    anthropic: [
        { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20240620' },
        { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
        { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
    ],
};


const SettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: AiSettings) => void;
    currentSettings: AiSettings;
}> = ({ isOpen, onClose, onSave, currentSettings }) => {
    const [provider, setProvider] = useState<AiProvider>(currentSettings.provider);
    const [model, setModel] = useState(currentSettings.model);
    const [apiKey, setApiKey] = useState(currentSettings.apiKey);
    
    // Update local state if the settings from context change (e.g., on first load)
    useEffect(() => {
        setProvider(currentSettings.provider);
        setModel(currentSettings.model);
        setApiKey(currentSettings.apiKey);
    }, [currentSettings]);

    if (!isOpen) return null;
    
    const handleSave = () => {
        onSave({ provider, model, apiKey });
        onClose();
    };

    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProvider = e.target.value as AiProvider;
        setProvider(newProvider);
        // Set to the first available model for the new provider
        setModel(AI_MODELS[newProvider][0].value);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
        >
            <div className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-md">
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-garamond text-amber-300 flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Configurações da IA
                    </h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <main className="p-6 space-y-4">
                    <p className="text-sm text-stone-400">
                        Selecione seu provedor de IA preferido. Se a chave de API for deixada em branco, o jogo usará uma configuração padrão.
                    </p>
                     <div>
                        <label htmlFor="ai-provider" className="block text-sm font-medium text-stone-300 mb-1">
                            Provedor
                        </label>
                        <select
                            id="ai-provider"
                            value={provider}
                            onChange={handleProviderChange}
                            className="w-full bg-stone-800/70 border border-stone-700 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            <option value="google">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic Claude</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="ai-model" className="block text-sm font-medium text-stone-300 mb-1">
                            Modelo
                        </label>
                        <select
                            id="ai-model"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-stone-800/70 border border-stone-700 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            {AI_MODELS[provider].map(m => (
                                <option key={m.value} value={m.value}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="api-key" className="block text-sm font-medium text-stone-300 mb-1">
                            Sua Chave de API (Opcional)
                        </label>
                        <input
                            type="password"
                            id="api-key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-stone-800/70 border border-stone-700 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                     <p className="text-xs text-stone-500 text-center">
                        Sua chave de API é salva apenas no seu navegador e nunca sai do seu computador.
                    </p>
                </main>
                <footer className="p-4 flex justify-end items-center gap-4 bg-stone-950/50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-md text-stone-200 bg-stone-700 hover:bg-stone-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-md text-stone-900 bg-amber-600 hover:bg-amber-700 transition-colors font-semibold"
                    >
                        Salvar e Recarregar
                    </button>
                </footer>
            </div>
        </div>
    );
};


const Settings: React.FC = () => {
    const { 
        settings, 
        isSettingsModalOpen, 
        saveSettings, 
        openSettingsModal, 
        closeSettingsModal 
    } = useSettingsContext();

    return (
        <>
            <button 
                onClick={openSettingsModal}
                className="fixed bottom-4 right-4 z-50 h-14 w-14 bg-stone-900/80 backdrop-blur-md border-2 border-amber-500/50 rounded-full flex items-center justify-center text-amber-400 hover:bg-stone-800 hover:border-amber-500 transition-all shadow-lg"
                title="Configurações da IA"
            >
                <Sparkles className="h-7 w-7" />
            </button>
            <SettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={closeSettingsModal}
                onSave={saveSettings}
                currentSettings={settings}
            />
        </>
    );
};

export default Settings;
