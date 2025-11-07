// src/components/NewCreationCharacter/NewStep4_ProficienciesAndLanguages.tsx
import React, { useCallback } from 'react';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import type { ApiListItem } from '@/types';
import { ArrowLeft, ArrowRight, Dice5, Languages, Shield, BookOpenCheck } from 'lucide-react';
import { normalizeProficiencyName } from '@/utils/translator';

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
    prevStep: () => void;
    nextStep: () => void;
    allLanguages: ApiListItem[];
}

const SectionShell: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }> = ({
    title,
    subtitle,
    icon,
    actions,
    children,
}) => (
    <section className="space-y-6 rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
                {icon && (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-stone-900 text-amber-200">
                        {icon}
                    </div>
                )}
                <div>
                    {subtitle && <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">{subtitle}</p>}
                    <h3 className="text-2xl font-semibold text-amber-50">{title}</h3>
                </div>
            </div>
            {actions}
        </div>
        {children}
    </section>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100 shadow-inner shadow-amber-500/20">
        {children}
    </span>
);

const SelectableTile: React.FC<{
    label: string;
    description?: string;
    isActive: boolean;
    disabled?: boolean;
    onClick: () => void;
}> = ({ label, description, isActive, disabled, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
            isActive
                ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-500/15 via-transparent to-emerald-400/10 text-emerald-50 shadow shadow-emerald-500/20'
                : 'border-white/5 bg-stone-950/40 text-stone-200 hover:border-emerald-400/40 hover:text-emerald-100'
        } disabled:cursor-not-allowed disabled:opacity-40`}
    >
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="text-xs text-stone-400">{description}</p>}
    </button>
);

const NewStep4_ProficienciesAndLanguages: React.FC<Props> = ({ hook, prevStep, nextStep, allLanguages }) => {
    const {
        allProficiencyChoices,
        allFixedProficiencies,
        proficiencySelections,
        unavailableProficiencies,
        handleProficiencyChange,
        canProceedFromProficiencies,
        baseLanguages,
        languageChoicesCount,
        chosenLanguages,
        handleLanguageChange,
        handleRandomizeProficiencies,
        handleRandomizeLanguages,
    } = hook;

    const availableLanguageOptions = allLanguages.filter(lang => !baseLanguages?.includes(lang.name));

    return (
        <div className="space-y-10 animate-fadeIn">
            <SectionShell
                title="Proficências e Idiomas"
                subtitle="Kit heroico"
                icon={<Shield className="h-5 w-5" />}
            >
                <p className="text-sm text-stone-400">
                    Parte das proficiências vem do seu legado; outras precisam ser escolhidas agora. Complete cada grupo para
                    desbloquear o avanço.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border border-white/5 bg-stone-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.4em] text-stone-500">Proficiências Fixas</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {Array.from(allFixedProficiencies.values())
                                .filter(p => p?.name && !p.name.includes('Saving Throw'))
                                .map(prof => (
                                    <Chip key={prof.index}>{normalizeProficiencyName(prof?.name || '')}</Chip>
                                ))}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-stone-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.4em] text-stone-500">Testes de Resistência</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {Array.from(allFixedProficiencies.values())
                                .filter(p => p?.name && p.name.includes('Saving Throw'))
                                .map(prof => (
                                    <Chip key={prof.index}>{normalizeProficiencyName(prof?.name || '')}</Chip>
                                ))}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-stone-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.4em] text-stone-500">Idiomas Nativos</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(baseLanguages || []).map(lang => (
                                <Chip key={lang}>{lang}</Chip>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionShell>

            {allProficiencyChoices.length > 0 && (
                <SectionShell
                    title="Escolhas de Proficiência"
                    subtitle="Especialização"
                    icon={<BookOpenCheck className="h-5 w-5" />}
                    actions={
                        <button
                            type="button"
                            onClick={handleRandomizeProficiencies}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-4 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition hover:brightness-110"
                        >
                            <Dice5 className="h-4 w-4" /> Sortear tudo
                        </button>
                    }
                >
                    <div className="space-y-5">
                        {allProficiencyChoices.map(choice => {
                            const selectedCountInGroup = proficiencySelections[choice.id]?.length || 0;
                            const availableOptions = choice.options.filter((option: any) => !allFixedProficiencies.has(option.index));
                            if (availableOptions.length === 0) return null;
                            return (
                                <div
                                    key={choice.id}
                                    className="rounded-3xl border border-white/5 bg-stone-950/60 p-5 shadow-inner shadow-black/20"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.4em] text-stone-500">{choice.source}</p>
                                            <h4 className="text-lg font-semibold text-stone-100">{normalizeProficiencyName(choice.desc)}</h4>
                                        </div>
                                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                                            {selectedCountInGroup}/{choice.choose}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {availableOptions.map((option: any) => {
                                            if (!option.name) return null;
                                            const isSelected = !!proficiencySelections[choice.id]?.includes(option.index);
                                            const isUnavailable = !isSelected && unavailableProficiencies.has(option.index);
                                            const isLimitReached = !isSelected && selectedCountInGroup >= choice.choose;
                                            const disabled = isUnavailable || isLimitReached;
                                            return (
                                                <SelectableTile
                                                    key={option.index}
                                                    label={normalizeProficiencyName(option.name)}
                                                    description={option.type || 'Perícia'}
                                                    isActive={isSelected}
                                                    disabled={disabled}
                                                    onClick={() => handleProficiencyChange(choice.id, option.index)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SectionShell>
            )}

            {languageChoicesCount > 0 && (
                <SectionShell
                    title="Idiomas Adicionais"
                    subtitle="Vozes e culturas"
                    icon={<Languages className="h-5 w-5" />}
                    actions={
                        <button
                            type="button"
                            onClick={() => handleRandomizeLanguages(baseLanguages || [], languageChoicesCount)}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-4 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition hover:brightness-110"
                        >
                            <Dice5 className="h-4 w-4" />
                            Sortear idiomas
                        </button>
                    }
                >
                    <p className="text-sm text-stone-400">
                        Escolha {languageChoicesCount} idioma(s) adicional(is). Idiomas já conhecidos não aparecem aqui.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: languageChoicesCount }).map((_, index) => (
                            <div key={index} className="rounded-2xl border border-white/5 bg-stone-950/60 p-4">
                                <p className="text-xs uppercase tracking-[0.4em] text-stone-500">Idioma {index + 1}</p>
                                <select
                                    id={`lang-choice-${index}`}
                                    value={chosenLanguages[index] || ''}
                                    onChange={e => handleLanguageChange(index, e.target.value)}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-stone-950/60 p-3 text-sm text-stone-100 focus:border-amber-400 focus:outline-none"
                                >
                                    <option value="" disabled>
                                        Selecione...
                                    </option>
                                    {availableLanguageOptions.map(lang => (
                                        <option key={lang.index} value={lang.name}>
                                            {lang.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </SectionShell>
            )}

            {!languageChoicesCount && (
                <SectionShell
                    title="Idiomas adicionais"
                    subtitle="Vozes e culturas"
                    icon={<Languages className="h-5 w-5" />}
                >
                    <p className="text-sm text-stone-400">
                        Nenhum idioma adicional disponível neste momento. Novos idiomas podem surgir com talentos ou escolhas futuras.
                    </p>
                </SectionShell>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-stone-100 transition hover:border-amber-300/60 hover:text-amber-100"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para Antecedente
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceedFromProficiencies}
                    className="flex items-center justify-center gap-3 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-6 py-3 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {canProceedFromProficiencies ? 'Prosseguir para Equipamentos' : 'Finalize as escolhas pendentes'}
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

export default NewStep4_ProficienciesAndLanguages;
