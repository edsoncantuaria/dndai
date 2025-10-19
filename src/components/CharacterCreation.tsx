'use client';

import React, { useState, useEffect } from 'react';
import type { ApiListItem } from '@/types';
import NewCharacterCreation from './NewCreationCharacter/NewCharacterCreation';
import * as DndApiService from '@/services/dndApiService';
import { Loader2 } from 'lucide-react';

interface CharacterCreationProps {
  onCharacterCreated: () => void;
}

const CharacterCreation: React.FC<CharacterCreationProps> = ({ onCharacterCreated }) => {
    // Data Fetching State
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [races, setRaces] = useState<ApiListItem[]>([]);
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [backgrounds, setBackgrounds] = useState<ApiListItem[]>([]);
    const [alignments, setAlignments] = useState<ApiListItem[]>([]);
    const [allLanguages, setAllLanguages] = useState<ApiListItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            setIsDataLoading(true);
            try {
                console.log("[CharacterCreation] Iniciando busca de dados iniciais...");
                const [racesData, classesData, backgroundsData, alignmentsData, languagesData] = await Promise.all([
                    DndApiService.getRaces(),
                    DndApiService.getClasses(),
                    DndApiService.getBackgrounds(),
                    DndApiService.getAlignments(),
                    DndApiService.getLanguages(),
                ]);

                console.log("[CharacterCreation] Dados recebidos:", { races: racesData?.results?.length, classes: classesData?.results?.length });
                setRaces(racesData?.results || []);
                setClasses(classesData?.results || []);
                setBackgrounds(backgroundsData?.results || []);
                setAlignments(alignmentsData?.results || []);
                setAllLanguages(languagesData?.results || []);
                setError(null);
            } catch (error) {
                console.error("Failed to load initial creation data:", error);
                setError("Falha ao carregar dados essenciais. Por favor, tente recarregar a página.");
            } finally {
                setIsDataLoading(false);
            }
        };
        loadInitialData();
    }, []);

    if (isDataLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400">
                <Loader2 className="h-12 w-12 animate-spin" />
                <p className="mt-4">Carregando tomos antigos...</p>
            </div>
        );
    }
    
    if (error) {
         return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-red-400">
                <p>{error}</p>
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
