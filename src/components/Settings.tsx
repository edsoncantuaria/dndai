'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsContext, AiSettings } from '@/contexts/SettingsContext';
import { Icons } from './Icons';

const SettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: AiSettings) => void;
    currentSettings: AiSettings;
}> = ({ isOpen, onClose, onSave, currentSettings }) => {
    const [apiKey, setApiKey] = useState(currentSettings.apiKey);
    const [provider, setProvider] = useState(currentSettings.provider);
    const [model, setModel] = useState(currentSettings.model);

    useEffect(() => {
        setApiKey(currentSettings.apiKey);
        setProvider(currentSettings.provider);
        setModel(currentSettings.model);
    }, [currentSettings]);

    if (!isOpen) return null;
    
    const handleSave = () => {
        onSave({ provider, model, apiKey });
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
        >
            <div className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-md">
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-garamond text-amber-300 flex items-center gap-2">
                        <Icons.Sparkles className="h-5 w-5" />
                        Configurações da IA
                    </h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <main className="p-6 space-y-4">
                    <p className="text-sm text-stone-400">
                        Opcionalmente, insira sua própria chave de API para usar seu provedor de IA preferido. Se deixado em branco, o jogo usará uma configuração padrão.
                    </p>
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
                <Icons.Sparkles className="h-7 w-7" />
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
