'use client';

import React, { ChangeEvent, useEffect, useState } from 'react';
import { useSettingsContext, AVAILABLE_MODELS, AVAILABLE_TTS_MODELS, AVAILABLE_IMAGE_MODELS, GenerationConfig, AVAILABLE_TTS_VOICES } from '../contexts/SettingsContext';
import { Info, KeyRound, Volume2, VolumeX, FlaskConical } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SliderProps {
    id: keyof GenerationConfig | 'volume';
    label: string;
    tooltip: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

const Slider: React.FC<SliderProps> = ({ id, label, tooltip, value, min, max, step, onChange }) => (
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

const AudioControls: React.FC = () => {
    const { volume, setVolume, isMuted, setIsMuted, playMenuMusic, setPlayMenuMusic } = useSettingsContext();

    return (
         <div className="space-y-4 pt-4 border-t border-stone-700/50">
            <h3 className="text-lg font-semibold text-stone-300">Áudio</h3>
            <div className="flex items-center gap-3">
                 <button onClick={() => setIsMuted(m => !m)} className="text-stone-300 hover:text-white p-2 rounded-full bg-stone-700/50 hover:bg-stone-600/50 transition-colors">
                    {isMuted ? <VolumeX size={20}/> : <Volume2 size={20} />}
                </button>
                 <Slider 
                    id="volume"
                    label="Volume Geral"
                    tooltip="Ajusta o volume da narração e dos sons de ambiente no jogo."
                    value={Math.round(volume * 100)}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                />
            </div>
            <div className="flex items-center justify-between bg-stone-800/50 p-3 rounded-md">
                <label htmlFor="menu-music-toggle" className="text-stone-300">Música da Tela Principal</label>
                <button
                    id="menu-music-toggle"
                    onClick={() => setPlayMenuMusic(p => !p)}
                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 ${playMenuMusic ? 'bg-amber-600' : 'bg-stone-600'}`}
                >
                    <span
                        aria-hidden="true"
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${playMenuMusic ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                </button>
            </div>
        </div>
    )
}


const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { 
        model, setModel, 
        ttsModel, setTtsModel, 
        imageModel, setImageModel, 
        ttsVoice, setTtsVoice, 
        apiKey, setApiKey, 
        generationConfig, setGenerationConfig,
        useAiHomebrew, setUseAiHomebrew
    } = useSettingsContext();
    
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
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-garamond text-amber-300">Configurações</h2>
                    <button onClick={handleSaveAndClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <main className="p-6 space-y-6 overflow-y-auto">
                     <div>
                        <div className="flex justify-between items-center mb-2">
                           <label htmlFor="api-key-input" className="text-stone-300 font-semibold flex items-center gap-2">
                              <KeyRound className="h-4 w-4"/> Chave de API do Google AI
                           </label>
                           <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 underline">
                              Como Obter?
                           </a>
                        </div>
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

                    <AudioControls />

                    <div className="space-y-4 pt-4 border-t border-stone-700/50">
                        <h3 className="text-lg font-semibold text-stone-300">Homebrew e IA</h3>
                         <div className="flex items-center justify-between bg-stone-800/50 p-3 rounded-md">
                            <label htmlFor="ai-homebrew-toggle" className="flex flex-col cursor-pointer">
                                <span className="font-semibold text-stone-300 flex items-center gap-2">
                                    <FlaskConical className="h-4 w-4 text-purple-400" />
                                    Usar Homebrew da IA
                                </span>
                                <span className="text-xs text-stone-400">Permitir que a IA crie e reutilize itens, NPCs e locais em suas sessões.</span>
                            </label>
                            <button
                                id="ai-homebrew-toggle"
                                onClick={() => setUseAiHomebrew(p => !p)}
                                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 ${useAiHomebrew ? 'bg-amber-600' : 'bg-stone-600'}`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${useAiHomebrew ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>
                    </div>


                    <div className="space-y-4 pt-4 border-t border-stone-700/50">
                        <h3 className="text-lg font-semibold text-stone-300">Modelos de IA</h3>
                         <div>
                            <label htmlFor="ai-model-select" className="block text-stone-300 font-semibold mb-2">
                                Modelo do Mestre
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
                        </div>
                        
                        <div>
                            <label htmlFor="tts-model-select" className="block text-stone-300 font-semibold mb-2">
                                Modelo de Voz (TTS)
                            </label>
                            <select
                                id="tts-model-select"
                                value={ttsModel}
                                onChange={(e) => setTtsModel(e.target.value)}
                                className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            >
                                {AVAILABLE_TTS_MODELS.map(modelName => (
                                    <option key={modelName} value={modelName}>
                                        {modelName}
                                    </option>
                                ))}
                            </select>
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
                        </div>
                    </div>


                    <div className="space-y-4 pt-4 border-t border-stone-700/50">
                         <h3 className="text-lg font-semibold text-stone-300">Parâmetros da IA</h3>
                        <Slider 
                            id="temperature"
                            label="Temperatura"
                            tooltip="A 'Inspiração' do Mestre. Valores altos o tornam mais criativo e imprevisível. Valores baixos o mantêm mais focado e direto."
                            value={generationConfig.temperature}
                            min={0} max={1} step={0.05}
                            onChange={handleConfigChange}
                        />
                         <Slider 
                            id="topP"
                            label="Top-P"
                            tooltip="A 'Confiança' do Mestre. Um valor alto permite que ele considere palavras mais ousadas e incomuns. Um valor baixo o limita às palavras mais seguras e prováveis."
                            value={generationConfig.topP}
                            min={0} max={1} step={0.05}
                            onChange={handleConfigChange}
                        />
                         <Slider 
                            id="topK"
                            label="Top-K"
                            tooltip="O 'Foco' do Mestre. Limita o número de palavras que ele considera a cada passo. Um valor baixo o torna mais repetitivo e previsível; um valor alto aumenta a variedade."
                            value={generationConfig.topK}
                            min={1} max={100} step={1}
                            onChange={handleConfigChange}
                        />
                         <Slider 
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
