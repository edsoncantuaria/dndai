// src/hooks/character-creation/useDataManager.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import * as DndApiService from '../../services/dndApiService';
import type { ApiRace, ApiClass, ApiBackground, ApiClassLevel, ApiSubrace, Feat, ApiTrait, ApiSpell, ApiListItem, InventoryItem } from '../../types';
import { fetchDetailsInChunks } from '../../utils/apiUtils';
import { apiClient } from '@/services/apiClient';

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

    const [equipmentCategoryCache, setEquipmentCategoryCache] = useState<Record<string, InventoryItem[]>>({});

    // Pre-load all equipment data
    useEffect(() => {
        const fetchBaseEquipment = async () => {
             setLoadingStates({ isLoading: true, message: 'Carregando o arsenal...', progress: 0 });
             try {
                const equipmentResponse = await apiClient<{ results: ApiListItem[] }>('/dnds/equipment');
                if (equipmentResponse?.results) {
                    const itemDetails = await fetchDetailsInChunks(
                        equipmentResponse.results,
                        DndApiService.getEquipmentDetails,
                        (loaded, total, progress) => {
                            setLoadingStates({ isLoading: true, message: `Analisando Itens ${loaded} de ${total}...`, progress });
                        }
                    );
                    const validItems = itemDetails.filter((item): item is InventoryItem => item !== null);

                    const newCache: Record<string, InventoryItem[]> = {};
                    validItems.forEach(item => {
                        const categories = [
                            item.equipment_category?.index,
                            (item as any).gear_category?.index,
                            item.weapon_category?.toLowerCase() + '-weapons', // e.g. simple-weapons
                            item.weapon_range?.toLowerCase() + '-weapons', // e.g. melee-weapons
                            item.armor_category?.toLowerCase() + '-armor', // e.g. heavy-armor
                        ].filter(Boolean);

                         // Specific composite categories
                        if (item.weapon_category === 'Martial' && item.weapon_range === 'Melee') {
                            categories.push('martial-melee-weapons');
                        }
                        if (item.weapon_category === 'Simple' && item.weapon_range === 'Melee') {
                            categories.push('simple-melee-weapons');
                        }

                        categories.forEach(cat => {
                            if (!newCache[cat!]) newCache[cat!] = [];
                            newCache[cat!].push(item);
                        });
                    });

                    // Add composite weapon categories
                    newCache['martial-weapons'] = [...(newCache['martial-melee-weapons'] || []), ...(newCache['martial-ranged-weapons'] || [])];
                    newCache['simple-weapons'] = [...(newCache['simple-melee-weapons'] || []), ...(newCache['simple-ranged-weapons'] || [])];
                    
                    setEquipmentCategoryCache(newCache);
                }
             } catch (error) {
                console.error("Falha catastrófica ao carregar equipamentos:", error);
             } finally {
                setLoadingStates({ isLoading: false, message: '', progress: 0 });
             }
        };
        fetchBaseEquipment();
    }, []);


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

    // Fetch Background Details
    useEffect(() => {
        if (!background) {
            setBackgroundDetails(null);
            return;
        }
        const fetchBackground = async () => {
            setLoadingStates({ isLoading: true, message: 'Relembrando o passado...', progress: 50 });
            const details = await DndApiService.getBackgroundDetails(background);
            setBackgroundDetails(details);
            setLoadingStates({ isLoading: false, message: '', progress: 0 });
        };
        fetchBackground();
    }, [background]);
    
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
        equipmentCategoryCache,
        loadingStates,
        fetchFeats,
    };
};
