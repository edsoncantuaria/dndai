// src/hooks/useCharacterCreation.ts
import { useState, useMemo, useEffect, useCallback } from 'react';
import * as DndApiService from '../services/dndApiService';
import { 
    ApiListItem, ApiRace, ApiClass, ApiBackground, ApiEquipmentOption, ApiClassLevel, ApiTrait, ApiSpell,
    Attributes, Proficiency, ProficiencyChoice, InventoryItem, ApiEquipment, ApiSubrace
} from '../types';
import { ATTRIBUTE_SHORT_MAP, getCantripsKnown, getSpellsKnown } from '../utils/characterUtils';
import { fetchDetailsInChunks } from '../utils/apiUtils';

export type ProficiencyChoiceWithSource = ProficiencyChoice & { 
    id: string; // Unique ID for React key
    source: 'Raça' | 'Classe' | 'Antecedente';
    options: ApiListItem[];
};

export const useCharacterCreation = (
    races: ApiListItem[],
    classes: ApiListItem[],
    backgrounds: ApiListItem[],
) => {
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
    const [equipmentChoices, setEquipmentChoices] = useState<Record<string, ApiEquipmentOption | null>>({});
    const [subChoiceOptions, setSubChoiceOptions] = useState<Record<string, ApiListItem[]>>({});
    const [subChoiceSelection, setSubChoiceSelection] = useState<Record<string, string>>({});
    const [selectedEquipmentDetails, setSelectedEquipmentDetails] = useState<Record<string, Partial<InventoryItem> | null>>({});
    const [chosenClassSpells, setChosenClassSpells] = useState<string[]>([]);
    const [chosenRacialSpells, setChosenRacialSpells] = useState<Record<string, string[]>>({});
    const [chosenLanguages, setChosenLanguages] = useState<string[]>([]);
    
    // Personality from background
    const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
    const [ideal, setIdeal] = useState('');
    const [bond, setBond] = useState('');
    const [flaw, setFlaw] = useState('');

    // Loading & Temp Data
    const [isSpellsLoading, setIsSpellsLoading] = useState(false);
    const [spellsLoadingProgress, setSpellsLoadingProgress] = useState<string | null>(null);
    const [classSpellOptions, setClassSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellOptions, setRacialSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellTraits, setRacialSpellTraits] = useState<{ traitName: string; choose: number; options: ApiListItem[] }[]>([]);
    

    // --- MEMOIZED DERIVED STATE ---

    const racialBonuses = useMemo<Partial<Attributes>>(() => {
        const bonuses: Partial<Attributes> = {};
        (raceDetails?.ability_bonuses || []).forEach(b => {
            const attrKey = ATTRIBUTE_SHORT_MAP[b.ability_score.index];
            if(attrKey) bonuses[attrKey] = (bonuses[attrKey] || 0) + b.bonus;
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
                options: choice.from.options.map(o => o.item) 
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


    // --- CALLBACKS & EFFECTS ---

    const resetSelections = useCallback(() => {
        setProficiencySelections({});
        setEquipmentChoices({});
        setSubChoiceOptions({});
        setSubChoiceSelection({});
        setSelectedEquipmentDetails({});
        setChosenClassSpells([]);
        setChosenRacialSpells({});
        setRacialSpellOptions([]);
        setRacialSpellTraits([]);
        setPersonalityTraits([]);
        setIdeal('');
        setBond('');
        setFlaw('');
    }, []);

    // Effect to resize chosenLanguages array when choice count changes
    useEffect(() => {
        setChosenLanguages(Array(languageChoicesCount).fill(''));
    }, [languageChoicesCount]);

    // Effect to clean up proficiency selections if they become fixed
    useEffect(() => {
        const newSelections: Record<string, string[]> = {};
        for(const groupId in proficiencySelections) {
            const groupSelections = proficiencySelections[groupId];
            const stillAvailable = groupSelections.filter(profIndex => !allFixedProficiencies.has(profIndex));
            if(stillAvailable.length > 0) {
                newSelections[groupId] = stillAvailable;
            }
        }
        if(JSON.stringify(newSelections) !== JSON.stringify(proficiencySelections)) {
            setProficiencySelections(newSelections);
        }
    }, [allFixedProficiencies, proficiencySelections]);
    
    // Effect to fetch racial spell options
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
                t.trait_specific?.spell_options?.from?.options?.map(opt => opt.item) || []
            ).filter((item): item is ApiListItem => !!item);
            
            if (allSpellOptionsList.length > 0) {
                const spellDetails = await fetchDetailsInChunks<ApiSpell>(allSpellOptionsList, DndApiService.getSpellDetails, () => {});
                setRacialSpellOptions(spellDetails);
            }
            
            setRacialSpellTraits(spellChoiceTraits.map(t => ({
                traitName: t.name,
                choose: t.trait_specific!.spell_options!.choose,
                options: t.trait_specific!.spell_options!.from.options.map(opt => opt.item),
            })));
        };

        fetchRacialTraitsAndSpells();
    }, [raceDetails, subraceDetails]);

    const getCostOfNextLevel = (currentScore: number) => (currentScore >= 13 ? 2 : 1);
    const getRefundForPrevLevel = (currentScore: number) => (currentScore > 13 ? 2 : 1);

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
            } else { // delta === -1
                if (currentBase <= 8) return attrs;
                const refund = getRefundForPrevLevel(currentBase);
                setPoints(p => p + refund);
                return { ...attrs, [attr]: currentBase - 1 };
            }
            return attrs;
        });
    }, [points]);

    const handleSuggestAttributes = useCallback(() => {
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
        // Reset subrace-specific selections
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
                    setClassSpellOptions(spellDetails.filter(s => s.level <= 1));
                }
            }
            setIsSpellsLoading(false);
            setSpellsLoadingProgress(null);
        }
    }, [resetSelections]);

    const handleBackgroundChange = useCallback(async (newBackgroundIndex: string) => {
        setBackground(newBackgroundIndex);
        setBackgroundDetails(null);
        resetSelections();
        if (newBackgroundIndex) {
            const details = await DndApiService.getBackgroundDetails(newBackgroundIndex);
            setBackgroundDetails(details);
        }
    }, [resetSelections]);

    const { equipmentChoiceGroups, fixedEquipment } = useMemo(() => {
        const choiceGroups: { desc: string, choices: ApiEquipmentOption[] }[] = [];
        const fixed: { item: ApiEquipment, quantity: number }[] = [];

        (classDetails?.starting_equipment || []).forEach(eq => {
            if (eq.equipment) fixed.push({ item: eq.equipment, quantity: eq.quantity });
        });
        (backgroundDetails?.starting_equipment || []).forEach(eq => {
            if (eq.equipment) fixed.push({ item: eq.equipment, quantity: eq.quantity });
        });
        
        (classDetails?.starting_equipment_options || []).forEach(choice => {
            choiceGroups.push({ desc: `Escolha de Equipamento (Classe)`, choices: [choice] });
        });
        (backgroundDetails?.starting_equipment_options || []).forEach(choice => {
            choiceGroups.push({ desc: `Escolha de Equipamento (Antecedente)`, choices: [choice] });
        });
        
        return { equipmentChoiceGroups: choiceGroups, fixedEquipment: fixed };
    }, [classDetails, backgroundDetails]);

    const handleEquipmentChange = useCallback(async (groupDesc: string, choiceIndex: string, optionIndex: string) => {
        const group = equipmentChoiceGroups.find(g => g.desc === groupDesc);
        if (!group) return;

        const choice = group.choices[parseInt(choiceIndex, 10)];
        const optionWrapper = choice.from.options[parseInt(optionIndex, 10)];
        const option = optionWrapper.item || optionWrapper;

        const key = `${groupDesc}-${choiceIndex}`;
        setEquipmentChoices(prev => ({...prev, [key]: option}));
        setSubChoiceSelection(prev => ({...prev, [key]: ''})); // Reset sub-choice

        if (option.type === 'choice' && option.from.option_set_type === 'equipment_category' && option.from.equipment_category?.index) {
            const data = await DndApiService.getEquipmentForCategory(option.from.equipment_category.index);
            setSubChoiceOptions(prev => ({ ...prev, [key]: data?.equipment || [] }));
            setSelectedEquipmentDetails(prev => ({ ...prev, [`choice-${key}`]: null })); // Clear direct choice details
        } else if (option.of?.index) {
            const details = await DndApiService.getEquipmentDetails(option.of.index);
            setSelectedEquipmentDetails(prev => ({ ...prev, [`choice-${key}`]: details }));
            setSubChoiceOptions(prev => ({...prev, [key]: []})); // Clear sub-choice options
        }
    }, [equipmentChoiceGroups]);

    const handleSubEquipmentChange = useCallback(async (groupDesc: string, choiceIndex: string, itemIndex: string) => {
        const key = `${groupDesc}-${choiceIndex}`;
        setSubChoiceSelection(prev => ({ ...prev, [key]: itemIndex }));
        const details = await DndApiService.getEquipmentDetails(itemIndex);
        setSelectedEquipmentDetails(prev => ({ ...prev, [`subchoice-${key}`]: details }));
    }, []);

    return {
        // Simple state
        name, setName,
        race, setRace,
        subrace, setSubrace,
        characterClass, setCharacterClass,
        background, setBackground,
        alignment, setAlignment,
        backstory, setBackstory,
        points, setPoints,
        baseAttributes, setBaseAttributes,
        personalityTraits, setPersonalityTraits,
        ideal, setIdeal,
        bond, setBond,
        flaw, setFlaw,
        // Handlers & Callbacks
        handleRaceChange,
        handleSubraceChange,
        handleClassChange,
        handleBackgroundChange,
        handleAttributeChange,
        handleSuggestAttributes,
        handleProficiencyChange,
        handleLanguageChange,
        handlePersonalityTraitChange,
        handleEquipmentChange,
        handleSubEquipmentChange,
        handleClassSpellChange,
        handleRacialSpellChange,
        // API Data & Derived State
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
        // Selection states
        proficiencySelections,
        equipmentChoices,
        subChoiceOptions,
        subChoiceSelection,
        selectedEquipmentDetails,
        chosenClassSpells,
        chosenRacialSpells,
        chosenLanguages,
        // Loading states
        isSpellsLoading,
        spellsLoadingProgress,
        // Spell Options
        classSpellOptions,
        racialSpellOptions,
        racialSpellTraits,
    };
};
