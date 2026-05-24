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
import SrdSourcePanel from './SrdSourcePanel';
import { EXAMPLES } from '@/data/examples';
import { useAuth } from '@/contexts/AuthContext';
import { DndButton, DndCard, DndHeading, DndInput } from '@/components/primitives';
import { HomebrewCreationStepper } from '@/features/homebrew/creator/HomebrewCreationStepper';
import { HomebrewLivePreview } from '@/features/homebrew/creator/HomebrewLivePreview';
import { HOMEBREW_CREATOR_STEPS, creatorSelectClass } from '@/features/homebrew/creator/constants';
import { hb } from '@/features/homebrew/forms/formUi';
import { cn } from '@/lib/utils';

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
    /** v2: stepper + preview ao vivo (Grimório) */
    variant?: 'legacy' | 'v2';
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

const TRANSLATABLE_KEYS = [
    'name', 'desc', 'material', 'higher_level', 'casting_time', 'range', 'duration',
    'age', 'alignment', 'language_desc', 'size_description', 'special', 'contents',
    'actions', 'legendary_actions', 'special_abilities',
];

function extractSrdOverrides(
    current: Record<string, unknown>,
    baseline: Record<string, unknown> | null,
    sourceKind: HomebrewService.HomebrewSourceKind,
): Record<string, unknown> {
    if (sourceKind === 'original' || !baseline) {
        return current;
    }
    if (sourceKind === 'fork') {
        const { url, ...rest } = current;
        return rest;
    }
    const overrides: Record<string, unknown> = {};
    for (const key of TRANSLATABLE_KEYS) {
        if (current[key] !== undefined && JSON.stringify(current[key]) !== JSON.stringify(baseline[key])) {
            overrides[key] = current[key];
        }
    }
    if (typeof current.name === 'string') overrides.name = current.name;
    return overrides;
}

