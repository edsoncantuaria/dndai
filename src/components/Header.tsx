'use client';
import React, { useState, useCallback } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import * as GeminiService from '@/services/geminiService';
import { User, Heart, Shield, Save, BrainCircuit, Loader2, Settings } from 'lucide-react';
import ConfirmationModal from './ui/ConfirmationModal';
import SettingsModal from './SettingsModal';
import { useSettingsContext } from '@/contexts/SettingsContext';

const Header: React.FC = () => {
    const { character, saveGameToFile } = useGameStateContext();
    const { model: selectedModel, generationConfig, apiKey: userApiKey } = useSettingsContext();
    const [isTestingAi, setIsTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ title: string, message: string } | null>(null);
    const [showAiTestModal, setShowAiTestModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);


    const handleTestAi = useCallback(async () => {
        setIsTestingAi(true);
        setAiTestResult(null);
        try {
            const apiKeyToUse = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || userApiKey;
            const response = await GeminiService.testAiConnection(selectedModel, generationConfig, apiKeyToUse);
            if (!response) {
                 throw new Error("A IA não retornou uma resposta.");
            }
            setAiTestResult({ title: 'Resposta da IA', message: response });
        } catch (error: any) {
            const errorMessage = error.message || "Ocorreu um erro desconhecido ao testar a conexão com a IA.";
            setAiTestResult({ title: 'Erro de Conexão', message: errorMessage });
            console.error(error);
        } finally {
            setIsTestingAi(false);
            setShowAiTestModal(true);
        }
    }, [selectedModel, generationConfig, userApiKey]);

    if (!character) {
        return null; // Or a placeholder header
    }

    const { name, level, characterClass, hp } = character;

    return (
        <>
            <div className="flex-shrink-0 bg-stone-900/50 backdrop-blur-sm p-2 rounded-lg border border-stone-700 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-stone-700 rounded-full flex items-center justify-center border-2 border-stone-600">
                        <svg fill="#e5e7eb" viewBox="-16 0 512 512" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-stone-400"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M106.75 215.06L1.2 370.95c-3.08 5 .1 11.5 5.93 12.14l208.26 22.07-108.64-190.1zM7.41 315.43L82.7 193.08 6.06 147.1c-2.67-1.6-6.06.32-6.06 3.43v162.81c0 4.03 5.29 5.53 7.41 2.09zM18.25 423.6l194.4 87.66c5.3 2.45 11.35-1.43 11.35-7.26v-65.67l-203.55-22.3c-4.45-.5-6.23 5.59-2.2 7.57zm81.22-257.78L179.4 22.88c4.34-7.06-3.59-15.25-10.78-11.14L17.81 110.35c-2.47 1.62-2.39 5.26.13 6.78l81.53 48.69zM240 176h109.21L253.63 7.62C250.5 2.54 245.25 0 240 0s-10.5 2.54-13.63 7.62L130.79 176H240zm233.94-28.9l-76.64 45.99 75.29 122.35c2.11 3.44 7.41 1.94 7.41-2.1V150.53c0-3.11-3.39-5.03-6.06-3.43zm-93.41 18.72l81.53-48.7c2.53-1.52 2.6-5.16.13-6.78l-150.81-98.6c-7.19-4.11-15.12 4.08-10.78 11.14l79.93 142.94zm79.02 250.21L256 438.32v65.67c0 5.84 6.05 9.71 11.35 7.26l194.4-87.66c4.03-1.97 2.25-8.06-2.2-7.56zm-86.3-200.97l-108.63 190.1 208.26-22.07c5.83-.65 9.01-7.14 5.93-12.14L373.25 215.06zM240 208H139.57L240 383.75 340.43 208H240z"></path></g></svg>
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-stone-100">{name}</h2>
                        <p className="text-sm text-stone-400">
                            {characterClass} de Nível {level}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-center flex items-center gap-2">
                        <Heart className="h-6 w-6 text-red-500" />
                        <div>
                            <div className="text-xs text-red-400 font-semibold">VIDA</div>
                            <div className="font-mono font-bold text-xl text-stone-200">{hp.current} / {hp.max}</div>
                        </div>
                    </div>
                    <div className="text-center flex items-center gap-2">
                        <Shield className="h-6 w-6 text-blue-500" />
                        <div>
                            <div className="text-xs text-blue-400 font-semibold">CA</div>
                            <div className="font-mono font-bold text-xl text-stone-200">{character.ac.value}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleTestAi}
                            disabled={isTestingAi}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors"
                            title="Testar Conexão com a IA"
                        >
                            {isTestingAi ? <Loader2 className="h-6 w-6 text-amber-300 animate-spin" /> : <BrainCircuit className="h-6 w-6 text-amber-300" />}
                        </button>
                        <button 
                            onClick={saveGameToFile}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors"
                            title="Salvar Jogo (Download)"
                        >
                            <Save className="h-6 w-6 text-amber-300" />
                        </button>
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors"
                            title="Configurações"
                        >
                            <Settings className="h-6 w-6 text-amber-300" />
                        </button>
                    </div>
                </div>
            </div>
             {aiTestResult && (
                <ConfirmationModal
                    isOpen={showAiTestModal}
                    title={aiTestResult.title}
                    message={aiTestResult.message}
                    onConfirm={() => setShowAiTestModal(false)}
                    confirmText="OK"
                />
            )}
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />
        </>
    );
};

export default Header;
