import React from 'react';
import { useCharacterCreation } from '../../hooks/useCharacterCreation';
import { ApiListItem } from '../../types';
import { translateApiString } from '../../utils/translator';
import AttributeSelection from './AttributeSelection';
import ProficiencyChoices from './ProficiencyChoices';
import LanguageSelection from './LanguageSelection';
import PersonalityChoices from './PersonalityChoices';
import EquipmentChoices from './EquipmentChoices';
import RacialSpellChoices from './RacialSpellChoices';
import ClassSpellChoices from './ClassSpellChoices';

interface CharacterCreationFormProps {
    hook: ReturnType<typeof useCharacterCreation>;
    races: ApiListItem[];
    classes: ApiListItem[];
    backgrounds: ApiListItem[];
    alignments: ApiListItem[];
    allLanguages: ApiListItem[];
    formError: string | null;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    onBackToMenu: () => void;
}

const CharacterCreationForm: React.FC<CharacterCreationFormProps> = ({ 
    hook, races, classes, backgrounds, alignments, allLanguages, formError, onSubmit, onBackToMenu 
}) => {
    
    return (
        <form onSubmit={onSubmit} className="space-y-8 bg-stone-800/50 p-6 rounded-lg border border-stone-700 animate-fadeIn max-w-5xl mx-auto">
            <div className="flex justify-between items-center border-b border-stone-700 pb-2">
                 <h2 className="text-2xl font-bold font-garamond text-amber-300 text-shadow-amber">Criação de Personagem</h2>
                 <button type="button" onClick={onBackToMenu} className="text-sm text-stone-400 hover:text-amber-400">Voltar ao Menu</button>
            </div>
            
            {formError && (
                <div className="p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm">
                    {formError}
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 md:gap-x-8">
                {/* Coluna Esquerda: Informações Básicas */}
                <div className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-stone-300 font-semibold mb-2">Nome</label>
                        <input type="text" id="name" value={hook.name} onChange={e => hook.setName(e.target.value)} required className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500" />
                    </div>
                     <div>
                        <label htmlFor="race" className="block text-stone-300 font-semibold mb-2">Raça</label>
                        <select id="race" value={hook.race} onChange={e => hook.handleRaceChange(e.target.value)} required className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500">
                            <option value="">Selecione...</option>
                            {races.map(r => <option key={r.index} value={r.index}>{translateApiString(r.name)}</option>)}
                        </select>
                    </div>
                    {hook.raceDetails?.subraces?.length > 0 && (
                        <div>
                            <label htmlFor="subrace" className="block text-stone-300 font-semibold mb-2">Sub-raça</label>
                            <select id="subrace" value={hook.subrace} onChange={e => hook.handleSubraceChange(e.target.value)} className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500">
                                <option value="">Nenhuma</option>
                                {hook.raceDetails.subraces.map(sr => <option key={sr.index} value={sr.index}>{translateApiString(sr.name)}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label htmlFor="class" className="block text-stone-300 font-semibold mb-2">Classe</label>
                        <select id="class" value={hook.characterClass} onChange={e => hook.handleClassChange(e.target.value)} required className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500">
                             <option value="">Selecione...</option>
                            {classes.map(c => <option key={c.index} value={c.index}>{translateApiString(c.name)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="background" className="block text-stone-300 font-semibold mb-2">Antecedente</label>
                        <select id="background" value={hook.background} onChange={e => hook.handleBackgroundChange(e.target.value)} required className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500">
                            <option value="">Selecione...</option>
                            {backgrounds.map(b => <option key={b.index} value={b.index}>{translateApiString(b.name)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="alignment" className="block text-stone-300 font-semibold mb-2">Alinhamento</label>
                        <select id="alignment" value={hook.alignment} onChange={e => hook.setAlignment(e.target.value)} required className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500">
                            <option value="">Selecione...</option>
                            {alignments.map(a => <option key={a.index} value={a.name}>{translateApiString(a.name)}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="backstory" className="block text-stone-300 font-semibold mb-2">História do Personagem (Opcional)</label>
                        <textarea 
                            id="backstory" value={hook.backstory} onChange={e => hook.setBackstory(e.target.value)} rows={4}
                            className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500" 
                            placeholder="Escreva sobre o passado do seu personagem, suas motivações, medos ou o que o trouxe até aqui..."
                        />
                    </div>
                </div>

                {/* Coluna Direita: Atributos */}
                <div className="space-y-4">
                    <AttributeSelection hook={hook} />
                </div>
            </div>

            {/* Seções de Escolhas Detalhadas */}
            <div className="pt-4 border-t border-stone-700">
                <ProficiencyChoices hook={hook} />
            </div>
            
            <div className="pt-4 border-t border-stone-700">
                <LanguageSelection hook={hook} allLanguages={allLanguages} />
            </div>

            <div className="pt-4 border-t border-stone-700">
                <PersonalityChoices hook={hook} />
            </div>

            <div className="pt-4 border-t border-stone-700">
                <EquipmentChoices hook={hook} />
            </div>

            <div className="pt-4 border-t border-stone-700">
                <RacialSpellChoices hook={hook} />
            </div>

            <div className="pt-4 border-t border-stone-700">
                <ClassSpellChoices hook={hook} />
            </div>

            <button type="submit" disabled={hook.isSpellsLoading} className="w-full bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold py-3 px-6 rounded-md transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-6">
                {hook.isSpellsLoading ? 'Carregando Magias...' : 'Iniciar Aventura'}
            </button>
        </form>
    );
};

export default CharacterCreationForm;
