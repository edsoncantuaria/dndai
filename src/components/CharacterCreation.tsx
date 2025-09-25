'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import * as DndApiService from '@/services/dndApiService';
import * as GeminiService from '@/services/geminiService';
import type { ApiListItem } from '@/types';
import CharacterCreationMenu from './creation/CharacterCreationMenu';
import NewCharacterCreation from './NewCreationCharacter/NewCharacterCreation';
import ActionModal from '@/components/ui/ActionModal';
import SettingsModal from './SettingsModal';
import { BrainCircuit, Loader2, Settings, Image as ImageIcon, Volume2 } from 'lucide-react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { generateImage } from '@/ai/flows/generateImage';
import { textToSpeech } from '@/ai/flows/textToSpeech';
import Image from 'next/image';

interface CharacterCreationProps {
  startNewGameFlow: () => void;
  onCharacterCreated: () => void;
  onContinueGame: () => void;
  isCreating: boolean;
}

const CharacterCreation: React.FC<CharacterCreationProps> = ({ startNewGameFlow, onCharacterCreated, onContinueGame, isCreating }) => {
    const { isLoading, character, checkForSavedGame, loadGameFromFile, getApiKey } = useGameStateContext();
    const { model: selectedModel, imageModel: selectedImageModel, ttsModel, ttsVoice, generationConfig } = useSettingsContext();
    const [hasSavedGame, setHasSavedGame] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    
    // State for AI Test
    const [showAiTestModal, setShowAiTestModal] = useState(false);
    const [isTestingAi, setIsTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ title: string, message: string, success: boolean } | null>(null);
    const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);


    useEffect(() => {
        setHasSavedGame(checkForSavedGame());
    }, [checkForSavedGame]);


    useEffect(() => {
        const loadInitialData = async () => {
            setIsDataLoading(true);
            try {
                const racesData = await DndApiService.getRaces();
                setRaces(racesData?.results || []);
                const classesData = await DndApiService.getClasses();
                setClasses(classesData?.results || []);
                const backgroundsData = await DndApiService.getBackgrounds();
                setBackgrounds(backgroundsData?.results || []);
                const alignmentsData = await DndApiService.getAlignments();
                setAlignments(alignmentsData?.results || []);
                const languagesData = await DndApiService.getLanguages();
                setAllLanguages(languagesData?.results || []);
            } catch (error) {
                console.error("Failed to load initial creation data:", error);
                setFormError("Falha ao carregar dados essenciais. Por favor, tente recarregar a página.");
            } finally {
                setIsDataLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const handleNewGame = () => {
        if (hasSavedGame) {
             setShowConfirmationModal(true);
        } else {
            startNewGameFlow();
        }
    };

    const confirmNewGame = () => {
        startNewGameFlow();
        setShowConfirmationModal(false);
    }

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


    // Data Fetching State
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [races, setRaces] = useState<ApiListItem[]>([]);
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [backgrounds, setBackgrounds] = useState<ApiListItem[]>([]);
    const [alignments, setAlignments] = useState<ApiListItem[]>([]);
    const [allLanguages, setAllLanguages] = useState<ApiListItem[]>([]);
    
    // --- Render Logic ---
    if (isLoading && !character) { 
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400 text-center">
                <Loader2 className="h-12 w-12 animate-spin" />
                <p className="mt-4 text-lg">Forjando seu destino nas chamas da criação...</p>
            </div>
        );
    }
    
    if (!isCreating) {
        return (
            <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center text-center">
                 <header className="mb-12 animate-fadeIn" style={{ animationDelay: '200ms' }}>
                    <h1 
                      className="text-5xl md:text-7xl font-bold text-amber-50"
                      style={{ textShadow: '0 0 15px rgba(239, 68, 68, 0.4), 0 0 5px rgba(239, 68, 68, 0.6)' }}
                    >
                        Crônicas de Aventuras
                    </h1>
                    <p className="text-stone-400 mt-2 text-lg">Um RPG de texto gerado por IA</p>
                </header>
                <main className="w-full animate-fadeIn" style={{ animationDelay: '400ms' }}>
                    <CharacterCreationMenu
                        hasSavedGame={hasSavedGame}
                        onNewGame={handleNewGame}
                        onLoadGame={onContinueGame}
                        onImportFile={loadGameFromFile}
                    />
                    <div className="mt-6 flex justify-center items-center gap-4">
                         <button
                            onClick={handleTestAi}
                            disabled={isTestingAi}
                            className="menu-button btn-import text-sm max-w-xs"
                        >
                            {isTestingAi ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <BrainCircuit className="h-5 w-5 mr-2"/>}
                            {isTestingAi ? 'Testando...' : 'Testar IA'}
                        </button>
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="p-3 rounded-full bg-stone-700/80 hover:bg-stone-600 transition-colors"
                            title="Configurações"
                        >
                            <Settings className="h-6 w-6 text-amber-300" />
                        </button>
                    </div>
                     {showConfirmationModal && (
                        <ActionModal
                            isOpen={showConfirmationModal}
                            title="Iniciar Novo Jogo?"
                            onClose={() => setShowConfirmationModal(false)}
                            actions={[
                                { text: "Não, voltar", onClick: () => setShowConfirmationModal(false), variant: 'secondary'},
                                { text: "Sim, começar de novo", onClick: confirmNewGame, variant: 'destructive'}
                            ]}
                        >
                            <p className="text-stone-300">Tem certeza que deseja iniciar um novo jogo? Todo o progresso salvo será perdido permanentemente.</p>
                        </ActionModal>
                     )}
                     {showAiTestModal && aiTestResult && (
                        <ActionModal
                            isOpen={showAiTestModal}
                            title={aiTestResult.title}
                            onClose={closeAiTestModal}
                            actions={[
                                { text: "Fechar", onClick: closeAiTestModal, variant: 'primary'}
                            ]}
                        >
                            <div className="space-y-4">
                                <p className={`whitespace-pre-wrap p-3 rounded-md border ${aiTestResult.success ? 'bg-stone-800 border-stone-700' : 'bg-red-900/40 border-red-700'} text-stone-300`}>
                                    {aiTestResult.message}
                                </p>
                                {aiTestResult.success && (
                                    <div className="space-y-4">
                                         {testImageUrl && <Image src={testImageUrl} alt="Imagem de teste gerada" width={512} height={288} className="rounded-md border-2 border-amber-600/50 w-full h-auto" />}
                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={handleTestImageGen} disabled={isGeneratingImage} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors disabled:opacity-50">
                                                {isGeneratingImage ? <Loader2 className="animate-spin h-5 w-5"/> : <ImageIcon className="h-5 w-5" />}
                                                Gerar Imagem
                                            </button>
                                            <button onClick={handleTestTts} disabled={isGeneratingAudio} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors disabled:opacity-50">
                                                 {isGeneratingAudio ? <Loader2 className="animate-spin h-5 w-5"/> : <Volume2 className="h-5 w-5" />}
                                                Ouvir Áudio
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ActionModal>
                     )}
                     <audio ref={audioRef} className="hidden" />
                     <SettingsModal 
                        isOpen={showSettingsModal}
                        onClose={() => setShowSettingsModal(false)}
                     />
                </main>
            </div>
        );
    }

     if (isDataLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400">
                <Loader2 className="h-12 w-12 animate-spin" />
                <p className="mt-4">Carregando tomos antigos...</p>
            </div>
        );
    }

    return (
        <NewCharacterCreation
            races={races}
            classes={classes}
            backgrounds={backgrounds}
            alignments={alignments}
            allLanguages={allLanguages}
            onCharacterCreated={onCharacterCreated}
        />
    );
};

export default CharacterCreation;
