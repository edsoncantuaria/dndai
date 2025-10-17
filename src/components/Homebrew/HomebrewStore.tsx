// src/components/Homebrew/HomebrewStore.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Plus, Trash2, CheckCircle, Download, Bot, Info, Swords, ScrollText, BookOpen, Shield, Heart, Grip, Minus, Edit, Package, PackagePlus, PackageCheck } from 'lucide-react';
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
type Tab = 'bundles' | 'public' | 'mine' | 'ai';

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


const HomebrewStore: React.FC<{ returnToMenu: () => void }> = ({ returnToMenu }) => {
    const [view, setView] = useState<View>('list');
    const [contentToEdit, setContentToEdit] = useState<HomebrewService.HomebrewContent | null>(null);
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

    const activeSessionId = sessionId;

    const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
    const [isCreatorOpen, setIsCreatorOpen] = useState(false);

    const fetchContentAndInstalledIds = useCallback(async () => {
        setIsLoading(true);
        try {
            const sessionsResultPromise = activeSessionId ? GameService.getSessionDetails(activeSessionId) : Promise.resolve(null);
            let contentPromise;

            if (activeTab === 'bundles') {
                contentPromise = HomebrewService.listHomebrewBundles();
            } else if (activeTab === 'public') {
                const filterType = typeFilter === 'all' ? undefined : typeFilter;
                contentPromise = HomebrewService.listHomebrewContent('public', filterType, 'user');
            } else if (activeTab === 'ai') {
                const filterType = typeFilter === 'all' ? undefined : typeFilter;
                contentPromise = HomebrewService.listHomebrewContent('public', filterType, 'ai');
            } else { // 'mine'
                const filterType = typeFilter === 'all' ? undefined : typeFilter;
                contentPromise = HomebrewService.listHomebrewContent('mine', filterType);
            }
            
            const [contentResult, sessionsResult] = await Promise.all([contentPromise, sessionsResultPromise]);

            if (activeTab === 'bundles') {
                setBundles((contentResult as HomebrewService.HomebrewBundle[]) || []);
                setContent([]);
            } else {
                setContent((contentResult as HomebrewService.HomebrewContent[]) || []);
                setBundles([]);
            }

            if (sessionsResult) {
                setInstalledIds(new Set(sessionsResult.homebrewContentIds || []));
            } else {
                 setInstalledIds(new Set());
            }
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
    }, [activeTab, toast, activeSessionId, typeFilter]);
    
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

        const idsToInstall = bundle.contents.map(c => c.id).filter(id => !installedIds.has(id));
        if (idsToInstall.length === 0) {
            toast({ title: 'Tudo pronto!', description: 'Todo o conteúdo deste pacote já está instalado.' });
            return;
        }
        
        // Exibe o modal de confirmação mesmo se for apenas um item.
        setInstallCandidate({ item: bundle, type: 'bundle' });
        setDependenciesToInstall(bundle.contents.filter(c => idsToInstall.includes(c.id)));
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
        setContentToEdit(item);
        setView('edit');
    };

    if (view === 'create') {
        return <HomebrewCreator onContentCreated={() => setView('list')} onCancel={() => setView('list')} />;
    }
    if (view === 'edit') {
        return <HomebrewCreator onContentCreated={() => setView('list')} onCancel={() => setView('list')} contentToEdit={contentToEdit} />;
    }


    return (
        <>
            <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col text-center animate-fadeIn p-4 sm:p-6">
                <header className="mb-8">
                    <h1 className="text-5xl md:text-7xl font-bold text-amber-50 font-serif text-shadow-amber">
                        Oficina Homebrew
                    </h1>
                    <p className="text-stone-400 mt-2">Crie, compartilhe e descubra novo conteúdo para suas aventuras.</p>
                </header>
                <main className="w-full">
                    <div className="flex justify-between items-center mb-4">
                         <div className="border-b border-stone-700">
                             <button onClick={() => setActiveTab('bundles')} className={`px-4 py-2 text-lg font-semibold transition-colors flex items-center gap-2 ${activeTab === 'bundles' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                                <Package className="h-5 w-5"/> Pacotes
                            </button>
                            <button onClick={() => setActiveTab('public')} className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'public' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                                Comunidade
                            </button>
                             <button onClick={() => setActiveTab('ai')} className={`px-4 py-2 text-lg font-semibold transition-colors flex items-center gap-2 ${activeTab === 'ai' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                                <Bot className="h-5 w-5"/> IA
                            </button>
                            <button onClick={() => setActiveTab('mine')} className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'mine' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                                Minhas Criações
                            </button>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setIsCreatorOpen(true)} className="menu-button btn-new flex items-center justify-center gap-2 text-base px-4 py-2">
                                <PackagePlus className="h-5 w-5"/> Criar Pacote
                            </button>
                            <button onClick={() => { setView('create'); setContentToEdit(null); }} className="menu-button btn-new flex items-center justify-center gap-2 text-base px-4 py-2">
                                <Plus className="h-5 w-5"/> Criar Novo
                            </button>
                        </div>
                    </div>

                    {activeTab !== 'bundles' && (
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
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full text-stone-400">
                                <Loader2 className="h-8 w-8 animate-spin mr-3" /> Carregando...
                            </div>
                        ) : activeTab === 'bundles' ? (
                            bundles.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {bundles.map(bundle => {
                                    const allContentsOfBundleInstalled = bundle.contents.every(c => installedIds.has(c.id));
                                    return (
                                        <div key={bundle.id} className="bg-stone-800/70 p-4 rounded-lg border border-stone-600 text-left flex flex-col justify-between hover:border-amber-700/50 transition-colors">
                                            <div>
                                                <h3 className="font-bold text-lg text-amber-200">{bundle.name}</h3>
                                                <p className="text-xs text-stone-400 mb-2">Contém {bundle.contents.length} itens.</p>
                                                <p className="text-sm text-stone-300">{bundle.description}</p>
                                            </div>
                                             <div className="mt-4 flex gap-2">
                                                <button
                                                    onClick={() => handleBundleInstallClick(bundle)}
                                                    disabled={!activeSessionId}
                                                    className={`w-full flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors disabled:bg-stone-600 disabled:text-stone-400 disabled:cursor-not-allowed ${
                                                        allContentsOfBundleInstalled ? 'bg-green-800 text-green-200 hover:bg-green-700' : 'bg-amber-700 hover:bg-amber-600 text-stone-900'
                                                    }`}
                                                >
                                                    {allContentsOfBundleInstalled ? <PackageCheck className="h-4 w-4"/> : <Download className="h-4 w-4"/>}
                                                    {allContentsOfBundleInstalled ? 'Instalado' : 'Instalar Pacote'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                                </div>
                            ) : (
                                <p className="text-stone-500 italic text-center py-10">Nenhum pacote de conteúdo encontrado.</p>
                            )
                        ) : (
                            content.length === 0 ? (
                                <p className="text-stone-500 italic text-center py-10">Nenhum conteúdo encontrado para os filtros selecionados.</p>
                            ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {content.map(item => {
                                    const isInstalled = installedIds.has(item.id);
                                    const isOwner = item.authorId === user?.id;
                                    const isStructural = ['race', 'subrace', 'class', 'subclass', 'background'].includes(item.type);
                                    
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
                                             <p className="text-xs text-stone-500 mt-1">
                                                Criado por: {item.createdBy === 'ai' ? 'Mestre IA' : (isOwner ? 'Você' : 'Comunidade')}
                                            </p>
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            {isOwner && (
                                                <button onClick={() => handleEdit(item)} className="p-2 bg-blue-800/80 hover:bg-blue-700 rounded-md text-blue-200 transition-colors" title="Editar">
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleInstallClick(item)}
                                                disabled={!activeSessionId || isStructural || isOwner}
                                                className={`w-full flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors disabled:bg-stone-600 disabled:text-stone-400 disabled:cursor-not-allowed ${
                                                    isOwner ? 'bg-green-800 text-green-200 cursor-default' : (isInstalled ? 'bg-green-800 text-green-200' : 'bg-amber-700 hover:bg-amber-600 text-stone-900')
                                                }`}
                                                title={isOwner ? "Seu conteúdo está sempre ativo." : (isStructural ? "Conteúdo estrutural é adicionado na criação do personagem." : (isInstalled ? 'Instalado' : 'Instalar'))}
                                            >
                                                {isOwner ? <CheckCircle className="h-4 w-4"/> : (isInstalled ? <CheckCircle className="h-4 w-4"/> : <Download className="h-4 w-4"/>)}
                                                {isOwner ? 'Sempre Ativo' : (isInstalled ? 'Instalado' : 'Instalar')}
                                            </button>
                                            
                                            {isInstalled && !isOwner && !isStructural && (
                                                <button
                                                    onClick={() => handleUninstall(item.id)}
                                                    disabled={!activeSessionId}
                                                    className="p-2 bg-red-800/80 hover:bg-red-700 rounded-md text-red-200 transition-colors disabled:opacity-50"
                                                    title="Desinstalar"
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        ))}
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
            <BundleCreator 
                isOpen={isCreatorOpen}
                onClose={() => setIsCreatorOpen(false)}
                onBundleCreated={fetchContentAndInstalledIds} // Recarrega a lista
            />
        </>
    );
};

export default HomebrewStore;
