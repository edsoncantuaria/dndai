// src/components/NewCreationCharacter/NewCharacterCreation.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { ApiListItem } from '@/types';
import NewStep1_RaceClass from './NewStep1_RaceClass';
import NewStep2_Attributes from './NewStep2_Attributes';
import NewStep3_Background from './NewStep3_Background';
import NewStep4_ProficienciesAndLanguages from './NewStep4_ProficienciesAndLanguages';
import NewStep5_Equipment2 from './NewStep5_Equipment2';
import NewStep6_Spells from './NewStep6_Spells';
import NewStep7_Feats from './NewStep7_Feats';
import NewStep8_Finalize from './NewStep8_Finalize';
import ActionModal from '../ui/ActionModal';
import { Loader2, Sparkles, Swords, ScrollText, Languages, Shield, Stars, Crown, CheckCircle2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
}> = ({ hook }) => {
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

    return (
        <aside className="rounded-[28px] border border-white/5 bg-stone-950/40 p-6 backdrop-blur-xl shadow-2xl shadow-black/50 space-y-6 h-fit sticky top-6">
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
        </aside>
    );
};

const AccordionSection: React.FC<{
    stepNumber: number;
    title: string;
    description: string;
    icon: LucideIcon;
    isComplete: boolean;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}> = ({ stepNumber, title, description, icon: Icon, isComplete, isOpen, onToggle, children }) => {

    return (
        <div className="rounded-[28px] border border-white/5 bg-stone-950/70 shadow-2xl shadow-black/40 overflow-hidden">
            <button
                className="flex w-full items-start justify-between gap-4 p-6 text-left"
                onClick={onToggle}
            >
                <div className="flex items-start gap-4">
                    <div
                        className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
                            isOpen
                                ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                : isComplete
                                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
                                : 'border-white/10 bg-stone-900/80 text-stone-400'
                        }`}
                    >
                       {isComplete && !isOpen ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.5em] text-stone-500">Etapa {stepNumber}</p>
                        <h3 className="mt-1 text-2xl font-semibold text-amber-50">{title}</h3>
                        <p className="mt-1 text-sm text-stone-400">{description}</p>
                    </div>
                </div>
                <ChevronDown className={`h-6 w-6 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.section
                        key="content"
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{
                            open: { opacity: 1, height: 'auto' },
                            collapsed: { opacity: 0, height: 0 },
                        }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="p-6 pt-0">{children}</div>
                    </motion.section>
                )}
            </AnimatePresence>
        </div>
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
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [openStep, setOpenStep] = useState(1);
    
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
    
    const getStepCompleteness = (step: number): boolean => {
        switch (step) {
            case 1: return !!hook.race && !!hook.characterClass;
            case 2: return hook.attributeMethod !== null && (!hook.isVariantHuman || hook.variantHumanBonusSelections.length === 2);
            case 3: return !!hook.background && !!hook.alignment && !!hook.ideal && !!hook.bond && !!hook.flaw && hook.personalityTraits.length > 0;
            case 4: return hook.canProceedFromProficiencies;
            case 5: return hook.areAllEquipmentChoicesMade;
            case 6: return hook.areClassSpellsSelected && hook.areRacialSpellsSelected;
            case 7: return !hook.isVariantHuman || !!hook.selectedFeat;
            case 8: return hook.isComplete;
            default: return false;
        }
    };

    const nextStep = () => setOpenStep(current => Math.min(current + 1, CREATION_STEPS.length));
    const prevStep = () => setOpenStep(current => Math.max(current - 1, 1));
    
    const stepsContent = [
        <NewStep1_RaceClass hook={hook} races={races} classes={classes} nextStep={nextStep} />,
        <NewStep2_Attributes hook={hook} prevStep={prevStep} nextStep={nextStep} />,
        <NewStep3_Background hook={hook} backgrounds={backgrounds} alignments={alignments} prevStep={prevStep} nextStep={nextStep} />,
        <NewStep4_ProficienciesAndLanguages hook={hook} prevStep={prevStep} nextStep={nextStep} allLanguages={allLanguages} />,
        <NewStep5_Equipment2 hook={hook} prevStep={prevStep} nextStep={nextStep} />,
        <NewStep6_Spells hook={hook} prevStep={prevStep} nextStep={nextStep} />,
        <NewStep7_Feats hook={hook} prevStep={prevStep} nextStep={nextStep} />,
        <NewStep8_Finalize hook={hook} prevStep={prevStep} handleFinalize={() => setShowConfirmationModal(true)} />,
    ];

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
        <div className="relative isolate min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.08),transparent_45%)] px-3 py-6 sm:px-6 sm:py-10">
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
                <div className="absolute inset-y-0 left-1/2 w-[60%] -translate-x-1/2 bg-gradient-to-b from-amber-600/10 via-transparent to-transparent blur-3xl" />
                <div className="absolute -top-32 right-0 h-72 w-72 bg-rose-500/20 blur-[180px]" />
                <div className="absolute bottom-0 left-4 h-64 w-64 bg-amber-500/20 blur-[120px]" />
            </div>

            <main className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(320px,1.2fr)] lg:items-start">
                <div className="space-y-6">
                    {CREATION_STEPS.map((step, index) => (
                        <AccordionSection 
                            key={step.title}
                            stepNumber={index + 1}
                            title={step.title}
                            description={step.description}
                            icon={step.icon}
                            isComplete={getStepCompleteness(index + 1)}
                            isOpen={openStep === index + 1}
                            onToggle={() => setOpenStep(openStep === index + 1 ? 0 : index + 1)}
                        >
                            {stepsContent[index]}
                        </AccordionSection>
                    ))}
                </div>
                
                <CharacterSummaryPanel hook={hook} />
            </main>

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
