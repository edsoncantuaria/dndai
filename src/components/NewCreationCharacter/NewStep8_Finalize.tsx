// src/components/NewCreationCharacter/NewStep8_Finalize.tsx
import React from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { normalizeProficiencyName, translateApiString, translateAttribute } from '@/utils/translator';
import type { Attributes } from '@/types';
import { ArrowLeft, Play } from 'lucide-react';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    handleFinalize: () => void;
}

const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const NewStep8_Finalize: React.FC<Props> = ({
    hook,
    prevStep,
    handleFinalize,
}) => {
    const {
        name, setName,
        sex, setSex,
        hairStyle, setHairStyle,
        beardStyle, setBeardStyle,
        skinColor, setSkinColor,
        isComplete,
        race,
        subrace,
        characterClass,
        background,
        alignment,
        finalAttributes,
        allFixedProficiencies,
        proficiencySelections,
        allProficiencyChoices,
        chosenClassSpells,
        classSpellOptions,
        chosenRacialSpells,
        racialSpellOptions,
        raceDetails
    } = hook;

    const finalSkills = Array.from(allFixedProficiencies.values())
        .filter(p => p.index.startsWith('skill-'))
        .map(p => normalizeProficiencyName(p.name));
        
    for (const key in proficiencySelections) {
        for (const profIndex of proficiencySelections[key]) {
             const choiceGroup = allProficiencyChoices.find(c => c.id === key);
             if (choiceGroup) {
                 const option = choiceGroup.options.find(o => o.index === profIndex);
                 if (option && option.index.startsWith('skill-')) {
                     finalSkills.push(normalizeProficiencyName(option.name));
                 }
             }
        }
    }

    const finalSpells = [...new Set([
        ...chosenClassSpells,
        ...Object.values(chosenRacialSpells).flat()
    ])].map(spellIndex => {
        const spell = [...classSpellOptions, ...racialSpellOptions].find(s => s.index === spellIndex);
        return spell ? translateApiString(spell.name) : null;
    }).filter(Boolean);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h3 className="text-2xl font-semibold text-stone-200 mb-2 font-garamond">O Toque Final</h3>
                <p className="text-sm text-stone-400">Revise as escolhas do seu herói e dê a ele um nome e uma aparência dignos de lendas.</p>
            </div>
            
            <div className="bg-stone-900/50 p-4 sm:p-6 rounded-lg border-2 border-stone-700 space-y-6 shadow-lg">
                
                <div className="w-full mb-6">
                    <label htmlFor="character-name" className="sr-only">Nome do Personagem</label>
                    <input
                        type="text"
                        id="character-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome do Personagem..."
                        className="w-full bg-transparent border-b-2 border-stone-600 focus:border-amber-500 pb-2 text-stone-100 text-3xl text-center font-bold font-garamond focus:ring-0 transition-colors"
                    />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="sex-select" className="block text-xs font-medium text-stone-400 mb-1">Sexo</label>
                        <select id="sex-select" value={sex} onChange={e => setSex(e.target.value as any)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200">
                            <option>Masculino</option>
                            <option>Feminino</option>
                            <option>Outro</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="hair-select" className="block text-xs font-medium text-stone-400 mb-1">Cabelo</label>
                        <select id="hair-select" value={hairStyle} onChange={e => setHairStyle(e.target.value as any)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200">
                            <option>Careca</option>
                            <option>Curto</option>
                            <option>Médio</option>
                            <option>Longo</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="beard-select" className="block text-xs font-medium text-stone-400 mb-1">Barba</label>
                        <select id="beard-select" value={beardStyle} onChange={e => setBeardStyle(e.target.value as any)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200">
                            <option>Sem Barba</option>
                            <option>Curta</option>
                            <option>Grande</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="skin-select" className="block text-xs font-medium text-stone-400 mb-1">Cor da Pele</label>
                        <select id="skin-select" value={skinColor} onChange={e => setSkinColor(e.target.value as any)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200">
                            <option>Branca</option>
                            <option>Parda</option>
                            <option>Negra</option>
                            <option>Indígena</option>
                            <option>Amarela</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="md:col-span-1 space-y-2">
                        <div className="bg-stone-800/50 p-3 rounded-md">
                            <strong className="text-stone-400 block text-xs uppercase tracking-wider">Raça</strong> 
                            <span className="text-stone-100 text-lg font-semibold">{translateApiString(raceDetails?.name)} {subrace && `(${translateApiString(subrace)})`}</span>
                        </div>
                        <div className="bg-stone-800/50 p-3 rounded-md">
                            <strong className="text-stone-400 block text-xs uppercase tracking-wider">Classe</strong> 
                            <span className="text-stone-100 text-lg font-semibold">{translateApiString(characterClass)}</span>
                        </div>
                         <div className="bg-stone-800/50 p-3 rounded-md">
                            <strong className="text-stone-400 block text-xs uppercase tracking-wider">Antecedente</strong> 
                            <span className="text-stone-100 text-lg font-semibold">{translateApiString(background)}</span>
                        </div>
                         <div className="bg-stone-800/50 p-3 rounded-md">
                            <strong className="text-stone-400 block text-xs uppercase tracking-wider">Alinhamento</strong> 
                            <span className="text-stone-100 text-lg font-semibold">{translateApiString(alignment)}</span>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                         <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-center">
                            {attributeOrder.map(attr => (
                                <div key={attr} className="bg-stone-800/50 p-3 rounded-md border border-stone-700/70">
                                    <div className="text-sm font-bold text-stone-300">{translateAttribute(attr).substring(0,3).toUpperCase()}</div>
                                    <div className="font-bold text-4xl text-amber-300 my-1">{finalAttributes[attr]}</div>
                                    <div className="text-lg text-amber-400/80 bg-stone-900/50 rounded-full w-10 h-10 flex items-center justify-center mx-auto">{Math.floor((finalAttributes[attr] - 10) / 2) >= 0 ? `+${Math.floor((finalAttributes[attr] - 10) / 2)}` : Math.floor((finalAttributes[attr] - 10) / 2)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {finalSkills.length > 0 && (
                        <div className="bg-stone-800/50 p-4 rounded-md">
                            <h4 className="font-semibold text-amber-300 border-b border-stone-700 pb-2 mb-2">Perícias</h4>
                            <ul className="columns-2 text-sm text-stone-300 space-y-1 list-disc list-inside">
                                {finalSkills.sort().map(skill => <li key={skill}>{skill}</li>)}
                            </ul>
                        </div>
                    )}

                    {finalSpells.length > 0 && (
                         <div className="bg-stone-800/50 p-4 rounded-md">
                            <h4 className="font-semibold text-amber-300 border-b border-stone-700 pb-2 mb-2">Magias Conhecidas (Nível 1)</h4>
                             <ul className="columns-2 text-sm text-stone-300 space-y-1 list-disc list-inside">
                                {finalSpells.sort().map(spell => <li key={spell}>{spell}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center pt-6">
                <button
                    type="button"
                    onClick={prevStep}
                    className="menu-button btn-import max-w-xs"
                >
                    <ArrowLeft className="h-6 w-6 mr-3" />
                    Voltar
                </button>
                <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={!isComplete}
                    className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isComplete ? 'Iniciar Aventura' : 'Preencha os campos'}
                    <Play className="h-6 w-6 ml-3" />
                </button>
            </div>
        </div>
    );
};

export default NewStep8_Finalize;
