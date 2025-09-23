import { useState, useMemo, useEffect, useCallback } from 'react';
import * as DndApiService from '../services/dndApiService';
import {
    ApiListItem, ApiRace, ApiClass, ApiBackground, ApiClassLevel, ApiTrait, ApiSpell,
    Attributes, Proficiency, ProficiencyChoice, ApiEquipmentOption, InventoryItem, ApiEquipment, ApiSubrace
} from '../types';
import { ATTRIBUTE_SHORT_MAP, getCantripsKnown, getSpellsKnown } from '../utils/characterUtils';
import { fetchDetailsInChunks } from '../utils/apiUtils';
import { getCostOfNextLevel, getRefundForPrevLevel } from '../utils/creationHelpers';
import { translateSpell } from '../utils/TranslatorSpells';
import { translateEquipment } from '../utils/TranslatorEquipments';

export type ProficiencyChoiceWithSource = ProficiencyChoice & {
    id: string;
    source: 'Raça' | 'Classe' | 'Antecedente';
    options: ApiListItem[];
};

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

export const useCharacterCreation = () => {
    const [name, setName] = useState('');
    const [race, setRace] = useState('');
    const [subrace, setSubrace] = useState('');
    const [characterClass, setCharacterClass] = useState('');
    const [background, setBackground] = useState('');
    const [alignment, setAlignment] = useState('');
    const [backstory, setBackstory] = useState('');
    const [points, setPoints] = useState(27);
    const [baseAttributes, setBaseAttributes] = useState<Attributes>({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 });
    const [raceDetails, setRaceDetails] = useState<ApiRace | null>(null);
    const [subraceDetails, setSubraceDetails] = useState<ApiSubrace | null>(null);
    const [classDetails, setClassDetails] = useState<ApiClass | null>(null);
    const [backgroundDetails, setBackgroundDetails] = useState<ApiBackground | null>(null);
    const [classLevels, setClassLevels] = useState<ApiClassLevel[] | null>(null);
    const [proficiencySelections, setProficiencySelections] = useState<Record<string, string[]>>({});
    const [equipmentChoices, setEquipmentChoices] = useState<Record<string, ApiEquipmentOption>>({});
    const [subChoiceOptions, setSubChoiceOptions] = useState<Record<string, ApiListItem[]>>({});
    const [subChoiceSelection, setSubChoiceSelection] = useState<Record<string, string>>({});
    const [chosenClassSpells, setChosenClassSpells] = useState<string[]>([]);
    const [chosenRacialSpells, setChosenRacialSpells] = useState<Record<string, string[]>>({});
    const [chosenLanguages, setChosenLanguages] = useState<string[]>([]);
    const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
    const [ideal, setIdeal] = useState('');
    const [bond, setBond] = useState('');
    const [flaw, setFlaw] = useState('');
    const [selectedEquipmentDetails, setSelectedEquipmentDetails] = useState<Record<string, Partial<InventoryItem> | null>>({});
    const [isSpellsLoading, setIsSpellsLoading] = useState(false);
    const [spellsLoadingProgress, setSpellsLoadingProgress] = useState<string | null>(null);
    const [classSpellOptions, setClassSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellOptions, setRacialSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellTraits, setRacialSpellTraits] = useState<{ traitName: string; choose: number; options: ApiListItem[] }[]>([]);

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
            if (!choice) return;
            choices.push({
                ...choice,
                id: `${idPrefix}-${choices.length}`,
                source,
                options: choice.from?.options?.map(o => o.item).filter(item => !allFixedProficiencies.has(item.index)) || []
            });
        };

        addChoice(raceDetails?.starting_proficiency_options, 'Raça', 'race');
        addChoice(subraceDetails?.starting_proficiency_options, 'Raça', 'subrace');
        (classDetails?.proficiency_choices || []).forEach((c, i) => addChoice(c, 'Classe', `class-${i}`));
        addChoice(backgroundDetails?.starting_proficiency_options, 'Antecedente', 'bg');

        return choices;
    }, [raceDetails, subraceDetails, classDetails, backgroundDetails, allFixedProficiencies]);

    const unavailableProficiencies = useMemo(() => {
        return new Set([...Array.from(allFixedProficiencies.keys()), ...Object.values(proficiencySelections).flat()]);
    }, [allFixedProficiencies, proficiencySelections]);

    const { equipmentChoiceGroups, fixedEquipment } = useMemo(() => {
        const choiceGroups: { desc: string, choices: ApiEquipmentOption[] }[] = [];
        const fixed: { item: ApiEquipment, quantity: number }[] = [];
        
        const classEq = classDetails?.starting_equipment || [];
        const backgroundEq = backgroundDetails?.starting_equipment || [];

        [...classEq, ...backgroundEq].forEach(eq => {
            fixed.push({ item: eq.equipment, quantity: eq.quantity });
        });

        const classChoices = classDetails?.starting_equipment_options || [];
        if (classChoices.length > 0) {
            choiceGroups.push({ desc: "Equipamento da Classe", choices: classChoices });
        }

        const backgroundChoices = backgroundDetails?.starting_equipment_options || [];
        if (backgroundChoices.length > 0) {
            choiceGroups.push({ desc: "Equipamento do Antecedente", choices: backgroundChoices });
        }

        return { equipmentChoiceGroups: choiceGroups, fixedEquipment: fixed };
    }, [classDetails, backgroundDetails]);

    const resetSelections = useCallback(() => {
        setProficiencySelections({});
        setEquipmentChoices({});
        setSubChoiceOptions({});
        setSubChoiceSelection({});
        setChosenClassSpells([]);
        setChosenRacialSpells({});
        setRacialSpellOptions([]);
        setRacialSpellTraits([]);
        setSelectedEquipmentDetails({});
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
                t.trait_specific?.spell_options?.from?.options?.map(opt => opt.item) || []
            ).filter((item): item is ApiListItem => !!item);
            
            if (allSpellOptionsList.length > 0) {
                const spellDetails = await fetchDetailsInChunks<ApiSpell>(allSpellOptionsList, DndApiService.getSpellDetails, () => {});
                setRacialSpellOptions(spellDetails.map(translateSpell));
            }

            setRacialSpellTraits(spellChoiceTraits.map(t => ({
                traitName: t.name,
                choose: t.trait_specific!.spell_options!.choose,
                options: t.trait_specific!.spell_options!.from.options.map(opt => opt.item),
            })));
        };

        fetchRacialTraitsAndSpells();
    }, [raceDetails, subraceDetails]);

    const handleAttributeChange = (attr: keyof Attributes, delta: 1 | -1) => {
        const currentBase = baseAttributes[attr];
        if (delta === 1) {
            if (currentBase >= 15) return;
            const cost = getCostOfNextLevel(currentBase);
            if (points >= cost) {
                setPoints(p => p - cost);
                setBaseAttributes(attrs => ({ ...attrs, [attr]: currentBase + 1 }));
            }
        } else {
            if (currentBase <= 8) return;
            const refund = getRefundForPrevLevel(currentBase);
            setPoints(p => p + refund);
            setBaseAttributes(attrs => ({ ...attrs, [attr]: currentBase - 1 }));
        }
    };

    const handleSuggestAttributes = () => {
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
    };

    const handleProficiencyChange = (profIndex: string, choiceGroup: ProficiencyChoiceWithSource) => {
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
    };

    const handleLanguageChange = (index: number, value: string) => {
        setChosenLanguages(prev => {
            const newLangs = [...prev];
            newLangs[index] = value;
            return newLangs;
        });
    };

    const handlePersonalityTraitChange = (trait: string) => {
        const limit = backgroundDetails?.personality_traits?.choose || 0;
        setPersonalityTraits(prev => {
            if (prev.includes(trait)) {
                return prev.filter(t => t !== trait);
            }
            return prev.length < limit ? [...prev, trait] : prev;
        });
    };

    const handleEquipmentChange = async (groupDesc: string, choiceIndex: number, optionIdxString: string) => {
        const optionIndex = parseInt(optionIdxString, 10);
        const group = equipmentChoiceGroups.find(g => g.desc === groupDesc);
        const choice = group?.choices[choiceIndex];
        const option = choice?.from.options?.[optionIndex];

        if (!option) return;

        const choiceKey = `${groupDesc}-${choiceIndex}`;
        setEquipmentChoices(prev => ({ ...prev, [choiceKey]: option }));

        setSubChoiceSelection(prev => { const next = {...prev}; delete next[choiceKey]; return next; });
        setSelectedEquipmentDetails(prev => {
            const next = {...prev};
            delete next[`choice-${choiceKey}`];
            delete next[`subchoice-${choiceKey}`];
            return next;
        });

        if (option.type === 'choice' && option.from.option_set_type === 'equipment_category' && option.from.equipment_category?.index) {
            const data = await DndApiService.getEquipmentForCategory(option.from.equipment_category.index);
            setSubChoiceOptions(prev => ({ ...prev, [choiceKey]: data?.equipment || [] }));
        } else if (option.of) {
            const details = await DndApiService.getEquipmentDetails(option.of.index);
            setSelectedEquipmentDetails(prev => ({ ...prev, [`choice-${choiceKey}`]: translateEquipment(details) }));
        }
    };

    const handleSubEquipmentChange = async (groupDesc: string, choiceIndex: number, itemIndex: string) => {
        const choiceKey = `${groupDesc}-${choiceIndex}`;
        if (!itemIndex) return;
        setSubChoiceSelection(prev => ({ ...prev, [choiceKey]: itemIndex }));
        const details = await DndApiService.getEquipmentDetails(itemIndex);
        setSelectedEquipmentDetails(prev => ({ ...prev, [`subchoice-${choiceKey}`]: translateEquipment(details) }));
    };

    const handleClassSpellChange = (spellIndex: string) => {
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
    };

    const handleRacialSpellChange = (traitName: string, spellIndex: string, limit: number) => {
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
    };

    const handleRaceChange = async (newRaceIndex: string) => {
        setRace(newRaceIndex);
        setSubrace('');
        setRaceDetails(null);
        setSubraceDetails(null);
        resetSelections();

        if (newRaceIndex) {
            const details = await DndApiService.getRaceDetails(newRaceIndex);
            setRaceDetails(details);
        } 
    };
    
    const handleSubraceChange = async (newSubraceIndex: string) => {
        setSubrace(newSubraceIndex);
        setSubraceDetails(null);
        // Reset racial-specific selections when subrace changes
        setRacialSpellOptions([]);
        setRacialSpellTraits([]);
        setChosenRacialSpells({});
        // Also reset proficiency selections that might depend on subrace
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
    };

    const handleClassChange = async (newClassIndex: string) => {
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
                    setClassSpellOptions(spellDetails.filter(s => s.level <= 1).map(translateSpell));
                }
            }
            setIsSpellsLoading(false);
            setSpellsLoadingProgress(null);
        }
    };

    const handleBackgroundChange = async (newBackgroundIndex: string) => {
        setBackground(newBackgroundIndex);
        setBackgroundDetails(null);
        resetSelections();
        if (newBackgroundIndex) {
            const details = await DndApiService.getBackgroundDetails(newBackgroundIndex);
            setBackgroundDetails(details);
        }
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
        equipmentChoices, handleEquipmentChange,
        subChoiceOptions,
        subChoiceSelection, handleSubEquipmentChange,
        chosenClassSpells, handleClassSpellChange,
        chosenRacialSpells, handleRacialSpellChange,
        chosenLanguages, handleLanguageChange,
        personalityTraits, handlePersonalityTraitChange,
        ideal, setIdeal,
        bond, setBond,
        flaw, setFlaw,
        selectedEquipmentDetails,
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
        classSpellOptions,
        racialSpellOptions,
        racialSpellTraits,
        isSpellsLoading,
        spellsLoadingProgress,
        handleAttributeChange,
        handleSuggestAttributes,
    };
};
