'use client';
import React, { useState, useCallback } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import * as GeminiService from '@/services/geminiService';
import { User, Heart, Shield, Save, BrainCircuit, Loader2 } from 'lucide-react';
import ConfirmationModal from './ui/ConfirmationModal';

const Header: React.FC = () => {
    const { character, saveGameToFile } = useGameStateContext();
    const [isTestingAi, setIsTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ title: string, message: string } | null>(null);
    const [showAiTestModal, setShowAiTestModal] = useState(false);


    const handleTestAi = useCallback(async () => {
        setIsTestingAi(true);
        setAiTestResult(null);
        try {
            const response = await GeminiService.testAiConnection();
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
    }, []);

    if (!character) {
        return null; // Or a placeholder header
    }

    const { name, level, characterClass, hp } = character;

    return (
        <>
            <div className="flex-shrink-0 bg-stone-900/50 backdrop-blur-sm p-2 rounded-lg border border-stone-700 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-stone-700 rounded-full flex items-center justify-center border-2 border-stone-600">
                        <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-stone-400"
            >
              <path d="M12 2L2 8.5V15.5L12 22L22 15.5V8.5L12 2Z" />
              <path d="M2 8.5L12 12L22 8.5" />
              <path d="M12 2V12" />
              <path d="M17 5.5L7 10.5" />
              <path d="M17 18.5L7 13.5" />
            </svg>
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
        </>
    );
};

export default Header;
