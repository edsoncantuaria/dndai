'use client';

import React from 'react';
import { useSettingsContext, AVAILABLE_MODELS } from '../contexts/SettingsContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { model, setModel } = useSettingsContext();

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
            onClick={onClose}
        >
            <div 
                className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()} // Impede o fechamento ao clicar dentro do modal
            >
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-garamond text-amber-300">Configurações</h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <main className="p-6 space-y-4">
                    <div>
                        <label htmlFor="ai-model-select" className="block text-stone-300 font-semibold mb-2">
                            Modelo de IA do Mestre
                        </label>
                        <select
                            id="ai-model-select"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            {AVAILABLE_MODELS.map(modelName => (
                                <option key={modelName} value={modelName}>
                                    {modelName}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-stone-500 mt-2">
                            A mudança de modelo será aplicada na próxima ação enviada ao mestre.
                        </p>
                    </div>
                </main>
                <footer className="p-4 flex justify-end items-center gap-4 bg-stone-950/50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-md font-semibold text-stone-900 bg-amber-600 hover:bg-amber-700 transition-colors"
                    >
                        Fechar
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SettingsModal;
