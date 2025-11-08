// src/components/Homebrew/HomebrewCreator.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import {
    ArrowLeft,
    Layers,
    Sparkles,
    Loader2,
    Info,
    ShieldPlus,
    Share2,
    BookOpen,
    ChevronRight,
    CheckCircle,
} from 'lucide-react';
import RaceForm from './forms/RaceForm';
import ClassForm from './forms/ClassForm';
import SubclassForm from './forms/SubclassForm';
import SpellForm from './forms/SpellForm';
import ItemForm from './forms/ItemForm';
import MonsterForm from './forms/MonsterForm';
import BackgroundForm from './forms/BackgroundForm';
import FeatForm from './forms/FeatForm';
import SubraceForm from './forms/SubraceForm';
import SkillForm from './forms/SkillForm';
import HomebrewHelpModal from './HomebrewHelpModal';
import ExampleModal from './ExampleModal';
import { EXAMPLES } from '@/data/examples';
import { useAuth } from '@/contexts/AuthContext';

const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race',
    'subrace',
    'class',
    'subclass',
    'spell',
    'item',
    'monster',
    'background',
    'feat',
    'skill',
];

type Step = 'meta' | 'structure' | 'review';

interface Props {
    onContentCreated: () => void;
    onCancel: () => void;
    contentToEdit?: HomebrewService.HomebrewContent | null;
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

const HomebrewCreator: React.FC<Props> = ({ onContentCreated, onCancel, contentToEdit }) => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [type, setType] = useState<HomebrewService.HomebrewContentType>(contentToEdit?.type || 'race');
    const [contentData, setContentData] = useState<any>(contentToEdit?.content || {});
    const [isPublic, setIsPublic] = useState(contentToEdit?.isPublic ?? false);
    const [isLoading, setIsLoading] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);
    const [exampleToLoad, setExampleToLoad] = useState<any | null>(null);
    const [activeStep, setActiveStep] = useState<Step>('meta');

    const availableContentTypes = useMemo(() => {
        if (user?.id === 1) return CONTENT_TYPES;
        return CONTENT_TYPES.filter((t) => t !== 'skill' && t !== 'translation');
    }, [user]);

    useEffect(() => {
        if (contentToEdit) {
            setType(contentToEdit.type);
            setContentData(contentToEdit.content);
            setIsPublic(contentToEdit.isPublic);
        }
    }, [contentToEdit]);

    const handleLoadExample = (sample?: any) => {
        const data = sample || EXAMPLES[type as keyof typeof EXAMPLES];
        if (!data) {
            toast({ variant: 'destructive', title: 'Sem exemplo', description: 'Ainda não temos um exemplo para este tipo.' });
            return;
        }
        setContentData(data);
        setExampleToLoad(data);
        toast({ title: 'Exemplo carregado', description: `Preenchemos os campos com uma referência de ${type}.` });
    };

    const handleSubmit = async () => {
        if (!contentData?.name) {
            toast({ variant: 'destructive', title: 'Nome obrigatório', description: 'Informe o nome do conteúdo antes de salvar.' });
            return;
        }

        setIsLoading(true);
        try {
            const payload: HomebrewService.CreateHomebrewData = {
                name: contentData.name,
                type,
                content: contentData,
                isPublic,
                dependencies: contentData.dependencies || [],
            };

            if (contentToEdit) {
                await HomebrewService.updateHomebrewContent(contentToEdit.id, payload);
                toast({ title: 'Conteúdo atualizado', description: `"${contentData.name}" salvo com sucesso.` });
            } else {
                await HomebrewService.createHomebrewContent(payload);
                toast({ title: 'Conteúdo criado', description: `"${contentData.name}" foi adicionado à sua oficina.` });
            }
            onContentCreated();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message || 'Ocorreu um problema ao salvar o conteúdo.' });
        } finally {
            setIsLoading(false);
        }
    };

    const initialDataForForm = useMemo(() => {
        if (exampleToLoad) return exampleToLoad;
        if (contentToEdit?.type === type) return contentToEdit.content;
        return {};
    }, [contentToEdit, exampleToLoad, type]);

    const renderForm = () => {
        const commonProps = { data: initialDataForForm, onChange: setContentData };
        switch (type) {
            case 'race':
                return <RaceForm {...commonProps} />;
            case 'subrace':
                return <SubraceForm {...commonProps} />;
            case 'class':
                return <ClassForm {...commonProps} />;
            case 'subclass':
                return <SubclassForm {...commonProps} />;
            case 'spell':
                return <SpellForm {...commonProps} />;
            case 'item':
                return <ItemForm {...commonProps} />;
            case 'monster':
                return <MonsterForm {...commonProps} />;
            case 'background':
                return <BackgroundForm {...commonProps} />;
            case 'feat':
                return <FeatForm {...commonProps} />;
            case 'skill':
                return <SkillForm {...commonProps} />;
            default:
                return <ItemForm {...commonProps} />;
        }
    };

    const canAdvanceToStructure = Boolean(contentData?.name && type);
    const canAdvanceToReview = canAdvanceToStructure && Boolean(contentData && Object.keys(contentData).length > 0);

    const stepper = [
        { id: 'meta', label: 'Metadados', description: 'Nome, índice e visibilidade' },
        { id: 'structure', label: 'Estrutura', description: 'Campos específicos do tipo' },
        { id: 'review', label: 'Revisão', description: 'JSON final e dependências' },
    ] satisfies { id: Step; label: string; description: string }[];

    const jsonPreview = useMemo(() => JSON.stringify({ type, isPublic, content: contentData }, null, 2), [type, isPublic, contentData]);

    const renderMetaStep = () => (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-sm font-semibold text-stone-200">Tipo de conteúdo</label>
                    <select
                        value={type}
                        onChange={(e) => {
                            setType(e.target.value as HomebrewService.HomebrewContentType);
                            setExampleToLoad(null);
                        }}
                        className="w-full rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-stone-100 outline-none focus:border-amber-500"
                    >
                        {availableContentTypes.map((ct) => (
                            <option key={ct} value={ct}>
                                {ct}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-semibold text-stone-200">Nome / título</label>
                    <input
                        type="text"
                        value={contentData.name || ''}
                        onChange={(e) => setContentData((prev: any) => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Espada Solar"
                        className="w-full rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-stone-100 placeholder:text-stone-600 focus:border-amber-500"
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-sm font-semibold text-stone-200">Slug / Index</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={contentData.index || ''}
                            onChange={(e) => setContentData((prev: any) => ({ ...prev, index: slugify(e.target.value) }))}
                            placeholder="espada-solar"
                            className="w-full rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-stone-100 placeholder:text-stone-600 focus:border-amber-500"
                        />
                        <button
                            type="button"
                            className="rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-stone-200 transition hover:border-amber-300 hover:text-amber-200"
                            onClick={() =>
                                setContentData((prev: any) => ({
                                    ...prev,
                                    index: slugify(prev?.name || 'homebrew'),
                                }))
                            }
                        >
                            Gerar
                        </button>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-semibold text-stone-200">Index oficial (opcional)</label>
                    <input
                        type="text"
                        value={contentData.official_index || ''}
                        onChange={(e) => setContentData((prev: any) => ({ ...prev, official_index: e.target.value }))}
                        placeholder="longsword"
                        className="w-full rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-stone-100 placeholder:text-stone-600 focus:border-amber-500"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-semibold text-stone-200">Compartilhamento</label>
                    <button
                        type="button"
                        onClick={() => setIsPublic((prev) => !prev)}
                        className={`flex w-full items-center justify-between rounded-xl border p-2 font-semibold transition ${
                            isPublic ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : 'border-stone-700 bg-stone-950/70 text-stone-300'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2">{isPublic ? <Share2 className="h-4 w-4" /> : <ShieldPlus className="h-4 w-4" />}{isPublic ? 'Visível para todos' : 'Somente você'}</span>
                        <span className={`h-5 w-10 rounded-full transition ${isPublic ? 'bg-emerald-400/60' : 'bg-stone-600'}`} />
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-stone-800 bg-black/30 p-4 shadow-inner shadow-black/60">
                <div className="flex flex-wrap items-center gap-4">
                    <button onClick={() => setIsHelpModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-stone-300 transition hover:text-white">
                        <Info className="h-4 w-4" /> Guia rápido
                    </button>
                    <button onClick={() => handleLoadExample()} className="inline-flex items-center gap-2 text-sm text-amber-300 transition hover:text-amber-200">
                        <BookOpen className="h-4 w-4" /> Carregar exemplo
                    </button>
                    <button onClick={() => handleLoadExample({})} className="inline-flex items-center gap-2 text-sm text-cyan-300 transition hover:text-cyan-200">
                        <Sparkles className="h-4 w-4" /> Limpar campos
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStructureStep = () => (
        <div className="rounded-2xl border border-stone-700 bg-black/30 p-4 shadow-inner shadow-black/60">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <p a className="text-xs uppercase tracking-[0.3em] text-amber-400/70">
                        Editor estruturado
                    </p>
                    <h2 className="text-xl font-semibold text-white">Campos para {type}</h2>
                    <p className="text-sm text-stone-400">As seções se adaptam automaticamente ao tipo escolhido.</p>
                </div>
                <Layers className="h-10 w-10 text-amber-300" />
            </div>
            <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950/60 p-4">{renderForm()}</div>
        </div>
    );

    const renderReviewStep = () => (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/60">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Resumo</p>
                <h2 className="text-xl font-semibold text-white">Check-list</h2>
                <ul className="mt-4 space-y-3 text-sm text-stone-300">
                    <li className="flex items-center gap-2">
                        <CheckCircle className={`h-4 w-4 ${contentData.name ? 'text-emerald-300' : 'text-stone-500'}`} />
                        Nome definido
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle className={`h-4 w-4 ${contentData.index ? 'text-emerald-300' : 'text-stone-500'}`} />
                        Slug/index
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle className={`h-4 w-4 ${Object.keys(contentData || {}).length > 1 ? 'text-emerald-300' : 'text-stone-500'}`} />
                        Campos preenchidos
                    </li>
                </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/60">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Pré-visualização JSON</p>
                <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-black/60 p-4 text-xs text-amber-100">{jsonPreview}</pre>
            </div>
        </div>
    );

    const renderStepContent = () => {
        switch (activeStep) {
            case 'meta':
                return renderMetaStep();
            case 'structure':
                return renderStructureStep();
            case 'review':
                return renderReviewStep();
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {isHelpModalOpen && <HomebrewHelpModal onClose={() => setIsHelpModalOpen(false)} />}
            {isExampleModalOpen && (
                <ExampleModal
                    open={isExampleModalOpen}
                    onClose={() => setIsExampleModalOpen(false)}
                    contentType={type}
                    onApply={(sample) => {
                        setExampleToLoad(sample);
                        setContentData(sample);
                        setIsExampleModalOpen(false);
                        toast({ title: 'Exemplo aplicado', description: 'Você pode ajustar qualquer campo antes de salvar.' });
                    }}
                />
            )}

            <div className="flex items-center justify-between flex-wrap gap-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-stone-200 transition hover:border-amber-200 hover:text-amber-200"
                >
                    <ArrowLeft className="h-4 w-4" /> Voltar para o marketplace
                </button>
                <div className="flex items-center gap-2 text-xs text-stone-400">
                    <Sparkles className="h-4 w-4" />
                    * Conteúdos passam pelo sanitizador automático ao salvar
                </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-5 shadow-2xl shadow-black/60">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-3">
                        {stepper.map((step, index) => (
                            <button
                                key={step.id}
                                type="button"
                                onClick={() => {
                                    if (step.id === 'structure' && !canAdvanceToStructure) return;
                                    if (step.id === 'review' && !canAdvanceToReview) return;
                                    setActiveStep(step.id);
                                }}
                                className={`flex flex-1 min-w-[180px] items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                                    activeStep === step.id
                                        ? 'border-amber-400/60 bg-amber-400/10 text-amber-100 shadow-inner shadow-amber-500/30'
                                        : 'border-white/10 bg-white/5 text-stone-300'
                                } ${(step.id === 'structure' && !canAdvanceToStructure) || (step.id === 'review' && !canAdvanceToReview) ? 'opacity-40 cursor-not-allowed' : 'hover:border-amber-200/40 hover:text-amber-100'}`}
                            >
                                <div>
                                    <p className="text-xs uppercase tracking-[0.25em]">{step.label}</p>
                                    <p className="text-xs text-stone-400">{step.description}</p>
                                </div>
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        ))}
                    </div>

                    {renderStepContent()}

                    <div className="flex flex-wrap gap-3">
                        {activeStep !== 'meta' && (
                            <button
                                type="button"
                                onClick={() => setActiveStep(activeStep === 'review' ? 'structure' : 'meta')}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-2 text-sm font-semibold text-stone-200 transition hover:border-amber-200 hover:text-amber-200"
                            >
                                Etapa anterior
                            </button>
                        )}

                        {activeStep !== 'review' && (
                            <button
                                type="button"
                                onClick={() => setActiveStep(activeStep === 'meta' ? 'structure' : 'review')}
                                disabled={(activeStep === 'meta' && !canAdvanceToStructure) || (activeStep === 'structure' && !canAdvanceToReview)}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 px-6 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Avançar
                            </button>
                        )}

                        {activeStep === 'review' && (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-cyan-500 px-6 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 disabled:opacity-40"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar conteúdo'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomebrewCreator;
