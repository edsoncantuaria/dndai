// hooks/newUseCharacterCreation.ts
import { useState, useMemo, useEffect, useCallback } from 'react';
import * as DndApiService from '../services/dndApiService';
import {
    ApiListItem, ApiRace, ApiClass, ApiBackground, ApiClassLevel, ApiTrait, ApiSpell,
    Attributes, Proficiency, ProficiencyChoice, InventoryItem, ApiSubrace, NewCharacterInfo
} from '../types';
import { ATTRIBUTE_SHORT_MAP, getCantripsKnown, getSpellsKnown } from '../utils/characterUtils';
import { fetchDetailsInChunks } from '../utils/apiUtils';
import { getCostOfNextLevel, getRefundForPrevLevel, getOptionLabel } from '../utils/creationHelpers';
import { translateSpell } from '../utils/TranslatorSpells';
import { v4 as uuidv4 } from 'uuid';

export type ProficiencyChoiceWithSource = ProficiencyChoice & {
    id: string;
    source: 'Raça' | 'Classe' | 'Antecedente';
    options: ApiListItem[];
};

export type EquipmentChoiceGroup = {
    id: string;
    source: 'Classe' | 'Antecedente';
    choice: ProficiencyChoice;
}

const attributeSuggestions: Record<string, (keyof Attributes)[]> = {
    'barbarian': ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'],
    'bard': ['charisma', 'dexterity', 'constitution', 'wisdom', 'intelligence', 'strength'],
    'cleric': ['wisdom', 'constitution', 'strength', 'charisma', 'dexterity', 'intelligence'],
    'druid': ['wisdom', 'constitution', 'dexterity', 'intelligence', 'charisma', 'strength'],
    'fighter': ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'],
    'monk': ['dexterity', 'wisdom', 'constitution', 'strength', 'charisma', 'intelligence'],
    'paladin': ['strength', 'charisma', 'constitution', 'wisdom', 'dexterity', 'intelligence'],
    'ranger': ['dexterity', 'wisdom', 'constitution', 'strength', 'intelligence', 'charisma'],
    'rogue': ['dexterity', 'charisma', 'constitution', 'wisdom', 'intelligence', 'strength'],
    'sorcerer': ['charisma', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'strength'],
    'warlock': ['charisma', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'strength'],
    'wizard': ['intelligence', 'constitution', 'dexterity', 'wisdom', 'charisma', 'strength'],
};

