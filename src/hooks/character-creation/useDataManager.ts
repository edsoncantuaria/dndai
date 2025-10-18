// src/hooks/character-creation/useDataManager.ts
import { useState, useEffect, useCallback } from 'react';
import * as DndApiService from '../../services/dndApiService';
import type { ApiRace, ApiClass, ApiBackground, ApiClassLevel, ApiSubrace, Feat, ApiTrait, ApiSpell, ApiListItem, InventoryItem } from '../../types';
import { fetchDetailsInChunks } from '../../utils/apiUtils';

export const useDataManager = (race: string, subrace: string, characterClass: string, background: string) => {
    // Fetched API Details
    const [raceDetails, setRaceDetails] = useState<ApiRace | null>(null);
    const [subraceDetails, setSubraceDetails] = useState<ApiSubrace | null>(null);
    const [classDetails, setClassDetails] = useState<ApiClass | null>(null);
    const [backgroundDetails, setBackgroundDetails] = useState<ApiBackground | null>(null);
    const [classLevels, setClassLevels] = useState<ApiClassLevel[] | null>(null);
    const [availableFeats, setAvailableFeats] = useState<Feat[]>([]);
    const [traitChoiceDetails, setTraitChoiceDetails] = useState<ApiTrait[]>([]);
    const [draconicAncestryOptions, setDraconicAncestryOptions] = useState<ApiListItem[]>([]);
    const [classSpellOptions, setClassSpellOptions] = useState<ApiSpell[]>([]);
    const [subclassSpells, setSubclassSpells] = useState<ApiSpell[]>([]);
    
    // Unified Loading State
    const [loadingStates, setLoadingStates] = useState({
        isLoading: false,
        message: '',
        progress: 0,
    });

    const [allEquipment, setAllEquipment] = useState<InventoryItem[]>([]);
    const [equipmentCategoryCache, setEquipmentCategoryCache] = useState<Record<string, InventoryItem[]>>({});


    useEffect(() => {
        const fetchBaseEquipment = async () => {
             setLoadingStates({ isLoading: true, message: 'Carregando equipamentos base...', progress: 0 });
            const equipmentResponse = await DndApiService.getEquipment();
            if (equipmentResponse?.results) {
                const itemDetails = await fetchDetailsInChunks(
                    equipmentResponse.results,
                    DndApiService.getEquipmentDetails,
                    (loaded, total, progress) => {
                        setLoadingStates({ isLoading: true, message: `Analisando Itens ${loaded} de ${total}...`, progress });
                    }
                );
                const validItems = itemDetails.filter((item): item is InventoryItem => item !== null);
                setAllEquipment(validItems);

                // Pre-populate cache from allEquipment
                const newCache: Record<string, InventoryItem[]> = {};
                validItems.forEach(item => {
                    const eqCat = item.equipment_category?.index;
                    const gearCat = (item as any).gear_category?.index;
                    if (eqCat) {
                        if (!newCache[eqCat]) newCache[eqCat] = [];
                        newCache[eqCat].push(item);
                    }
                    if (gearCat) {
                         if (!newCache[gearCat]) newCache[gearCat] = [];
                        newCache[gearCat].push(item);
                    }
                });
                setEquipmentCategoryCache(newCache);
            }
             setLoadingStates({ isLoading: false, message: '', progress: 0 });
        };
        fetchBaseEquipment();
    }, []);

    const fetchEquipmentCategory = useCallback(async (categoryIndex: string): Promise<InventoryItem[]> => {
        if (!categoryIndex) return [];
        if (equipmentCategoryCache[categoryIndex]) {
            return equipmentCategoryCache[categoryIndex];
        }

        const filtered = allEquipment.filter(item => 
            item.equipment_category?.index === categoryIndex || 
            (item as any).gear_category?.index === categoryIndex
        );

        if (filtered.length > 0) {
            setEquipmentCategoryCache(prev => ({...prev, [categoryIndex]: filtered }));
            return filtered;
        }
        
        // Fallback to API if not in the main list for some reason
        setLoadingStates({ isLoading: true, message: `Carregando categoria: ${categoryIndex}...`, progress: 0 });
        try {
            const categoryDetails = await DndApiService.getEquipmentCategoryDetails(categoryIndex);
            if (!categoryDetails || !categoryDetails.equipment) return [];
            
            const items = await fetchDetailsInChunks(categoryDetails.equipment, DndApiService.getEquipmentDetails, ()=>{});
            const validItems = items.filter(Boolean) as InventoryItem[];
            setEquipmentCategoryCache(prev => ({...prev, [categoryIndex]: validItems }));
            return validItems;
        } catch (error) {
            console.error(`Failed to fetch equipment category ${categoryIndex}:`, error);
            return [];
        } finally {
            setLoadingStates({ isLoading: false, message: '', progress: 0 });
        }
    }, [equipmentCategoryCache, allEquipment]);


    // Fetch Race Details
    useEffect(() => {
        if (!race) {
            setRaceDetails(null);
            return;
        }
        const fetchRace = async () => {
            setLoadingStates({ isLoading: true, message: 'Buscando linhagens...', progress: 50 });
            const details = await DndApiService.getRaceDetails(race);
            setRaceDetails(details);
            if (race === 'dragonborn') {
                const ancestryTrait = await DndApiService.getTraitDetails('draconic-ancestry');
                if (ancestryTrait?.trait_specific?.subtrait_options?.from?.options) {
                    setDraconicAncestryOptions(ancestryTrait.trait_specific.subtrait_options.from.options.map((o: any) => o.item));
                }
            } else {
                setDraconicAncestryOptions([]);
            }
            setLoadingStates({ isLoading: false, message: '', progress: 0 });
        };
        fetchRace();
    }, [race]);

    // Fetch Subrace Details
    useEffect(() => {
        if (!subrace) {
            setSubraceDetails(null);
            return;
        }
        const fetchSubrace = async () => {
            setLoadingStates({ isLoading: true, message: 'Consultando sub-raças...', progress: 50 });
            setSubraceDetails(await DndApiService.getSubraceDetails(subrace));
            setLoadingStates({ isLoading: false, message: '', progress: 0 });
        };
        fetchSubrace();
    }, [subrace]);

    // Fetch Class Details
    useEffect(() => {
        if (!characterClass) {
            setClassDetails(null);
            setClassLevels(null);
            setClassSpellOptions([]);
            setSubclassSpells([]);
            return;
        }
        const fetchClass = async () => {
            setLoadingStates({ isLoading: true, message: 'Estudando as artes...', progress: 0 });
            const [details, levels] = await Promise.all([
                DndApiService.getClassDetails(characterClass),
                DndApiService.getClassLevels(characterClass)
            ]);
            setClassDetails(details);
            setClassLevels(levels);

            if (details?.spellcasting) {
                const spellsResponse = await DndApiService.getSpellsForClass(characterClass);
                if (spellsResponse?.results) {
                    const spellDetails = await fetchDetailsInChunks(
                        spellsResponse.results, 
                        DndApiService.getSpellDetails, 
                        (loaded, total, progress) => setLoadingStates({ isLoading: true, message: `Carregando Magias ${loaded} de ${total}...`, progress })
                    );
                    setClassSpellOptions(spellDetails.filter((s): s is ApiSpell => s !== null && s.level <= 1));
                }
            }

            if (details?.subclasses?.[0]) {
                const subClassDetails = await DndApiService.getSubclassDetails(details.subclasses[0].index);
                 if (subClassDetails?.spells) {
                    const spellRefs = subClassDetails.spells.filter(s => s.prerequisites.some(p => p && p.type === 'level' && p.url.endsWith('/1'))).map(s => s.spell);
                    if(spellRefs.length > 0) {
                        const spellDetails = await fetchDetailsInChunks(spellRefs, DndApiService.getSpellDetails, ()=>{});
                        setSubclassSpells(spellDetails.filter(Boolean) as ApiSpell[]);
                    }
                }
            }
            
            setLoadingStates({ isLoading: false, message: '', progress: 0 });
        };
        fetchClass();
    }, [characterClass]);

    // Fetch Background Details and its equipment categories
    useEffect(() => {
        if (!background) {
            setBackgroundDetails(null);
            return;
        }
        const fetchBackground = async () => {
            setLoadingStates({ isLoading: true, message: 'Relembrando o passado...', progress: 50 });
            const details = await DndApiService.getBackgroundDetails(background);
            setBackgroundDetails(details);
    
            if (details?.starting_equipment_options) {
                for (const choice of details.starting_equipment_options) {
                    const processOptionSet = async (optionSet: any) => {
                        if (optionSet.option_set_type === 'equipment_category' && optionSet.equipment_category?.index) {
                            await fetchEquipmentCategory(optionSet.equipment_category.index);
                        } else if (optionSet.option_set_type === 'options_array' && Array.isArray(optionSet.options)) {
                            for (const option of optionSet.options) {
                                if (option.option_type === 'choice' && option.choice?.from) {
                                    await processOptionSet(option.choice.from);
                                }
                            }
                        }
                    };
                    await processOptionSet(choice.from);
                }
            }
    
            setLoadingStates({ isLoading: false, message: '', progress: 0 });
        };
        fetchBackground();
    }, [background, fetchEquipmentCategory]);
    
    // Fetch Racial Traits
    useEffect(() => {
        const fetchRacialTraits = async () => {
            if (!raceDetails) {
                setTraitChoiceDetails([]);
                return;
            }
            setLoadingStates({ isLoading: true, message: 'Analisando traços...', progress: 0 });
            const allTraitList = [...(raceDetails.traits || []), ...(subraceDetails?.racial_traits || [])].filter(Boolean);
            const traitDetails = await fetchDetailsInChunks<ApiListItem, ApiTrait>(allTraitList, DndApiService.getTraitDetails, (l, t, p) => {
                setLoadingStates({ isLoading: true, message: `Analisando Traços ${l} de ${t}...`, progress: p });
            });
            setTraitChoiceDetails(traitDetails.filter(Boolean));
            setLoadingStates({ isLoading: false, message: '', progress: 0 });
        };
        fetchRacialTraits();
    }, [raceDetails, subraceDetails]);

    const fetchFeats = async () => {
        setLoadingStates({ isLoading: true, message: 'Procurando talentos...', progress: 0 });
        const featsList = await DndApiService.getFeats();
        if (featsList?.results) {
            const featDetails = await fetchDetailsInChunks(featsList.results, DndApiService.getFeatDetails, (l, t, p) => {
                 setLoadingStates({ isLoading: true, message: `Carregando Talentos ${l} de ${t}...`, progress: p });
            });
            setAvailableFeats(featDetails as Feat[]);
        }
        setLoadingStates({ isLoading: false, message: '', progress: 0 });
    };

    return {
        details: {
            raceDetails,
            subraceDetails,
            classDetails,
            backgroundDetails,
            classLevels,
            availableFeats,
            traitChoiceDetails,
            draconicAncestryOptions,
            classSpellOptions,
            subclassSpells,
        },
        allEquipment,
        equipmentCategoryCache,
        loadingStates,
        fetchFeats,
    };
};