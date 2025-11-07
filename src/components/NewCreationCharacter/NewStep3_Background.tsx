// src/components/NewCreationCharacter/NewStep3_Background.tsx
import React, { useCallback } from 'react';
import type { ApiListItem } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { Dice5, ArrowLeft, ArrowRight, ScrollText, Sparkles, Quote, Feather } from 'lucide-react';
import * as DndApiService from '@/services/dndApiService';

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
    backgrounds: ApiListItem[];
    alignments: ApiListItem[];
    prevStep: () => void;
    nextStep: () => void;
}

type PersonalitySection = 'ideals' | 'bonds' | 'flaws';

const SectionHeader: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode }> = ({ title, subtitle, icon }) => (
    <div className="flex items-center gap-3">
        {icon && <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-stone-900 text-amber-200">{icon}</div>}
        <div>
            {subtitle && <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">{subtitle}</p>}
            <h3 className="text-2xl font-semibold text-amber-50">{title}</h3>
        </div>
    </div>
);

const SelectCard: React.FC<{
    children: React.ReactNode;
    isActive: boolean;
    onClick?: () => void;
    disabled?: boolean;
}> = ({ children, isActive, onClick, disabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-3xl border px-4 py-3 text-left transition ${
            isActive
                ? 'border-amber-400/70 bg-gradient-to-br from-amber-500/15 via-transparent to-rose-500/10 shadow-lg shadow-amber-500/20'
                : 'border-white/5 bg-stone-950/50 hover:border-amber-400/40 hover:bg-stone-900/60'
        } disabled:cursor-not-allowed disabled:opacity-50`}
    >
        {children}
    </button>
);

const NewStep3_Background: React.FC<Props> = ({ hook, backgrounds, alignments, prevStep, nextStep }) => {
    const {
        background,
        handleBackgroundChange,
        details: { backgroundDetails },
        alignment,
        setField,
        personalityTraits,
        ideal,
        bond,
        flaw,
        backstory,
    } = hook;

    const handlePersonalityTraitChange = useCallback(
        (trait: string) => {
            const limit = backgroundDetails?.personality_traits?.choose || 0;
            setField('personalityTraits', (prev: string[]) => {
                if (prev.includes(trait)) {
                    return prev.filter(t => t !== trait);
                }
                return prev.length < limit ? [...prev, trait] : prev;
            });
        },
        [backgroundDetails, setField],
    );

    const handleRandomizeBackground = useCallback(async () => {
        if (backgrounds.length === 0) return;
        const randomBgItem = backgrounds[Math.floor(Math.random() * backgrounds.length)];

        await handleBackgroundChange(randomBgItem.index);

        setTimeout(async () => {
            const details = await DndApiService.getBackgroundDetails(randomBgItem.index);
            if (!details) return;

            if (details.personality_traits) {
                const options = details.personality_traits.from.options;
                const shuffled = [...options].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, details.personality_traits.choose).map((opt: any) => opt.string);
                setField('personalityTraits', selected);
            }
            if (details.ideals) {
                const options = details.ideals.from.options;
                const randomIdeal = options[Math.floor(Math.random() * options.length)];
                setField('ideal', randomIdeal.desc || randomIdeal.string);
            }
            if (details.bonds) {
                const options = details.bonds.from.options;
                const randomBond = options[Math.floor(Math.random() * options.length)];
                setField('bond', randomBond.string);
            }
            if (details.flaws) {
                const options = details.flaws.from.options;
                const randomFlaw = options[Math.floor(Math.random() * options.length)];
                setField('flaw', randomFlaw.string);
            }
        }, 300);
    }, [backgrounds, handleBackgroundChange, setField]);

    const canProceed = background && alignment && personalityTraits.length > 0 && ideal && bond && flaw;
    const personalityTraitLimit = backgroundDetails?.personality_traits?.choose || 0;

    const alignmentValue = alignment || '';

    const personalitySections: Array<{ key: PersonalitySection; label: string; value: string | null }> = [
        { key: 'ideals', label: 'Ideal', value: ideal },
        { key: 'bonds', label: 'Vínculo', value: bond },
        { key: 'flaws', label: 'Defeito', value: flaw },
    ];

    const getPersonalityOptions = (section: PersonalitySection) => backgroundDetails?.[section]?.from?.options || [];

    return (
        <div className="space-y-10 animate-fadeIn">
            <section className="rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <SectionHeader title="Antecedente & História" subtitle="Identidade narrativa" icon={<ScrollText className="h-5 w-5" />} />
                    <button
                        type="button"
                        onClick={handleRandomizeBackground}
                        className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
                    >
                        <Dice5 className="h-4 w-4" /> Surpreenda-me
                    </button>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
                    <div className="space-y-4">
                        <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                            {backgrounds.map(bg => (
                                <SelectCard key={bg.index} isActive={background === bg.index} onClick={() => handleBackgroundChange(bg.index)}>
                                    <p className="text-lg font-semibold text-stone-100">{bg.name}</p>
                                    <p className="text-sm text-stone-400">Clique para abraçar este passado.</p>
                                </SelectCard>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {backgroundDetails ? (
                            <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-stone-900/80 to-stone-950/60 p-5">
                                <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500">Traço marcante</p>
                                <h4 className="mt-1 text-xl font-semibold text-amber-100">{backgroundDetails.feature?.name}</h4>
                                <p className="mt-3 text-sm text-stone-200">{backgroundDetails.feature?.desc?.join(' ')}</p>
                            </div>
                        ) : (
                            <div className="rounded-3xl border border-dashed border-white/10 bg-stone-950/30 p-5 text-center text-sm text-stone-400">
                                Escolha um antecedente para visualizar seu destaque exclusivo.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {backgroundDetails && (
                <section className="space-y-6 rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                    <SectionHeader
                        title="Rasgos de Personalidade"
                        subtitle="Construção dramática"
                        icon={<Sparkles className="h-5 w-5" />}
                    />
                    <p className="text-sm text-stone-400">
                        Selecione {personalityTraitLimit} traço(s) que traduzem seu modo de agir. ({personalityTraits.length}/{personalityTraitLimit})
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {backgroundDetails.personality_traits?.from?.options?.map((opt: any, index: number) => {
                            const value = opt.string || opt.desc;
                            const isActive = personalityTraits.includes(value);
                            return (
                                <SelectCard key={`${value}-${index}`} isActive={isActive} onClick={() => handlePersonalityTraitChange(value)}>
                                    <p className="text-sm text-stone-200">{value}</p>
                                </SelectCard>
                            );
                        })}
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {personalitySections.map(section => {
                            const options = getPersonalityOptions(section.key);
                            if (!options?.length) return null;
                            const currentValue = section.value;
                            const setValue = (val: string) => setField(section.key === 'ideals' ? 'ideal' : section.key === 'bonds' ? 'bond' : 'flaw', val);
                            return (
                                <div key={section.key} className="space-y-3">
                                    <p className="text-sm font-semibold text-stone-300">
                                        {section.label} <span className="text-xs font-normal text-stone-500">(Escolha 1)</span>
                                    </p>
                                    <div className="space-y-2">
                                        {options.map((opt: any, i: number) => {
                                            const value = opt.string || opt.desc;
                                            return (
                                                <SelectCard key={`${section.key}-${i}`} isActive={currentValue === value} onClick={() => setValue(value)}>
                                                    <p className="text-xs uppercase tracking-[0.4em] text-stone-500">{opt.alignments?.map((a: any) => a.name).join(', ') || 'Livre'}</p>
                                                    <p className="text-sm text-stone-200">{value}</p>
                                                </SelectCard>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            <section className="space-y-6 rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                <SectionHeader title="Alinhamento & História" subtitle="Código moral" icon={<Quote className="h-5 w-5" />} />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {alignments.map(al => (
                        <SelectCard key={al.index} isActive={alignmentValue === al.name} onClick={() => setField('alignment', al.name)}>
                            <p className="text-lg font-semibold text-stone-100">{al.name}</p>
                            <p className="text-sm text-stone-400">Uma filosofia de vida e ação.</p>
                        </SelectCard>
                    ))}
                </div>

                <div className="rounded-3xl border border-white/5 bg-stone-950/60 p-5">
                    <div className="flex items-center gap-3 text-stone-300">
                        <Feather className="h-5 w-5 text-amber-300" />
                        <div>
                            <p className="text-xs uppercase tracking-[0.4em] text-stone-500">Crônica pessoal</p>
                            <h4 className="text-lg font-semibold text-stone-100">História (opcional)</h4>
                        </div>
                    </div>
                    <textarea
                        value={backstory}
                        onChange={e => setField('backstory', e.target.value)}
                        rows={5}
                        placeholder="Relate eventos marcantes, mentores, lugares ou segredos que moldaram sua jornada até aqui..."
                        className="mt-4 w-full rounded-2xl border border-white/5 bg-stone-950/70 p-4 text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-400 focus:outline-none"
                    />
                </div>
            </section>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-stone-100 transition hover:border-white/40 hover:bg-white/5"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para Atributos
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceed}
                    className="flex items-center justify-center gap-3 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-6 py-3 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {canProceed ? 'Prosseguir para Perícias' : 'Complete as escolhas narrativas'}
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

export default NewStep3_Background;