const HomebrewCreator: React.FC<Props> = ({ onContentCreated, onCancel, contentToEdit, variant = 'legacy' }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const isV2 = variant === 'v2';
    const fieldLabel = isV2 ? undefined : 'text-sm font-semibold text-stone-200';
    const fieldInput = isV2
        ? ''
        : 'w-full rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-stone-100 placeholder:text-stone-600 focus:border-amber-500';

    const [type, setType] = useState<HomebrewService.HomebrewContentType>(contentToEdit?.type || 'race');
    const [sourceKind, setSourceKind] = useState<HomebrewService.HomebrewSourceKind>(
        contentToEdit?.sourceKind ?? 'original',
    );
    const [sourceResource, setSourceResource] = useState<string | null>(contentToEdit?.sourceResource ?? null);
    const [sourceIndex, setSourceIndex] = useState<string | null>(contentToEdit?.sourceIndex ?? null);
    const [locale, setLocale] = useState(contentToEdit?.locale ?? 'pt-BR');
    const [officialBaseline, setOfficialBaseline] = useState<Record<string, unknown> | null>(null);
    const [contentData, setContentData] = useState<any>(contentToEdit?.content || {});
    const [isPublic, setIsPublic] = useState(contentToEdit?.isPublic ?? false);
    const [isLoading, setIsLoading] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [exampleToLoad, setExampleToLoad] = useState<any | null>(null);
    const [activeStep, setActiveStep] = useState<Step>('meta');

    const availableContentTypes = useMemo(() => {
        if (user?.id === 1) return CONTENT_TYPES;
        return CONTENT_TYPES.filter((t) => t !== 'skill' && t !== 'translation');
    }, [user]);

    useEffect(() => {
        if (contentToEdit) {
            setType(contentToEdit.type);
            setSourceKind(contentToEdit.sourceKind ?? 'original');
            setSourceResource(contentToEdit.sourceResource ?? null);
            setSourceIndex(contentToEdit.sourceIndex ?? null);
            setLocale(contentToEdit.locale ?? 'pt-BR');
            setContentData(contentToEdit.content);
            setIsPublic(contentToEdit.isPublic);
        }
    }, [contentToEdit]);

    const handleOfficialLoaded = ({
        sourceResource: resource,
        sourceIndex: index,
        official,
    }: {
        sourceResource: string;
        sourceIndex: string;
        official: Record<string, unknown>;
    }) => {
        setSourceResource(resource);
        setSourceIndex(index);
        setOfficialBaseline(official);

        if (sourceKind === 'translation') {
            setContentData({
                ...official,
                official_index: index,
                index,
            });
        } else {
            const forkIndex = slugify(`${String(official.name)}-fork`);
            setContentData({
                ...official,
                official_index: index,
                index: forkIndex,
                name: `${official.name} (Fork)`,
            });
        }
    };

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
            if (contentToEdit) {
                const payload: HomebrewService.CreateHomebrewData = {
                    name: contentData.name,
                    type,
                    content: contentData,
                    isPublic,
                    dependencies: contentData.dependencies || [],
                    sourceKind,
                    sourceResource,
                    sourceIndex,
                    locale,
                };
                await HomebrewService.updateHomebrewContent(contentToEdit.id, payload);
                toast({ title: 'Conteúdo atualizado', description: `"${contentData.name}" salvo com sucesso.` });
            } else if (sourceKind !== 'original' && sourceResource && sourceIndex) {
                const overrides = extractSrdOverrides(contentData, officialBaseline, sourceKind);
                await HomebrewService.createHomebrewFromSrd({
                    type: type as HomebrewService.CreateFromSrdData['type'],
                    name: contentData.name,
                    sourceKind,
                    sourceResource,
                    sourceIndex,
                    overrides,
                    isPublic,
                    locale,
                    dependencies: contentData.dependencies || [],
                });
                toast({ title: 'Conteúdo criado', description: `"${contentData.name}" derivado do SRD com sucesso.` });
            } else {
                const payload: HomebrewService.CreateHomebrewData = {
                    name: contentData.name,
                    type,
                    content: contentData,
                    isPublic,
                    dependencies: contentData.dependencies || [],
                    sourceKind: 'original',
                    locale,
                };
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
        if (Object.keys(contentData || {}).length > 0) return contentData;
        if (contentToEdit?.type === type) return contentToEdit.content;
        return {};
    }, [contentToEdit, exampleToLoad, type, contentData]);

    const renderForm = () => {
        const commonProps = { onDataChange: setContentData, initialData: initialDataForForm };
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

    const canAdvanceToStructure = Boolean(
        contentData?.name &&
        type &&
        (sourceKind === 'original' || (sourceIndex && sourceResource)),
    );
    const canAdvanceToReview = canAdvanceToStructure && Boolean(contentData && Object.keys(contentData).length > 0);

    const jsonPreview = useMemo(
        () => JSON.stringify({ type, sourceKind, sourceResource, sourceIndex, locale, isPublic, content: contentData }, null, 2),
        [type, sourceKind, sourceResource, sourceIndex, locale, isPublic, contentData],
    );

    const renderMetaStep = () => (
        <div className={cn('space-y-6', isV2 && 'space-y-5')}>
            <div className={cn('grid gap-4 md:grid-cols-3', isV2 && hb.section)}>
                <div className="space-y-1">
                    {isV2 ? (
                        <label className={hb.label}>Origem do conteúdo</label>
                    ) : (
                        <label className={fieldLabel}>Origem do conteúdo</label>
                    )}
                    <select
                        value={sourceKind}
                        onChange={(e) => {
                            const next = e.target.value as HomebrewService.HomebrewSourceKind;
                            setSourceKind(next);
                            setSourceIndex(null);
                            setSourceResource(null);
                            setOfficialBaseline(null);
                            if (next === 'original') {
                                setContentData((prev: any) => ({
                                    name: prev?.name ?? '',
                                    index: prev?.index ?? '',
                                }));
                            }
                        }}
                        className={isV2 ? creatorSelectClass : fieldInput}
                    >
                        <option value="original">Original (novo, padrão SRD)</option>
                        <option value="translation">Tradução (base SRD)</option>
                        <option value="fork">Fork (variante do SRD)</option>
                    </select>
                </div>
                <div className="space-y-1">
                    {isV2 ? (
                        <label className={hb.label}>Tipo de conteúdo</label>
                    ) : (
                        <label className={fieldLabel}>Tipo de conteúdo</label>
                    )}
                    <select
                        value={type}
                        onChange={(e) => {
                            setType(e.target.value as HomebrewService.HomebrewContentType);
                            setExampleToLoad(null);
                            setSourceIndex(null);
                            setSourceResource(null);
                            setOfficialBaseline(null);
                        }}
                        className={isV2 ? creatorSelectClass : fieldInput}
                    >
                        {availableContentTypes.map((ct) => (
                            <option key={ct} value={ct}>
                                {ct}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    {isV2 ? (
                        <DndInput
                            label="Nome / título"
                            value={contentData.name || ''}
                            onChange={(e) => setContentData((prev: any) => ({ ...prev, name: e.target.value }))}
                            placeholder="Ex: Espada Solar"
                        />
                    ) : (
                        <>
                            <label className={fieldLabel}>Nome / título</label>
                            <input
                                type="text"
                                value={contentData.name || ''}
                                onChange={(e) => setContentData((prev: any) => ({ ...prev, name: e.target.value }))}
                                placeholder="Ex: Espada Solar"
                                className={fieldInput}
                            />
                        </>
                    )}
                </div>
            </div>

            {sourceKind !== 'original' && (
                <SrdSourcePanel
                    variant={variant}
                    homebrewType={type}
                    sourceKind={sourceKind}
                    selectedIndex={sourceIndex}
                    onOfficialLoaded={handleOfficialLoaded}
                />
            )}

            <div className={cn('grid gap-4 md:grid-cols-3', isV2 && hb.section)}>
                <div className="space-y-1">
                    <label className={isV2 ? hb.label : fieldLabel}>Slug / index</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={contentData.index || ''}
                            onChange={(e) => setContentData((prev: any) => ({ ...prev, index: slugify(e.target.value) }))}
                            placeholder={sourceKind === 'translation' ? 'fireball' : 'espada-solar'}
                            disabled={sourceKind === 'translation'}
                            className={cn(isV2 ? hb.control : fieldInput, 'disabled:opacity-60')}
                        />
                        {sourceKind !== 'translation' &&
                            (isV2 ? (
                                <DndButton
                                    type="button"
                                    size="sm"
                                    variant="goldOutline"
                                    onClick={() =>
                                        setContentData((prev: any) => ({
                                            ...prev,
                                            index: slugify(prev?.name || 'homebrew'),
                                        }))
                                    }
                                >
                                    Gerar
                                </DndButton>
                            ) : (
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
                            ))}
                    </div>
                </div>
                <div className="space-y-1">
                    <label className={isV2 ? hb.label : fieldLabel}>
                        {sourceKind === 'original' ? 'Index oficial (opcional)' : 'Index oficial SRD'}
                    </label>
                    <input
                        type="text"
                        value={sourceIndex || contentData.official_index || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSourceIndex(val || null);
                            setContentData((prev: any) => ({ ...prev, official_index: val }));
                        }}
                        placeholder="fireball"
                        disabled={sourceKind !== 'original' && Boolean(sourceIndex)}
                        className={cn(isV2 ? hb.control : fieldInput, 'disabled:opacity-60')}
                    />
                </div>
                <div className="space-y-1">
                    <label className={isV2 ? hb.label : fieldLabel}>Locale</label>
                    <input
                        type="text"
                        value={locale}
                        onChange={(e) => setLocale(e.target.value)}
                        placeholder="pt-BR"
                        className={isV2 ? hb.control : fieldInput}
                    />
                </div>
            </div>

            <div className={isV2 ? hb.section : 'space-y-1'}>
                <label className={isV2 ? hb.label : fieldLabel}>Compartilhamento</label>
                <button
                    type="button"
                    onClick={() => setIsPublic((prev) => !prev)}
                    className={cn(
                        'flex w-full items-center justify-between rounded-md border px-4 py-3 font-ui text-sm transition',
                        isV2
                            ? isPublic
                                ? 'border-dnd-success/40 bg-dnd-success/10 text-dnd-parchment'
                                : 'border-dnd-gold/20 bg-dnd-obsidian-raised/50 text-dnd-parchment-muted'
                            : isPublic
                              ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                              : 'border-stone-700 bg-stone-950/70 text-stone-300'
                    )}
                >
                    <span className="inline-flex items-center gap-2">
                        {isPublic ? <Share2 className="h-4 w-4" /> : <ShieldPlus className="h-4 w-4" />}
                        {isPublic ? 'Visível para todos' : 'Somente você'}
                    </span>
                    <span
                        className={cn(
                            'h-5 w-10 rounded-full transition',
                            isPublic
                                ? isV2
                                    ? 'bg-dnd-success/50'
                                    : 'bg-emerald-400/60'
                                : isV2
                                  ? 'bg-dnd-mist-strong'
                                  : 'bg-stone-600'
                        )}
                    />
                </button>
            </div>

            {!isV2 ? (
            <div className="rounded-2xl border border-stone-800 bg-black/30 p-4 shadow-inner shadow-black/60">
                <div className="flex flex-wrap items-center gap-4">
                    <button
                        type="button"
                        onClick={() => setIsHelpModalOpen(true)}
                        className="inline-flex items-center gap-2 text-sm text-stone-300 transition hover:text-white"
                    >
                        <Info className="h-4 w-4" /> Guia rápido
                    </button>
                    <button
                        type="button"
                        onClick={() => handleLoadExample()}
                        className="inline-flex items-center gap-2 text-sm text-amber-300 transition hover:text-amber-200"
                    >
                        <BookOpen className="h-4 w-4" /> Carregar exemplo
                    </button>
                    <button
                        type="button"
                        onClick={() => handleLoadExample({})}
                        className="inline-flex items-center gap-2 text-sm text-cyan-300 transition hover:text-cyan-200"
                    >
                        <Sparkles className="h-4 w-4" /> Limpar campos
                    </button>
                </div>
            </div>
            ) : null}
        </div>
    );

    const renderCreatorQuickActions = () => (
        <div className="flex flex-wrap items-center gap-2 border-b border-dnd-gold/12 pb-4">
            <DndButton type="button" size="sm" variant="ghost" onClick={() => setIsHelpModalOpen(true)}>
                <Info className="h-4 w-4" />
                Guia rápido
            </DndButton>
            <DndButton type="button" size="sm" variant="goldOutline" onClick={() => handleLoadExample()}>
                <BookOpen className="h-4 w-4" />
                Carregar exemplo
            </DndButton>
            <DndButton type="button" size="sm" variant="ghost" onClick={() => handleLoadExample({})}>
                <Sparkles className="h-4 w-4" />
                Limpar campos
            </DndButton>
        </div>
    );

    const renderStructureStep = () => (
        <div
            className={
                isV2
                    ? 'space-y-4'
                    : 'rounded-2xl border border-stone-700 bg-black/30 p-4 shadow-inner shadow-black/60'
            }
        >
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    {isV2 ? (
                        <>
                            <DndHeading variant="label">Editor estruturado</DndHeading>
                            <DndHeading variant="section" className="mt-1">
                                Campos para {type}
                            </DndHeading>
                        </>
                    ) : (
                        <>
                            <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Editor estruturado</p>
                            <h2 className="text-xl font-semibold text-white">Campos para {type}</h2>
                        </>
                    )}
                    <p className={isV2 ? 'mt-1 font-narrative text-sm text-dnd-parchment-muted' : 'text-sm text-stone-400'}>
                        As seções se adaptam automaticamente ao tipo escolhido.
                    </p>
                </div>
                <Layers className={isV2 ? 'h-10 w-10 text-dnd-gold' : 'h-10 w-10 text-amber-300'} />
            </div>
            <div
                className={
                    isV2
                        ? 'rounded-lg border border-dnd-gold/15 bg-dnd-obsidian-raised/50 p-4'
                        : 'mt-4 rounded-2xl border border-stone-800 bg-stone-950/60 p-4'
                }
            >
                {renderForm()}
            </div>
        </div>
    );

    const renderReviewStep = () => (
        <div className={cn('space-y-4', !isV2 && 'grid gap-4 md:grid-cols-2')}>
            <div
                className={
                    isV2
                        ? 'rounded-lg border border-dnd-gold/15 bg-dnd-obsidian-raised/40 p-4'
                        : 'rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/60'
                }
            >
                {isV2 ? (
                    <DndHeading variant="label">Resumo</DndHeading>
                ) : (
                    <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Resumo</p>
                )}
                <h2 className={isV2 ? 'mt-1 font-display text-xl text-dnd-parchment' : 'text-xl font-semibold text-white'}>
                    Check-list
                </h2>
                <ul
                    className={cn(
                        'mt-4 space-y-3 text-sm',
                        isV2 ? 'text-dnd-parchment-muted' : 'text-stone-300'
                    )}
                >
                    <li className="flex items-center gap-2">
                        <CheckCircle
                            className={cn(
                                'h-4 w-4',
                                contentData.name
                                    ? isV2
                                        ? 'text-dnd-success'
                                        : 'text-emerald-300'
                                    : 'text-stone-500'
                            )}
                        />
                        Nome definido
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle
                            className={cn(
                                'h-4 w-4',
                                contentData.index
                                    ? isV2
                                        ? 'text-dnd-success'
                                        : 'text-emerald-300'
                                    : 'text-stone-500'
                            )}
                        />
                        Slug/index
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle
                            className={cn(
                                'h-4 w-4',
                                Object.keys(contentData || {}).length > 1
                                    ? isV2
                                        ? 'text-dnd-success'
                                        : 'text-emerald-300'
                                    : 'text-stone-500'
                            )}
                        />
                        Campos preenchidos
                    </li>
                </ul>
            </div>
            {isV2 ? (
                <details className="rounded-lg border border-dnd-gold/15 bg-dnd-obsidian-raised/30">
                    <summary className="cursor-pointer list-none px-4 py-3 font-ui text-sm font-medium text-dnd-gold [&::-webkit-details-marker]:hidden">
                        JSON técnico (opcional)
                    </summary>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-dnd-gold/10 p-4 font-mono text-[11px] leading-relaxed text-dnd-parchment-muted">
                        {jsonPreview}
                    </pre>
                </details>
            ) : (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/60">
                    <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Pré-visualização JSON</p>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/60 p-4 text-xs text-amber-100">
                        {jsonPreview}
                    </pre>
                </div>
            )}
        </div>
    );

    const legacyStepper = [
        { id: 'meta' as const, label: 'Metadados', description: 'Nome, índice e visibilidade' },
        { id: 'structure' as const, label: 'Estrutura', description: 'Campos específicos do tipo' },
        { id: 'review' as const, label: 'Revisão', description: 'JSON final e dependências' },
    ];

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

    const modals = (
        <>
            <HomebrewHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
        </>
    );

    const activeStepMeta = HOMEBREW_CREATOR_STEPS.find((s) => s.id === activeStep);

    if (isV2) {
        const stepperProps = {
            activeStep,
            canStructure: canAdvanceToStructure,
            canReview: canAdvanceToReview,
            onStepChange: setActiveStep,
        };

        const previewProps = {
            activeStep,
            type,
            sourceKind,
            contentData,
            isPublic,
            locale,
        };

        return (
            <div className="space-y-5">
                {modals}

                {renderCreatorQuickActions()}

                <HomebrewLivePreview variant="compact" className="lg:hidden" {...previewProps} />

                <div className="lg:hidden">
                    <HomebrewCreationStepper {...stepperProps} />
                </div>

                <div className="grid gap-5 lg:grid-cols-[12.5rem_minmax(0,1fr)_15.5rem] lg:items-start">
                    <aside className="hidden lg:block">
                        <HomebrewCreationStepper {...stepperProps} />
                    </aside>

                    <DndCard padding="md" className="min-w-0">
                        <p className="font-ui text-xs text-dnd-parchment-muted">{activeStepMeta?.description}</p>
                        <DndHeading variant="section" className="mt-1">
                            {activeStepMeta?.label}
                        </DndHeading>
                        <div className="hb-form mt-5">{renderStepContent()}</div>
                        <div className="mt-6 flex flex-wrap gap-3 border-t border-dnd-gold/12 pt-5">
                            {activeStep !== 'meta' && (
                                <DndButton
                                    variant="ghost"
                                    className="min-w-[7rem] flex-1"
                                    onClick={() => setActiveStep(activeStep === 'review' ? 'structure' : 'meta')}
                                >
                                    Voltar
                                </DndButton>
                            )}
                            {activeStep !== 'review' && (
                                <DndButton
                                    variant="ember"
                                    className="min-w-[7rem] flex-1"
                                    disabled={
                                        (activeStep === 'meta' && !canAdvanceToStructure) ||
                                        (activeStep === 'structure' && !canAdvanceToReview)
                                    }
                                    onClick={() => setActiveStep(activeStep === 'meta' ? 'structure' : 'review')}
                                >
                                    Continuar
                                </DndButton>
                            )}
                            {activeStep === 'review' && (
                                <DndButton
                                    variant="ember"
                                    className="min-w-[7rem] flex-1"
                                    disabled={isLoading}
                                    onClick={handleSubmit}
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                                </DndButton>
                            )}
                        </div>
                    </DndCard>

                    <HomebrewLivePreview variant="sidebar" className="hidden lg:block" {...previewProps} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {modals}

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
                        {legacyStepper.map((step) => (
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
