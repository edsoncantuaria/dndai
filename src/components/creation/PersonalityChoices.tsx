import React from 'react';
import { useCharacterCreation } from '../../hooks/useCharacterCreation';

interface PersonalityChoicesProps {
    hook: ReturnType<typeof useCharacterCreation>;
}

const PersonalityChoices: React.FC<PersonalityChoicesProps> = ({ hook }) => {
    const { 
        backgroundDetails, 
        personalityTraits, 
        ideal, 
        bond, 
        flaw, 
        handlePersonalityTraitChange, 
        setIdeal, 
        setBond, 
        setFlaw 
    } = hook;

    if (!backgroundDetails) return null;

    const { 
        personality_traits: personalityTraitsOptions,
        ideals: idealsOptions,
        bonds: bondsOptions,
        flaws: flawsOptions 
    } = backgroundDetails;

    // Do not render if the background provides no personality options
    if (!personalityTraitsOptions && !idealsOptions && !bondsOptions && !flawsOptions) {
        return null;
    }

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold font-garamond text-amber-300 border-b border-stone-700 pb-2 text-shadow-amber">Personalidade e História</h3>

            {personalityTraitsOptions && personalityTraitsOptions.from && (
                <div>
                    <label className="block text-stone-300 font-semibold mb-2">Traços de Personalidade <span className="text-stone-400 font-normal">(Escolha {personalityTraitsOptions.choose})</span></label>
                    <div className="space-y-2">
                        {personalityTraitsOptions.from.options.map((opt, i) => opt.string && (
                            <label key={i} className={`flex items-start p-3 rounded-md border transition-colors cursor-pointer ${personalityTraits.includes(opt.string) ? 'bg-amber-800/50 border-amber-600' : 'bg-stone-700 border-stone-600 hover:bg-stone-600'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={personalityTraits.includes(opt.string)} 
                                    onChange={() => handlePersonalityTraitChange(opt.string)} 
                                    className="form-checkbox h-4 w-4 text-amber-500 bg-stone-800 border-stone-600 rounded focus:ring-amber-500 mt-1"
                                />
                                <span className="ml-3 text-stone-200 text-sm">{opt.string}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {idealsOptions && idealsOptions.from && (
                 <div>
                    <label className="block text-stone-300 font-semibold mb-2">Ideal <span className="text-stone-400 font-normal">(Escolha {idealsOptions.choose})</span></label>
                    <div className="space-y-2">
                        {idealsOptions.from.options.map((opt, i) => opt.desc && (
                             <label key={i} className={`flex items-start p-3 rounded-md border transition-colors cursor-pointer ${ideal === opt.desc ? 'bg-amber-800/50 border-amber-600' : 'bg-stone-700 border-stone-600 hover:bg-stone-600'}`}>
                                <input 
                                    type="radio" 
                                    name="ideal" 
                                    checked={ideal === opt.desc} 
                                    onChange={() => setIdeal(opt.desc || '')} 
                                    className="form-radio h-4 w-4 text-amber-500 bg-stone-800 border-stone-600 focus:ring-amber-500 mt-1"
                                />
                                <span className="ml-3 text-stone-200 text-sm">{opt.desc}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {bondsOptions && bondsOptions.from && (
                <div>
                    <label className="block text-stone-300 font-semibold mb-2">Vínculo <span className="text-stone-400 font-normal">(Escolha {bondsOptions.choose})</span></label>
                    <div className="space-y-2">
                        {bondsOptions.from.options.map((opt, i) => opt.string && (
                             <label key={i} className={`flex items-start p-3 rounded-md border transition-colors cursor-pointer ${bond === opt.string ? 'bg-amber-800/50 border-amber-600' : 'bg-stone-700 border-stone-600 hover:bg-stone-600'}`}>
                                <input 
                                    type="radio" 
                                    name="bond" 
                                    checked={bond === opt.string} 
                                    onChange={() => setBond(opt.string || '')} 
                                    className="form-radio h-4 w-4 text-amber-500 bg-stone-800 border-stone-600 focus:ring-amber-500 mt-1"
                                />
                                <span className="ml-3 text-stone-200 text-sm">{opt.string}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {flawsOptions && flawsOptions.from && (
                <div>
                    <label className="block text-stone-300 font-semibold mb-2">Defeito <span className="text-stone-400 font-normal">(Escolha {flawsOptions.choose})</span></label>
                    <div className="space-y-2">
                        {flawsOptions.from.options.map((opt, i) => opt.string && (
                             <label key={i} className={`flex items-start p-3 rounded-md border transition-colors cursor-pointer ${flaw === opt.string ? 'bg-amber-800/50 border-amber-600' : 'bg-stone-700 border-stone-600 hover:bg-stone-600'}`}>
                                <input 
                                    type="radio" 
                                    name="flaw" 
                                    checked={flaw === opt.string} 
                                    onChange={() => setFlaw(opt.string || '')} 
                                    className="form-radio h-4 w-4 text-amber-500 bg-stone-800 border-stone-600 focus:ring-amber-500 mt-1"
                                />
                                <span className="ml-3 text-stone-200 text-sm">{opt.string}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalityChoices;