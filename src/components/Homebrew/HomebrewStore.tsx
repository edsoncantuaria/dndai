/**
 * Grimório homebrew — UI fullscreen legada.
 * @deprecated Em UI v2 use `HomebrewStorePage` (`@/features/homebrew`) com `embedded`.
 * O motor e serviços permanecem aqui até migração completa para `features/homebrew`.
 */
// src/components/Homebrew/HomebrewStore.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    ArrowLeft,
    Loader2,
    Plus,
    Trash2,
    CheckCircle,
    Download,
    Upload,
    Bot,
    Info,
    Swords,
    ScrollText,
    BookOpen,
    Shield,
    Heart,
    Grip,
    Minus,
    Edit,
    Package,
    PackagePlus,
    PackageCheck,
    ChevronDown,
    Search,
    Users,
    Languages,
    Sparkles,
    Star,
    TrendingUp,
} from 'lucide-react';
import * as HomebrewService from '@/services/homebrewService';
import HomebrewCreator from './HomebrewCreator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import ActionModal from '../ui/ActionModal';
import BundleCreator from './BundleCreator';
import AiCreator, { AiGeneratedHomebrew } from './AiCreator';
import TranslationStudio from './TranslationStudio';

type View = 'list' | 'create' | 'edit';
type Tab = 'bundles' | 'community' | 'mine' | 'installed' | 'ai';

const MARKETPLACE_CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
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

const CONTENT_TYPE_ICONS: Record<HomebrewService.HomebrewContentType, React.ReactNode> = {
    race: <Heart className="h-4 w-4" />,
    subrace: <Heart className="h-4 w-4" />,
    class: <Swords className="h-4 w-4" />,
    subclass: <Swords className="h-4 w-4" />,
    spell: <ScrollText className="h-4 w-4" />,
    item: <Shield className="h-4 w-4" />,
    monster: <Bot className="h-4 w-4" />,
    background: <BookOpen className="h-4 w-4" />,
    feat: <BookOpen className="h-4 w-4" />,
    skill: <BookOpen className="h-4 w-4" />,
    translation: <Languages className="h-4 w-4" />,
};

const TABS: { id: Tab; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'bundles', label: 'Pacotes', description: 'Coleções completas prontas para instalar', icon: <Package className="h-4 w-4" /> },
    { id: 'community', label: 'Comunidade', description: 'Criações abertas de outros aventureiros', icon: <Users className="h-4 w-4" /> },
    { id: 'mine', label: 'Minha Oficina', description: 'Tudo o que você publicou', icon: <Edit className="h-4 w-4" /> },
    { id: 'installed', label: 'Instalados', description: 'Conteúdo ativo na sua conta', icon: <CheckCircle className="h-4 w-4" /> },
    { id: 'ai', label: 'Curadoria IA', description: 'Sugestões do Mestre Digital', icon: <Bot className="h-4 w-4" /> },
];

const getContentSummary = (item: HomebrewService.HomebrewContent): string => {
    const payload: any = item.content || {};
    const candidates = [payload.summary, payload.flavor, payload.flavor_text, payload.short_description];
    if (Array.isArray(payload.desc) && payload.desc.length) candidates.push(payload.desc[0]);
    if (Array.isArray(payload.description) && payload.description.length) candidates.push(payload.description[0]);
    if (typeof payload.text === 'string') candidates.push(payload.text);
    const summary = candidates.find((entry) => typeof entry === 'string' && entry.trim().length > 6);
    return summary ? String(summary).trim().slice(0, 220) : 'Conteúdo personalizado pronto para ser usado imediatamente na sua campanha.';
};

