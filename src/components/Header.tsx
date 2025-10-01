'use client';
import React, { useState, useCallback, useRef } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import * as GeminiService from '@/services/geminiService';
import { User, Heart, Shield, Save, BrainCircuit, Loader2, Settings, Image as ImageIcon, Volume2, Dices, DoorOpen } from 'lucide-react';
import ActionModal from '@/components/ui/ActionModal';
import SettingsModal from './SettingsModal';
import { useSettingsContext } from '@/contexts/SettingsContext';
import Image from 'next/image';
import { textToSpeech } from '@/ai/flows/textToSpeech';
import { generateImage } from '@/ai/flows/generateImage';
import DiceTestModal from './DiceTestModal'; 
import { useAuth } from '@/contexts/AuthContext';


interface HeaderProps {
    returnToMenu: () => void;
}

const Header: React.FC<HeaderProps> = ({ returnToMenu }) => {
    const { character, saveGameToFile, getApiKey, isLoading, forceReload } = useGameStateContext();
    const { logout } = useAuth();
    const { model: selectedModel, imageModel: selectedImageModel, ttsModel, ttsVoice, generationConfig } = useSettingsContext();
    const [isTestingAi, setIsTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ title: string, message: string, success: boolean } | null>(null);
    const [showAiTestModal, setShowAiTestModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [showDiceTestModal, setShowDiceTestModal] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const closeAiTestModal = () => {
        setShowAiTestModal(false);
        setAiTestResult(null);
        setTestImageUrl(null);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
    };

    const handleTestAi = useCallback(async () => {
        setIsTestingAi(true);
        setAiTestResult(null);
        setTestImageUrl(null);
        try {
            const apiKey = getApiKey();
            const response = await GeminiService.testAiConnection(selectedModel, generationConfig, apiKey);
            if (!response) {
                 throw new Error("A IA não retornou uma resposta de texto.");
            }
            setAiTestResult({ title: 'Diagnóstico da IA', message: response, success: true });
        } catch (error: any) {
            const errorMessage = error.message || "Ocorreu um erro desconhecido ao testar a conexão com a IA.";
            setAiTestResult({ title: 'Erro de Conexão', message: errorMessage, success: false });
            console.error(error);
        } finally {
            setIsTestingAi(false);
            setShowAiTestModal(true);
        }
    }, [selectedModel, generationConfig, getApiKey]);

    const handleTestImageGen = useCallback(async () => {
        setIsGeneratingImage(true);
        setTestImageUrl(null);
        try {
            const apiKey = getApiKey();
            if (!apiKey) throw new Error("Chave de API não encontrada.");
            const prompt = "Dungeons and Dragons 5e style art, digital painting, cinematic lighting: A lone adventurer stands on a cliff overlooking a vast, misty valley at sunrise. A dragon circles in the distant sky. The scene should be inspiring, epic, and full of potential.";
            const response = await generateImage(prompt, selectedImageModel, apiKey);
            if (response?.imageUrl) {
                setTestImageUrl(response.imageUrl);
            } else {
                throw new Error("A geração de imagem falhou ou retornou um resultado vazio.");
            }
        } catch (error: any) {
             setAiTestResult(prev => ({...prev!, message: `Erro na geração de imagem: ${error.message}`}));
        } finally {
            setIsGeneratingImage(false);
        }
    }, [getApiKey, selectedImageModel]);

    const handleTestTts = useCallback(async () => {
        if (!aiTestResult?.message || !aiTestResult.success) return;
        setIsGeneratingAudio(true);
        try {
            const apiKey = getApiKey();
            if (!apiKey) throw new Error("Chave de API não encontrada.");
            const response = await textToSpeech(aiTestResult.message, ttsModel, ttsVoice, apiKey);
            if (response?.media && audioRef.current) {
                audioRef.current.src = response.media;
                audioRef.current.play();
            } else {
                throw new Error("A geração de áudio falhou.");
            }
        } catch (error: any) {
             setAiTestResult(prev => ({...prev!, message: `Erro no TTS: ${error.message}`}));
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [aiTestResult, getApiKey, ttsModel, ttsVoice]);


    if (!character) {
        return null; // Or a placeholder header
    }

    const { name, level, characterClass, hp } = character;
    const isInteractionDisabled = isLoading || isTestingAi;


    return (
        <>
            <div className="flex-shrink-0 bg-stone-900/50 backdrop-blur-sm p-3 rounded-lg border border-stone-700">
                <div className="flex justify-between items-start gap-3">
                    {/* Character Info */}
                    <div className="flex items-center gap-3 flex-grow">
                        <div className="w-10 h-10 bg-stone-700 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-stone-600">
                            <User className="h-6 w-6 text-stone-400"/>
                        </div>
                        <div className="flex-grow">
                            <div className="flex justify-between items-baseline">
                                <h2 className="font-bold text-lg text-stone-100 truncate">{name}</h2>
                                <div className="md:hidden flex items-center gap-1.5">
                                     <button 
                                        onClick={handleTestAi}
                                        disabled={isInteractionDisabled}
                                        className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                                        title="Testar Conexão com a IA"
                                    >
                                        {isTestingAi ? <Loader2 className="h-4 w-4 text-amber-300 animate-spin" /> : <BrainCircuit className="h-4 w-4 text-amber-300" />}
                                    </button>
                                     <button 
                                        onClick={saveGameToFile}
                                        disabled={isInteractionDisabled}
                                        className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                                        title="Salvar Jogo (Download)"
                                    >
                                        <Save className="h-4 w-4 text-amber-300" />
                                    </button>
                                    <button
                                        onClick={() => setShowSettingsModal(true)}
                                        disabled={isInteractionDisabled}
                                        className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                                        title="Configurações"
                                    >
                                        <Settings className="h-4 w-4 text-amber-300" />
                                    </button>
                                     <button
                                        onClick={() => setShowExitModal(true)}
                                        disabled={isInteractionDisabled}
                                        className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                                        title="Sair da Conta"
                                    >
                                        <DoorOpen className="h-4 w-4 text-amber-300" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-stone-400">
                                {characterClass} de Nível {level}
                            </p>
                        </div>
                    </div>

                    {/* Desktop Action Buttons */}
                    <div className="hidden md:flex items-center justify-end gap-2">
                         <button 
                            onClick={handleTestAi}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Testar Conexão com a IA"
                        >
                            {isTestingAi ? <Loader2 className="h-5 w-5 text-amber-300 animate-spin" /> : <BrainCircuit className="h-5 w-5 text-amber-300" />}
                        </button>
                        <button 
                            onClick={forceReload}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Restaurar Jogo / Descongelar"
                        >
                            <LogOut className="h-5 w-5 text-amber-300" />
                        </button>
                        <button 
                            onClick={saveGameToFile}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Salvar Jogo (Download)"
                        >
                            <Save className="h-5 w-5 text-amber-300" />
                        </button>
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Configurações"
                        >
                            <Settings className="h-5 w-5 text-amber-300" />
                        </button>
                         <button
                            onClick={() => setShowExitModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Sair da Conta"
                        >
                            <DoorOpen className="h-5 w-5 text-amber-300" />
                        </button>
                    </div>
                </div>

                {/* Stats - moved below name on all screen sizes */}
                <div className="flex items-center gap-4 justify-center mt-3">
                    <div className="text-center flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        <div>
                            <div className="text-xs text-red-400 font-semibold">VIDA</div>
                            <div className="font-mono font-bold text-lg text-stone-200">{hp.current} / {hp.max}</div>
                        </div>
                    </div>
                    <div className="text-center flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <div>
                            <div className="text-xs text-blue-400 font-semibold">CA</div>
                            <div className="font-mono font-bold text-lg text-stone-200">{character.ac.value}</div>
                        </div>
                    </div>
                </div>
            </div>


             {showAiTestModal && aiTestResult && (
                <ActionModal
                    isOpen={showAiTestModal}
                    title={aiTestResult.title}
                    onClose={closeAiTestModal}
                    actions={[{ text: "Fechar", onClick: closeAiTestModal, variant: 'primary'}]}
                >
                     <div className="space-y-4">
                        <p className={`whitespace-pre-wrap p-3 rounded-md border ${aiTestResult.success ? 'bg-stone-800 border-stone-700' : 'bg-red-900/40 border-red-700'} text-stone-300`}>
                            {aiTestResult.message}
                        </p>
                        {aiTestResult.success && (
                            <div className="space-y-4">
                                {testImageUrl && <Image src={testImageUrl} alt="Imagem de teste gerada" width={512} height={288} className="rounded-md border-2 border-amber-600/50 w-full h-auto" />}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    <button onClick={handleTestImageGen} disabled={isGeneratingImage} className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors disabled:opacity-50">
                                        {isGeneratingImage ? <Loader2 className="animate-spin h-5 w-5"/> : <ImageIcon className="h-5 w-5" />}
                                        Gerar Imagem
                                    </button>
                                    <button onClick={handleTestTts} disabled={isGeneratingAudio} className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors disabled:opacity-50">
                                         {isGeneratingAudio ? <Loader2 className="animate-spin h-5 w-5"/> : <Volume2 className="h-5 w-5" />}
                                        Ouvir Áudio
                                    </button>
                                    <button onClick={() => setShowDiceTestModal(true)} className="sm:col-span-2 lg:col-span-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors">
                                        <Dices className="h-5 w-5" />
                                        Testar Dados
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </ActionModal>
            )}
            
            {showExitModal && (
                <ActionModal
                    isOpen={showExitModal}
                    title="Sair da Aventura?"
                    onClose={() => setShowExitModal(false)}
                    actions={[
                        { text: "Cancelar", onClick: () => setShowExitModal(false), variant: 'secondary' },
                        { text: "Voltar ao Menu", onClick: returnToMenu, variant: 'primary' },
                        { text: "Sair da Conta (Logout)", onClick: logout, variant: 'destructive' }
                    ]}
                >
                    <p className="text-stone-300">Seu progresso é salvo automaticamente. Deseja voltar ao menu principal ou fazer logout completo?</p>
                </ActionModal>
            )}

             <audio ref={audioRef} className="hidden" />
             {showDiceTestModal && <DiceTestModal isOpen={showDiceTestModal} onClose={() => setShowDiceTestModal(false)} />}
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />
        </>
    );
};

export default Header;
