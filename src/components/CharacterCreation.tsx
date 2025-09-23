// Este componente agora atua como um roteador para a nova UI de criação,
// mantendo a lógica de busca de dados centralizada.

'use client';
import React, { useState, useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { useCharacterCreation } from '@/hooks/useCharacterCreation';
import * as DndApiService from '@/services/dndApiService';
import { ApiListItem } from '@/types';
import { Icons } from './Icons';
import CharacterCreationMenu from './creation/CharacterCreationMenu';
import NewCharacterCreation from './NewCreationCharacter/NewCharacterCreation';

const CharacterCreation: React.FC<{ startNewGame: () => void }> = ({ startNewGame }) => {
    const { createCharacter, isLoading, checkForSavedGame, loadGameFromLocalStorage, loadGameFromFile } = useGameStateContext();
    const [view, setView] = useState<'menu' | 'form'>('menu');
    const [hasSavedGame, setHasSavedGame] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

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
             if (window.confirm('Tem certeza que deseja iniciar um novo jogo? O progresso atual será perdido.')) {
                startNewGame();
                // O componente será resetado via page.tsx
            }
        } else {
            setView('form');
        }
    };
    
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
            <CharacterCreationMenu
                hasSavedGame={hasSavedGame}
                onNewGame={handleNewGame}
                onLoadGame={loadGameFromLocalStorage}
                onImportFile={loadGameFromFile}
            />
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

    // Renderiza a nova UI de criação de personagem
    return (
        <NewCharacterCreation
            races={races}
            classes={classes}
            backgrounds={backgrounds}
            alignments={alignments}
            allLanguages={allLanguages}
            onBackToMenu={() => setView('menu')}
        />
    );
};

export default CharacterCreation;
