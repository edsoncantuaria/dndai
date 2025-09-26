'use client';

import React, { ChangeEvent, useEffect, useState } from 'react';
import { useSettingsContext, AVAILABLE_MODELS, AVAILABLE_TTS_MODELS, AVAILABLE_IMAGE_MODELS, GenerationConfig, AVAILABLE_TTS_VOICES } from '../contexts/SettingsContext';
import { Info, KeyRound } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SliderWithTooltipProps {
    id: keyof GenerationConfig;
    label: string;
    tooltip: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

const SliderWithTooltip: React.FC<SliderWithTooltipProps> = ({ id, label, tooltip, value, min, max, step, onChange }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <label htmlFor={id} className="text-stone-300 font-semibold flex items-center gap-2">
                {label}
                <div className="relative group">
                    <Info className="h-4 w-4 text-stone-500 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-stone-950 text-stone-300 text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg border border-stone-700">
                        {tooltip}
                    </div>
                </div>
            </label>
            <span className="font-mono text-amber-300">{value}</span>
        </div>
        <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onChange}
            className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer"
        />
    </div>
);


const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { model, setModel, ttsModel, setTtsModel, imageModel, setImageModel, ttsVoice, setTtsVoice, apiKey, setApiKey, generationConfig, setGenerationConfig } = useSettingsContext();
    
    if (!isOpen) return null;
    
    const handleConfigChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setGenerationConfig(prev => ({
            ...prev,
            [id]: Number(value),
        }));
    };

    const handleSaveAndClose = () => {
        onClose();
    }

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
            onClick={handleSaveAndClose}
        >
            <div 
                className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()} // Impede o fechamento ao clicar dentro do modal
            >
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-garamond text-amber-300">Configurações</h2>
                    <button onClick={handleSaveAndClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <main className="p-6 space-y-6 overflow-y-auto">
                     <div>
                        <label htmlFor="api-key-input" className="block text-stone-300 font-semibold mb-2 flex items-center gap-2">
                           <KeyRound className="h-4 w-4"/> Chave de API do Google AI
                        </label>
                         <input
                            id="api-key-input"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Cole sua chave aqui"
                            className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                         <p className="text-xs text-stone-500 mt-2">
                            Sua chave é salva localmente no seu navegador. Se não for fornecida, o jogo tentará usar uma chave de ambiente.
                        </p>
                    </div>

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
                    
                     <div>
                        <label htmlFor="tts-voice-select" className="block text-stone-300 font-semibold mb-2">
                            Voz do Narrador (TTS)
                        </label>
                        <select
                            id="tts-voice-select"
                            value={ttsVoice}
                            onChange={(e) => setTtsVoice(e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            {AVAILABLE_TTS_VOICES.map(voiceName => (
                                <option key={voiceName} value={voiceName}>
                                    {voiceName}
                                </option>
                            ))}
                        </select>
                         <p className="text-xs text-stone-500 mt-2">
                           A mudança da voz será aplicada na próxima narração gerada.
                        </p>
                    </div>

                     <div>
                        <label htmlFor="image-model-select" className="block text-stone-300 font-semibold mb-2">
                            Modelo de Geração de Imagem
                        </label>
                        <select
                            id="image-model-select"
                            value={imageModel}
                            onChange={(e) => setImageModel(e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            {AVAILABLE_IMAGE_MODELS.map(modelName => (
                                <option key={modelName} value={modelName}>
                                    {modelName}
                                </option>
                            ))}
                        </select>
                         <p className="text-xs text-stone-500 mt-2">
                           A mudança do modelo de imagem será aplicada na próxima imagem gerada.
                        </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-stone-700/50">
                         <h3 className="text-lg font-semibold text-stone-300">Parâmetros da IA</h3>
                        <SliderWithTooltip 
                            id="temperature"
                            label="Temperatura"
                            tooltip="A 'Inspiração' do Mestre. Valores altos o tornam mais criativo e imprevisível. Valores baixos o mantêm mais focado e direto."
                            value={generationConfig.temperature}
                            min={0} max={1} step={0.05}
                            onChange={handleConfigChange}
                        />
                         <SliderWithTooltip 
                            id="topP"
                            label="Top-P"
                            tooltip="A 'Confiança' do Mestre. Um valor alto permite que ele considere palavras mais ousadas e incomuns. Um valor baixo o limita às palavras mais seguras e prováveis."
                            value={generationConfig.topP}
                            min={0} max={1} step={0.05}
                            onChange={handleConfigChange}
                        />
                         <SliderWithTooltip 
                            id="topK"
                            label="Top-K"
                            tooltip="O 'Foco' do Mestre. Limita o número de palavras que ele considera a cada passo. Um valor baixo o torna mais repetitivo e previsível; um valor alto aumenta a variedade."
                            value={generationConfig.topK}
                            min={1} max={100} step={1}
                            onChange={handleConfigChange}
                        />
                         <SliderWithTooltip 
                            id="maxOutputTokens"
                            label="Tamanho da Resposta"
                            tooltip="O 'Fôlego' do Mestre. Define o quão longas e detalhadas suas respostas podem ser. Valores altos permitem narrativas épicas, mas podem levar mais tempo."
                            value={generationConfig.maxOutputTokens}
                            min={2048} max={8192} step={256}
                            onChange={handleConfigChange}
                        />
                    </div>

                </main>
                <footer className="p-4 flex justify-end items-center gap-4 bg-stone-950/50 rounded-b-lg">
                    <button
                        onClick={handleSaveAndClose}
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