export const useNewCharacterCreation = () => {
    // --- STATE MANAGEMENT ---
    // Basic character info
    const [name, setName] = useState('');
    const [race, setRace] = useState('');
    const [subrace, setSubrace] = useState('');
    const [characterClass, setCharacterClass] = useState('');
    const [background, setBackground] = useState('');
    const [alignment, setAlignment] = useState('');
    const [backstory, setBackstory] = useState('');

    // Attributes
    const [points, setPoints] = useState(27);
    const [baseAttributes, setBaseAttributes] = useState<Attributes>({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 });

    // Fetched API Details
    const [raceDetails, setRaceDetails] = useState<ApiRace | null>(null);
    const [subraceDetails, setSubraceDetails] = useState<ApiSubrace | null>(null);
    const [classDetails, setClassDetails] = useState<ApiClass | null>(null);
    const [backgroundDetails, setBackgroundDetails] = useState<ApiBackground | null>(null);
    const [classLevels, setClassLevels] = useState<ApiClassLevel[] | null>(null);

    // Selections
    const [proficiencySelections, setProficiencySelections] = useState<Record<string, string[]>>({});
    const [equipmentSelections, setEquipmentSelections] = useState<Record<string, { main: number, sub?: number }>>({});
    const [finalizedEquipment, setFinalizedEquipment] = useState<InventoryItem[]>([]);
    const [chosenClassSpells, setChosenClassSpells] = useState<string[]>([]);
    const [chosenRacialSpells, setChosenRacialSpells] = useState<Record<string, string[]>>({});
    const [chosenLanguages, setChosenLanguages] = useState<string[]>([]);
    
    // Personality
    const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
    const [ideal, setIdeal] = useState('');
    const [bond, setBond] = useState('');
    const [flaw, setFlaw] = useState('');

    // Loading & Temp Data
    const [isSpellsLoading, setIsSpellsLoading] = useState(false);
    const [spellsLoadingProgress, setSpellsLoadingProgress] = useState<string | null>(null);
    const [isEquipmentLoading, setIsEquipmentLoading] = useState(false);
    const [isSubchoiceLoading, setIsSubchoiceLoading] = useState<Record<string, boolean>>({});
    const [subChoiceOptions, setSubChoiceOptions] = useState<Record<string, ApiListItem[]>>({});
    const [classSpellOptions, setClassSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellOptions, setRacialSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellTraits, setRacialSpellTraits] = useState<{ traitName: string; choose: number; options: ApiListItem[] }[]>([]);
    
    // --- MEMOIZED DERIVED STATE ---

    const racialBonuses = useMemo<Partial<Attributes>>(() => {
        const bonuses: Partial<Attributes> = {};
        (raceDetails?.ability_bonuses || []).forEach(b => {
            const attrKey = ATTRIBUTE_SHORT_MAP[b.ability_score.index];
            if (attrKey) bonuses[attrKey] = (bonuses[attrKey] || 0) + b.bonus;
        });
        (subraceDetails?.ability_bonuses || []).forEach(b => {
            const attrKey = ATTRIBUTE_SHORT_MAP[b.ability_score.index];
            if (attrKey) bonuses[attrKey] = (bonuses[attrKey] || 0) + b.bonus;
        });
        return bonuses;
    }, [raceDetails, subraceDetails]);

    const finalAttributes = useMemo<Attributes>(() =>
        (Object.keys(baseAttributes) as Array<keyof Attributes>).reduce((acc, key) => {
            acc[key] = baseAttributes[key] + (racialBonuses[key] || 0);
            return acc;
        }, {} as Attributes)
    , [baseAttributes, racialBonuses]);

    const { baseLanguages, languageChoicesCount } = useMemo(() => {
        let choices = 0;
        const base = new Set<string>();
        if (raceDetails) {
            raceDetails.languages.forEach(lang => base.add(lang.name));
            choices += raceDetails.language_options?.choose || 0;
        }
        if (subraceDetails) {
            subraceDetails.languages.forEach(lang => base.add(lang.name));
        }
        if (backgroundDetails) {
            choices += backgroundDetails.language_options?.choose || 0;
        }
        return { baseLanguages: Array.from(base), languageChoicesCount: choices };
    }, [raceDetails, subraceDetails, backgroundDetails]);

    const allFixedProficiencies = useMemo<Map<string, Proficiency>>(() => {
        const profs = new Map<string, Proficiency>();
        const addProfs = (profList: Proficiency[] | undefined) =>
            (profList || []).forEach(p => profs.set(p.index, { ...p }));

        addProfs(raceDetails?.starting_proficiencies);
        addProfs(subraceDetails?.starting_proficiencies);
        addProfs(classDetails?.proficiencies);
        addProfs(backgroundDetails?.starting_proficiencies);
        (classDetails?.saving_throws || []).forEach(st => profs.set(`saving-throw-${st.index}`, { index: st.index, name: `Saving Throw: ${st.name}`, url: st.url }));

        return profs;
    }, [raceDetails, subraceDetails, classDetails, backgroundDetails]);

    const allProficiencyChoices = useMemo<ProficiencyChoiceWithSource[]>(() => {
        const choices: ProficiencyChoiceWithSource[] = [];
        const addChoice = (choice: ProficiencyChoice | undefined, source: ProficiencyChoiceWithSource['source'], idPrefix: string) => {
            if (!choice || !choice.from?.options) return;
            choices.push({
                ...choice,
                id: `${idPrefix}-${choices.length}`,
                source,
                options: choice.from.options.map((o: any) => o.item || o) 
            });
        };

        addChoice(raceDetails?.starting_proficiency_options, 'Raça', 'race');
        addChoice(subraceDetails?.starting_proficiency_options, 'Raça', 'subrace');
        (classDetails?.proficiency_choices || []).forEach((c, i) => addChoice(c, 'Classe', `class-${i}`));
        addChoice(backgroundDetails?.starting_proficiency_options, 'Antecedente', 'bg');

        return choices;
    }, [raceDetails, subraceDetails, classDetails, backgroundDetails]);
    
    const unavailableProficiencies = useMemo(() => {
        return new Set([...Array.from(allFixedProficiencies.keys()), ...Object.values(proficiencySelections).flat()]);
    }, [allFixedProficiencies, proficiencySelections]);

    const { equipmentChoiceGroups, fixedEquipment } = useMemo(() => {
        const choiceGroups: EquipmentChoiceGroup[] = [];
        const fixed: InventoryItem[] = [];
    
        const addEquipment = (list: { equipment: ApiListItem, quantity: number }[] = []) => {
            list.forEach(item => fixed.push({ ...item.equipment, id: uuidv4(), quantity: item.quantity, equipped: false }));
        };
    
        if (classDetails) {
            addEquipment(classDetails.starting_equipment);
            classDetails.starting_equipment_options.forEach((choice, i) => {
                choiceGroups.push({ id: `class-${i}`, source: 'Classe', choice });
            });
        }
        if (backgroundDetails) {
            addEquipment(backgroundDetails.starting_equipment);
             backgroundDetails.starting_equipment_options?.forEach((choice, i) => {
                choiceGroups.push({ id: `bg-${i}`, source: 'Antecedente', choice });
            });
        }
        
        return { equipmentChoiceGroups: choiceGroups, fixedEquipment: fixed };
    }, [classDetails, backgroundDetails]);
    
    const startingGold = useMemo(() => {
        const goldPouch = fixedEquipment.find(item => item.name.toLowerCase().includes('pouch') && item.desc?.[0]?.toLowerCase().includes('gold'));
        if (goldPouch && goldPouch.desc) {
            const match = goldPouch.desc[0].match(/(\d+)\s*gp/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        if (background === 'acolyte') return 15;
        return 0;
    }, [fixedEquipment, background]);

    const areAllEquipmentChoicesMade = useMemo(() => {
        return equipmentChoiceGroups.every(group => {
            const selection = equipmentSelections[group.id];
            if (!selection) return false;
            
            const isCategoryChoice = group.choice.from.option_set_type === 'equipment_category';
            const options = group.choice.from.options || (isCategoryChoice ? [group.choice.from] : []);
            
            if (selection.main === undefined || selection.main < 0 || selection.main >= options.length) return false;
            
            const mainOption = options[selection.main];

            if (mainOption?.option_type === 'choice' || isCategoryChoice) {
                return selection.sub !== undefined;
            }
            return true;
        });
    }, [equipmentChoiceGroups, equipmentSelections]);


    const isComplete = useMemo(() => {
        if (!name || !race || !characterClass || !background || !alignment || points > 0) {
            return false;
        }
        if (raceDetails?.subraces?.length > 0 && !subrace) {
            return false;
        }
        const allProficienciesDone = allProficiencyChoices.every(
            choice => (proficiencySelections[choice.id]?.length || 0) === choice.choose
        );
        if (!allProficienciesDone) return false;

        const cantripsKnown = classDetails && classLevels ? getCantripsKnown(classLevels, 1) : 0;
        const spellsKnown = classDetails && classLevels ? getSpellsKnown(1, classLevels, classDetails, finalAttributes) : 0;
        const selectedCantripsCount = chosenClassSpells.filter(sIndex => classSpellOptions.some(c => c.index === sIndex && c.level === 0)).length;
        const selectedSpellsCount = chosenClassSpells.filter(sIndex => classSpellOptions.some(c => c.index === sIndex && c.level > 0)).length;
        if (selectedCantripsCount !== cantripsKnown || selectedSpellsCount !== spellsKnown) {
            return false;
        }

        const racialSpellsDone = racialSpellTraits.every(trait => (chosenRacialSpells[trait.traitName]?.length || 0) === trait.choose);
        if (!racialSpellsDone) return false;

        return areAllEquipmentChoicesMade;
    }, [name, race, subrace, characterClass, background, alignment, points, raceDetails, allProficiencyChoices, proficiencySelections, classDetails, classLevels, finalAttributes, chosenClassSpells, classSpellOptions, racialSpellTraits, chosenRacialSpells, areAllEquipmentChoicesMade]);

    // --- CALLBACKS & EFFECTS ---

    const resetSelections = useCallback(() => {
        setProficiencySelections({});
        setFinalizedEquipment([]);
        setEquipmentSelections({});
        setChosenClassSpells([]);
        setChosenRacialSpells({});
        setRacialSpellOptions([]);
        setRacialSpellTraits([]);
        setPersonalityTraits([]);
        setIdeal('');
        setBond('');
        setFlaw('');
    }, []);

    useEffect(() => {
        setChosenLanguages(Array(languageChoicesCount).fill(''));
    }, [languageChoicesCount]);

    useEffect(() => {
        const newSelections: Record<string, string[]> = {};
        for (const groupId in proficiencySelections) {
            const groupSelections = proficiencySelections[groupId];
            const stillAvailable = groupSelections.filter(profIndex => !allFixedProficiencies.has(profIndex));
            if (stillAvailable.length > 0) {
                newSelections[groupId] = stillAvailable;
            }
        }
        if (JSON.stringify(newSelections) !== JSON.stringify(proficiencySelections)) {
            setProficiencySelections(newSelections);
        }
    }, [allFixedProficiencies, proficiencySelections]);

    useEffect(() => {
        const fetchRacialTraitsAndSpells = async () => {
            setRacialSpellOptions([]);
            setRacialSpellTraits([]);
            setChosenRacialSpells({});

            const allTraitList = [
                ...(raceDetails?.traits || []),
                ...(subraceDetails?.racial_traits || [])
            ];

            if (allTraitList.length === 0) return;

            const traitDetails = await fetchDetailsInChunks<ApiTrait>(allTraitList, DndApiService.getTraitDetails, () => {});
            const spellChoiceTraits = traitDetails.filter((t): t is ApiTrait => !!t?.trait_specific?.spell_options);

            if (spellChoiceTraits.length === 0) return;

            const allSpellOptionsList = spellChoiceTraits.flatMap(t => 
                t.trait_specific?.spell_options?.from?.options?.map((opt: any) => opt.item) || []
            ).filter((item): item is ApiListItem => !!item);
            
            if (allSpellOptionsList.length > 0) {
                const spellDetails = await fetchDetailsInChunks<ApiSpell>(allSpellOptionsList, DndApiService.getSpellDetails, () => {});
                setRacialSpellOptions(spellDetails.map(translateSpell));
            }

            setRacialSpellTraits(spellChoiceTraits.map(t => ({
                traitName: t.name,
                choose: t.trait_specific!.spell_options!.choose,
                options: t.trait_specific!.spell_options!.from.options.map((opt: any) => opt.item),
            })));
        };

        fetchRacialTraitsAndSpells();
    }, [raceDetails, subraceDetails]);

    useEffect(() => {
        const finalizeEquipmentSelections = async () => {
            if (isEquipmentLoading) return;
    
            const finalItems: InventoryItem[] = [];
            for (const group of equipmentChoiceGroups) {
                const selection = equipmentSelections[group.id];
                if (!selection || selection.main === undefined || selection.main < 0) continue;

                const isCategoryChoice = group.choice.from.option_set_type === 'equipment_category';
                const options = group.choice.from.options || (isCategoryChoice ? [group.choice.from] : []);
                
                if (selection.main >= options.length) continue;

                const mainOption = options[selection.main];
    
                if (mainOption.option_type === 'counted_reference' && mainOption.of) {
                    const details = await DndApiService.getEquipmentDetails(mainOption.of.index);
                    finalItems.push({ ...details, ...mainOption.of, id: uuidv4(), quantity: mainOption.count || 1, equipped: false });
                } else if (mainOption.option_type === 'multiple' && mainOption.items) {
                    for(const subItem of mainOption.items){
                        if(subItem.option_type === 'counted_reference' && subItem.of) {
                            const details = await DndApiService.getEquipmentDetails(subItem.of.index);
                            finalItems.push({ ...details, ...subItem.of, id: uuidv4(), quantity: subItem.count || 1, equipped: false });
                        }
                    }
                } else if ((mainOption.option_type === 'choice' || isCategoryChoice) && selection.sub !== undefined) {
                    const subOptions = subChoiceOptions[group.id];
                    if (subOptions && subOptions[selection.sub]) {
                        const chosenSubItem = subOptions[selection.sub];
                        const details = await DndApiService.getEquipmentDetails(chosenSubItem.index);
                        finalItems.push({ ...details, ...chosenSubItem, id: uuidv4(), quantity: 1, equipped: false });
                    }
                }
            }
            setFinalizedEquipment(finalItems);
        };
    
        finalizeEquipmentSelections();
    }, [equipmentSelections, equipmentChoiceGroups, subChoiceOptions, isEquipmentLoading]);

    const handleAttributeChange = useCallback((attr: keyof Attributes, delta: 1 | -1) => {
        setBaseAttributes(attrs => {
            const currentBase = attrs[attr];
            if (delta === 1) {
                if (currentBase >= 15) return attrs;
                const cost = getCostOfNextLevel(currentBase);
                if (points >= cost) {
                    setPoints(p => p - cost);
                    return { ...attrs, [attr]: currentBase + 1 };
                }
            } else {
                if (currentBase <= 8) return attrs;
                const refund = getRefundForPrevLevel(currentBase);
                setPoints(p => p + refund);
                return { ...attrs, [attr]: currentBase - 1 };
            }
            return attrs;
        });
    }, [points]);

    const handleSuggestAttributes = useCallback(() => {
        if (!characterClass) return;
        const suggestedOrder = attributeSuggestions[characterClass];
        if (!suggestedOrder) return;

        const standardArray = [15, 14, 13, 12, 10, 8];
        const newAttributes: Partial<Attributes> = {};
        suggestedOrder.forEach((attr, index) => {
            newAttributes[attr] = standardArray[index];
        });

        setBaseAttributes(newAttributes as Attributes);
        setPoints(0);
    }, [characterClass]);

    const handleProficiencyChange = useCallback((profIndex: string, choiceGroup: ProficiencyChoiceWithSource) => {
        setProficiencySelections(prev => {
            const newSelections = { ...prev };
            const currentGroup = newSelections[choiceGroup.id] || [];
            const isSelected = currentGroup.includes(profIndex);

            if (isSelected) {
                newSelections[choiceGroup.id] = currentGroup.filter(p => p !== profIndex);
            } else if (currentGroup.length < choiceGroup.choose) {
                newSelections[choiceGroup.id] = [...currentGroup, profIndex];
            }
            return newSelections;
        });
    }, []);

    const handleEquipmentChange = useCallback(async (groupId: string, mainIndexStr: string, subIndexStr?: string) => {
        const mainIndex = parseInt(mainIndexStr, 10);
        const subIndex = subIndexStr !== undefined ? parseInt(subIndexStr, 10) : undefined;

        setEquipmentSelections(prev => ({
            ...prev,
            [groupId]: { main: mainIndex, sub: subIndex }
        }));
    
        const group = equipmentChoiceGroups.find(g => g.id === groupId);
        if (!group) return;
        
        const isCategoryChoice = group.choice.from.option_set_type === 'equipment_category';
        const options = group.choice.from.options || (isCategoryChoice ? [group.choice.from] : []);
        const selectedOption = options[mainIndex];
    
        const needsSubChoice = selectedOption?.option_type === 'choice' || isCategoryChoice;

        if (needsSubChoice) {
            setIsSubchoiceLoading(prev => ({ ...prev, [groupId]: true }));
            const categoryUrl = isCategoryChoice 
                ? (group.choice.from.equipment_category as ApiListItem).url 
                : (selectedOption as any).choice.from.equipment_category.url;
            
            const categoryIndex = categoryUrl.split('/').pop();
            
            if(categoryIndex){
                const categoryData = await DndApiService.getEquipmentForCategory(categoryIndex);
                setSubChoiceOptions(prev => ({ ...prev, [groupId]: categoryData?.equipment || [] }));
            }
            
            setIsSubchoiceLoading(prev => ({ ...prev, [groupId]: false }));
            
            if (subIndex === undefined) {
                 setEquipmentSelections(prev => ({
                    ...prev,
                    [groupId]: { main: mainIndex, sub: undefined }
                }));
            }
        } else {
             setSubChoiceOptions(prev => {
                const next = {...prev};
                delete next[groupId];
                return next;
             });
        }
    }, [equipmentChoiceGroups]);


    const handleLanguageChange = useCallback((index: number, value: string) => {
        setChosenLanguages(prev => {
            const newLangs = [...prev];
            newLangs[index] = value;
            return newLangs;
        });
    }, []);

    const handlePersonalityTraitChange = useCallback((trait: string) => {
        const limit = backgroundDetails?.personality_traits?.choose || 0;
        setPersonalityTraits(prev => {
            if (prev.includes(trait)) {
                return prev.filter(t => t !== trait);
            }
            return prev.length < limit ? [...prev, trait] : prev;
        });
    }, [backgroundDetails]);
    
    const handleClassSpellChange = useCallback((spellIndex: string) => {
        setChosenClassSpells(prev => {
            const spell = classSpellOptions.find(s => s.index === spellIndex);
            if (!spell || !classDetails || !classLevels) return prev;

            const isCantrip = spell.level === 0;
            const limit = isCantrip ? getCantripsKnown(classLevels, 1) : getSpellsKnown(1, classLevels, classDetails, finalAttributes);
            const currentSelected = prev.filter(sIdx => classSpellOptions.some(s => s.index === sIdx && s.level === spell.level));

            if (prev.includes(spellIndex)) {
                return prev.filter(s => s !== spellIndex);
            }
            if (currentSelected.length < limit) {
                return [...prev, spellIndex];
            }
            return prev;
        });
    }, [classSpellOptions, classDetails, classLevels, finalAttributes]);

    const handleRacialSpellChange = useCallback((traitName: string, spellIndex: string, limit: number) => {
        setChosenRacialSpells(prev => {
            const currentSelected = prev[traitName] || [];
            if (currentSelected.includes(spellIndex)) {
                return { ...prev, [traitName]: currentSelected.filter(s => s !== spellIndex) };
            }
            if (currentSelected.length < limit) {
                return { ...prev, [traitName]: [...currentSelected, spellIndex] };
            }
            return prev;
        });
    }, []);

    const handleRaceChange = useCallback(async (newRaceIndex: string) => {
        setRace(newRaceIndex);
        setSubrace('');
        setRaceDetails(null);
        setSubraceDetails(null);
        resetSelections();

        if (newRaceIndex) {
            const details = await DndApiService.getRaceDetails(newRaceIndex);
            setRaceDetails(details);
        } 
    }, [resetSelections]);
    
    const handleSubraceChange = useCallback(async (newSubraceIndex: string) => {
        setSubrace(newSubraceIndex);
        setSubraceDetails(null);
        setRacialSpellOptions([]);
        setRacialSpellTraits([]);
        setChosenRacialSpells({});
        setProficiencySelections(prev => {
            const next = {...prev};
            Object.keys(next).forEach(key => {
                if (key.startsWith('subrace')) {
                    delete next[key];
                }
            });
            return next;
        });

        if (newSubraceIndex) {
            const details = await DndApiService.getSubraceDetails(newSubraceIndex);
            setSubraceDetails(details);
        } 
    }, []);

    const handleClassChange = useCallback(async (newClassIndex: string) => {
        setCharacterClass(newClassIndex);
        setClassDetails(null);
        setClassLevels(null);
        setClassSpellOptions([]);
        resetSelections();

        if (newClassIndex) {
            setIsEquipmentLoading(true);
            setIsSpellsLoading(true);
            setSpellsLoadingProgress('Carregando detalhes da classe...');
            const details = await DndApiService.getClassDetails(newClassIndex);
            setClassDetails(details);
            const levels = await DndApiService.getClassLevels(newClassIndex);
            setClassLevels(levels);

            if (details?.spellcasting) {
                const spellsResponse = await DndApiService.getSpellsForClass(newClassIndex);
                if (spellsResponse?.results) {
                    const spellDetails = await fetchDetailsInChunks(
                        spellsResponse.results,
                        DndApiService.getSpellDetails,
                        (loaded, total) => setSpellsLoadingProgress(`Carregando magias ${loaded} de ${total}...`)
                    );
                    setClassSpellOptions(spellDetails.filter((s): s is ApiSpell => s !== null && s.level <= 1).map(translateSpell));
                }
            }
            setIsSpellsLoading(false);
            setSpellsLoadingProgress(null);
            setIsEquipmentLoading(false);
        }
    }, [resetSelections]);

    const handleBackgroundChange = useCallback(async (newBackgroundIndex: string) => {
        setBackground(newBackgroundIndex);
        setBackgroundDetails(null);
        resetSelections();
        if (newBackgroundIndex) {
            setIsEquipmentLoading(true);
            const details = await DndApiService.getBackgroundDetails(newBackgroundIndex);
            setBackgroundDetails(details);
            setIsEquipmentLoading(false);
        }
    }, [resetSelections]);
    
    const buildCharacter = (): NewCharacterInfo | null => {
        if (!isComplete || !raceDetails || !classDetails || !backgroundDetails || !classLevels) return null;

        const allProficiencies: Proficiency[] = [
            ...Array.from(allFixedProficiencies.values()),
            ...Object.values(proficiencySelections).flat().map(profIndex => {
                for (const choiceGroup of allProficiencyChoices) {
                    const option = choiceGroup.options.find(opt => opt.index === profIndex);
                    if (option) return { index: option.index, name: option.name, url: option.url };
                }
                return null;
            }).filter((p): p is Proficiency => p !== null)
        ];
        
        const finalLanguages = [...baseLanguages, ...chosenLanguages.filter(l => l)];
        const allSpells = [...chosenClassSpells, ...Object.values(chosenRacialSpells).flat()];
        
        const finalInventory = [...fixedEquipment, ...finalizedEquipment];
        
        const inventoryWithoutGold = finalInventory.filter(i => !(i.name.toLowerCase().includes("pouch") && i.desc?.[0].toLowerCase().includes("gold")));

        return {
            name,
            race: raceDetails.name,
            subrace: subraceDetails?.name || null,
            characterClass: classDetails.name,
            subclass: null, 
            hitDie: classDetails.hit_die,
            background: backgroundDetails.name,
            alignment: alignment,
            attributes: finalAttributes,
            proficiencies: allProficiencies,
            languages: finalLanguages,
            inventory: inventoryWithoutGold,
            spells: allSpells,
            backstory,
            personalityTraits,
            ideal,
            bond,
            flaw,
            startingGold,
        };
    };

    return {
        name, setName,
        race, handleRaceChange,
        subrace, handleSubraceChange,
        characterClass, handleClassChange,
        background, handleBackgroundChange,
        alignment, setAlignment,
        backstory, setBackstory,
        points,
        baseAttributes,
        proficiencySelections, handleProficiencyChange,
        equipmentSelections, handleEquipmentChange,
        finalizedEquipment, setFinalizedEquipment,
        chosenClassSpells, handleClassSpellChange,
        chosenRacialSpells, handleRacialSpellChange,
        chosenLanguages, handleLanguageChange,
        personalityTraits, handlePersonalityTraitChange,
        ideal, setIdeal,
        bond, setBond,
        flaw, setFlaw,
        raceDetails,
        subraceDetails,
        classDetails,
        backgroundDetails,
        classLevels,
        racialBonuses,
        finalAttributes,
        baseLanguages,
        languageChoicesCount,
        allFixedProficiencies,
        allProficiencyChoices,
        unavailableProficiencies,
        equipmentChoiceGroups,
        fixedEquipment,
        startingGold,
        isEquipmentLoading,
        isSubchoiceLoading,
        subChoiceOptions,
        areAllEquipmentChoicesMade,
        classSpellOptions,
        racialSpellOptions,
        racialSpellTraits,
        isSpellsLoading,
        spellsLoadingProgress,
        handleAttributeChange,
        handleSuggestAttributes,
        isComplete,
        buildCharacter
    };
};
