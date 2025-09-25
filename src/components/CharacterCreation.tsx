'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import * as DndApiService from '@/services/dndApiService';
import * as GeminiService from '@/services/geminiService';
import type { ApiListItem } from '@/types';
import CharacterCreationMenu from './creation/CharacterCreationMenu';
import NewCharacterCreation from './NewCreationCharacter/NewCharacterCreation';
import ConfirmationModal from './ui/ConfirmationModal';
import SettingsModal from './SettingsModal'; // Importando o novo modal
import { BrainCircuit, Loader2, Settings } from 'lucide-react';
import { useSettingsContext } from '@/contexts/SettingsContext';

interface CharacterCreationProps {
  startNewGameFlow: () => void;
  onCharacterCreated: () => void;
  onContinueGame: () => void;
  isCreating: boolean;
}

const CharacterCreation: React.FC<CharacterCreationProps> = ({ startNewGameFlow, onCharacterCreated, onContinueGame, isCreating }) => {
    const { isLoading, character, checkForSavedGame, loadGameFromFile } = useGameStateContext();
    const { model: selectedModel, generationConfig } = useSettingsContext(); // Pega o modelo e a config
    const [hasSavedGame, setHasSavedGame] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showAiTestModal, setShowAiTestModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false); // Estado para o modal de configurações
    
    // State for AI Test
    const [isTestingAi, setIsTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ title: string, message: string } | null>(null);

    // --- Data Fetching ---
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [races, setRaces] = useState<ApiListItem[]>([]);
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [backgrounds, setBackgrounds] = useState<ApiListItem[]>([]);
    const [alignments, setAlignments] = useState<ApiListItem[]>([]);
    const [allLanguages, setAllLanguages] = useState<ApiListItem[]>([]);


    useEffect(() => {
        setHasSavedGame(checkForSavedGame());
    }, [checkForSavedGame]);


    useEffect(() => {
        // Always load data for the creation form
        const loadInitialData = async () => {
            setIsDataLoading(true);
            try {
                // Fetch data sequentially to avoid rate limiting
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

    const handleTestAi = useCallback(async () => {
        setIsTestingAi(true);
        setAiTestResult(null);
        try {
            // Passa o modelo selecionado para a função de teste
            const response = await GeminiService.testAiConnection(selectedModel, generationConfig);
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
    }, [selectedModel, generationConfig]); // Adiciona a config como dependência
    
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
                     <ConfirmationModal
                        isOpen={showConfirmationModal}
                        title="Iniciar Novo Jogo?"
                        message="Tem certeza que deseja iniciar um novo jogo? Todo o progresso salvo será perdido permanentemente."
                        onConfirm={confirmNewGame}
                        onCancel={() => setShowConfirmationModal(false)}
                        confirmText="Sim, começar de novo"
                        cancelText="Não, voltar"
                    />
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
            allLanguages={allLanguages}
            alignments={alignments}
            onCharacterCreated={onCharacterCreated}
        />
    );
};

export default CharacterCreation;
