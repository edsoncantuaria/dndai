
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import * as DndApiService from '@/services/dndApiService';
import * as GameService from '@/services/gameService';
import type { ApiListItem } from '@/types';
import NewCharacterCreation from './NewCreationCharacter/NewCharacterCreation';
import ActionModal from '@/components/ui/ActionModal';
import SettingsModal from './SettingsModal';
import { BrainCircuit, Loader2, Settings, Image as ImageIcon, Volume2, Dices, LogOut } from 'lucide-react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { generateImage } from '@/ai/flows/generateImage';
import { textToSpeech } from '@/ai/flows/textToSpeech';
import Image from 'next/image';
import DiceTestModal from './DiceTestModal';
import { useAuth } from '@/contexts/AuthContext';


interface CharacterCreationProps {
  startNewGameFlow: () => void;
  onCharacterCreated: () => void;
  isCreating: boolean;
}

const CharacterCreation: React.FC<CharacterCreationProps> = ({ startNewGameFlow, onCharacterCreated, isCreating }) => {
    const { isLoading } = useGameStateContext();
    const { user, logout } = useAuth();
    const { model: selectedModel, imageModel: selectedImageModel, ttsModel, ttsVoice, apiKey } = useSettingsContext();
    const [formError, setFormError] = useState<string | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    
    // State for AI Test
    const [showAiTestModal, setShowAiTestModal] = useState(false);
    const [isTestingAi, setIsTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ title: string, message: string, success: boolean } | null>(null);
    const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [showDiceTestModal, setShowDiceTestModal] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Data Fetching State
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [races, setRaces] = useState<ApiListItem[]>([]);
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [backgrounds, setBackgrounds] = useState<ApiListItem[]>([]);
    const [alignments, setAlignments] = useState<ApiListItem[]>([]);
    const [allLanguages, setAllLanguages] = useState<ApiListItem[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            setIsDataLoading(true);
            try {
                const [racesData, classesData, backgroundsData, alignmentsData, languagesData] = await Promise.all([
                    DndApiService.getRaces(),
                    DndApiService.getClasses(),
                    DndApiService.getBackgrounds(),
                    DndApiService.getAlignments(),
                    DndApiService.getLanguages(),
                ]);

                setRaces(racesData?.results || []);
                setClasses(classesData?.results || []);
                setBackgrounds(backgroundsData?.results || []);
                setAlignments(alignmentsData?.results || []);
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
        if (!user) return;
        setIsTestingAi(true);
        setAiTestResult(null);
        setTestImageUrl(null);
        try {
            const response = await GameService.testAiConnection(selectedModel);
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
    }, [user, selectedModel]);

    const handleTestImageGen = useCallback(async () => {
        setIsGeneratingImage(true);
        setTestImageUrl(null);
        try {
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
    }, [apiKey, selectedImageModel]);

    const handleTestTts = useCallback(async () => {
        if (!aiTestResult?.message || !aiTestResult.success) return;
        setIsGeneratingAudio(true);
        try {
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
    }, [aiTestResult, apiKey, ttsModel, ttsVoice]);


    if (isDataLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400">
                <Loader2 className="h-12 w-12 animate-spin" />
                <p className="mt-4">Carregando tomos antigos...</p>
            </div>
        );
    }
    
    if (isLoading) { 
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400 text-center">
                <Loader2 className="h-12 w-12 animate-spin" />
                <p className="mt-4 text-lg">Forjando seu destino nas chamas da criação...</p>
            </div>
        );
    }
    
    if (!isCreating) {
        // This view is now handled by GameContainer
        return null; 
    }

    return (
      <>
        <NewCharacterCreation
            races={races}
            classes={classes}
            backgrounds={backgrounds}
            alignments={alignments}
            allLanguages={allLanguages}
            onCharacterCreated={onCharacterCreated}
        />
        {/* Modals are kept here as they relate to creation-time testing */}
        {showAiTestModal && aiTestResult && (
            <ActionModal
                isOpen={showAiTestModal}
                title={aiTestResult.title}
                onClose={closeAiTestModal}
                actions={[ { text: "Fechar", onClick: closeAiTestModal, variant: 'primary'} ]}
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
        <audio ref={audioRef} className="hidden" />
        {showDiceTestModal && <DiceTestModal isOpen={showDiceTestModal} onClose={() => setShowDiceTestModal(false)} />}
        <SettingsModal 
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
        />
      </>
    );
};

export default CharacterCreation;