const BundleCard: React.FC<{
    bundle: HomebrewService.HomebrewBundle;
    isOwner: boolean;
    installedIds: Set<string>;
    onInstall: (bundle: HomebrewService.HomebrewBundle) => void;
    onUninstall: (bundle: HomebrewService.HomebrewBundle) => void;
    onEdit: (bundle: HomebrewService.HomebrewBundle) => void;
    onDelete: (bundle: HomebrewService.HomebrewBundle) => void;
    onExport: (bundle: HomebrewService.HomebrewBundle) => void;
}> = ({ bundle, isOwner, installedIds, onInstall, onUninstall, onEdit, onDelete, onExport }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isBundleInstalled = useMemo(() => installedIds.has(bundle.id), [bundle.id, installedIds]);

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-stone-900/90 via-stone-900/60 to-stone-900/30 p-5 shadow-lg shadow-black/30 backdrop-blur">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_60%)]" />
            <div className="relative z-10 flex flex-col gap-4">
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">{isOwner ? 'Seu Pacote' : 'Coleção da Comunidade'}</p>
                        <div className="mt-1 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-amber-400" />
                            <h3 className="text-xl font-semibold text-amber-100">{bundle.name}</h3>
                        </div>
                        <p className="text-sm text-stone-400 mt-1">{bundle.description || 'Coleção temática criada pela comunidade.'}</p>
                    </div>
                    <button
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className="rounded-full border border-white/10 bg-white/5 p-2 text-stone-300 transition hover:text-amber-200 hover:border-amber-300/60"
                        aria-label="Exibir conteúdos do pacote"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </header>

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">{bundle.contentCount} itens</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-stone-200">por {isOwner ? 'você' : bundle.author?.username || 'Comunidade'}</span>
                    {isBundleInstalled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-amber-100">
                            <PackageCheck className="h-3.5 w-3.5" /> Instalado
                        </span>
                    )}
                </div>

                {isExpanded && (bundle.contents || []).length > 0 && (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3 shadow-inner max-h-48 overflow-y-auto">
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70 mb-2">Conteúdos</p>
                        <ul className="space-y-1 text-sm text-stone-300">
                            {(bundle.contents || []).map((content) => (
                                <li key={content.id} className="flex items-center justify-between gap-2">
                                    <span className="truncate">{content.name}</span>
                                    <span className="text-xs capitalize text-stone-500">{content.type}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {isOwner && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => onEdit(bundle)}
                                className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-100 transition hover:bg-blue-500/20"
                            >
                                <Edit className="h-4 w-4" /> Editar
                            </button>
                            <button
                                onClick={() => onDelete(bundle)}
                                className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/10"
                            >
                                <Trash2 className="h-4 w-4" /> Excluir
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => onExport(bundle)}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
                    >
                        <Download className="h-4 w-4" /> Exportar JSON
                    </button>
                    <button
                        onClick={() => (isBundleInstalled ? onUninstall(bundle) : onInstall(bundle))}
                        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                            isBundleInstalled
                                ? 'bg-red-500/10 text-red-200 border border-red-400/30 hover:bg-red-500/20'
                                : 'bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 text-stone-950 shadow-lg shadow-amber-500/30 hover:brightness-110'
                        }`}
                    >
                        {isBundleInstalled ? <PackageCheck className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                        {isBundleInstalled ? 'Remover Pacote' : 'Instalar Pacote'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export interface HomebrewStoreProps {
    returnToMenu: () => void;
    /** Esconde chrome de página inteira (header/footer) — uso com HomebrewLayout v2 */
    embedded?: boolean;
    /** Remove botão e fluxo do Estúdio de Tradução (rota separada) */
    hideTranslationEntry?: boolean;
    /** Exibe badge Original / Fork / Tradução SRD nos cards */
    showSourceBadges?: boolean;
}

const HomebrewStore: React.FC<HomebrewStoreProps> = ({
    returnToMenu,
    embedded = false,
    hideTranslationEntry = false,
    showSourceBadges = false,
}) => {
    const [view, setView] = useState<View>('list');
    const [contentToEdit, setContentToEdit] = useState<HomebrewService.HomebrewContent | null>(null);
    const [bundleToEdit, setBundleToEdit] = useState<HomebrewService.HomebrewBundle | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('bundles');
    const [typeFilter, setTypeFilter] = useState<HomebrewService.HomebrewContentType | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState<HomebrewService.HomebrewContent[]>([]);
    const [bundles, setBundles] = useState<HomebrewService.HomebrewBundle[]>([]);
    const { toast } = useToast();
    const { user, revalidateUserSession } = useAuth();

    const [installCandidate, setInstallCandidate] = useState<{ item: HomebrewService.HomebrewContent | HomebrewService.HomebrewBundle; type: 'item' | 'bundle' } | null>(null);
    const [uninstallCandidate, setUninstallCandidate] = useState<{ item: HomebrewService.HomebrewContent | HomebrewService.HomebrewBundle; type: 'item' | 'bundle' } | null>(null);
    const [dependencies, setDependencies] = useState<HomebrewService.HomebrewContent[]>([]);
    const [itemToDelete, setItemToDelete] = useState<{ item: HomebrewService.HomebrewBundle; type: 'bundle' } | null>(null);
    const [isBundleCreatorOpen, setIsBundleCreatorOpen] = useState(false);
    const [isAiCreatorOpen, setIsAiCreatorOpen] = useState(false);
    const [showTranslationStudio, setShowTranslationStudio] = useState(false);
    const importFileRef = useRef<HTMLInputElement>(null);

    const contentTypeFilters = hideTranslationEntry ? MARKETPLACE_CONTENT_TYPES : [...MARKETPLACE_CONTENT_TYPES, 'translation'];

    const installedIds = useMemo(() => new Set(user?.installedHomebrewIds || []), [user]);

    const fetchContentAndBundles = useCallback(async () => {
        setIsLoading(true);
        try {
            const [publicBundles, myBundles, publicContent, myContent, aiContent] = await Promise.all([
                HomebrewService.listBundles('public'),
                user ? HomebrewService.listBundles('mine') : Promise.resolve([]),
                HomebrewService.listHomebrewContent('public', 'user'),
                user ? HomebrewService.listHomebrewContent('mine') : Promise.resolve([]),
                HomebrewService.listHomebrewContent('public', 'ai'),
            ]);

            const bundlesMap = new Map<string, HomebrewService.HomebrewBundle>();
            publicBundles.forEach((bundle) => bundlesMap.set(bundle.id, bundle));
            myBundles.forEach((bundle) => bundlesMap.set(bundle.id, bundle));

            const contentMap = new Map<string, HomebrewService.HomebrewContent>();
            publicContent.forEach((item) => contentMap.set(item.id, item));
            myContent.forEach((item) => contentMap.set(item.id, item));
            aiContent.forEach((item) => contentMap.set(item.id, item));

            setBundles(Array.from(bundlesMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
            setContent(Array.from(contentMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao buscar conteúdo', description: error.message || 'Não foi possível carregar o conteúdo homebrew.' });
            setBundles([]);
            setContent([]);
        } finally {
            setIsLoading(false);
        }
    }, [toast, user]);

    useEffect(() => {
        if (view === 'list') {
            fetchContentAndBundles();
        }
    }, [view, fetchContentAndBundles, user]);

    const handleInstallClick = async (item: HomebrewService.HomebrewContent) => {
        try {
            const deps = await HomebrewService.getHomebrewDependencies(item.id);
            const depsToInstall = deps.filter((dep) => !installedIds.has(dep.id));
            setInstallCandidate({ item, type: 'item' });
            setDependencies(depsToInstall);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao verificar dependências', description: error.message });
        }
    };

    const handleBundleInstallClick = (bundle: HomebrewService.HomebrewBundle) => {
        setInstallCandidate({ item: bundle, type: 'bundle' });
        setDependencies([]);
    };

    const handleUninstallClick = (item: HomebrewService.HomebrewContent | HomebrewService.HomebrewBundle, type: 'item' | 'bundle') => {
        setUninstallCandidate({ item, type });
        setDependencies([]);
    };

    const confirmInstallation = async () => {
        if (!installCandidate) return;
        setIsLoading(true);
        try {
            await HomebrewService.updateUserHomebrew(installCandidate.item.id, 'install');
            await revalidateUserSession();
            toast({ title: 'Instalação concluída!', description: `"${installCandidate.item.name}" foi adicionado à sua conta.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na instalação', description: error.message });
        } finally {
            setInstallCandidate(null);
            setDependencies([]);
            setIsLoading(false);
        }
    };

    const confirmUninstallation = async () => {
        if (!uninstallCandidate) return;
        setIsLoading(true);
        try {
            await HomebrewService.updateUserHomebrew(uninstallCandidate.item.id, 'uninstall');
            await revalidateUserSession();
            toast({ title: 'Desinstalação concluída!', description: `"${uninstallCandidate.item.name}" foi removido.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na desinstalação', description: error.message });
        } finally {
            setUninstallCandidate(null);
            setDependencies([]);
            setIsLoading(false);
        }
    };

    const handleEdit = (item: HomebrewService.HomebrewContent) => {
        if (item.bundleId) {
            toast({ variant: 'destructive', title: 'Conteúdo em pacote', description: 'Remova este item do pacote para editá-lo.' });
            return;
        }
        setContentToEdit(item);
        setView('edit');
    };

    const handleEditBundle = (bundle: HomebrewService.HomebrewBundle) => {
        setBundleToEdit(bundle);
        setIsBundleCreatorOpen(true);
    };

    const handleDeleteClick = (bundle: HomebrewService.HomebrewBundle) => {
        setItemToDelete({ item: bundle, type: 'bundle' });
    };

    const confirmDeletion = async () => {
        if (!itemToDelete) return;
        setIsLoading(true);
        try {
            await HomebrewService.deleteBundle(itemToDelete.item.id);
            toast({ title: 'Pacote excluído', description: `"${itemToDelete.item.name}" foi removido permanentemente.` });
            fetchContentAndBundles();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na exclusão', description: error.message });
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    const handleExportBundle = async (bundle: HomebrewService.HomebrewBundle) => {
        try {
            const manifest = await HomebrewService.exportBundle(bundle.id);
            const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${bundle.name.toLowerCase().replace(/\s+/g, '-')}-bundle.json`;
            anchor.click();
            URL.revokeObjectURL(url);
            toast({ title: 'Pacote exportado', description: `"${bundle.name}" salvo como JSON.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na exportação', description: error.message });
        }
    };

    const handleImportBundleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!user) {
            toast({ variant: 'destructive', title: 'Login necessário', description: 'Entre na conta para importar pacotes.' });
            return;
        }
        setIsLoading(true);
        try {
            const text = await file.text();
            const manifest = JSON.parse(text) as HomebrewService.BundleExportManifest;
            if (manifest.formatVersion !== 1 || !manifest.contents?.length) {
                throw new Error('Arquivo inválido. Use um manifesto exportado pela Oficina Homebrew.');
            }
            const bundle = await HomebrewService.importBundle({ manifest, makePublic: false });
            toast({ title: 'Pacote importado', description: `"${bundle.name}" adicionado à sua oficina.` });
            fetchContentAndBundles();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na importação', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAiContentCreated = (payload: AiGeneratedHomebrew) => {
        setContentToEdit({
            id: '',
            authorId: user?.id || 0,
            type: payload.type,
            name: String(payload.content.name ?? 'Conteúdo IA'),
            content: payload.content,
            isPublic: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'user',
            sourceKind: payload.sourceKind,
            sourceResource: payload.sourceResource,
            sourceIndex: payload.sourceIndex,
            locale: payload.locale,
        });
        setView('create');
    };

    const marketplaceStats = useMemo(() => {
        const communityCreations = content.filter((item) => item.createdBy !== 'ai').length;
        const aiCurations = content.filter((item) => item.createdBy === 'ai').length;
        return {
            totalContent: content.length,
            bundles: bundles.length,
            communityCreations,
            aiCurations,
            installed: installedIds.size,
        };
    }, [content, bundles, installedIds]);

    const communityHighlights = useMemo(() => {
        const creatorMap = new Map<string, { name: string; count: number }>();
        const typeMap = new Map<string, number>();

        content.forEach((item) => {
            const creator = item.createdBy === 'ai' ? 'Mestre IA' : item.author?.username || 'Comunidade';
            creatorMap.set(creator, { name: creator, count: (creatorMap.get(creator)?.count || 0) + 1 });
            typeMap.set(item.type, (typeMap.get(item.type) || 0) + 1);
        });

        return {
            featured: Array.from(creatorMap.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 4),
            trending: Array.from(typeMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
        };
    }, [content]);

    const hasCommunityHighlights = communityHighlights.featured.length > 0 || communityHighlights.trending.length > 0;

    const handleTrendingChipClick = (targetType: string) => {
        setTypeFilter(targetType as HomebrewService.HomebrewContentType);
        setActiveTab('community');
    };

    const handleCreatorChipClick = (creator: string) => {
        setSearchTerm(creator === 'Mestre IA' ? '' : creator);
        setActiveTab('community');
    };

    const filteredContent = useCallback(
        (contentList: HomebrewService.HomebrewContent[]) =>
            contentList.filter((item) => {
                if (hideTranslationEntry && item.type === 'translation') return false;
                const matchesType = typeFilter === 'all' || item.type === typeFilter;
                const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesType && matchesSearch;
            }),
        [typeFilter, searchTerm]
    );

    const renderContentGrid = (contentList: HomebrewService.HomebrewContent[]) => {
        const filtered = filteredContent(contentList);

        if (!filtered.length && !isLoading) {
            return (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-stone-400">
                    <Info className="h-8 w-8 text-amber-400" />
                    <p>Nenhum conteúdo encontrado com os filtros atuais.</p>
                </div>
            );
        }

        return (
            <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((item) => {
                    const isInstalled = installedIds.has(item.id);
                    const isOwner = item.authorId === user?.id;
                    const isFromAI = item.createdBy === 'ai';
                    const descriptor = getContentSummary(item);

                    return (
                        <article key={item.id} className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-stone-950/70 via-stone-900/50 to-stone-900/30 p-5 shadow-lg shadow-black/30">
                            <div
                                className="absolute inset-0 pointer-events-none opacity-40"
                                style={{ background: 'radial-gradient(circle at top, rgba(251,191,36,0.25), transparent 55%)' }}
                            />
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-amber-100">{item.name}</h3>
                                        <p className="text-xs text-stone-400">
                                            {isFromAI ? 'Curadoria do Mestre IA' : isOwner ? 'Criado por você' : `Criado por ${item.author?.username || 'Comunidade'}`}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 items-end">
                                        {showSourceBadges && item.sourceKind ? (
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                                    item.sourceKind === 'fork'
                                                        ? 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                                                        : item.sourceKind === 'translation'
                                                        ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30'
                                                        : 'bg-amber-500/15 text-amber-200 border border-amber-400/30'
                                                }`}
                                            >
                                                {item.sourceKind === 'fork' ? 'Fork SRD' : item.sourceKind === 'translation' ? 'Tradução SRD' : 'Original'}
                                            </span>
                                        ) : null}
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold capitalize text-stone-200">
                                            {CONTENT_TYPE_ICONS[item.type] || <Bot className="h-3.5 w-3.5" />} {item.type}
                                        </span>
                                        {item.bundle && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-100">
                                                <Package className="h-3.5 w-3.5" /> {item.bundle.name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <p className="text-sm text-stone-300 line-clamp-3">{descriptor}</p>

                                <div className="flex items-center gap-2 text-xs font-semibold text-stone-400">
                                    {isInstalled && !isFromAI && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">
                                            <CheckCircle className="h-3.5 w-3.5" /> Instalado
                                        </span>
                                    )}
                                    {isFromAI && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-3 py-1 text-cyan-200">
                                            <Bot className="h-3.5 w-3.5" /> Disponível automaticamente
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {isOwner && !isFromAI && !item.bundleId && (
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20"
                                        >
                                            <Edit className="h-3.5 w-3.5" /> Editar
                                        </button>
                                    )}
                                    <button
                                        onClick={() => (isInstalled ? handleUninstallClick(item, 'item') : handleInstallClick(item))}
                                        disabled={isFromAI}
                                        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            isFromAI
                                                ? 'cursor-not-allowed border border-white/10 bg-white/5 text-stone-400'
                                                : isInstalled
                                                ? 'border border-red-400/40 bg-red-500/10 text-red-100 hover:bg-red-500/20'
                                                : 'bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 text-stone-950 shadow-lg shadow-amber-500/30 hover:brightness-110'
                                        }`}
                                    >
                                        {isFromAI ? <Info className="h-4 w-4" /> : isInstalled ? <Minus className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                                        {isFromAI ? 'Disponível por padrão' : isInstalled ? 'Remover' : 'Instalar'}
                                    </button>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        );
    };

    const renderBundlesTab = () => {
        const filteredBundles = bundles.filter((bundle) => bundle.name.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!filteredBundles.length && !isLoading) {
            return (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-stone-400">
                    <Package className="h-8 w-8 text-amber-400" />
                    <p>Nenhum pacote encontrado com o filtro atual.</p>
                </div>
            );
        }

        return (
            <div className="grid gap-4 md:grid-cols-2">
                {filteredBundles.map((bundle) => (
                    <BundleCard
                        key={bundle.id}
                        bundle={bundle}
                        isOwner={bundle.authorId === user?.id}
                        installedIds={installedIds}
                        onInstall={handleBundleInstallClick}
                        onUninstall={(b) => handleUninstallClick(b, 'bundle')}
                        onEdit={handleEditBundle}
                        onDelete={handleDeleteClick}
                        onExport={handleExportBundle}
                    />
                ))}
            </div>
        );
    };

    const renderCommunityTab = () => renderContentGrid(content.filter((item) => item.createdBy !== 'ai' && !item.bundleId));
    const renderMyCreationsTab = () => renderContentGrid(content.filter((item) => item.authorId === user?.id && !item.bundleId));
    const renderAiTab = () => renderContentGrid(content.filter((item) => item.createdBy === 'ai'));

    const renderInstalledTab = () => {
        const installedBundles = bundles.filter((bundle) => installedIds.has(bundle.id));
        const installedSoloContent = content.filter((item) => installedIds.has(item.id) && !item.bundleId);

        if (!installedBundles.length && !installedSoloContent.length && !isLoading) {
            return (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-stone-400">
                    <Info className="h-8 w-8 text-amber-400" />
                    <p>Você ainda não instalou nenhum conteúdo extra.</p>
                </div>
            );
        }

        return (
            <div className="space-y-8">
                {installedBundles.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <PackageCheck className="h-5 w-5 text-amber-300" />
                            <h3 className="text-lg font-semibold text-amber-100">Pacotes ativos</h3>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {installedBundles.map((bundle) => (
                                <BundleCard
                                    key={bundle.id}
                                    bundle={bundle}
                                    isOwner={bundle.authorId === user?.id}
                                    installedIds={installedIds}
                                    onInstall={handleBundleInstallClick}
                                    onUninstall={(b) => handleUninstallClick(b, 'bundle')}
                                    onEdit={handleEditBundle}
                                    onDelete={handleDeleteClick}
                                    onExport={handleExportBundle}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {installedSoloContent.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-300" />
                            <h3 className="text-lg font-semibold text-emerald-100">Itens individuais</h3>
                        </div>
                        {renderContentGrid(installedSoloContent)}
                    </div>
                )}
            </div>
        );
    };

    const renderActiveTab = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center gap-3 py-12 text-stone-400">
                    <Loader2 className="h-6 w-6 animate-spin" /> Carregando marketplace...
                </div>
            );
        }

        switch (activeTab) {
            case 'bundles':
                return renderBundlesTab();
            case 'community':
                return renderCommunityTab();
            case 'mine':
                return renderMyCreationsTab();
            case 'installed':
                return renderInstalledTab();
            case 'ai':
                return renderAiTab();
            default:
                return null;
        }
    };

    const renderInstallModal = () => {
        const candidate = installCandidate || uninstallCandidate;
        if (!candidate) return null;

        const isInstall = Boolean(installCandidate);
        const onDismiss = () => {
            setInstallCandidate(null);
            setUninstallCandidate(null);
            setDependencies([]);
        };

        return (
            <ActionModal
                isOpen
                title={isInstall ? 'Confirmar instalação' : 'Confirmar desinstalação'}
                onClose={onDismiss}
                actions={[
                    { text: 'Cancelar', onClick: onDismiss, variant: 'secondary' },
                    {
                        text: isInstall ? 'Instalar agora' : 'Remover acesso',
                        onClick: isInstall ? confirmInstallation : confirmUninstallation,
                        variant: isInstall ? 'primary' : 'destructive',
                        disabled: isLoading,
                        icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined,
                    },
                ]}
            >
                <p className="text-xs text-stone-400">
                    {isInstall
                        ? `Instalar "${candidate.item.name}" adicionará o conteúdo à sua conta.`
                        : `Remover "${candidate.item.name}" faz com que ele deixe de aparecer nas suas sessões.`}
                </p>
                {isInstall && dependencies.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-white/5 bg-stone-900/80 p-3">
                        <p className="text-sm text-amber-200 mb-2 flex items-center gap-2">
                            <Info className="h-4 w-4" /> Dependências adicionais
                        </p>
                        <ul className="space-y-1 text-sm text-stone-300 max-h-40 overflow-y-auto">
                            {dependencies.map((dep) => (
                                <li key={dep.id} className="flex items-center justify-between gap-2">
                                    <span>{dep.name}</span>
                                    <span className="text-xs capitalize text-stone-500">{dep.type}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </ActionModal>
        );
    };

    if (showTranslationStudio && !hideTranslationEntry) {
        return <TranslationStudio onCancel={() => setShowTranslationStudio(false)} />;
    }

    if (view === 'create' || view === 'edit') {
        const creatorProps = {
            onContentCreated: () => {
                setView('list');
                fetchContentAndBundles();
            },
            onCancel: () => setView('list'),
            contentToEdit,
        };

        if (embedded) {
            return (
                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => setView('list')}
                        className="inline-flex items-center gap-2 font-ui text-sm text-dnd-parchment-muted hover:text-dnd-gold"
                    >
                        <ArrowLeft className="h-4 w-4" /> Voltar ao marketplace
                    </button>
                    <HomebrewCreator {...creatorProps} variant="v2" />
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-950/95 to-stone-900 px-4 py-8">
                <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-black/30 p-6 shadow-2xl shadow-black/60 backdrop-blur">
                    <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
                        <button
                            onClick={() => setView('list')}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-stone-200 transition hover:border-amber-200 hover:text-amber-200"
                        >
                            <ArrowLeft className="h-4 w-4" /> Voltar para o marketplace
                        </button>
                        <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Edição premium</p>
                            <h2 className="text-2xl font-semibold text-white">Oficina de Criação</h2>
                        </div>
                    </div>
                    <HomebrewCreator {...creatorProps} />
                </div>
            </div>
        );
    }

    const statsCards = [
        { label: 'Conteúdos Disponíveis', value: marketplaceStats.totalContent, sub: '+ comunidade & IA', icon: <Sparkles className="h-5 w-5 text-amber-400" /> },
        { label: 'Pacotes', value: marketplaceStats.bundles, sub: 'coleções prontas', icon: <Package className="h-5 w-5 text-purple-300" /> },
        { label: 'Instalados', value: marketplaceStats.installed, sub: 'ativos na sua conta', icon: <CheckCircle className="h-5 w-5 text-emerald-300" /> },
        { label: 'Curadoria IA', value: marketplaceStats.aiCurations, sub: 'sem tradução necessária', icon: <Bot className="h-5 w-5 text-cyan-300" /> },
    ];

    return (
        <>
            <div className={embedded ? 'relative space-y-4' : 'relative min-h-screen bg-gradient-to-b from-stone-950 via-stone-950/95 to-stone-900 py-6'}>
                {!embedded ? <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30" aria-hidden /> : null}
                <div className={embedded ? 'relative space-y-4' : 'relative z-10 mx-auto w-full max-w-6xl px-4 space-y-6'}>
                    {!embedded ? (
                    <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-stone-950/90 via-stone-900/70 to-stone-900/50 p-6 shadow-2xl shadow-black/60 backdrop-blur">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Mercado da Comunidade</p>
                                <h1 className="mt-2 text-4xl font-semibold text-white">Oficina Homebrew</h1>
                                <p className="mt-3 text-stone-300">
                                    Descubra, instale e publique conteúdo criado pela comunidade – com curadoria manual e sugestões da IA para manter sua aventura sempre fresca.
                                </p>
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <button
                                        onClick={() => {
                                            setContentToEdit(null);
                                            setView('create');
                                        }}
                                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 px-5 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-500/30 hover:brightness-110"
                                    >
                                        <Plus className="h-4 w-4" /> Criar conteúdo
                                    </button>
                                    <button
                                        onClick={() => {
                                            setBundleToEdit(null);
                                            setIsBundleCreatorOpen(true);
                                        }}
                                        className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/10 px-5 py-2 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/20"
                                    >
                                        <PackagePlus className="h-4 w-4" /> Criar pacote
                                    </button>
                                    <button
                                        onClick={() => importFileRef.current?.click()}
                                        className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                                    >
                                        <Upload className="h-4 w-4" /> Importar pacote
                                    </button>
                                    <input
                                        ref={importFileRef}
                                        type="file"
                                        accept="application/json,.json"
                                        className="hidden"
                                        onChange={handleImportBundleFile}
                                    />
                                    <button
                                        onClick={() => setIsAiCreatorOpen(true)}
                                        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                                    >
                                        <Bot className="h-4 w-4" /> Gerar com IA
                                    </button>
                                    {!hideTranslationEntry ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowTranslationStudio(true)}
                                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-stone-200 transition hover:border-amber-200 hover:text-amber-200"
                                    >
                                        <Languages className="h-4 w-4" /> Estúdio de tradução
                                    </button>
                                    ) : null}
                                </div>
                            </div>
                            <div className="grid w-full flex-1 min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
                                {statsCards.map((card) => (
                                    <div key={card.label} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left shadow-inner shadow-black/50">
                                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-stone-400">{card.icon} {card.label}</div>
                                        <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                                        <p className="text-xs text-stone-400">{card.sub}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </header>
                    ) : (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setContentToEdit(null);
                                setView('create');
                            }}
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 px-4 py-2 text-xs font-semibold text-stone-950"
                        >
                            <Plus className="h-3.5 w-3.5" /> Criar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setBundleToEdit(null);
                                setIsBundleCreatorOpen(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-2 text-xs font-semibold text-purple-100"
                        >
                            <PackagePlus className="h-3.5 w-3.5" /> Pacote
                        </button>
                        <button
                            type="button"
                            onClick={() => importFileRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100"
                        >
                            <Upload className="h-3.5 w-3.5" /> Importar
                        </button>
                        <input
                            ref={importFileRef}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={handleImportBundleFile}
                        />
                        <button
                            type="button"
                            onClick={() => setIsAiCreatorOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100"
                        >
                            <Bot className="h-3.5 w-3.5" /> IA
                        </button>
                    </div>
                    )}

                    <section className="grid grid-cols-1 gap-3 rounded-3xl border border-white/5 bg-black/20 p-5 shadow-inner shadow-black/40 md:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-stone-900/70 to-stone-900/30 p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-400/70">
                                <TrendingUp className="h-4 w-4" /> Tendências
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {!hasCommunityHighlights && <p className="text-xs text-stone-500">Sem dados ainda. Instale ou crie algo!</p>}
                                {communityHighlights.trending.length === 0 && content.length > 0 && (
                                    <p className="text-xs text-stone-500">Sem tendências suficientes.</p>
                                )}
                                {communityHighlights.trending.map(([type, count]) => (
                                    <button
                                        key={type}
                                        onClick={() => handleTrendingChipClick(type)}
                                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
                                            typeFilter === type ? 'border-amber-400/70 bg-amber-500/20 text-amber-100' : 'border-white/10 bg-white/5 text-stone-200 hover:border-amber-300/40 hover:text-amber-100'
                                        }`}
                                    >
                                        {CONTENT_TYPE_ICONS[type as HomebrewService.HomebrewContentType] || <Sparkles className="h-3.5 w-3.5" />} {type}
                                        <span className="text-stone-400">({count})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-stone-900/70 to-stone-900/30 p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-400/70">
                                <Star className="h-4 w-4" /> Destaques da comunidade
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-stone-300">
                                {!hasCommunityHighlights && <p className="text-xs text-stone-500">Sem participações registradas.</p>}
                                {communityHighlights.featured.map((creator) => (
                                    <button
                                        key={creator.name}
                                        onClick={() => handleCreatorChipClick(creator.name)}
                                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-left transition hover:border-amber-300/40 hover:text-amber-100"
                                    >
                                        <span className="font-medium text-white">{creator.name}</span>
                                        <span className="text-xs text-stone-400">{creator.count} criações</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-stone-900/70 to-stone-900/30 p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-400/70">
                                <Grip className="h-4 w-4" /> Seus filtros
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    onClick={() => setTypeFilter('all')}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${typeFilter === 'all' ? 'bg-amber-500 text-stone-950' : 'bg-white/10 text-stone-300 hover:bg-white/20'}`}
                                >
                                    Todos
                                </button>
                                {contentTypeFilters.map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setTypeFilter(type)}
                                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                                            typeFilter === type ? 'bg-amber-500 text-stone-950' : 'bg-white/10 text-stone-300 hover:bg-white/20'
                                        }`}
                                    >
                                        {CONTENT_TYPE_ICONS[type]} {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-black/30 p-5 shadow-2xl shadow-black/40">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap gap-2">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`rounded-2xl border px-4 py-2 text-left text-sm transition ${
                                            activeTab === tab.id
                                                ? 'border-amber-400/60 bg-amber-400/10 text-amber-100 shadow-inner shadow-amber-500/30'
                                                : 'border-white/10 bg-white/5 text-stone-300 hover:border-amber-200/40 hover:text-amber-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em]">{tab.icon} {tab.label}</div>
                                        <p className="text-xs text-stone-400">{tab.description}</p>
                                    </button>
                                ))}
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-stone-500 focus:border-amber-400/60 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="mt-6 rounded-2xl border border-white/5 bg-black/30 p-4 min-h-[50vh]">{renderActiveTab()}</div>
                    </section>

                    {!embedded ? (
                    <footer className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/30 p-4 text-sm text-stone-300">
                        <button
                            onClick={returnToMenu}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 transition hover:border-amber-200 hover:text-amber-200"
                        >
                            <ArrowLeft className="h-4 w-4" /> Voltar ao menu principal
                        </button>
                        <p className="text-xs text-stone-500">Marketplace compartilhado pela comunidade. Curadoria automática da IA mantém o conteúdo consistente.</p>
                    </footer>
                    ) : null}
                </div>
            </div>

            {renderInstallModal()}

            {itemToDelete && (
                <ActionModal
                    isOpen
                    title={`Excluir "${itemToDelete.item.name}"?`}
                    onClose={() => setItemToDelete(null)}
                    actions={[
                        { text: 'Cancelar', onClick: () => setItemToDelete(null), variant: 'secondary' },
                        { text: 'Confirmar exclusão', onClick: confirmDeletion, variant: 'destructive', disabled: isLoading },
                    ]}
                >
                    <p className="text-stone-300 mb-2">Tem certeza que deseja excluir este pacote?</p>
                    <p className="text-sm text-yellow-400 bg-yellow-900/40 p-3 rounded-md border border-yellow-700">
                        Os itens dentro do pacote não serão excluídos, apenas desvinculados, e poderão ser encontrados em "Minhas Criações".
                    </p>
                </ActionModal>
            )}

            <BundleCreator
                isOpen={isBundleCreatorOpen}
                onClose={() => {
                    setIsBundleCreatorOpen(false);
                    setBundleToEdit(null);
                }}
                onBundleCreated={fetchContentAndBundles}
                bundleToEdit={bundleToEdit}
            />

            <AiCreator
                variant={embedded ? 'v2' : 'legacy'}
                isOpen={isAiCreatorOpen}
                onClose={() => setIsAiCreatorOpen(false)}
                onContentGenerated={handleAiContentCreated}
            />
        </>
    );
};

export default HomebrewStore;
