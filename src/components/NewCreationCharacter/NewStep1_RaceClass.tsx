// src/components/NewCreationCharacter/NewStep1_RaceClass.tsx
import React, { useState, useMemo } from 'react';
import type { ApiListItem, ApiTrait } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { Dice5, ArrowRight, Loader2, Eye } from 'lucide-react';
import * as DndApiService from '@/services/dndApiService';
import ClassDetailsModal from './ClassDetailsModal';

const TraitDisplay: React.FC<{ trait: ApiListItem }> = ({ trait }) => {
    const [details, setDetails] = useState<ApiTrait | null>(null);

    const fetchDetails = async () => {
        if (!details) {
            const data = await DndApiService.getTraitDetails(trait.index);
            setDetails(data);
        }
    };

    return (
        <div className="relative group text-sm">
            <span
                onMouseEnter={fetchDetails}
                className="cursor-help font-semibold text-stone-200 underline decoration-dotted decoration-stone-500"
            >
                {trait.name}
            </span>
            {details && (
                <div className="absolute bottom-full left-1/2 z-20 mb-2 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-stone-950/95 p-3 text-xs text-stone-200 opacity-0 shadow-2xl shadow-black/70 transition-opacity group-hover:opacity-100">
                    <h4 className="mb-1 font-semibold text-amber-300">{details.name}</h4>
                    <div className="space-y-1">
                        {details.desc.map((d, i) => (
                            <p key={i}>{d}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const RaceDetailsDisplay: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
    const {
        details: { raceDetails, subraceDetails },
        racialBonuses,
    } = hook;

    if (!raceDetails) return null;

    const finalTraits = Array.from(
        new Map([...(raceDetails?.traits || []), ...(subraceDetails?.racial_traits || [])].map(item => [item.index, item])).values()
    );

    return (
        <div className="rounded-3xl border border-white/10 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500">Legado</p>
                    <h4 className="text-xl font-semibold text-amber-100">
                        {raceDetails.name} {subraceDetails ? `(${subraceDetails.name})` : ''}
                    </h4>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    {raceDetails.size || 'Tamanho'}
                </span>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-white/5 bg-stone-900/70 p-3 text-sm sm:grid-cols-2">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500">Bônus de Atributo</p>
                    <p className="text-stone-100">
                        {Object.entries(racialBonuses)
                            .map(([attr, bonus]) => `${attr.substring(0, 3).toUpperCase()} +${bonus}`)
                            .join(', ') || 'Nenhum'}
                    </p>
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500">Velocidade</p>
                    <p className="text-stone-100">{raceDetails.speed} pés</p>
                </div>
            </div>

            {finalTraits.length > 0 && (
                <div className="mt-5 space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500">Traços Raciais</p>
                    <div className="space-y-1 text-sm text-stone-200">
                        {finalTraits.map(trait => (
                            <TraitDisplay key={trait.index} trait={trait} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SelectableCard: React.FC<{
    title: string;
    description?: string;
    onClick: () => void;
    selected: boolean;
}> = ({ title, description, onClick, selected }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
            selected
                ? 'border-amber-400/70 bg-gradient-to-br from-amber-500/15 via-transparent to-rose-500/10 shadow-lg shadow-amber-500/20'
                : 'border-white/5 bg-stone-900/60 hover:border-amber-400/40 hover:bg-stone-900'
        }`}
    >
        <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-stone-100">{title}</p>
            <span
                className={`h-2 w-2 rounded-full ${selected ? 'bg-amber-400 shadow shadow-amber-400/50' : 'bg-stone-600'}`}
            />
        </div>
        {description && <p className="mt-1 text-sm text-stone-400">{description}</p>}
    </button>
);

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
    races: ApiListItem[];
    classes: ApiListItem[];
    nextStep: () => void;
}

const NewStep1_RaceClass: React.FC<Props> = ({ hook, races, classes, nextStep }) => {
    const {
        race,
        subrace,
        characterClass,
        handleRaceChange,
        handleSubraceChange,
        handleClassChange,
        details: { raceDetails, classDetails, draconicAncestryOptions },
        loadingStates,
        handleRandomizeRaceAndClass,
        isVariantHuman,
        setField,
        draconicAncestry,
    } = hook;

    const [isClassModalOpen, setIsClassModalOpen] = useState(false);

    const canProceed = useMemo(() => {
        if (!race || !characterClass) return false;
        if (race === 'dragonborn' && !draconicAncestry) return false;
        return true;
    }, [race, characterClass, draconicAncestry]);

    const classSavingThrows = classDetails?.saving_throws?.map(st => st.name).join(', ');
    const classHitDie = classDetails?.hit_die ? `d${classDetails.hit_die}` : '—';
    const classSubclass = classDetails?.subclasses?.[0]?.name;

    return (
        <>
            <div className="space-y-10 animate-fadeIn">
                <section className="rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Escolha inicial</p>
                            <h3 className="text-2xl font-semibold text-amber-50">Defina sua Raça</h3>
                            <p className="text-sm text-stone-400">Cada linhagem desbloqueia idiomas, traços e possibilidades únicas.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleRandomizeRaceAndClass(races, classes)}
                            className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
                        >
                            <Dice5 className="h-4 w-4" />
                            Surpreenda-me
                        </button>
                    </div>

                    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {races.map(r => (
                                    <SelectableCard
                                        key={r.index}
                                        title={r.name}
                                        description="Veja bônus e idiomas."
                                        selected={race === r.index}
                                        onClick={() => handleRaceChange(r.index)}
                                    />
                                ))}
                            </div>

                            {loadingStates.isLoading && (
                                <div className="flex items-center justify-center py-6 text-amber-300">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            )}

                            {raceDetails?.subraces?.length > 0 && (
                                <div className="space-y-3 rounded-3xl border border-white/5 bg-stone-950/60 p-5">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.4em] text-stone-500">Sub-raça</p>
                                        <h4 className="text-lg font-semibold text-stone-100">Detalhe seu legado</h4>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {raceDetails.subraces.map((sr: ApiListItem) => (
                                            <SelectableCard
                                                key={sr.index}
                                                title={sr.name}
                                                description="Ajuste habilidades específicas."
                                                selected={subrace === sr.index}
                                                onClick={() => handleSubraceChange(sr.index)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {race === 'human' && (
                                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm text-stone-200">
                                    <label className="flex items-start gap-4">
                                        <input
                                            type="checkbox"
                                            checked={isVariantHuman}
                                            onChange={e => setField('isVariantHuman', e.target.checked)}
                                            className="mt-1 h-5 w-5 rounded border border-emerald-400 bg-transparent text-emerald-400 focus:ring-emerald-400"
                                        />
                                        <div>
                                            <p className="text-base font-semibold text-emerald-100">Humano Variante</p>
                                            <p>Troque o bônus universal por +1 em dois atributos, uma perícia adicional e um talento inicial.</p>
                                        </div>
                                    </label>
                                </div>
                            )}

                            {race === 'dragonborn' && draconicAncestryOptions && (
                                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-5">
                                    <h4 className="text-lg font-semibold text-rose-100">Ancestralidade Dracônica</h4>
                                    <p className="text-sm text-rose-200/80">Sua linhagem define o tipo de dano e o sopro elemental.</p>
                                    <div className="mt-3 rounded-2xl border border-rose-500/30 bg-stone-950/60 p-3">
                                        <select
                                            value={hook.draconicAncestry}
                                            onChange={e => setField('draconicAncestry', e.target.value)}
                                            className="w-full rounded-xl border border-white/10 bg-transparent p-3 text-stone-100 focus:border-rose-400 focus:outline-none"
                                        >
                                            <option value="" disabled>
                                                Escolha sua linhagem...
                                            </option>
                                            {draconicAncestryOptions.map(opt => {
                                                const dragonName = opt.name.replace('Draconic Ancestry: ', '');
                                                const damageType = opt.damage_type || 'Desconhecido';
                                                return (
                                                    <option key={opt.index} value={opt.index} className="bg-stone-900">
                                                        {dragonName} (Sopro de {damageType})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            {!loadingStates.isLoading && race && raceDetails && <RaceDetailsDisplay hook={hook} />}
                            {!race && (
                                <div className="rounded-3xl border border-dashed border-white/10 bg-stone-950/30 p-6 text-center text-sm text-stone-400">
                                    Escolha uma raça para ver bônus e traços especiais aqui.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Vocação</p>
                            <h4 className="text-2xl font-semibold text-amber-50">Selecione sua Classe</h4>
                            <p className="text-sm text-stone-400">Determine proficiências, equipamentos iniciais e estilo de jogo.</p>
                        </div>
                        {characterClass && classDetails && !loadingStates.isLoading && (
                            <button
                                type="button"
                                onClick={() => setIsClassModalOpen(true)}
                                className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
                            >
                                <Eye className="h-4 w-4" />
                                Ver detalhes completos
                            </button>
                        )}
                    </div>

                    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {classes.map(c => (
                                <SelectableCard
                                    key={c.index}
                                    title={c.name}
                                    description="Desbloqueia perícias e magias iniciais."
                                    selected={characterClass === c.index}
                                    onClick={() => handleClassChange(c.index)}
                                />
                            ))}
                        </div>

                        <div className="space-y-4">
                            {characterClass && classDetails ? (
                                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-stone-900/80 to-stone-950/60 p-6">
                                    <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500">Perfil da Classe</p>
                                    <h5 className="text-xl font-semibold text-amber-100">{classDetails.name}</h5>
                                    <div className="mt-4 grid gap-3 text-sm text-stone-200">
                                        <div className="rounded-2xl border border-white/5 bg-stone-900/70 p-3">
                                            <p className="text-[10px] uppercase tracking-[0.4em] text-stone-500">Dado de Vida</p>
                                            <p className="text-lg font-semibold text-stone-100">{classHitDie}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/5 bg-stone-900/70 p-3">
                                            <p className="text-[10px] uppercase tracking-[0.4em] text-stone-500">Testes de Resistência</p>
                                            <p>{classSavingThrows || '—'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/5 bg-stone-900/70 p-3">
                                            <p className="text-[10px] uppercase tracking-[0.4em] text-stone-500">Subclasse</p>
                                            <p>{classSubclass || 'Obtida em níveis futuros'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-3xl border border-dashed border-white/10 bg-stone-950/30 p-6 text-center text-sm text-stone-400">
                                    Escolha uma classe para ver o perfil resumido.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={nextStep}
                        disabled={!canProceed}
                        className="flex items-center gap-3 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/60 px-6 py-3 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {canProceed ? 'Avançar para atributos' : 'Complete suas escolhas'}
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {classDetails && (
                <ClassDetailsModal
                    isOpen={isClassModalOpen}
                    onClose={() => setIsClassModalOpen(false)}
                    classDetails={classDetails}
                    classLevels={hook.details.classLevels || []}
                />
            )}
        </>
    );
};

export default NewStep1_RaceClass;
