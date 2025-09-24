'use client';

import React, { useState, useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import * as DndApiService from '@/services/dndApiService';
import type { ApiListItem } from '@/types';
import { Icons } from './Icons';
import CharacterCreationMenu from './creation/CharacterCreationMenu';
import NewCharacterCreation from './NewCreationCharacter/NewCharacterCreation';
import ConfirmationModal from './ui/ConfirmationModal';

const CharacterCreation: React.FC<{ startNewGame: () => void }> = ({ startNewGame }) => {
    const { isLoading, checkForSavedGame, loadGameFromLocalStorage, loadGameFromFile } = useGameStateContext();
    const [view, setView] = useState<'menu' | 'form'>('menu');
    const [hasSavedGame, setHasSavedGame] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);

    // --- Data Fetching ---
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [races, setRaces] = useState<ApiListItem[]>([]);
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [backgrounds, setBackgrounds] = useState<ApiListItem[]>([]);
    const [alignments, setAlignments] = useState<ApiListItem[]>([]);
    const [allLanguages, setAllLanguages] = useState<ApiListItem[]>([]);


    useEffect(() => {
        setHasSavedGame(checkForSavedGame());
    }, [checkForSavedGame, isLoading]);

    useEffect(() => {
        // Always load data for the creation form
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

    const handleNewGame = () => {
        if (hasSavedGame) {
             setShowConfirmationModal(true);
        } else {
            setView('form');
        }
    };

    const confirmNewGame = () => {
        startNewGame();
        setShowConfirmationModal(false);
        setView('form');
    }
    
    // --- Render Logic ---
    if (isLoading && !hasSavedGame) { // Mostra loading ao criar personagem
        return (
            <div className="flex flex-col items-center justify-center p-8 text-stone-400 text-center">
                <Icons.Spinner className="h-12 w-12" />
                <p className="mt-4 text-lg">Forjando seu destino nas chamas da criação...</p>
            </div>
        );
    }
    
    if (view === 'menu') {
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
                        onLoadGame={loadGameFromLocalStorage}
                        onImportFile={loadGameFromFile}
                    />
                     <ConfirmationModal
                        isOpen={showConfirmationModal}
                        title="Iniciar Novo Jogo?"
                        message="Tem certeza que deseja iniciar um novo jogo? Todo o progresso salvo será perdido permanentemente."
                        onConfirm={confirmNewGame}
                        onCancel={() => setShowConfirmationModal(false)}
                        confirmText="Sim, começar de novo"
                        cancelText="Não, voltar"
                    />
                </main>
            </div>
        );
    }

     if (isDataLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                <Icons.Spinner className="h-12 w-12" />
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
            onBackToMenu={() => setView('menu')}
        />
    );
};

export default CharacterCreation;
