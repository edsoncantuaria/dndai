'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ApiListItem } from '@/types';
import * as DndApiService from '@/services/dndApiService';
import PremiumLoader from '@/components/ui/PremiumLoader';
import dynamic from 'next/dynamic';

const CharacterCreationWizard = dynamic(
  () => import('@/features/character-create/CharacterCreationWizard'),
  {
    loading: () => (
      <PremiumLoader
        title="Carregando o forjador de heróis"
        subtitle="Preparando o ritual de criação v2."
        showSkeletons={false}
      />
    ),
    ssr: false,
  }
);


interface CharacterCreationProps {
  onCharacterCreated: () => void;
  onCancel?: () => void;
}

const CharacterCreation: React.FC<CharacterCreationProps> = ({ onCharacterCreated, onCancel }) => {
    // Data Fetching State
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [races, setRaces] = useState<ApiListItem[]>([]);
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [backgrounds, setBackgrounds] = useState<ApiListItem[]>([]);
    const [alignments, setAlignments] = useState<ApiListItem[]>([]);
    const [allLanguages, setAllLanguages] = useState<ApiListItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const loadInitialData = useCallback(async () => {
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
            setError("Falha ao carregar dados essenciais. Por favor, tente novamente.");
        } finally {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    if (isDataLoading) {
        return (
            <PremiumLoader
                title="Preparando o criador de heróis"
                subtitle="Buscando raças, classes, antecedentes e idiomas disponíveis."
                description="Sincronizando catálogos básicos para liberar todas as opções da ficha..."
            />
        );
    }
    
    if (error) {
         return (
            <div className="relative min-h-screen w-full overflow-hidden bg-dnd-obsidian">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_55%)]" />
                <div className="absolute -bottom-32 left-0 h-72 w-72 bg-dnd-ember/20 blur-[180px]" />
                <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="space-y-6 rounded-3xl border border-dnd-gold/15 bg-dnd-obsidian-raised p-10 shadow-2xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-dnd-ember/30 bg-dnd-ember/10 px-3 py-1 font-ui text-[10px] uppercase tracking-[0.5em] text-dnd-ember">
                            falha na sincronização
                        </div>
                        <h2 className="font-display text-3xl text-dnd-parchment">Não conseguimos carregar os tomos iniciais</h2>
                        <p className="font-ui text-sm text-dnd-parchment-muted">{error}</p>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={loadInitialData}
                                className="inline-flex items-center gap-2 rounded-full bg-dnd-ember px-6 py-2 font-ui text-sm font-semibold text-dnd-parchment transition hover:brightness-110"
                            >
                                Tentar novamente
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (typeof window !== 'undefined') {
                                        window.location.reload();
                                    }
                                }}
                                className="inline-flex items-center gap-2 rounded-full border border-dnd-gold/25 px-6 py-2 font-ui text-sm font-semibold text-dnd-parchment-muted transition hover:border-dnd-gold hover:text-dnd-parchment"
                            >
                                Recarregar página
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const sharedProps = {
        races,
        classes,
        backgrounds,
        alignments,
        allLanguages,
        onCharacterCreated,
        onCancel,
    };

    return <CharacterCreationWizard {...sharedProps} />;
};

export default CharacterCreation;
