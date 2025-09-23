'use client';
import React, { useState, useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { useCharacterCreation } from '@/hooks/useCharacterCreation';
import * as DndApiService from '@/services/dndApiService';
import { ApiListItem, Proficiency, InventoryItem } from '@/types';
import { Icons } from './Icons';
import CharacterCreationMenu from './creation/CharacterCreationMenu';
import CharacterCreationForm from './creation/CharacterCreationForm';

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
        if (view === 'form' && !isDataLoading) return;

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
                setFormError("Falha ao carregar dados essenciais para a criação de personagem. Por favor, tente recarregar a página.");
            } finally {
                setIsDataLoading(false);
            }
        };
        loadInitialData();
    }, [view]);

    // --- Main Hook ---
    const hook = useCharacterCreation();

    const handleNewGame = () => {
        if (hasSavedGame) {
             if (window.confirm('Tem certeza que deseja iniciar um novo jogo? O progresso atual será perdido.')) {
                startNewGame();
                // We don't switch view here, the whole component will reset via page.tsx
            }
        } else {
            setView('form');
        }
    };
    
    // --- Form Submission Logic ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // --- Validation ---
        const personalityTraitsNeeded = hook.backgroundDetails?.personality_traits?.choose || 0;
        const allEquipmentChoicesMade = (hook.equipmentChoiceGroups.flatMap(g => g.choices) || []).every((choice, index) => {
            const group = hook.equipmentChoiceGroups.find(g => g.choices.includes(choice));
            if (!group) return false;
            const choiceKey = `${group.desc}-${index}`;
            const mainSelection = hook.equipmentChoices[choiceKey];
            if (!mainSelection) return false;
            if (mainSelection.from?.option_set_type === 'equipment_category' || mainSelection.type === 'choice') {
                return !!hook.subChoiceSelection[choiceKey];
            }
            return true;
        });

        if (!hook.name || !hook.race || !hook.characterClass || !hook.background || !hook.alignment) {
            setFormError('Por favor, preencha as informações básicas do personagem (Nome, Raça, Classe, Antecedente, Alinhamento).');
            return;
        }
        if (hook.points > 0) {
            setFormError('Você ainda tem pontos de atributo para distribuir.');
            return;
        }
        if (hook.languageChoicesCount > 0 && hook.chosenLanguages.some(l => l === '')) {
            setFormError('Por favor, selecione todos os idiomas adicionais.');
            return;
        }
        if (!allEquipmentChoicesMade) {
            setFormError('Você precisa fazer todas as escolhas de equipamento inicial.');
            return;
        }
        if (hook.personalityTraits.length < personalityTraitsNeeded || !hook.ideal || !hook.bond || !hook.flaw) {
            setFormError('Complete a seção de Personalidade e História (Traços, Ideal, Vínculo, Defeito).');
            return;
        }

        const cantripsKnown = hook.classLevels?.[0]?.spellcasting?.cantrips_known || 0;
        const spellsKnown = hook.classLevels?.[0]?.spellcasting?.spells_known || 0;
        const selectedCantrips = hook.chosenClassSpells.filter(sIdx => hook.classSpellOptions.find(s => s.index === sIdx && s.level === 0)).length;
        const selectedLvl1Spells = hook.chosenClassSpells.filter(sIdx => hook.classSpellOptions.find(s => s.index === sIdx && s.level === 1)).length;

        if (cantripsKnown > 0 && selectedCantrips < cantripsKnown) {
            setFormError(`Selecione ${cantripsKnown} truque(s) de classe.`);
            return;
        }
        if (spellsKnown > 0 && selectedLvl1Spells < spellsKnown) {
            setFormError(`Selecione ${spellsKnown} magia(s) de nível 1.`);
            return;
        }

        // --- Data Aggregation & Creation ---
        const finalProficiencies: Proficiency[] = Array.from(hook.allFixedProficiencies.values());
        Object.entries(hook.proficiencySelections).forEach(([choiceId, selections]) => {
            const choiceInfo = hook.allProficiencyChoices.find(c => c.id === choiceId);
            if (choiceInfo) {
                selections.forEach(name => {
                    if (!finalProficiencies.some(p => p.name === name)) {
                        finalProficiencies.push({ name: name, type: choiceInfo.type || 'outros', index: name, url: '' });
                    }
                });
            }
        });

        const allChosenSpells = [...hook.chosenClassSpells, ...Object.values(hook.chosenRacialSpells).flat()];
        const allLanguagesList = [...new Set([...hook.baseLanguages, ...hook.chosenLanguages.filter(l => l)])];

        // Process equipment to get final inventory
        const finalInventory: InventoryItem[] = [];
        const currency = { gp: 0, sp: 0, cp: 0 };
        
        const backgroundGold = hook.backgroundDetails?.starting_equipment_options?.find(opt => opt.from.option_set_type === 'equipment_category' && opt.from.equipment_category?.index === 'adventuring-gear');
        if (backgroundGold && backgroundGold.desc) {
            const goldString = backgroundGold.desc.match(/(\d+) po/);
            if (goldString && goldString[1]) {
                currency.gp += parseInt(goldString[1], 10);
            }
        } else if (hook.backgroundDetails?.starting_equipment_options?.some(o => o.desc?.includes('15 po'))) {
           currency.gp += 15;
        }

        Object.values(hook.selectedEquipmentDetails).forEach(item => {
            if (item && item.name) {
                 finalInventory.push({ ...item, id: crypto.randomUUID(), quantity: item.quantity || 1 } as InventoryItem);
            }
        });
        
        createCharacter({
            name: hook.name,
            race: hook.raceDetails?.name || '',
            subrace: hook.subraceDetails?.name,
            characterClass: hook.classDetails?.name || '',
            attributes: hook.finalAttributes,
            proficiencies: finalProficiencies,
            background: hook.backgroundDetails?.name || '',
            alignment: hook.alignment,
            backstory: hook.backstory,
            inventory: finalInventory,
            currency,
            hitDie: hook.classDetails?.hit_die || 8,
            speed: hook.raceDetails?.speed || 30,
            spells: [...new Set(allChosenSpells)],
            languages: allLanguagesList,
            personalityTraits: hook.personalityTraits,
            ideal: hook.ideal,
            bond: hook.bond,
            flaw: hook.flaw,
        });
    };

    // --- Render Logic ---
    if (isLoading && !hasSavedGame) { // Show loading only when creating character, not on initial load check
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

    // --- Form View ---
     if (isDataLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                <Icons.Spinner className="h-12 w-12" />
                <p className="mt-4">Carregando tomos antigos...</p>
            </div>
        );
    }

    return (
        <CharacterCreationForm
            hook={hook}
            races={races}
            classes={classes}
            backgrounds={backgrounds}
            alignments={alignments}
            allLanguages={allLanguages}
            formError={formError}
            onSubmit={handleSubmit}
            onBackToMenu={() => setView('menu')}
        />
    );
};

export default CharacterCreation;
