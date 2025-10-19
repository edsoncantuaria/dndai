// src/hooks/character-creation/useDataManager.ts
import { useState, useEffect, useMemo } from 'react';
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
    const [draconicAncestryOptions, setDraconicAncestryOptions] = useState<any[]>([]); // Será populado com detalhes
    const [classSpellOptions, setClassSpellOptions] = useState<ApiSpell[]>([]);
    const [subclassSpells, setSubclassSpells] = useState<ApiSpell[]>([]);
    
    // Unified Loading State
    const [loadingStates, setLoadingStates] = useState({
        isLoading: false,
        message: '',
        progress: 0,
    });

    const [allEquipment, setAllEquipment] = useState<InventoryItem[]>([]);
    const [equipmentCategoryCache, setEquipmentCategoryCache] = useState<Record<string, InventoryItem[]>>(() => ({}));

    // Pre-load all equipment data
    useEffect(() => {
        const fetchBaseEquipment = async () => {
             setLoadingStates({ isLoading: true, message: 'Carregando o arsenal...', progress: 0 });
             try {
                const equipmentList = await DndApiService.getEquipment();
                
                if (!Array.isArray(equipmentList)) {
                    throw new Error("A lista de equipamentos não pôde ser carregada ou está em formato incorreto.");
                }

                const unifiedEquipment = equipmentList as InventoryItem[];
                setAllEquipment(unifiedEquipment);

                const newCache: Record<string, InventoryItem[]> = {};
                
                const add = (keys: (string | undefined)[], itemToAdd: InventoryItem) => {
                    keys.forEach(key => {
                        if (!key) return;
                        const normalizedKey = key.toLowerCase();
                        if (!newCache[normalizedKey]) newCache[normalizedKey] = [];
                        newCache[normalizedKey].push(itemToAdd);
                    });
                };
                
                const addWithVariations = (baseKey: string, items: InventoryItem[]) => {
                    const keys = [
                        baseKey.toLowerCase(),
                        `${baseKey.toLowerCase()}s`,
                        baseKey.toLowerCase().replace(/ /g, '-'),
                        `${baseKey.toLowerCase().replace(/ /g, '-')}s`,
                    ];
                    keys.forEach(key => {
                        newCache[key] = items;
                    });
                };

                unifiedEquipment.forEach(item => {
                    if (!item) return;
                    add([item.equipment_category?.index, (item as any).gear_category?.index], item);
                });

                const musicalInstruments = unifiedEquipment.filter(i => i.equipment_category?.index === 'musical-instruments' || (i as any).gear_category?.index === 'musical-instruments');
                const holySymbols = unifiedEquipment.filter(i => i.equipment_category?.index === 'holy-symbols');
                const arcaneFoci = unifiedEquipment.filter(i => i.equipment_category?.index === 'arcane-foci');
                const druidicFoci = unifiedEquipment.filter(i => i.equipment_category?.index === 'druidic-foci');
                const simpleWeapons = unifiedEquipment.filter(i => i.weapon_category === 'Simple');
                const martialWeapons = unifiedEquipment.filter(i => i.weapon_category === 'Martial');

                addWithVariations('musical instrument', musicalInstruments);
                addWithVariations('holy symbol', holySymbols);
                addWithVariations('arcane focus', arcaneFoci);
                addWithVariations('druidic focus', druidicFoci);
                addWithVariations('simple weapon', simpleWeapons);
                addWithVariations('martial weapon', martialWeapons);
                
                addWithVariations('simple melee weapon', simpleWeapons.filter(i => i.weapon_range === 'Melee'));
                addWithVariations('martial melee weapon', martialWeapons.filter(i => i.weapon_range === 'Melee'));
                
                setEquipmentCategoryCache(newCache);

             } catch (error) {
                console.error("Falha catastrófica ao carregar equipamentos:", error);
                setEquipmentCategoryCache({}); // Garante que não seja undefined em caso de erro
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
            setDraconicAncestryOptions([]);
            return;
        }
        const fetchRace = async () => {
            setLoadingStates({ isLoading: true, message: 'Buscando linhagens...', progress: 50 });
            const details = await DndApiService.getRaceDetails(race);
            setRaceDetails(details);

            if (race === 'dragonborn') {
                const ancestryTrait = await DndApiService.getTraitDetails('draconic-ancestry');
                if (ancestryTrait?.trait_specific?.subtrait_options?.from?.options) {
                    const ancestryRefs = ancestryTrait.trait_specific.subtrait_options.from.options.map((o: any) => o.item);
                    
                    // Busca os detalhes de cada ancestralidade para obter o tipo de dano
                    const ancestryDetails = await fetchDetailsInChunks(
                        ancestryRefs,
                        DndApiService.getTraitDetails,
                        () => {} // Progress opcional
                    );
                    
                    const detailedOptions = ancestryDetails.map(detail => {
                        if (detail && detail.trait_specific?.damage_type) {
                            return {
                                index: detail.index,
                                name: detail.name,
                                damage_type: detail.trait_specific.damage_type.name,
                            };
                        }
                        return null;
                    }).filter(Boolean);

                    setDraconicAncestryOptions(detailedOptions);
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
            const [details, levelsData] = await Promise.all([
                DndApiService.getClassDetails(characterClass),
                DndApiService.getClassLevels(characterClass)
            ]);
            setClassDetails(details);
            
             const levels = Array.isArray(levelsData)
              ? levelsData
              : (levelsData ? Object.values(levelsData) : []);

            setClassLevels(levels as ApiClassLevel[]);

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
            } else {
                setClassSpellOptions([]);
            }
            
            setSubclassSpells([]);
            if (details?.subclasses?.[0]) {
                const subClassDetails = await DndApiService.getSubclassDetails(details.subclasses[0].index);
                 if (subClassDetails?.spells) {
                    const spellRefs = subClassDetails.spells.filter(s => s.prerequisites.some(p => p && p.url.endsWith('/1'))).map(s => s.spell);
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
    
    const safeCache = useMemo(() => equipmentCategoryCache || {}, [equipmentCategoryCache]);


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
        equipmentCategoryCache: safeCache,
        loadingStates,
        fetchFeats,
    };
};
