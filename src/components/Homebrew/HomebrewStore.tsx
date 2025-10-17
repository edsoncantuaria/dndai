
// src/components/Homebrew/HomebrewStore.tsx
'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Loader2, Plus, Trash2, CheckCircle, Download, Bot, Info, Swords, ScrollText, BookOpen, Shield, Heart, Grip, Minus, Edit, Package, PackagePlus, PackageCheck, ChevronDown, Search, Users } from 'lucide-react';
import * as HomebrewService from '@/services/homebrewService';
import HomebrewCreator from './HomebrewCreator';
import { useToast } from '@/hooks/use-toast';
import { translateApiString } from '@/utils/translator';
import { useAuth } from '@/contexts/AuthContext';
import ActionModal from '../ui/ActionModal';
import BundleCreator from './BundleCreator';

type View = 'list' | 'create' | 'edit';
type Tab = 'bundles' | 'community' | 'mine' | 'installed' | 'ai';

const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'
];

const CONTENT_TYPE_ICONS: Record<HomebrewService.HomebrewContentType, React.ReactNode> = {
    'race': <Heart className="h-4 w-4" />,
    'subrace': <Heart className="h-4 w-4" />,
    'class': <Swords className="h-4 w-4" />,
    'subclass': <Swords className="h-4 w-4" />,
    'spell': <ScrollText className="h-4 w-4" />,
    'item': <Shield className="h-4 w-4" />,
    'monster': <Bot className="h-4 w-4" />,
    'background': <BookOpen className="h-4 w-4" />,
    'feat': <BookOpen className="h-4 w-4" />,
};

const BundleCard: React.FC<{
    bundle: HomebrewService.HomebrewBundle;
    isOwner: boolean;
    installedIds: Set<string>;
    onInstall: (bundle: HomebrewService.HomebrewBundle) => void;
    onUninstall: (bundle: HomebrewService.HomebrewBundle) => void;
    onEdit: (bundle: HomebrewService.HomebrewBundle) => void;
    onDelete: (bundle: HomebrewService.HomebrewBundle) => void;
}> = ({ bundle, isOwner, installedIds, onInstall, onUninstall, onEdit, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Um pacote é considerado "instalado" se todos os seus conteúdos estiverem instalados.
    const isBundleInstalled = useMemo(() => {
        if (!bundle.contents || bundle.contents.length === 0) return false;
        return bundle.contents.every(c => installedIds.has(c.id));
    }, [bundle.contents, installedIds]);


    return (
        <div className="bg-stone-800/70 p-4 rounded-lg border border-stone-600 text-left flex flex-col justify-between hover:border-amber-700/50 transition-colors">
            <div>
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg text-amber-200">{bundle.name}</h3>
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-stone-400 hover:text-amber-300">
                        <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <p className="text-xs text-stone-400 mb-2">por {isOwner ? 'Você' : bundle.author?.username || 'Comunidade'} • Contém {bundle.contentCount} itens.</p>
                <p className="text-sm text-stone-300">{bundle.description}</p>
            </div>

            {isExpanded && (bundle.contents || []).length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-700 max-h-40 overflow-y-auto pr-2">
                    <ul className="list-disc list-inside space-y-1 text-sm text-stone-300">
                        {bundle.contents.map(c => <li key={c.id}>{c.name} <span className="text-xs text-stone-500">({translateApiString(c.type)})</span></li>)}
                    </ul>
                </div>
            )}

            <div className="mt-4 flex gap-2">
                {isOwner && (
                    <>
                        <button onClick={() => onEdit(bundle)} className="flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors bg-blue-800 hover:bg-blue-700 text-blue-200">
                            <Edit className="h-4 w-4"/> Editar
                        </button>
                        <button onClick={() => onDelete(bundle)} className="p-2 bg-red-800 hover:bg-red-700 text-red-200 rounded-md transition-colors">
                            <Trash2 className="h-5 w-5"/>
                        </button>
                    </>
                )}
                 <button
                    onClick={() => isBundleInstalled ? onUninstall(bundle) : onInstall(bundle)}
                    className={`w-full flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
                        isBundleInstalled ? 'bg-red-800/80 hover:bg-red-700 text-red-200' : 'bg-amber-700 hover:bg-amber-600 text-stone-900'
                    }`}
                >
                    {isBundleInstalled ? <PackageCheck className="h-4 w-4"/> : <Download className="h-4 w-4"/>}
                    {isBundleInstalled ? 'Desinstalar Pacote' : 'Instalar Pacote'}
                </button>
            </div>
        </div>
    );
};


