// components/creation/RaceStep.tsx
import React from 'react';
import { useCreationContext } from '../../contexts/CreationContext';
import { ApiListItem, ApiSpell } from '../../types';
import { ATTRIBUTE_SHORT_MAP } from '../../utils/characterUtils';
import { translateApiString, translateAttribute } from '../../utils/translator';
import { Accordion, LabeledSelect, Section, SpellChoice } from '../ui';

const RaceStep: React.FC = () => {
    const { 
        races,
        race, handleRaceChange,
        raceDetails, 
        subraces, 
        subrace, handleSubraceChange,
        subraceDetails,
        baseLanguages, languageChoicesCount, chosenLanguages, handleLanguageChange, languages,
        racialSpellTraits, racialSpellOptions, chosenRacialSpells, handleRacialSpellChange,
        allProficiencyChoices, proficiencySelections, handleProficiencyChange, proficiencies,
        unavailableProficiencies
    } = useCreationContext();

    const raceProficiencyChoices = allProficiencyChoices.filter(c => c.source === 'Raça');

    // This is the key change: we create a component that re-renders when racialSpellTraits changes.
    const RacialSpellsComponent = () => (
        <>
            {racialSpellTraits.map(trait => (
                <div key={trait.traitName} className="mt-4">
                    <SpellChoice 
                        title={`Escolha de Magia: ${trait.traitName}`}
                        availableSpells={racialSpellOptions.filter(s => trait.options.some(opt => opt.index === s.index))}
                        chosenSpells={chosenRacialSpells[trait.traitName] || []}
                        onSpellSelect={(spellIndex) => handleRacialSpellChange(trait.traitName, spellIndex, trait.choose)}
                        spellLimit={trait.choose}
                        spellLevel={0} // Assuming racial spells are cantrips for now, this might need adjustment
                    />
                </div>
            ))}
        </>
    );

    return (
        <Section title="Raça e Sub-raça">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LabeledSelect
                    label="Raça"
                    value={race}
                    onChange={(e) => handleRaceChange(e.target.value)}
                    options={races.map(r => ({ value: r.index, label: r.name }))}
                    helpText="A raça determina seus traços inatos e aparência."
                />
                {subraces.length > 0 && (
                    <LabeledSelect
                        label="Sub-raça"
                        value={subrace}
                        onChange={(e) => handleSubraceChange(e.target.value)}
                        options={subraces.map(sr => ({ value: sr.index, label: sr.name }))}
                        helpText="Algumas raças possuem linhagens distintas."
                        disabled={!race}
                    />
                )}
            </div>

            {(raceDetails || subraceDetails) && (
                <Accordion title="Detalhes da Raça" defaultOpen>
                    <div className="space-y-4">
                        {raceDetails?.ability_bonuses.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-stone-300">Bônus de Atributo da Raça:</h4>
                                <p className="text-sm text-stone-400">{raceDetails.ability_bonuses.map(b => `+${b.bonus} ${translateAttribute(ATTRIBUTE_SHORT_MAP[b.ability_score.index])}`).join(', ')}</p>
                            </div>
                        )}
                         {subraceDetails?.ability_bonuses.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-stone-300">Bônus de Atributo da Sub-raça:</h4>
                                <p className="text-sm text-stone-400">{subraceDetails.ability_bonuses.map(b => `+${b.bonus} ${translateAttribute(ATTRIBUTE_SHORT_MAP[b.ability_score.index])}`).join(', ')}</p>
                            </div>
                        )}
                        <div>
                            <h4 className="font-semibold text-stone-300">Idiomas Base:</h4>
                            <p className="text-sm text-stone-400">{baseLanguages.join(', ') || 'Nenhum'}</p>
                        </div>
                        {raceDetails && <p className="text-sm text-stone-400"><strong className="text-stone-300">Idade:</strong> {raceDetails.age}</p>}
                        {raceDetails && <p className="text-sm text-stone-400"><strong className="text-stone-300">Alinhamento:</strong> {raceDetails.alignment}</p>}
                        {raceDetails && <p className="text-sm text-stone-400"><strong className="text-stone-300">Tamanho:</strong> {raceDetails.size_description}</p>}
                    </div>
                </Accordion>
            )}

            {languageChoicesCount > 0 && (
                 <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2 text-stone-200">Escolha de Idiomas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: languageChoicesCount }).map((_, i) => (
                            <LabeledSelect
                                key={i}
                                label={`Idioma Adicional ${i + 1}`}
                                value={chosenLanguages[i] || ''}
                                onChange={(e) => handleLanguageChange(i, e.target.value)}
                                options={languages.map(l => ({ value: l.name, label: l.name }))}
                                helpText="Idiomas adicionais de sua raça ou antecedente."
                            />
                        ))}
                    </div>
                </div>
            )}
            
            {raceProficiencyChoices.map(choice => (
                <div key={choice.id} className="mt-4">
                    <h3 className="text-lg font-semibold text-stone-200">{`Escolha de Proficiência (${choice.source})`}</h3>
                    <p className="text-sm text-stone-400 mb-2">Escolha {choice.choose} opç{choice.choose > 1 ? 'ões' : 'ão'}.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {choice.options.map(prof => {
                            const isSelected = proficiencySelections[choice.id]?.includes(prof.index);
                            const isDisabled = !isSelected && (unavailableProficiencies.has(prof.index) || (proficiencySelections[choice.id]?.length || 0) >= choice.choose);
                            return (
                                <button 
                                    key={prof.index} 
                                    onClick={() => handleProficiencyChange(prof.index, choice)}
                                    disabled={isDisabled}
                                    className={`p-2 text-left rounded-md text-sm transition-colors ${isSelected ? 'bg-amber-600 text-white' : 'bg-stone-700 hover:bg-stone-600'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {translateApiString(prof.name)}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ))}

            {/* Render the spell choices here */}
            <RacialSpellsComponent />
        </Section>
    );
};

export default RaceStep;
