// src/hooks/character-creation/useDataManager.ts
import { useState, useEffect } from 'react';
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
    const [allEquipment, setAllEquipment] = useState<InventoryItem[]>([]);

    // Loading States
    const [isLoading, setIsLoading] = useState({
        race: false,
        class: false,
        background: false,
        feats: false,
        traits: false,
        spells: false,
        equipment: false,
    });
    const [spellsLoadingProgress, setSpellsLoadingProgress] = useState<{ progress: number; text: string } | null>(null);


    // Fetch All Equipment (once)
    useEffect(() => {
        const fetchAllEquipment = async () => {
            setIsLoading(prev => ({ ...prev, equipment: true }));
            try {
                // O DndApiService já busca da nossa API unificada, que deve conter homebrew
                const equipmentList = await DndApiService.getEquipment();
                const equipmentDetails = await fetchDetailsInChunks(
                    equipmentList?.results || [],
                    DndApiService.getEquipmentDetails,
                    () => {}
                );
                setAllEquipment(equipmentDetails.filter(Boolean) as InventoryItem[]);
            } catch (error) {
                console.error("Failed to fetch all equipment:", error);
            } finally {
                setIsLoading(prev => ({ ...prev, equipment: false }));
            }
        };
        fetchAllEquipment();
    }, []);

    // Fetch Race Details
    useEffect(() => {
        if (!race) {
            setRaceDetails(null);
            return;
        }
        const fetchRace = async () => {
            setIsLoading(prev => ({ ...prev, race: true }));
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
            setIsLoading(prev => ({ ...prev, race: false }));
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
            setIsLoading(prev => ({ ...prev, race: true }));
            setSubraceDetails(await DndApiService.getSubraceDetails(subrace));
            setIsLoading(prev => ({ ...prev, race: false }));
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
            setIsLoading(prev => ({ ...prev, class: true, spells: true }));
            const [details, levels] = await Promise.all([
                DndApiService.getClassDetails(characterClass),
                DndApiService.getClassLevels(characterClass)
            ]);
            setClassDetails(details);
            setClassLevels(levels);

            if (details?.spellcasting) {
                setSpellsLoadingProgress({ progress: 0, text: 'Carregando magias...' });
                const spellsResponse = await DndApiService.getSpellsForClass(characterClass);
                if (spellsResponse?.results) {
                    const spellDetails = await fetchDetailsInChunks(
                        spellsResponse.results, 
                        DndApiService.getSpellDetails, 
                        (loaded, total, progress) => setSpellsLoadingProgress({ progress, text: `Carregando magias ${loaded} de ${total}...` })
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
            
            setIsLoading(prev => ({ ...prev, class: false, spells: false }));
            setSpellsLoadingProgress(null);
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
            setIsLoading(prev => ({ ...prev, background: true }));
            setBackgroundDetails(await DndApiService.getBackgroundDetails(background));
            setIsLoading(prev => ({ ...prev, background: false }));
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
            setIsLoading(prev => ({ ...prev, traits: true }));
            const allTraitList = [...(raceDetails.traits || []), ...(subraceDetails?.racial_traits || [])].filter(Boolean);
            const traitDetails = await fetchDetailsInChunks<ApiListItem, ApiTrait>(allTraitList, DndApiService.getTraitDetails, () => {});
            setTraitChoiceDetails(traitDetails.filter(Boolean));
            setIsLoading(prev => ({ ...prev, traits: false }));
        };
        fetchRacialTraits();
    }, [raceDetails, subraceDetails]);

    const fetchFeats = async () => {
        setIsLoading(prev => ({...prev, feats: true}));
        const featsList = await DndApiService.getFeats();
        if (featsList?.results) {
            const featDetails = await fetchDetailsInChunks(featsList.results, DndApiService.getFeatDetails, () => {});
            setAvailableFeats(featDetails as Feat[]);
        }
        setIsLoading(prev => ({...prev, feats: false}));
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
        loadingStates: {
            ...isLoading,
            spellsLoadingProgress,
        },
        fetchFeats,
    };
};
