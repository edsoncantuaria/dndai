// hooks/newUseCharacterCreation.ts
import { useState, useMemo, useEffect, useCallback } from 'react';
import * as DndApiService from '../services/dndApiService';
import {
    ApiListItem, ApiRace, ApiClass, ApiBackground, ApiClassLevel, ApiTrait, ApiSpell,
    Attributes, Proficiency, ProficiencyChoice, InventoryItem, ApiSubrace, NewCharacterInfo, Feat
} from '../types';
import * as characterUtils from '../utils/characterUtils';
import { fetchDetailsInChunks } from '../utils/apiUtils';
import { getCostForScore, getPointsForScore, rollAttribute } from '@/utils/creationHelpers';
import { translateApiString, translateSpell } from '@/utils/translator';
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

export const useNewCharacterCreation = ({ allLanguages }: { allLanguages: ApiListItem[] }) => {
    // --- STATE MANAGEMENT ---
    // Basic character info
    const [name, setName] = useState('');
    const [race, setRace] = useState('');
    const [subrace, setSubrace] = useState('');
    const [characterClass, setCharacterClass] = useState('');
    const [background, setBackground] = useState('');
    const [alignment, setAlignment] = useState('');
    const [backstory, setBackstory] = useState('');

    // Appearance
    const [sex, setSex] = useState<'Masculino' | 'Feminino' | 'Outro'>('Masculino');
    const [hairStyle, setHairStyle] = useState<'Careca' | 'Curto' | 'Médio' | 'Longo'>('Curto');
    const [beardStyle, setBeardStyle] = useState<'Sem Barba' | 'Curta' | 'Grande'>('Sem Barba');
    const [skinColor, setSkinColor] = useState<'Branca' | 'Parda' | 'Negra' | 'Indígena' | 'Amarela'>('Parda');


    // Attributes
    const [attributeMethod, setAttributeMethod] = useState<'point-buy' | 'roll' | null>(null);
    const [points, setPoints] = useState(27);
    const [baseAttributes, setBaseAttributes] = useState<Attributes>({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 });

    // Fetched API Details
    const [raceDetails, setRaceDetails] = useState<ApiRace | null>(null);
    const [subraceDetails, setSubraceDetails] = useState<ApiSubrace | null>(null);
    const [classDetails, setClassDetails] = useState<ApiClass | null>(null);
    const [backgroundDetails, setBackgroundDetails] = useState<ApiBackground | null>(null);
    const [classLevels, setClassLevels] = useState<ApiClassLevel[] | null>(null);
    const [subclassFlavor, setSubclassFlavor] = useState<string | null>(null);
    
    // Selections
    const [proficiencySelections, setProficiencySelections] = useState<Record<string, string[]>>({});
    const [equipmentSelections, setEquipmentSelections] = useState<Record<string, { main?: number, sub?: number }>>({});
    const [finalizedEquipment, setFinalizedEquipment] = useState<InventoryItem[]>([]);
    const [chosenClassSpells, setChosenClassSpells] = useState<string[]>([]);
    const [chosenRacialSpells, setChosenRacialSpells] = useState<Record<string, string[]>>({});
    const [chosenLanguages, setChosenLanguages] = useState<string[]>([]);
    const [traitSelections, setTraitSelections] = useState<Record<string, string>>({});
    
    // Feats
    const [isFeatsLoading, setIsFeatsLoading] = useState(false);
    const [availableFeats, setAvailableFeats] = useState<Feat[]>([]);
    const [selectedFeat, setSelectedFeat] = useState<string>('');
    const [isVariantHuman, setIsVariantHuman] = useState(false);
    const [variantHumanBonusSelections, setVariantHumanBonusSelections] = useState<(keyof Attributes)[]>([]);


    // Dragonborn specific state
    const [draconicAncestry, setDraconicAncestry] = useState('');
    const [draconicAncestryOptions, setDraconicAncestryOptions] = useState<ApiListItem[]>([]);
    const [selectedAncestryDetails, setSelectedAncestryDetails] = useState<ApiTrait | null>(null);
    const [isDraconicAncestryLoading, setIsDraconicAncestryLoading] = useState(false);


    // Personality
    const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
    const [ideal, setIdeal] = useState('');
    const [bond, setBond] = useState('');
    const [flaw, setFlaw] = useState('');

    // Loading & Temp Data
    const [isSpellsLoading, setIsSpellsLoading] = useState(false);
    const [spellsLoadingProgress, setSpellsLoadingProgress] = useState<string | null>(null);
    const [isEquipmentLoading, setIsEquipmentLoading] = useState(false);
    const [classSpellOptions, setClassSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellOptions, setRacialSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellTraits, setRacialSpellTraits] = useState<{ traitName: string; choose: number; options: ApiListItem[] }[]>([]);
    const [traitChoiceDetails, setTraitChoiceDetails] = useState<ApiTrait[]>([]);
    const [subclassSpells, setSubclassSpells] = useState<ApiSpell[]>([]);
    
    // --- MEMOIZED DERIVED STATE ---

    const racialBonuses = useMemo<Partial<Attributes>>(() => {
        const bonuses: Partial<Attributes> = {};
        
        if (isVariantHuman) {
            variantHumanBonusSelections.forEach(attr => {
                bonuses[attr] = (bonuses[attr] || 0) + 1;
            });
            return bonuses;
        }
        
        const abilityBonusChoices = raceDetails?.ability_bonus_options;
    
        if (abilityBonusChoices?.from?.options?.[0]?.item?.index) {
            const selectionKey = abilityBonusChoices.from.options[0].item.index;
            const selection = traitSelections[selectionKey];
            if (selection) {
                const selectedBonus = abilityBonusChoices.from.options.find(o => o.item.index === selection);
                if(selectedBonus?.item) {
                     const attrKey = characterUtils.ATTRIBUTE_SHORT_MAP[selectedBonus.item.index.replace('ability-bonus-', '')];
                    if (attrKey) bonuses[attrKey] = (bonuses[attrKey] || 0) + 1;
                }
            }
        }
    
        (raceDetails?.ability_bonuses || []).forEach(b => {
            if (b && b.ability_score && b.ability_score.index) {
                const attrKey = characterUtils.ATTRIBUTE_SHORT_MAP[b.ability_score.index];
                if (attrKey) bonuses[attrKey] = (bonuses[attrKey] || 0) + b.bonus;
            }
        });
        (subraceDetails?.ability_bonuses || []).forEach(b => {
            if (b && b.ability_score && b.ability_score.index) {
                const attrKey = characterUtils.ATTRIBUTE_SHORT_MAP[b.ability_score.index];
                if (attrKey) bonuses[attrKey] = (bonuses[attrKey] || 0) + b.bonus;
            }
        });
        return bonuses;
    }, [raceDetails, subraceDetails, traitSelections, isVariantHuman, variantHumanBonusSelections]);

    const finalAttributes = useMemo<Attributes>(() =>
        (Object.keys(baseAttributes) as Array<keyof Attributes>).reduce((acc, key) => {
            acc[key] = baseAttributes[key] + (racialBonuses[key] || 0);
            return acc;
        }, {} as Attributes)
    , [baseAttributes, racialBonuses]);

    const { cantripsKnown, spellsKnown } = useMemo(() => {
        if (!classDetails || !classLevels) return { cantripsKnown: 0, spellsKnown: 0 };
        const level1Data = classLevels.find(l => l.level === 1);
        if (!level1Data) return { cantripsKnown: 0, spellsKnown: 0 };

        return {
            cantripsKnown: characterUtils.getCantripsKnown(level1Data),
            spellsKnown: characterUtils.getSpellsKnown(1, level1Data, classDetails, finalAttributes)
        }
    }, [classDetails, classLevels, finalAttributes]);

    const { baseLanguages, languageChoicesCount } = useMemo(() => {
        let choices = isVariantHuman ? 1 : 0;
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
    }, [raceDetails, subraceDetails, backgroundDetails, isVariantHuman]);

    const allFixedProficiencies = useMemo<Map<string, Proficiency>>(() => {
        const profs = new Map<string, Proficiency>();
        const addProfs = (profList: Proficiency[] | undefined) =>
            (profList || []).forEach(p => profs.set(p.index, { ...p }));
        
        if (isVariantHuman) {
            // Variant humans don't get the standard +1 to all stats and default languages
        } else {
             addProfs(raceDetails?.starting_proficiencies);
        }
        
        addProfs(subraceDetails?.starting_proficiencies);
        addProfs(classDetails?.proficiencies);
        addProfs(backgroundDetails?.starting_proficiencies);
        (classDetails?.saving_throws || []).forEach(st => profs.set(`saving-throw-${st.index}`, { index: st.index, name: `Saving Throw: ${st.name}`, url: st.url }));

        return profs;
    }, [raceDetails, subraceDetails, classDetails, backgroundDetails, isVariantHuman]);

    const allProficiencyChoices = useMemo<ProficiencyChoiceWithSource[]>(() => {
        const choices: ProficiencyChoiceWithSource[] = [];
        
        const processChoice = (choice: ProficiencyChoice | undefined, source: ProficiencyChoiceWithSource['source'], idPrefix: string) => {
            if (!choice || !choice.from?.options) return;

            choice.from.options.forEach((option, index) => {
                const newId = `${idPrefix}-${index}`;
                if (option.option_type === 'choice') {
                    processChoice(option.choice, source, newId);
                } else if (option.option_type === 'reference' && option.item) {
                     const descSlice = choice.desc ? choice.desc.substring(0, 10) : choice.type || 'default';
                     const parentId = `${idPrefix}-group-${descSlice}`;
                    const existingGroup = choices.find(c => c.id === parentId);
                    if (existingGroup) {
                        existingGroup.options.push(option.item);
                    } else {
                        choices.push({
                            ...choice,
                            id: parentId,
                            source,
                            options: [option.item]
                        });
                    }
                }
            });
        };
        
        (classDetails?.proficiency_choices || []).forEach((c, i) => processChoice(c, 'Classe', `class-${i}`));
        
        if (!isVariantHuman) {
            processChoice(raceDetails?.starting_proficiency_options, 'Raça', 'race');
        }
        processChoice(subraceDetails?.starting_proficiency_options, 'Raça', 'subrace');
        processChoice(backgroundDetails?.starting_proficiency_options, 'Antecedente', 'bg');

        if (isVariantHuman) {
            choices.push({
                id: 'variant-human-skill',
                source: 'Raça',
                desc: 'Escolha uma perícia (Humano Variante)',
                choose: 1,
                type: 'proficiencies',
                options: characterUtils.ALL_SKILLS.map(s => ({ index: `skill-${s.toLowerCase().replace(' ', '-')}`, name: `Skill: ${s}`, url: ''}))
            });
        }
        
        const groupedChoices: Record<string, ProficiencyChoiceWithSource> = {};
        choices.forEach(choice => {
            const key = `${choice.desc}-${choice.choose}`;
            if (groupedChoices[key]) {
                groupedChoices[key].options.push(...choice.options);
                // Ensure unique options
                groupedChoices[key].options = Array.from(new Set(groupedChoices[key].options.map(o => o.index))).map(index => groupedChoices[key].options.find(o => o.index === index)!);
            } else {
                groupedChoices[key] = { ...choice, id: key };
            }
        });

        return Object.values(groupedChoices);

    }, [raceDetails, subraceDetails, classDetails, backgroundDetails, isVariantHuman]);
    
    const unavailableProficiencies = useMemo(() => {
        return new Set([...Array.from(allFixedProficiencies.keys()), ...Object.values(proficiencySelections).flat()]);
    }, [allFixedProficiencies, proficiencySelections]);

    const canProceedFromProficiencies = useMemo(() => {
        const languageChoicesMet = chosenLanguages.filter(Boolean).length >= languageChoicesCount;
        const proficiencyChoicesMet = allProficiencyChoices.every(choice => {
            const selectedCount = proficiencySelections[choice.id]?.length || 0;
            const availableOptions = choice.options.filter(opt => opt && !allFixedProficiencies.has(opt.index));
            return selectedCount >= choice.choose || availableOptions.length === 0;
        });
        return languageChoicesMet && proficiencyChoicesMet;
    }, [allProficiencyChoices, proficiencySelections, allFixedProficiencies, chosenLanguages, languageChoicesCount]);

    const { equipmentChoiceGroups, fixedEquipment } = useMemo(() => {
        const choiceGroups: EquipmentChoiceGroup[] = [];
        let fixed: InventoryItem[] = [];
    
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

        // Add class-specific spellcasting focus if not already present
        const hasFocus = fixed.some(item => item.index.includes('focus') || item.index.includes('holy-symbol'));
        if (classDetails?.spellcasting && !hasFocus) {
            const classIndex = classDetails.index;
            if (classIndex === 'cleric' || classIndex === 'paladin') {
                fixed.push({ id: uuidv4(), index: 'holy-symbol', name: 'Holy Symbol', quantity: 1, equipped: true });
            } else if (classIndex === 'druid') {
                 fixed.push({ id: uuidv4(), index: 'druidic-focus', name: 'Druidic Focus', quantity: 1, equipped: true });
            } else if (['sorcerer', 'warlock', 'wizard'].includes(classIndex)) {
                 fixed.push({ id: uuidv4(), index: 'arcane-focus', name: 'Arcane Focus', quantity: 1, equipped: true });
            }
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
        return 0;
    }, [fixedEquipment]);

    const areAllEquipmentChoicesMade = useMemo(() => {
        return equipmentChoiceGroups.every(group => {
            const selection = equipmentSelections[group.id];
            
            // Direct category choice
            if (group.choice.from.option_set_type === 'equipment_category') {
                return selection?.sub !== undefined;
            }

            // For other choices, `main` must be defined.
            if (!selection || selection.main === undefined) return false;
            
            const options = group.choice.from.options || [];
            if (selection.main >= options.length) return false;
            const mainOption = options[selection.main];

            // If the main option itself requires a sub-choice, `sub` must be defined.
            if (mainOption?.option_type === 'choice') {
                return selection.sub !== undefined;
            }
            return true;
        });
    }, [equipmentChoiceGroups, equipmentSelections]);


    const isComplete = useMemo(() => {
        if (!name || !race || !characterClass || !background || !alignment) return false;
        
        if (attributeMethod === 'point-buy' && points > 0) return false;
        if (!attributeMethod) return false;

        if (raceDetails?.subraces?.length > 0 && !subrace) {
            // Subrace is optional, so this check might need adjustment if subrace is not a hard requirement
        }
        if(!canProceedFromProficiencies) return false;
        
        // Check for Draconic Ancestry selection
        if (race === 'dragonborn' && !draconicAncestry) {
            return false;
        }
        
        if(isVariantHuman && !selectedFeat) return false;
        if (isVariantHuman && variantHumanBonusSelections.length !== 2) return false;


        const cantripsKnownVal = cantripsKnown;
        const spellsKnownVal = spellsKnown;
        const selectedCantripsCount = chosenClassSpells.filter(sIndex => classSpellOptions.some(c => c.index === sIndex && c.level === 0)).length;
        const selectedSpellsCount = chosenClassSpells.filter(sIndex => classSpellOptions.some(c => c.index === sIndex && c.level > 0)).length;
        if (selectedCantripsCount !== cantripsKnownVal || selectedSpellsCount !== spellsKnownVal) {
            return false;
        }

        const racialSpellsDone = racialSpellTraits.every(trait => (chosenRacialSpells[trait.traitName]?.length || 0) === trait.choose);
        if (!racialSpellsDone) return false;

        return areAllEquipmentChoicesMade;
    }, [name, race, subrace, characterClass, background, alignment, points, attributeMethod, raceDetails, canProceedFromProficiencies, cantripsKnown, spellsKnown, chosenClassSpells, classSpellOptions, racialSpellTraits, chosenRacialSpells, areAllEquipmentChoicesMade, draconicAncestry, isVariantHuman, selectedFeat, variantHumanBonusSelections]);

    // --- CALLBACKS & EFFECTS ---
    
    useEffect(() => {
        const fetchFeats = async () => {
            if (isVariantHuman) {
                setIsFeatsLoading(true);
                const featsList = await DndApiService.getFeats();
                if (featsList?.results) {
                    const featDetails = await fetchDetailsInChunks(featsList.results, DndApiService.getFeatDetails, () => {});
                    setAvailableFeats(featDetails as Feat[]);
                }
                setIsFeatsLoading(false);
            }
        };
        fetchFeats();
    }, [isVariantHuman]);

    const resetSelections = useCallback((type: 'full' | 'class' | 'background') => {
        setProficiencySelections({});
        setFinalizedEquipment([]);
        setEquipmentSelections({});

        if (type === 'full') {
            setTraitSelections({});
            setDraconicAncestry('');
            setSelectedAncestryDetails(null);
            setChosenRacialSpells({});
            setPersonalityTraits([]);
            setIdeal('');
            setBond('');
            setFlaw('');
            setChosenClassSpells([]); // Also reset class spells if race changes
            setChosenLanguages([]);
            setTraitChoiceDetails([]); // Ensure racial trait choices are cleared
            setDraconicAncestryOptions([]); // Clear dragonborn options
            setSelectedFeat('');
            setIsVariantHuman(false);
            setVariantHumanBonusSelections([]);
        } else if (type === 'class') {
            setChosenClassSpells([]);
        } else if (type === 'background') {
            setPersonalityTraits([]);
            setIdeal('');
            setBond('');
            setFlaw('');
            // Reset only background-related language choices if needed
        }
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
            const allTraitList: ApiListItem[] = [
                ...(raceDetails?.traits || []),
                ...(subraceDetails?.racial_traits || [])
            ].filter(t => t);
    
            if (allTraitList.length === 0) {
                setRacialSpellTraits([]);
                setRacialSpellOptions([]);
                setTraitChoiceDetails([]);
                return;
            }
    
            const traitDetails = await fetchDetailsInChunks<ApiListItem, ApiTrait>(allTraitList, DndApiService.getTraitDetails, () => {});
            setTraitChoiceDetails(traitDetails.filter((t): t is ApiTrait => !!t));
            
            const newRacialSpellTraits: { traitName: string; choose: number; options: ApiListItem[] }[] = [];
            const spellOptionsToFetch = new Set<ApiListItem>();
    
            // Special Case: High Elf Cantrip
            const highElfTrait = traitDetails.find(t => t?.index === 'high-elf-cantrip');
            if (highElfTrait) {
                setIsSpellsLoading(true);
                const wizardSpellsResponse = await DndApiService.getSpellsForClass('wizard');
                const wizardCantrips = (wizardSpellsResponse?.results || []).filter((spell: any) => spell.level === 0 || spell.url.includes('level-0'));
                
                const cantripDetails = await fetchDetailsInChunks(wizardCantrips, DndApiService.getSpellDetails, () => {});
                const level0Cantrips = cantripDetails.filter(s => s && s.level === 0).map(s => ({ index: s!.index, name: s!.name, url: s!.url }));
                
                if (level0Cantrips.length > 0) {
                     newRacialSpellTraits.push({
                        traitName: 'Truque de Alto Elfo',
                        choose: 1, 
                        options: level0Cantrips
                    });
                    level0Cantrips.forEach(c => spellOptionsToFetch.add(c));
                }
                setIsSpellsLoading(false);
            }
    
            // General case for other racial spell traits
            for (const trait of traitDetails) {
                if (!trait || trait.index === 'high-elf-cantrip' || trait.index === 'draconic-ancestry') continue;
                
                const choice = trait.trait_specific?.spell_options || trait.trait_specific?.subfeature_options;
                if (choice && choice.from?.options) {
                    const options = choice.from.options.map((opt: any) => opt.item).filter(Boolean);
                    if (options.length > 0) {
                        newRacialSpellTraits.push({
                            traitName: trait.name,
                            choose: choice.choose,
                            options: options,
                        });
                        options.forEach((opt: ApiListItem) => spellOptionsToFetch.add(opt));
                    }
                }
            }

            if (spellOptionsToFetch.size > 0) {
                const fetchedSpellDetails = await fetchDetailsInChunks(Array.from(spellOptionsToFetch), DndApiService.getSpellDetails, () => {});
                setRacialSpellOptions(fetchedSpellDetails.filter((s): s is ApiSpell => s !== null).map(spell => translateSpell(spell) as ApiSpell));
            }
    
            setRacialSpellTraits(newRacialSpellTraits);
        };
    
        if (raceDetails) {
           fetchRacialTraitsAndSpells();
        }
    }, [raceDetails, subraceDetails]);

    useEffect(() => {
        const fetchAncestryDetails = async () => {
            if (!draconicAncestry) {
                setSelectedAncestryDetails(null);
                return;
            }

            const details = await DndApiService.getTraitDetails(draconicAncestry);
            setSelectedAncestryDetails(details);

            if (details?.trait_specific?.damage_type?.index) {
                const damageType = details.trait_specific.damage_type.index;
                const breathWeaponIndex = `breath-weapon-${damageType}`;
                setChosenRacialSpells(prev => ({ ...prev, 'Draconic Ancestry': [breathWeaponIndex] }));
            }
        };
        fetchAncestryDetails();
    }, [draconicAncestry]);

    useEffect(() => {
        const finalizeEquipmentSelections = async () => {
            const finalItems: InventoryItem[] = [];
            const processedItems = new Set<string>();

            for (const group of equipmentChoiceGroups) {
                const selection = equipmentSelections[group.id];
                if (!selection) continue;

                // Case 1: Direct category choice (e.g., Acolyte's Holy Symbol)
                if (group.choice.from.option_set_type === 'equipment_category' && selection.sub !== undefined) {
                    const categoryUrl = group.choice.from.equipment_category?.url;
                    if (!categoryUrl) continue;
                    const subOptionsData = await DndApiService.getEquipmentForCategory(group.choice.from.equipment_category!.index);
                    const subOptions = subOptionsData?.equipment || [];

                    if (subOptions && subOptions[selection.sub]) {
                        const chosenSubItem = subOptions[selection.sub];
                        const details = await DndApiService.getEquipmentDetails(chosenSubItem.index);
                        if(details && !processedItems.has(chosenSubItem.index)) {
                            finalItems.push({ ...details, ...chosenSubItem, id: uuidv4(), quantity: 1, equipped: false });
                            processedItems.add(chosenSubItem.index);
                        }
                    }
                } 
                // Case 2: Nested choice (e.g., weapon choices)
                else if (selection.main !== undefined) {
                    const mainOption = group.choice.from.options?.[selection.main];
                    if (!mainOption) continue;
    
                    if (mainOption.option_type === 'counted_reference' && mainOption.of) {
                        const details = await DndApiService.getEquipmentDetails(mainOption.of.index);
                         if(details && !processedItems.has(mainOption.of.index)){
                            finalItems.push({ ...details, ...mainOption.of, id: uuidv4(), quantity: mainOption.count || 1, equipped: false });
                            processedItems.add(mainOption.of.index);
                         }
                    } else if (mainOption.option_type === 'multiple' && mainOption.items) {
                        for (const subItem of mainOption.items) {
                            if (subItem.option_type === 'counted_reference' && subItem.of) {
                                const details = await DndApiService.getEquipmentDetails(subItem.of.index);
                                if(details && !processedItems.has(subItem.of.index)){
                                    finalItems.push({ ...details, ...subItem.of, id: uuidv4(), quantity: subItem.count || 1, equipped: false });
                                    processedItems.add(subItem.of.index);
                                }
                            }
                        }
                    } else if (mainOption.option_type === 'choice' && selection.sub !== undefined) {
                        const categoryUrl = mainOption.choice?.from?.equipment_category?.url;
                        if (!categoryUrl) continue;

                        const subOptionsData = await DndApiService.getEquipmentForCategory(mainOption.choice.from.equipment_category.index);
                        const subOptions = subOptionsData?.equipment || [];
                        if (subOptions && subOptions[selection.sub]) {
                            const chosenSubItem = subOptions[selection.sub];
                            const details = await DndApiService.getEquipmentDetails(chosenSubItem.index);
                            if(details && !processedItems.has(chosenSubItem.index)){
                                finalItems.push({ ...details, ...chosenSubItem, id: uuidv4(), quantity: 1, equipped: false });
                                processedItems.add(chosenSubItem.index);
                            }
                        }
                    }
                }
            }
            setFinalizedEquipment(finalItems);
        };
    
        if(areAllEquipmentChoicesMade) {
            finalizeEquipmentSelections();
        }
    }, [equipmentSelections, equipmentChoiceGroups, areAllEquipmentChoicesMade]);
    
    // --- ATTRIBUTE METHODS ---
    const handleAttributeChange = useCallback((attr: keyof Attributes, delta: 1 | -1) => {
        const currentScore = baseAttributes[attr];
        let newScore = currentScore + delta;
        
        if (newScore > 15 || newScore < 8) return;

        const oldPoints = getPointsForScore(currentScore);
        const newPoints = getPointsForScore(newScore);
        const cost = newPoints - oldPoints;
        
        if (points - cost >= 0) {
            setPoints(points - cost);
            setBaseAttributes(prev => ({ ...prev, [attr]: newScore }));
        }
    }, [baseAttributes, points]);

    const handleRollAttributes = useCallback(() => {
        const newAttributes = {
            strength: rollAttribute(),
            dexterity: rollAttribute(),
            constitution: rollAttribute(),
            intelligence: rollAttribute(),
            wisdom: rollAttribute(),
            charisma: rollAttribute(),
        };
        setBaseAttributes(newAttributes);
    }, []);

    const handleSuggestAttributes = useCallback(() => {
        if (!characterClass) return;
        const suggestedOrder = attributeSuggestions[characterClass];
        if (!suggestedOrder) return;

        const standardArray = [15, 14, 13, 12, 10, 8];
        const newAttributes: Partial<Attributes> = {};
        suggestedOrder.forEach((attr, index) => {
            newAttributes[attr] = standardArray[index];
        });
        
        const totalCost = Object.values(newAttributes).reduce((sum, score) => sum + getPointsForScore(score as number), 0);

        setBaseAttributes(newAttributes as Attributes);
        setPoints(27 - totalCost);
    }, [characterClass]);

    // --- OTHER HANDLERS ---
    const handleTraitSelection = (traitIndex: string, selection: string) => {
        setTraitSelections(prev => ({ ...prev, [traitIndex]: selection }));
    };

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

    const handleEquipmentChange = useCallback((groupId: string, mainIndexStr?: string, subIndexStr?: string) => {
        setEquipmentSelections(prev => {
            const newSelections = { ...prev };
            const currentSelection = newSelections[groupId] || {};

            const mainIndex = mainIndexStr !== undefined ? parseInt(mainIndexStr, 10) : currentSelection.main;
            const subIndex = subIndexStr !== undefined ? parseInt(subIndexStr, 10) : currentSelection.sub;

            // If main selection changes, reset sub selection
            if (mainIndexStr !== undefined && mainIndex !== currentSelection.main) {
                newSelections[groupId] = { main: mainIndex, sub: undefined };
            } else {
                newSelections[groupId] = { main: mainIndex, sub: subIndex };
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
            if (!spell) return prev;
    
            const isCantrip = spell.level === 0;
            const limit = isCantrip ? cantripsKnown : spellsKnown;
            const currentSelected = prev.filter(sIdx => {
                const s = classSpellOptions.find(opt => opt.index === sIdx);
                return s && s.level === spell.level;
            });
    
            if (prev.includes(spellIndex)) {
                return prev.filter(s => s !== spellIndex);
            }
            if (currentSelected.length < limit) {
                return [...prev, spellIndex];
            }
            return prev;
        });
    }, [classSpellOptions, cantripsKnown, spellsKnown]);

    const handleRacialSpellChange = useCallback((traitName: string, spellIndex: string, limit: number) => {
        setChosenRacialSpells(prev => {
            const newSelections = { ...prev };
            const currentSelected = newSelections[traitName] || [];
            
            if (currentSelected.includes(spellIndex)) {
                newSelections[traitName] = currentSelected.filter(s => s !== spellIndex);
            } else {
                 if (limit === 1) { // If only one choice is allowed, replace the existing one
                    newSelections[traitName] = [spellIndex];
                } else if (currentSelected.length < limit) {
                    newSelections[traitName] = [...currentSelected, spellIndex];
                }
            }
            return newSelections;
        });
    }, []);

    const handleRaceChange = useCallback(async (newRaceIndex: string) => {
        setRace(newRaceIndex);
        setSubrace('');
        setRaceDetails(null);
        setSubraceDetails(null);
        resetSelections('full');

        if (newRaceIndex) {
            const details = await DndApiService.getRaceDetails(newRaceIndex);
            setRaceDetails(details);
            
            if (newRaceIndex === 'dragonborn') {
                setIsDraconicAncestryLoading(true);
                const ancestryTrait = await DndApiService.getTraitDetails('draconic-ancestry');
                if (ancestryTrait?.trait_specific?.subtrait_options?.from?.options) {
                    setDraconicAncestryOptions(ancestryTrait.trait_specific.subtrait_options.from.options.map((o: any) => o.item));
                }
                setIsDraconicAncestryLoading(false);
            } else {
                setDraconicAncestryOptions([]);
            }
        } 
    }, [resetSelections]);
    
    const handleSubraceChange = useCallback(async (newSubraceIndex: string) => {
        setSubrace(newSubraceIndex);
        setSubraceDetails(null);
        setChosenRacialSpells({});

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
        setSubclassSpells([]);
        setSubclassFlavor(null);
        resetSelections('class');
    
        if (newClassIndex) {
            setIsEquipmentLoading(true);
    
            const detailsPromise = DndApiService.getClassDetails(newClassIndex);
            const levelsPromise = DndApiService.getClassLevels(newClassIndex);
    
            const [details, levels] = await Promise.all([detailsPromise, levelsPromise]);
    
            setClassDetails(details);
            setClassLevels(levels);
            setIsEquipmentLoading(false);
    
            if (details?.subclasses?.[0]) {
                const subClassDetails = await DndApiService.getSubclassDetails(details.subclasses[0].index);
                setSubclassFlavor(subClassDetails?.subclass_flavor || null);

                 if (subClassDetails?.spells) {
                    const level1SubclassSpells = subClassDetails.spells
                        .filter(s => s.prerequisites.some(p => p && p.type === 'level' && typeof p.spell === 'string' && p.spell.includes('1')))
                        .map(s => s.spell);
                    
                    if (level1SubclassSpells.length > 0) {
                        const spellDetails = await fetchDetailsInChunks(level1SubclassSpells, DndApiService.getSpellDetails, () => {});
                        setSubclassSpells(spellDetails.filter(Boolean) as ApiSpell[]);
                    }
                }
            }
    
            if (details?.spellcasting) {
                setIsSpellsLoading(true);
                setSpellsLoadingProgress('Carregando magias...');
    
                DndApiService.getSpellsForClass(newClassIndex).then(spellsResponse => {
                    if (spellsResponse?.results) {
                        fetchDetailsInChunks(
                            spellsResponse.results,
                            DndApiService.getSpellDetails,
                            (loaded, total) => setSpellsLoadingProgress(`Carregando magias ${loaded} de ${total}...`)
                        ).then(spellDetails => {
                            setClassSpellOptions(spellDetails.filter((s): s is ApiSpell => s !== null && s.level <= 1).map(spell => translateSpell(spell) as ApiSpell));
                            setIsSpellsLoading(false);
                            setSpellsLoadingProgress(null);
                        });
                    } else {
                        setIsSpellsLoading(false);
                        setSpellsLoadingProgress(null);
                    }
                });
            }
        }
    }, [resetSelections]);

    const handleBackgroundChange = useCallback(async (newBackgroundIndex: string) => {
        setBackground(newBackgroundIndex);
        setBackgroundDetails(null);
        resetSelections('background');
        if (newBackgroundIndex) {
            setIsEquipmentLoading(true);
            const details = await DndApiService.getBackgroundDetails(newBackgroundIndex);
            setBackgroundDetails(details);
            setIsEquipmentLoading(false);
        }
    }, [resetSelections]);
    
    // --- RANDOMIZATION FUNCTIONS ---
    const handleRandomizeRaceAndClass = useCallback(async (races: ApiListItem[], classes: ApiListItem[]) => {
        const randomRaceItem = races[Math.floor(Math.random() * races.length)];
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        
        await handleRaceChange(randomRaceItem.index);
        await handleClassChange(randomClass.index);
        
        setTimeout(async () => {
            const raceData = await DndApiService.getRaceDetails(randomRaceItem.index);
            if (raceData && raceData.subraces && raceData.subraces.length > 0) {
                const randomSubrace = raceData.subraces[Math.floor(Math.random() * raceData.subraces.length)];
                await handleSubraceChange(randomSubrace.index);
            }
             if (raceData?.index === 'dragonborn') {
                const ancestryTrait = await DndApiService.getTraitDetails('draconic-ancestry');
                if (ancestryTrait?.trait_specific?.subtrait_options?.from?.options) {
                    const options = ancestryTrait.trait_specific.subtrait_options.from.options;
                    const randomAncestry = options[Math.floor(Math.random() * options.length)];
                    setDraconicAncestry(randomAncestry.item.index);
                }
            }
        }, 500);

    }, [handleRaceChange, handleClassChange, handleSubraceChange]);

    const handleRandomizeBackground = useCallback(async (backgrounds: ApiListItem[]) => {
        const randomBgItem = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        await handleBackgroundChange(randomBgItem.index);

        const details = await DndApiService.getBackgroundDetails(randomBgItem.index);
        if (!details) return;
        
        if (details.personality_traits) {
            const options = details.personality_traits.from.options;
            const shuffled = [...options].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, details.personality_traits.choose).map((opt: any) => opt.string);
            setPersonalityTraits(selected);
        }
        if (details.ideals) {
            const options = details.ideals.from.options;
            const randomIdeal = options[Math.floor(Math.random() * options.length)];
            setIdeal(randomIdeal.string || randomIdeal.desc);
        }
        if (details.bonds) {
            const options = details.bonds.from.options;
            const randomBond = options[Math.floor(Math.random() * options.length)];
            setBond(randomBond.string);
        }
        if (details.flaws) {
            const options = details.flaws.from.options;
            const randomFlaw = options[Math.floor(Math.random() * options.length)];
            setFlaw(randomFlaw.string);
        }
    }, [handleBackgroundChange]);

    const handleRandomizeProficiencies = useCallback(() => {
        const newSelections: Record<string, string[]> = {};
        const currentlySelected = new Set(Object.values(proficiencySelections).flat());

        allProficiencyChoices.forEach(choice => {
            const availableOptions = choice.options.filter(opt => !allFixedProficiencies.has(opt.index) && !currentlySelected.has(opt.index));
            const shuffled = availableOptions.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, choice.choose).map(opt => opt.index);
            newSelections[choice.id] = selected;
            selected.forEach(s => currentlySelected.add(s));
        });
        setProficiencySelections(newSelections);
    }, [allProficiencyChoices, allFixedProficiencies, proficiencySelections]);

    const handleRandomizeLanguages = useCallback(() => {
        if (languageChoicesCount <= 0) return;
        const available = allLanguages.filter(lang => !baseLanguages.includes(lang.name));
        const shuffled = available.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, languageChoicesCount).map(lang => lang.name);
        setChosenLanguages(selected);
    }, [languageChoicesCount, allLanguages, baseLanguages]);

    const handleRandomizeEquipment = useCallback(() => {
        const newSelections: Record<string, { main?: number, sub?: number }> = {};
        equipmentChoiceGroups.forEach(group => {
            const mainOptionsCount = group.choice.from.options?.length || 0;
            if (mainOptionsCount > 0) {
                const randomMainIndex = Math.floor(Math.random() * mainOptionsCount);
                newSelections[group.id] = { main: randomMainIndex, sub: undefined };
            } else if (group.choice.from.option_set_type === 'equipment_category') {
                newSelections[group.id] = { main: 0, sub: undefined };
            }
        });
        setEquipmentSelections(newSelections);
    }, [equipmentChoiceGroups]);

    const handleRandomizeSpells = useCallback(() => {
        if (!classDetails || !classLevels) return;

        const cantrips = classSpellOptions.filter(s => s.level === 0);
        const level1Spells = classSpellOptions.filter(s => s.level === 1);

        const cantripsToChoose = cantripsKnown;
        const spellsToChoose = spellsKnown;

        const randomCantrips = cantrips.sort(() => 0.5 - Math.random()).slice(0, cantripsToChoose).map(s => s.index);
        const randomLevel1s = level1Spells.sort(() => 0.5 - Math.random()).slice(0, spellsToChoose).map(s => s.index);
        
        setChosenClassSpells([...randomCantrips, ...randomLevel1s]);

        const newRacialSpells: Record<string, string[]> = {};
        racialSpellTraits.forEach(trait => {
            const shuffled = trait.options.sort(() => 0.5 - Math.random());
            newRacialSpells[trait.traitName] = shuffled.slice(0, trait.choose).map(opt => opt.index);
        });
        setChosenRacialSpells(newRacialSpells);

    }, [classDetails, classLevels, classSpellOptions, cantripsKnown, spellsKnown, racialSpellTraits]);

    const handleFeatSelection = (featIndex: string) => {
        setSelectedFeat(featIndex);
    };

    const handleVariantHumanBonusSelection = useCallback((attr: keyof Attributes) => {
        setVariantHumanBonusSelections(prev => {
            const isSelected = prev.includes(attr);
            if (isSelected) {
                return prev.filter(a => a !== attr);
            }
            if (prev.length < 2) {
                return [...prev, attr];
            }
            return prev; // Limit to 2 selections
        });
    }, []);

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
        
        const allSpells = [...new Set([
            ...chosenClassSpells,
            ...Object.values(chosenRacialSpells).flat(),
            ...subclassSpells.map(s => s.index)
        ])];
        
        const finalInventory = [...fixedEquipment, ...finalizedEquipment];
        
        const inventoryWithoutGold = finalInventory.filter(i => !(i.name.toLowerCase().includes("pouch") && i.desc?.[0]?.toLowerCase().includes("gold")));
    
        const finalTraitsMap = new Map<string, ApiListItem>();
        (raceDetails.traits || []).forEach(trait => finalTraitsMap.set(trait.index, trait));
        (subraceDetails?.racial_traits || []).forEach(trait => finalTraitsMap.set(trait.index, trait));
        const finalTraits = Array.from(finalTraitsMap.values());
        
        const finalFeats: Feat[] = [];
        if (selectedFeat) {
            const featDetail = availableFeats.find(f => f.index === selectedFeat);
            if (featDetail) finalFeats.push(featDetail);
        }

        return {
            name,
            sex,
            hairStyle,
            beardStyle,
            skinColor,
            race: raceDetails.name,
            subrace: subraceDetails?.name || null,
            draconicAncestry: draconicAncestry || undefined,
            characterClass: classDetails.name,
            subclassFlavor: subclassFlavor || null,
            background: backgroundDetails.name,
            alignment: alignment,
            attributes: finalAttributes,
            proficiencies: allProficiencies,
            traits: finalTraits,
            languages: finalLanguages,
            inventory: inventoryWithoutGold,
            spells: allSpells,
            backstory,
            personalityTraits,
            ideal,
            bond,
            flaw,
            feats: finalFeats,
            hitDie: classDetails.hit_die,
            subclass: null, 
            level: 1
        };
    };

    return {
        name, setName,
        sex, setSex,
        hairStyle, setHairStyle,
        beardStyle, setBeardStyle,
        skinColor, setSkinColor,
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
        allLanguages,
        personalityTraits, handlePersonalityTraitChange,
        ideal, setIdeal,
        bond, setBond,
        flaw, setFlaw,
        raceDetails,
        subraceDetails,
        classDetails,
        backgroundDetails,
        classLevels,
        subclassFlavor,
        racialBonuses,
        finalAttributes,
        baseLanguages,
        languageChoicesCount,
        allFixedProficiencies,
        allProficiencyChoices,
        unavailableProficiencies,
        canProceedFromProficiencies,
        equipmentChoiceGroups,
        fixedEquipment,
        startingGold,
        isEquipmentLoading,
        areAllEquipmentChoicesMade,
        classSpellOptions,
        racialSpellOptions,
        racialSpellTraits,
        isSpellsLoading,
        spellsLoadingProgress,
        attributeMethod, setAttributeMethod,
        handleAttributeChange,
        handleSuggestAttributes,
        handleRollAttributes,
        isComplete,
        buildCharacter,
        cantripsKnown,
        spellsKnown,
        // Trait choices
        traitChoiceDetails,
        traitSelections,
        handleTraitSelection,
        draconicAncestry, setDraconicAncestry,
        draconicAncestryOptions,
        selectedAncestryDetails,
        isDraconicAncestryLoading,
        // Feats
        isVariantHuman, setIsVariantHuman,
        isFeatsLoading,
        availableFeats,
        selectedFeat,
        handleFeatSelection,
        // Randomizers
        handleRandomizeRaceAndClass,
        handleRandomizeBackground,
        handleRandomizeProficiencies,
        handleRandomizeLanguages,
        handleRandomizeEquipment,
        handleRandomizeSpells,
        // Variant Human
        variantHumanBonusSelections,
        handleVariantHumanBonusSelection,
    };
};
