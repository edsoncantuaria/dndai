// src/components/NewCreationCharacter/NewCharacterCreation.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { ApiListItem } from '@/types';
import NewStep1_RaceClass from './NewStep1_RaceClass';
import NewStepper from './NewStepper';
import NewStep2_Attributes from './NewStep2_Attributes';
import NewStep3_Background from './NewStep3_Background';
import NewStep4_ProficienciesAndLanguages from './NewStep4_ProficienciesAndLanguages';
import NewStep5_Equipment2 from './NewStep5_Equipment2';
import NewStep6_Spells from './NewStep6_Spells';
import NewStep7_Feats from './NewStep7_Feats';
import NewStep8_Finalize from './NewStep8_Finalize';
import ActionModal from '../ui/ActionModal';
import { Loader2, Sparkles, Swords, ScrollText, Languages, Shield, Stars, Crown, CheckCircle2 } from 'lucide-react';

const CREATION_STEPS = [
    { title: 'Raça & Classe', description: 'Defina legado e vocação inicial.', icon: Sparkles },
    { title: 'Atributos', description: 'Distribua poder e potencial.', icon: Swords },
    { title: 'Antecedente', description: 'Roleplay e história pessoal.', icon: ScrollText },
    { title: 'Perícias & Idiomas', description: 'Especialize talentos únicos.', icon: Languages },
    { title: 'Equipamentos', description: 'Armas, armaduras e utilidades.', icon: Shield },
    { title: 'Magias', description: 'Defina repertório arcano.', icon: Stars },
    { title: 'Talentos', description: 'Escolha feitos memoráveis.', icon: Crown },
    { title: 'Finalização', description: 'Revise e inicie a jornada.', icon: CheckCircle2 },
] as const;

const ATTRIBUTE_ORDER = [
    { key: 'strength', label: 'FOR' },
    { key: 'dexterity', label: 'DES' },
    { key: 'constitution', label: 'CON' },
    { key: 'intelligence', label: 'INT' },
    { key: 'wisdom', label: 'SAB' },
    { key: 'charisma', label: 'CAR' },
] as const;

