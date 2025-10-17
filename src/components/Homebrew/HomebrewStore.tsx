
// src/components/Homebrew/HomebrewStore.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Plus, Trash2, CheckCircle, Download, Bot, Info, Swords, ScrollText, BookOpen, Shield, Heart, Grip, Minus, Edit, Package, PackagePlus, PackageCheck, ChevronDown } from 'lucide-react';
import * as HomebrewService from '@/services/homebrewService';
import * as GameService from '@/services/gameService';
import HomebrewCreator from './HomebrewCreator';
import { useToast } from '@/hooks/use-toast';
import { translateApiString } from '@/utils/translator';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { useAuth } from '@/contexts/AuthContext';
import ActionModal from '../ui/ActionModal';
import BundleCreator from './BundleCreator';

type View = 'list' | 'create' | 'edit';
type Tab = 'bundles' | 'community' | 'mine';

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
    activeSessionId: number | null;
    onInstall: (bundle: HomebrewService.HomebrewBundle) => void;
    onEdit: (bundle: HomebrewService.HomebrewBundle) => void;
    onDelete: (bundle: HomebrewService.HomebrewBundle) => void;
}> = ({ bundle, isOwner, installedIds, activeSessionId, onInstall, onEdit, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const allContentsOfBundleInstalled = bundle.contents.every(c => installedIds.has(c.id));

    return (
        <div className="bg-stone-800/70 p-4 rounded-lg border border-stone-600 text-left flex flex-col justify-between hover:border-amber-700/50 transition-colors">
            <div>
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg text-amber-200">{bundle.name}</h3>
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-stone-400 hover:text-amber-300">
                        <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <p className="text-xs text-stone-400 mb-2">Contém {bundle.contentCount} itens. {isOwner && '(Meu Pacote)'}</p>
                <p className="text-sm text-stone-300">{bundle.description}</p>
            </div>

            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-stone-700 max-h-40 overflow-y-auto pr-2">
                    <ul className="list-disc list-inside space-y-1 text-sm text-stone-300">
                        {bundle.contents.map(c => <li key={c.id}>{c.name} <span className="text-xs text-stone-500">({translateApiString(c.type)})</span></li>)}
                    </ul>
                </div>
            )}

            <div className="mt-4 flex gap-2">
                {isOwner ? (
                    <>
                        <button onClick={() => onEdit(bundle)} className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors bg-blue-800 hover:bg-blue-700 text-blue-200">
                            <Edit className="h-4 w-4"/> Editar
                        </button>
                        <button onClick={() => onDelete(bundle)} className="p-2 bg-red-800 hover:bg-red-700 text-red-200 rounded-md transition-colors">
                            <Trash2 className="h-5 w-5"/>
                        </button>
                    </>
                ) : (
                     <button
                        onClick={() => onInstall(bundle)}
                        disabled={!activeSessionId}
                        className={`w-full flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors disabled:bg-stone-600 disabled:text-stone-400 disabled:cursor-not-allowed ${
                            allContentsOfBundleInstalled ? 'bg-green-800 text-green-200' : 'bg-amber-700 hover:bg-amber-600 text-stone-900'
                        }`}
                        title={!activeSessionId ? "Inicie uma sessão para instalar" : ""}
                    >
                        {allContentsOfBundleInstalled ? <PackageCheck className="h-4 w-4"/> : <Download className="h-4 w-4"/>}
                        {allContentsOfBundleInstalled ? 'Instalado' : 'Instalar Pacote'}
                    </button>
                )}
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
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState<HomebrewService.HomebrewContent[]>([]);
    const [bundles, setBundles] = useState<HomebrewService.HomebrewBundle[]>([]);
    const { toast } = useToast();
    const { sessionId } = useGameStateContext();
    const { user } = useAuth();
    
    const [installCandidate, setInstallCandidate] = useState<{item: HomebrewService.HomebrewContent | HomebrewService.HomebrewBundle, type: 'item' | 'bundle'} | null>(null);
    const [dependenciesToInstall, setDependenciesToInstall] = useState<HomebrewService.HomebrewContent[]>([]);

    const [itemToDelete, setItemToDelete] = useState<{item: HomebrewService.HomebrewBundle, type: 'bundle'} | null>(null);

    const activeSessionId = sessionId;
    const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
    const [isBundleCreatorOpen, setIsBundleCreatorOpen] = useState(false);

    const fetchContentAndInstalledIds = useCallback(async () => {
        setIsLoading(true);
        try {
            const filterType = typeFilter === 'all' ? undefined : typeFilter;
            const sessionsResultPromise = activeSessionId ? GameService.getSessionDetails(activeSessionId) : Promise.resolve(null);
            
            let contentResult: HomebrewService.HomebrewContent[] = [];
            let bundlesResult: HomebrewService.HomebrewBundle[] = [];

            if (activeTab === 'bundles') {
                const [publicBundles, myBundles, sessionsResult] = await Promise.all([
                    HomebrewService.listHomebrewBundles('public'),
                    user ? HomebrewService.listHomebrewBundles('mine') : Promise.resolve([]),
                    sessionsResultPromise
                ]);
                const myBundleIds = new Set(myBundles.map(b => b.id));
                bundlesResult = [...myBundles, ...publicBundles.filter(b => !myBundleIds.has(b.id))];

                if (sessionsResult) setInstalledIds(new Set(sessionsResult.homebrewContentIds || []));

            } else if(activeTab === 'mine') {
                 const [myContent, myBundles, sessionsResult] = await Promise.all([
                    user ? HomebrewService.listHomebrewContent('mine', filterType) : Promise.resolve([]),
                    user ? HomebrewService.listHomebrewBundles('mine') : Promise.resolve([]),
                    sessionsResultPromise,
                ]);
                contentResult = myContent;
                bundlesResult = myBundles;
                if (sessionsResult) setInstalledIds(new Set(sessionsResult.homebrewContentIds || []));

            } else { // Community Tab
                 const [publicContent, sessionsResult] = await Promise.all([
                    HomebrewService.listHomebrewContent('public', filterType, 1, 100),
                    sessionsResultPromise
                ]);
                contentResult = publicContent.filter(c => c.authorId !== user?.id); // Exclude own public content
                if (sessionsResult) setInstalledIds(new Set(sessionsResult.homebrewContentIds || []));
            }

            setContent(contentResult.sort((a,b) => a.name.localeCompare(b.name)));
            setBundles(bundlesResult.sort((a,b) => a.name.localeCompare(b.name)));

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
    }, [activeTab, toast, activeSessionId, typeFilter, user]);
    
    useEffect(() => {
        if (view === 'list') {
            fetchContentAndInstalledIds();
        }
    }, [view, activeTab, fetchContentAndInstalledIds]);

    const handleInstallClick = async (item: HomebrewService.HomebrewContent) => {
        if (!activeSessionId) {
            toast({ variant: 'destructive', title: 'Nenhuma sessão ativa', description: 'Por favor, inicie ou continue um jogo para instalar conteúdo.' });
            return;
        }

        try {
            const deps = await HomebrewService.getHomebrewDependencies(item.id);
            const depsToInstall = deps.filter(d => !installedIds.has(d.id));

            if (depsToInstall.length > 1) { 
                setInstallCandidate({ item, type: 'item' });
                setDependenciesToInstall(depsToInstall);
            } else {
                await confirmInstallation([item.id]);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Verificar Dependências', description: error.message });
        }
    };
    
    const handleBundleInstallClick = async (bundle: HomebrewService.HomebrewBundle) => {
        if (!activeSessionId) {
            toast({ variant: 'destructive', title: 'Nenhuma sessão ativa', description: 'Por favor, inicie ou continue um jogo para instalar pacotes.' });
            return;
        }
        
        const allDepsPromises = bundle.contents.map(c => HomebrewService.getHomebrewDependencies(c.id));
        const allDepsArrays = await Promise.all(allDepsPromises);
        const allUniqueDeps = Array.from(new Map(allDepsArrays.flat().map(dep => [dep.id, dep])).values());

        const idsToInstall = allUniqueDeps.filter(dep => !installedIds.has(dep.id));

        if (idsToInstall.length === 0) {
            toast({ title: 'Tudo pronto!', description: 'Todo o conteúdo deste pacote e suas dependências já estão instalados.' });
            return;
        }
        
        setInstallCandidate({ item: bundle, type: 'bundle' });
        setDependenciesToInstall(idsToInstall);
    };
    
    const confirmInstallation = async (idsToInstall: string[]) => {
        if (!activeSessionId) return;

        setIsLoading(true);
        try {
            let sessionData;
            for (const id of idsToInstall) {
                sessionData = await GameService.updateSessionHomebrew(activeSessionId, id, 'install');
            }
            if (sessionData) {
                setInstalledIds(new Set(sessionData.sessao.homebrewContentIds || []));
            }
            toast({
                title: 'Instalação Concluída!',
                description: `${idsToInstall.length} ite${idsToInstall.length > 1 ? 'ns foram adicionados' : 'm foi adicionado'} à sua sessão.`,
            });
        } catch (error: any) {
             toast({ variant: 'destructive', title: `Falha na Instalação`, description: error.message });
        } finally {
            setInstallCandidate(null);
            setDependenciesToInstall([]);
            setIsLoading(false);
        }
    }

    const handleUninstall = async (contentId: string) => {
        if (!activeSessionId) return;

        try {
            const { sessao } = await GameService.updateSessionHomebrew(activeSessionId, contentId, 'uninstall');
            setInstalledIds(new Set(sessao.homebrewContentIds || []));
            toast({
                title: `Conteúdo Desinstalado!`,
                description: `O item foi removido da sua sessão ativa.`,
            });
        } catch (error: any) {
             toast({ variant: 'destructive', title: `Falha na Desinstalação`, description: error.message });
        }
    };

    const handleEdit = (item: HomebrewService.HomebrewContent) => {
        if (item.bundleId) {
            toast({
                variant: 'destructive',
                title: 'Conteúdo em Pacote',
                description: 'Remova este item do pacote para poder editá-lo.',
            });
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
            await HomebrewService.deleteHomebrewBundle(itemToDelete.item.id);
            toast({ title: 'Pacote Excluído', description: `"${itemToDelete.item.name}" foi removido permanentemente.` });
            fetchContentAndInstalledIds();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na Exclusão', description: error.message });
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    if (view === 'create') {
        return <HomebrewCreator onContentCreated={() => setView('list')} onCancel={() => setView('list')} />;
    }
    if (view === 'edit') {
        return <HomebrewCreator onContentCreated={() => setView('list')} onCancel={() => setView('list')} contentToEdit={contentToEdit} />;
    }

    const renderContentGrid = (contentList: HomebrewService.HomebrewContent[]) => {
        if (contentList.length === 0) {
            return <p className="text-stone-500 italic text-center py-10">Nenhum conteúdo encontrado para os filtros selecionados.</p>;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contentList.map(item => {
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
                                {isFromAI && <p className="text-xs text-stone-500 mt-1">Criado por: Mestre IA</p>}
                                {item.bundle && <p className="text-xs text-purple-400 mt-1">Parte do pacote: {item.bundle.name}</p>}
                            </div>
                            <div className="mt-4 flex gap-2">
                                {isOwner && !isFromAI && !item.bundleId && (
                                    <button onClick={() => handleEdit(item)} className="p-2 bg-blue-800/80 hover:bg-blue-700 rounded-md text-blue-200 transition-colors" title="Editar">
                                        <Edit className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleInstallClick(item)}
                                    disabled={!activeSessionId}
                                    className={`w-full flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors disabled:bg-stone-600 disabled:text-stone-400 disabled:cursor-not-allowed ${
                                        isInstalled ? 'bg-green-800 text-green-200' : 'bg-amber-700 hover:bg-amber-600 text-stone-900'
                                    }`}
                                    title={isInstalled ? 'Instalado' : 'Instalar'}
                                >
                                    {isInstalled ? <CheckCircle className="h-4 w-4"/> : <Download className="h-4 w-4"/>}
                                    {isInstalled ? 'Instalado' : 'Instalar'}
                                </button>
                                {isInstalled && !item.bundleId && (
                                     <button
                                        onClick={() => handleUninstall(item.id)}
                                        disabled={!activeSessionId}
                                        className="p-2 bg-red-800/80 hover:bg-red-700 rounded-md text-red-200 transition-colors disabled:opacity-50"
                                        title={"Desinstalar"}
                                    >
                                        <Minus className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };
    
    const renderBundlesTab = () => (
        bundles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bundles.map(bundle => (
                    <BundleCard
                        key={bundle.id}
                        bundle={bundle}
                        isOwner={bundle.authorId === user?.id}
                        installedIds={installedIds}
                        activeSessionId={activeSessionId}
                        onInstall={handleBundleInstallClick}
                        onEdit={handleEditBundle}
                        onDelete={handleDeleteClick}
                    />
                ))}
            </div>
        ) : (
            <p className="text-stone-500 italic text-center py-10">Nenhum pacote de conteúdo encontrado.</p>
        )
    );

    const renderMyCreationsTab = () => {
        const myUnbundledContent = content.filter(c => c.authorId === user?.id && !c.bundleId);
        const myBundles = bundles.filter(b => b.authorId === user?.id);

        return (
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-amber-200 mb-4 border-b border-stone-600 pb-2">Meus Pacotes</h2>
                    {myBundles.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myBundles.map(bundle => (
                                <BundleCard
                                    key={bundle.id}
                                    bundle={bundle}
                                    isOwner={true}
                                    installedIds={installedIds}
                                    activeSessionId={activeSessionId}
                                    onInstall={() => {}}
                                    onEdit={handleEditBundle}
                                    onDelete={handleDeleteClick}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-stone-500 italic py-4">Você ainda não criou nenhum pacote.</p>
                    )}
                </div>
                 <div>
                    <h2 className="text-2xl font-bold text-amber-200 mb-4 border-b border-stone-600 pb-2">Minhas Criações Avulsas</h2>
                    {renderContentGrid(myUnbundledContent)}
                </div>
            </div>
        );
    }
    
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
            case 'community': return renderContentGrid(content.filter(c => c.authorId !== user?.id));
            case 'mine': return renderMyCreationsTab();
            default: return null;
        }
    };

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
                    <div className="flex justify-between items-center mb-4 border-b border-stone-700">
                         <div className="flex">
                             <button onClick={() => setActiveTab('bundles')} className={`px-4 py-2 text-lg font-semibold transition-colors flex items-center gap-2 ${activeTab === 'bundles' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                                <Package className="h-5 w-5"/> Pacotes
                            </button>
                            <button onClick={() => setActiveTab('community')} className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'community' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                                Comunidade
                            </button>
                            <button onClick={() => setActiveTab('mine')} className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'mine' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                                Minhas Criações
                            </button>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => { setBundleToEdit(null); setIsBundleCreatorOpen(true); }} className="menu-button btn-new flex items-center justify-center gap-2 text-base px-4 py-2">
                                <PackagePlus className="h-5 w-5"/> Criar Pacote
                            </button>
                            <button onClick={() => { setView('create'); setContentToEdit(null); }} className="menu-button btn-new flex items-center justify-center gap-2 text-base px-4 py-2">
                                <Plus className="h-5 w-5"/> Criar Novo
                            </button>
                        </div>
                    </div>
                    {activeTab === 'community' && (
                        <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-stone-900/50 rounded-lg border border-stone-700">
                            <span className="text-sm font-semibold text-stone-400 mr-2">Filtrar por tipo:</span>
                            <button onClick={() => setTypeFilter('all')} className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors ${typeFilter === 'all' ? 'bg-amber-600 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}`}>
                                <Grip className="h-4 w-4"/> Todos
                            </button>
                            {CONTENT_TYPES.map(type => (
                                <button key={type} onClick={() => setTypeFilter(type)} className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors ${typeFilter === type ? 'bg-amber-600 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}`}>
                                {CONTENT_TYPE_ICONS[type]} {translateApiString(type)}
                                </button>
                            ))}
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
            {installCandidate && (
                <ActionModal
                    isOpen={!!installCandidate}
                    title="Instalar Conteúdo"
                    onClose={() => { setInstallCandidate(null); setDependenciesToInstall([]); }}
                    actions={[
                        { text: "Cancelar", onClick: () => { setInstallCandidate(null); setDependenciesToInstall([]); }, variant: 'secondary' },
                        { text: `Instalar Tudo (${dependenciesToInstall.length})`, onClick: () => confirmInstallation(dependenciesToInstall.map(d => d.id)), variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : undefined }
                    ]}
                >
                    <p className="text-stone-300 mb-4">Para instalar "{installCandidate.item.name}", os seguintes itens também precisam ser instalados na sua sessão:</p>
                    <div className="max-h-60 overflow-y-auto bg-stone-800/50 p-3 rounded-md border border-stone-700">
                        <ul className="list-disc list-inside text-stone-300 space-y-1">
                            {dependenciesToInstall.map(dep => (
                                <li key={dep.id}>{dep.name} <span className="text-xs text-stone-500">({translateApiString(dep.type)})</span></li>
                            ))}
                        </ul>
                    </div>
                </ActionModal>
            )}
            
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
                onBundleCreated={fetchContentAndInstalledIds}
                bundleToEdit={bundleToEdit}
            />
        </>
    );
};

export default HomebrewStore;

    