const HomebrewStore: React.FC<{ returnToMenu: () => void }> = ({ returnToMenu }) => {
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
    
    const [installCandidate, setInstallCandidate] = useState<{item: HomebrewService.HomebrewContent | HomebrewService.HomebrewBundle, type: 'item' | 'bundle'} | null>(null);
    const [uninstallCandidate, setUninstallCandidate] = useState<{item: HomebrewService.HomebrewContent | HomebrewService.HomebrewBundle, type: 'item' | 'bundle'} | null>(null);
    const [dependencies, setDependencies] = useState<HomebrewService.HomebrewContent[]>([]);

    const [itemToDelete, setItemToDelete] = useState<{item: HomebrewService.HomebrewBundle, type: 'bundle'} | null>(null);

    const installedIds = useMemo(() => new Set(user?.installedHomebrewIds || []), [user]);
    const [isBundleCreatorOpen, setIsBundleCreatorOpen] = useState(false);

    const fetchContentAndBundles = useCallback(async () => {
        setIsLoading(true);
        try {
            const [publicBundles, myBundles, publicContent, myContent, aiContent] = await Promise.all([
                HomebrewService.listBundles('public'),
                user ? HomebrewService.listBundles('mine') : Promise.resolve([]),
                HomebrewService.listHomebrewContent('public', 'user'), // Apenas user, AI será tratada separadamente
                user ? HomebrewService.listHomebrewContent('mine') : Promise.resolve([]),
                HomebrewService.listHomebrewContent('public', 'ai'),
            ]);

            const allBundles = [...myBundles, ...publicBundles.filter(pb => !myBundles.some(mb => mb.id === pb.id))];
            
            // Suas criações publicas devem aparecer na comunidade
            const communityVisibleContent = [...publicContent, ...myContent.filter(mc => mc.isPublic)];
            
            setContent([...myContent, ...communityVisibleContent, ...aiContent].sort((a, b) => a.name.localeCompare(b.name)));
            setBundles(allBundles.sort((a, b) => a.name.localeCompare(b.name)));

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao buscar conteúdo',
                description: error.message || 'Não foi possível carregar o conteúdo homebrew.',
            });
            setContent([]);
            setBundles([]);
        } finally {
            setIsLoading(false);
        }
    }, [toast, user]);
    
    useEffect(() => {
        if (view === 'list') {
            fetchContentAndBundles();
        }
    }, [view, fetchContentAndBundles]);

    const handleInstallClick = async (item: HomebrewService.HomebrewContent) => {
        try {
            const deps = await HomebrewService.getHomebrewDependencies(item.id);
            const depsToInstall = deps.filter(d => !installedIds.has(d.id));
            setInstallCandidate({ item, type: 'item' });
            setDependencies(depsToInstall);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Verificar Dependências', description: error.message });
        }
    };
    
    const handleBundleInstallClick = async (bundle: HomebrewService.HomebrewBundle) => {
        const allDepsPromises = (bundle.contents || []).map(c => HomebrewService.getHomebrewDependencies(c.id));
        const allDepsArrays = await Promise.all(allDepsPromises);
        const allUniqueDeps = Array.from(new Map(allDepsArrays.flat().map(dep => [dep.id, dep])).values());
        const idsToInstall = allUniqueDeps.filter(dep => !installedIds.has(dep.id));
        setInstallCandidate({ item: bundle, type: 'bundle' });
        setDependencies(idsToInstall);
    };

    const handleUninstallClick = async (item: HomebrewService.HomebrewContent | HomebrewService.HomebrewBundle, type: 'item' | 'bundle') => {
        let deps: HomebrewService.HomebrewContent[] = [];
        if (type === 'item') {
            deps = await HomebrewService.getHomebrewDependencies(item.id);
        } else {
            const allDepsPromises = ((item as HomebrewService.HomebrewBundle).contents || []).map(c => HomebrewService.getHomebrewDependencies(c.id));
            const allDepsArrays = await Promise.all(allDepsPromises);
            deps = Array.from(new Map(allDepsArrays.flat().map(dep => [dep.id, dep])).values());
        }
        setUninstallCandidate({ item, type });
        setDependencies(deps);
    };
    
    const confirmInstallation = async (idsToInstall: string[]) => {
        setIsLoading(true);
        try {
            for (const id of idsToInstall) {
                await HomebrewService.updateUserHomebrew(id, 'install');
            }
            await revalidateUserSession();
            toast({
                title: 'Instalação Concluída!',
                description: `${idsToInstall.length} ite${idsToInstall.length > 1 ? 'ns foram adicionados' : 'm foi adicionado'} à sua conta.`,
            });
        } catch (error: any) {
             toast({ variant: 'destructive', title: `Falha na Instalação`, description: error.message });
        } finally {
            setInstallCandidate(null);
            setDependencies([]);
            setIsLoading(false);
        }
    }

    const confirmUninstallation = async (idsToUninstall: string[]) => {
        setIsLoading(true);
        try {
            for (const id of idsToUninstall) {
                await HomebrewService.updateUserHomebrew(id, 'uninstall');
            }
            await revalidateUserSession();
            toast({
                title: 'Desinstalação Concluída!',
                description: `${idsToUninstall.length} ite${idsToUninstall.length > 1 ? 'ns foram removidos' : 'm foi removido'} da sua conta.`,
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na Desinstalação', description: error.message });
        } finally {
            setUninstallCandidate(null);
            setDependencies([]);
            setIsLoading(false);
        }
    };

    const handleEdit = (item: HomebrewService.HomebrewContent) => {
        if (item.bundleId) {
            toast({ variant: 'destructive', title: 'Conteúdo em Pacote', description: 'Remova este item do pacote para poder editá-lo.' });
            return;
        }
        setContentToEdit(item);
        setView('edit');
    };
    
    const handleEditBundle = (bundle: HomebrewService.HomebrewBundle) => {
        setBundleToEdit(bundle);
        setIsBundleCreatorOpen(true);
    };

    const handleDeleteClick = (item: HomebrewService.HomebrewBundle) => {
        setItemToDelete({ item, type: 'bundle' });
    };

    const confirmDeletion = async () => {
        if (!itemToDelete || itemToDelete.type !== 'bundle') return;
        setIsLoading(true);
        try {
            await HomebrewService.deleteBundle(itemToDelete.item.id);
            toast({ title: 'Pacote Excluído', description: `"${itemToDelete.item.name}" foi removido permanentemente.` });
            fetchContentAndBundles();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na Exclusão', description: error.message });
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    if (view === 'create') {
        return <HomebrewCreator onContentCreated={() => { setView('list'); fetchContentAndBundles(); }} onCancel={() => setView('list')} />;
    }
    if (view === 'edit') {
        return <HomebrewCreator onContentCreated={() => { setView('list'); fetchContentAndBundles(); }} onCancel={() => setView('list')} contentToEdit={contentToEdit} />;
    }

    const renderContentGrid = (contentList: HomebrewService.HomebrewContent[]) => {
        const filteredContent = contentList.filter(item => 
            (typeFilter === 'all' || item.type === typeFilter) &&
            (item.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (filteredContent.length === 0 && !isLoading) {
            return <p className="text-stone-500 italic text-center py-10">Nenhum conteúdo encontrado para os filtros selecionados.</p>;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContent.map(item => {
                    const isInstalled = installedIds.has(item.id);
                    const isOwner = item.authorId === user?.id;
                    const isFromAI = item.createdBy === 'ai';
                    
                    return (
                        <div key={item.id} className="bg-stone-800/70 p-4 rounded-lg border border-stone-600 text-left flex flex-col justify-between hover:border-amber-700/50 transition-colors">
                            <div>
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-lg text-amber-200">{item.name}</h3>
                                    <div className="flex items-center gap-1.5 text-xs text-stone-400 capitalize bg-stone-700/50 px-2 py-1 rounded-full">
                                         {CONTENT_TYPE_ICONS[item.type] || <Bot className="h-4 w-4"/>}
                                         {translateApiString(item.type)}
                                    </div>
                                </div>
                                <p className="text-xs text-stone-400 mt-1">
                                    {isFromAI ? 'Criado por: Mestre IA' : (isOwner ? 'Criado por: Você' : `Criado por: ${item.author?.username || 'Comunidade'}`)}
                                </p>
                                {item.bundle && <p className="text-xs text-purple-400 mt-1">Parte do pacote: {item.bundle.name}</p>}
                            </div>
                            <div className="mt-4 flex gap-2">
                                {isOwner && !isFromAI && !item.bundleId && (
                                    <button onClick={() => handleEdit(item)} className="p-2 bg-blue-800/80 hover:bg-blue-700 rounded-md text-blue-200 transition-colors" title="Editar">
                                        <Edit className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => isInstalled ? handleUninstallClick(item, 'item') : handleInstallClick(item)}
                                    className={`w-full flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors`}
                                    style={{
                                        backgroundColor: isInstalled ? 'rgb(127 29 29 / 0.8)' : 'rgb(217 119 6)',
                                        color: isInstalled ? 'rgb(254 202 202)' : 'rgb(28 25 23)',
                                    }}
                                    disabled={isFromAI}
                                    title={isFromAI ? "Conteúdo da IA é sempre ativo" : isInstalled ? 'Desinstalar' : 'Instalar'}
                                >
                                    {isInstalled ? <Minus className="h-4 w-4"/> : <Download className="h-4 w-4"/>}
                                    {isFromAI ? "Sempre Ativo" : isInstalled ? 'Desinstalar' : 'Instalar'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };
    
    const renderBundlesTab = () => {
        const filteredBundles = bundles.filter(b => 
            b.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
            (activeTab === 'bundles' || 
             (activeTab === 'installed' && (b.contents || []).every(c => installedIds.has(c.id))) ||
             (activeTab === 'mine' && b.authorId === user?.id))
        );
    
        if (filteredBundles.length === 0 && !isLoading) {
            return <p className="text-stone-500 italic text-center py-10">Nenhum pacote de conteúdo encontrado para os filtros selecionados.</p>;
        }
    
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBundles.map(bundle => (
                    <BundleCard
                        key={bundle.id}
                        bundle={bundle}
                        isOwner={bundle.authorId === user?.id}
                        installedIds={installedIds}
                        onInstall={handleBundleInstallClick}
                        onUninstall={(b) => handleUninstallClick(b, 'bundle')}
                        onEdit={handleEditBundle}
                        onDelete={handleDeleteClick}
                    />
                ))}
            </div>
        );
    };
    
    const renderCommunityTab = () => {
        const communityContent = content.filter(c => c.isPublic && c.authorId !== user?.id && !c.bundleId && c.createdBy === 'user');
        const myPublicContent = content.filter(c => c.isPublic && c.authorId === user?.id && !c.bundleId && c.createdBy === 'user');
        return renderContentGrid([...communityContent, ...myPublicContent]);
    };

    const renderMyCreationsTab = () => {
        const myContent = content.filter(c => c.authorId === user?.id && !c.bundleId);
        const myBundles = bundles.filter(b => b.authorId === user?.id);
        
        return (
             <div className="space-y-8">
                {myBundles.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold text-amber-200 mb-4 border-b border-stone-600 pb-2">Meus Pacotes</h2>
                        {renderBundlesTab()}
                    </div>
                )}
                <div>
                    <h2 className="text-2xl font-bold text-amber-200 mb-4 border-b border-stone-600 pb-2">Minhas Criações Avulsas</h2>
                    {renderContentGrid(myContent)}
                </div>
                {myBundles.length === 0 && myContent.length === 0 && <p className="text-stone-500 italic text-center py-10">Você ainda não criou nenhum conteúdo.</p>}
            </div>
        );
    }
    
    const renderInstalledTab = () => {
        const installedContent = content.filter(c => installedIds.has(c.id) && !c.bundleId);
        const installedBundles = bundles.filter(b => (b.contents || []).every(c => installedIds.has(c.id)));
        
        return (
             <div className="space-y-8">
                {installedBundles.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold text-amber-200 mb-4 border-b border-stone-600 pb-2">Pacotes Instalados</h2>
                        {renderBundlesTab()}
                    </div>
                )}
                {installedContent.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold text-amber-200 mb-4 border-b border-stone-600 pb-2">Criações Avulsas Instaladas</h2>
                        {renderContentGrid(installedContent)}
                    </div>
                )}
                {installedBundles.length === 0 && installedContent.length === 0 && <p className="text-stone-500 italic text-center py-10">Nenhum conteúdo instalado.</p>}
            </div>
        )
    };

    const renderAiTab = () => {
        const aiContent = content.filter(c => c.createdBy === 'ai');
        return renderContentGrid(aiContent);
    };

    const renderActiveTab = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-full text-stone-400 py-10">
                    <Loader2 className="h-8 w-8 animate-spin mr-3" /> Carregando...
                </div>
            );
        }
        
        switch (activeTab) {
            case 'bundles': return renderBundlesTab();
            case 'community': return renderCommunityTab();
            case 'mine': return renderMyCreationsTab();
            case 'installed': return renderInstalledTab();
            case 'ai': return renderAiTab();
            default: return null;
        }
    };

    const renderModal = () => {
        const candidate = installCandidate || uninstallCandidate;
        if (!candidate) return null;

        const isInstall = !!installCandidate;
        const title = isInstall ? "Confirmar Instalação" : "Confirmar Desinstalação";
        const primaryActionText = isInstall ? `Instalar (${dependencies.length})` : `Desinstalar (${dependencies.length})`;
        const onConfirm = () => isInstall ? confirmInstallation(dependencies.map(d => d.id)) : confirmUninstallation(dependencies.map(d => d.id));
        const message = isInstall 
            ? `Para instalar "${candidate.item.name}", os seguintes itens também precisam ser instalados:`
            : `Desinstalar "${candidate.item.name}" também removerá suas dependências da sua conta:`;

        return (
            <ActionModal
                isOpen={true}
                title={title}
                onClose={() => { setInstallCandidate(null); setUninstallCandidate(null); setDependencies([]); }}
                actions={[
                    { text: "Cancelar", onClick: () => { setInstallCandidate(null); setUninstallCandidate(null); setDependencies([]); }, variant: 'secondary' },
                    { text: primaryActionText, onClick: onConfirm, variant: isInstall ? 'primary' : 'destructive', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : undefined }
                ]}
            >
                <p className="text-stone-300 mb-4">{message}</p>
                {dependencies.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto bg-stone-800/50 p-3 rounded-md border border-stone-700">
                        <ul className="list-disc list-inside text-stone-300 space-y-1">
                            {dependencies.map(dep => (
                                <li key={dep.id}>{dep.name} <span className="text-xs text-stone-500">({translateApiString(dep.type)})</span></li>
                            ))}
                        </ul>
                    </div>
                ) : <p className="text-stone-400 italic">Nenhuma dependência necessária.</p>}
            </ActionModal>
        )
    }

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'bundles', label: 'Pacotes', icon: <Package className="h-5 w-5"/> },
        { id: 'community', label: 'Comunidade', icon: <Users className="h-5 w-5"/> },
        { id: 'mine', label: 'Minhas Criações', icon: <Edit className="h-5 w-5"/> },
        { id: 'installed', label: 'Instalados', icon: <CheckCircle className="h-5 w-5"/> },
        { id: 'ai', label: 'IA', icon: <Bot className="h-5 w-5"/> },
    ];

    return (
        <>
            <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col text-center animate-fadeIn p-4 sm:p-6">
                <header className="mb-8">
                    <h1 className="text-5xl md:text-7xl font-bold text-amber-50 font-serif text-shadow-amber">
                        Oficina Homebrew
                    </h1>
                    <p className="text-stone-400 mt-2">Crie, compartilhe e descubra novo conteúdo para suas aventuras.</p>
                </header>
                <main className="w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 border-b border-stone-700">
                         <div className="flex flex-wrap">
                             {TABS.map(tab => (
                                 <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-3 sm:px-4 sm:py-2 text-sm sm:text-base font-semibold transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                                    {tab.icon} {tab.label}
                                </button>
                             ))}
                        </div>
                        <div className="flex gap-2 mt-2 sm:mt-0">
                             <button onClick={() => { setBundleToEdit(null); setIsBundleCreatorOpen(true); }} className="menu-button btn-new flex items-center justify-center gap-2 text-base px-3 py-1 sm:px-4 sm:py-2">
                                <PackagePlus className="h-5 w-5"/> Criar Pacote
                            </button>
                            <button onClick={() => { setView('create'); setContentToEdit(null); }} className="menu-button btn-new flex items-center justify-center gap-2 text-base px-3 py-1 sm:px-4 sm:py-2">
                                <Plus className="h-5 w-5"/> Criar Novo
                            </button>
                        </div>
                    </div>
                    {(activeTab !== 'mine' && activeTab !== 'installed') && (
                        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-stone-900/50 rounded-lg border border-stone-700">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500"/>
                                <input 
                                    type="text"
                                    placeholder="Buscar por nome..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-stone-800 border-stone-700 rounded-full py-1.5 pl-9 pr-3 text-sm"
                                />
                            </div>
                            {(activeTab === 'community' || activeTab === 'ai' || activeTab === 'bundles') && (
                                <>
                                <span className="text-sm font-semibold text-stone-400 ml-4">Filtrar:</span>
                                <button onClick={() => setTypeFilter('all')} className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors ${typeFilter === 'all' ? 'bg-amber-600 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}`}>
                                    <Grip className="h-4 w-4"/> Todos
                                </button>
                                {CONTENT_TYPES.map(type => (
                                    <button key={type} onClick={() => setTypeFilter(type)} className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors ${typeFilter === type ? 'bg-amber-600 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}`}>
                                    {CONTENT_TYPE_ICONS[type]} {translateApiString(type)}
                                    </button>
                                ))}
                                </>
                            )}
                        </div>
                    )}
                    <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 min-h-[40vh] max-h-[60vh] overflow-y-auto">
                        {renderActiveTab()}
                    </div>
                </main>
                <footer className="mt-8">
                    <button onClick={returnToMenu} className="text-stone-300 hover:text-amber-300 underline flex items-center gap-2 mx-auto">
                        <ArrowLeft className="h-4 w-4" /> Voltar ao Menu Principal
                    </button>
                </footer>
            </div>
            {renderModal()}
            
            {itemToDelete && (
                <ActionModal
                    isOpen={!!itemToDelete}
                    title={`Excluir "${itemToDelete.item.name}"?`}
                    onClose={() => setItemToDelete(null)}
                    actions={[
                        { text: "Cancelar", onClick: () => setItemToDelete(null), variant: 'secondary' },
                        { text: "Confirmar Exclusão", onClick: confirmDeletion, variant: 'destructive', disabled: isLoading }
                    ]}
                >
                    <p className="text-stone-300 mb-2">
                        Tem certeza que deseja excluir este pacote?
                    </p>
                    <p className="text-sm text-yellow-400 bg-yellow-900/40 p-3 rounded-md border border-yellow-700">
                        Os itens dentro do pacote não serão excluídos, apenas desvinculados, e poderão ser encontrados em "Minhas Criações".
                    </p>
                </ActionModal>
            )}
             <BundleCreator 
                isOpen={isBundleCreatorOpen}
                onClose={() => setIsBundleCreatorOpen(false)}
                onBundleCreated={fetchContentAndBundles}
                bundleToEdit={bundleToEdit}
            />
        </>
    );
};

export default HomebrewStore;