const CharacterSummaryPanel: React.FC<{
    hook: ReturnType<typeof useCharacterCreator>;
    currentStep: number;
    totalSteps: number;
}> = ({ hook, currentStep, totalSteps }) => {
    const {
        name,
        details,
        race,
        characterClass,
        background,
        alignment,
        finalAttributes,
        baseAttributes,
        modifiers,
        ac,
        hp,
        speed,
        proficiencyBonus,
        baseLanguages,
        chosenLanguages = [],
    } = hook;

    const attributeSource = (finalAttributes || baseAttributes) as Record<string, number> | undefined;
    const modifierSource = modifiers as Record<string, number> | undefined;
    const languageBadges = useMemo(() => {
        const merged = new Set<string>();
        (baseLanguages || []).forEach(lang => lang && merged.add(lang));
        (chosenLanguages || []).forEach(lang => lang && merged.add(lang));
        return Array.from(merged);
    }, [baseLanguages, chosenLanguages]);

    const highlightStats = [
        { label: 'Classe de Armadura', value: ac?.value ? `${ac.value}` : '—', caption: ac?.source || 'Base' },
        { label: 'Vida Máxima', value: hp?.max ? `${hp.max} PV` : '—', caption: hp?.current ? `Atual ${hp.current}` : 'Nível 1' },
        { label: 'Deslocamento', value: speed ? `${speed} ft` : '—', caption: 'Velocidade' },
        { label: 'Bônus de Proficiência', value: proficiencyBonus ? `+${proficiencyBonus}` : '—', caption: 'Escala heroica' },
    ];

    const progressRatio = currentStep / totalSteps;

    return (
        <aside className="rounded-[28px] border border-white/5 bg-stone-950/40 p-6 backdrop-blur-xl shadow-2xl shadow-black/50 space-y-6">
            <div>
                <p className="text-[10px] uppercase tracking-[0.5em] text-amber-400/80">Prévia</p>
                <h4 className="mt-2 text-xl font-semibold text-amber-50">Visão do Herói</h4>
                <p className="text-sm text-stone-400">Ajuste os detalhes e veja o personagem ganhar vida.</p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-stone-900/80 to-stone-950/60 p-4 space-y-3">
                <div>
                    <p className="text-xs uppercase text-stone-500">Nome</p>
                    <p className="text-lg font-medium text-stone-100">{name || 'Herói sem nome'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-stone-500">Raça</p>
                        <p className="text-stone-100">{details.raceDetails?.name || race || 'Selecionar'}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-stone-500">Classe</p>
                        <p className="text-stone-100">{details.classDetails?.name || characterClass || 'Selecionar'}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-stone-500">Antecedente</p>
                        <p className="text-stone-100">{details.backgroundDetails?.name || background || 'Selecionar'}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-stone-500">Alinhamento</p>
                        <p className="text-stone-100">{alignment || 'Escolher'}</p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-stone-950/60 p-4 space-y-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-stone-500">
                    <span>Atributos</span>
                    <span>+Mod</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {ATTRIBUTE_ORDER.map(attr => {
                        const score = attributeSource?.[attr.key];
                        const mod = modifierSource?.[attr.key];
                        return (
                            <div key={attr.key} className="rounded-xl border border-white/5 bg-stone-900/70 p-3 text-center">
                                <p className="text-[11px] uppercase tracking-wide text-amber-300">{attr.label}</p>
                                <p className="text-2xl font-semibold text-stone-50">{score ?? '—'}</p>
                                <p className="text-xs text-stone-400">{typeof mod === 'number' ? (mod >= 0 ? `+${mod}` : mod) : '—'}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid gap-3">
                {highlightStats.map(stat => (
                    <div key={stat.label} className="rounded-xl border border-white/5 bg-stone-950/50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.4em] text-stone-500">{stat.label}</p>
                        <p className="text-lg font-semibold text-stone-100">{stat.value}</p>
                        <p className="text-xs text-stone-500">{stat.caption}</p>
                    </div>
                ))}
            </div>

            <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500 mb-2">Idiomas</p>
                {languageBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {languageBadges.map(lang => (
                            <span key={lang} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                                {lang}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-stone-500">Nenhum idioma selecionado.</p>
                )}
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-stone-500">
                    <span>Progresso</span>
                    <span>{Math.round(progressRatio * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-stone-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 transition-all duration-300" style={{ width: `${Math.max(progressRatio * 100, 5)}%` }} />
                </div>
            </div>
        </aside>
    );
};

interface NewCharacterCreationProps {
    races: ApiListItem[];
    classes: ApiListItem[];
    backgrounds: ApiListItem[];
    alignments: ApiListItem[];
    allLanguages: ApiListItem[];
    onCharacterCreated: () => void;
}

const NewCharacterCreation: React.FC<NewCharacterCreationProps> = ({
    races,
    classes,
    backgrounds,
    alignments,
    allLanguages,
    onCharacterCreated
}) => {
    const { createCharacter } = useGameStateContext();
    const hook = useCharacterCreator({ allLanguages: allLanguages || [] });
    const [currentStep, setCurrentStep] = useState(1);
    const [highestStep, setHighestStep] = useState(1);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const totalSteps = CREATION_STEPS.length;
    const wizardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (wizardRef.current) {
            wizardRef.current.scrollTo(0, 0);
        }
    }, [currentStep]);

    const nextStep = () => {
        const next = Math.min(currentStep + 1, totalSteps);
        setCurrentStep(next);
        setHighestStep(Math.max(highestStep, next));
    };
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const goToStep = (step: number) => {
        if (step <= highestStep && step >= 1) {
            setCurrentStep(step);
        }
    };
    
    const handleFinalizeAndSubmit = async () => {
        const finalCharacterData = hook.buildCharacter();
        if (finalCharacterData) {
            setShowConfirmationModal(false);
            const result = await createCharacter(finalCharacterData);
            if (result) {
                onCharacterCreated();
            }
        } else {
            console.error("Não foi possível finalizar a criação do personagem. Dados incompletos.");
            setShowConfirmationModal(false);
        }
    };

    const promptFinalize = () => {
        if (hook.isComplete) {
            setShowConfirmationModal(true);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <NewStep1_RaceClass hook={hook} nextStep={nextStep} races={races} classes={classes} />;
            case 2:
                return <NewStep2_Attributes hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 3:
                return <NewStep3_Background hook={hook} backgrounds={backgrounds} alignments={alignments} prevStep={prevStep} nextStep={nextStep} />;
            case 4:
                return <NewStep4_ProficienciesAndLanguages hook={hook} prevStep={prevStep} nextStep={nextStep} allLanguages={allLanguages} />;
            case 5:
                return <NewStep5_Equipment2 hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 6:
                return <NewStep6_Spells hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 7:
                return <NewStep7_Feats hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 8:
                return <NewStep8_Finalize hook={hook} prevStep={prevStep} handleFinalize={promptFinalize} />;
            default:
                return <div>Etapa Inválida.</div>;
        }
    };
    
    const progressPercentage = useMemo(() => Math.round((currentStep / totalSteps) * 100), [currentStep, totalSteps]);
    const currentStepMeta = CREATION_STEPS[currentStep - 1] || CREATION_STEPS[0];

    if (hook.loadingStates.isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400">
                <Loader2 className="h-12 w-12 animate-spin" />
                {hook.loadingStates.message && (
                     <div className="w-full max-w-sm mt-4">
                        <p className="text-center text-sm mb-2">{hook.loadingStates.message}</p>
                        <div className="w-full bg-stone-700 rounded-full h-2.5">
                            <div 
                                className="bg-amber-600 h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${hook.loadingStates.progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative isolate min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.08),transparent_45%)] px-3 py-6 sm:px-6 sm:py-10">
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
                <div className="absolute inset-y-0 left-1/2 w-[60%] -translate-x-1/2 bg-gradient-to-b from-amber-600/10 via-transparent to-transparent blur-3xl" />
                <div className="absolute -top-32 right-0 h-72 w-72 bg-rose-500/20 blur-[140px]" />
                <div className="absolute bottom-0 left-4 h-64 w-64 bg-amber-500/20 blur-[120px]" />
            </div>

            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
                <header className="relative overflow-hidden rounded-[32px] border border-white/5 bg-gradient-to-br from-stone-900/80 via-stone-950/80 to-black/80 px-6 py-6 sm:px-10 sm:py-8 shadow-2xl shadow-black/50">
                    <div className="grid gap-6 md:grid-cols-[2fr_1fr] md:items-center">
                        <div className="space-y-4">
                            <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Forja Arcana</p>
                            <h2 className="text-3xl sm:text-4xl font-semibold text-amber-50">Criação de Personagem</h2>
                            <p className="text-sm text-stone-300">
                                Bem-vindo à nova experiência premium de criação. Cada etapa traz contexto visual, progresso claro e
                                um painel vivo do herói que você está moldando.
                            </p>
                            <div className="flex flex-wrap items-center gap-6 pt-2">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500">Etapa Atual</p>
                                    <p className="text-lg font-semibold text-amber-200">{currentStep}. {currentStepMeta.title}</p>
                                    <p className="text-sm text-stone-400">{currentStepMeta.description}</p>
                                </div>
                                <div className="w-full max-w-xs">
                                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.4em] text-stone-500">
                                        <span>Progresso</span>
                                        <span>{progressPercentage}%</span>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-stone-800">
                                        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="relative hidden rounded-3xl border border-white/5 bg-stone-900/60 p-5 md:block">
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
                            <div className="relative z-10 space-y-3">
                                <p className="text-[11px] uppercase tracking-[0.5em] text-stone-500">Destaques da Etapa</p>
                                <ul className="space-y-2 text-sm text-stone-200">
                                    <li>{currentStepMeta.description}</li>
                                    <li>Revisite os passos anteriores a qualquer momento.</li>
                                    <li>O painel à direita mostra o impacto instantâneo das escolhas.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </header>

                <NewStepper
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    highestStep={highestStep}
                    goToStep={goToStep}
                    steps={CREATION_STEPS}
                />

                <main className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1.2fr)]">
                    <section
                        ref={wizardRef}
                        className="relative overflow-hidden rounded-[32px] border border-white/5 bg-stone-950/70 p-4 sm:p-6 shadow-2xl shadow-black/40 backdrop-blur-xl"
                    >
                        <div className="absolute inset-0 pointer-events-none opacity-30">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.08),transparent_55%)]" />
                        </div>
                        <div className="relative z-10 max-h-none overflow-visible pr-1 lg:max-h-[72vh] lg:overflow-y-auto">
                            {renderStep()}
                        </div>
                    </section>

                    <CharacterSummaryPanel hook={hook} currentStep={currentStep} totalSteps={totalSteps} />
                </main>
            </div>

            {showConfirmationModal && (
                 <ActionModal
                    isOpen={showConfirmationModal}
                    title="Iniciar Aventura?"
                    onClose={() => setShowConfirmationModal(false)}
                    actions={[
                        { text: "Não, voltar", onClick: () => setShowConfirmationModal(false), variant: 'secondary' },
                        { text: "Sim, iniciar aventura!", onClick: handleFinalizeAndSubmit, variant: 'primary' }
                    ]}
                >
                    <p className="text-stone-300">{`Você está prestes a começar sua jornada como ${hook.name || 'um herói sem nome'}. Uma vez iniciada, a história não poderá ser alterada. Deseja continuar?`}</p>
                </ActionModal>
            )}

        </div>
    );
};

export default NewCharacterCreation;
