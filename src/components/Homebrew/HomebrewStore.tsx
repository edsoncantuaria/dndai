// src/components/Homebrew/HomebrewStore.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Plus, Trash2, CheckCircle, Download, Bot, Info, Swords, ScrollText, BookOpen, Shield, Heart } from 'lucide-react';
import * as HomebrewService from '@/services/homebrewService';
import * as GameService from '@/services/gameService';
import HomebrewCreator from './HomebrewCreator';
import { useToast } from '@/hooks/use-toast';
import { translateApiString } from '@/utils/translator';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type View = 'list' | 'create';
type Tab = 'public' | 'mine' | 'ai';
const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'
];

const CONTENT_TYPE_ICONS: Record<HomebrewService.HomebrewContentType, React.ReactNode> = {
    'race': <Heart className="h-4 w-4" />,
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
    const [activeTab, setActiveTab] = useState<Tab>('public');
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState<HomebrewService.HomebrewContent[]>([]);
    const { toast } = useToast();
    const { sessionId } = useGameStateContext();
    
    const activeSessionId = sessionId;

    const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

    const fetchContentAndInstalledIds = useCallback(async () => {
        setIsLoading(true);
        try {
            let contentPromise;
            if (activeTab === 'public') {
                contentPromise = HomebrewService.listHomebrewContent('public', undefined, 'user');
            } else if (activeTab === 'ai') {
                contentPromise = HomebrewService.listHomebrewContent('public', undefined, 'ai');
            } else {
                contentPromise = HomebrewService.listHomebrewContent('mine');
            }
            
            const [contentResult, sessionsResult] = await Promise.all([
                contentPromise,
                activeSessionId ? GameService.getSessionDetails(activeSessionId) : Promise.resolve(null),
            ]);

            setContent(contentResult || []);

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
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, toast, activeSessionId]);
    
    useEffect(() => {
        if (view === 'list') {
            fetchContentAndInstalledIds();
        }
    }, [view, activeTab, fetchContentAndInstalledIds]);

    const handleInstallToggle = async (contentId: string) => {
        if (!activeSessionId) {
            toast({ variant: 'destructive', title: 'Nenhuma sessão ativa', description: 'Por favor, inicie ou continue um jogo para instalar conteúdo.' });
            return;
        }
        
        const isInstalled = installedIds.has(contentId);
        const action = isInstalled ? 'uninstall' : 'install';

        try {
            const { sessao } = await GameService.updateSessionHomebrew(activeSessionId, contentId, action);
            setInstalledIds(new Set(sessao.homebrewContentIds || []));
            
            toast({
                title: `Conteúdo ${isInstalled ? 'Desinstalado' : 'Instalado'}!`,
                description: `O item foi ${isInstalled ? 'removido da' : 'adicionado à'} sua sessão ativa.`,
            });
        } catch (error: any) {
             toast({ variant: 'destructive', title: `Falha na ${isInstalled ? 'Desinstalação' : 'Instalação'}`, description: error.message });
        }
    };


    if (view === 'create') {
        return <HomebrewCreator onContentCreated={() => setView('list')} onCancel={() => setView('list')} />;
    }

    return (
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
                        <button onClick={() => setActiveTab('public')} className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'public' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                            Comunidade
                        </button>
                         <button onClick={() => setActiveTab('ai')} className={`px-4 py-2 text-lg font-semibold transition-colors flex items-center gap-2 ${activeTab === 'ai' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                            <Bot className="h-5 w-5"/> IA
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-stone-500 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Conteúdo gerado pela IA é ativado automaticamente e não precisa ser instalado.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </button>
                        <button onClick={() => setActiveTab('mine')} className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'mine' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                            Minhas Criações
                        </button>
                    </div>
                    <button onClick={() => setView('create')} className="menu-button btn-new flex items-center justify-center gap-2 text-base px-4 py-2">
                        <Plus className="h-5 w-5"/> Criar Novo
                    </button>
                </div>
                 <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 min-h-[40vh] max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full text-stone-400">
                            <Loader2 className="h-8 w-8 animate-spin mr-3" /> Carregando...
                        </div>
                    ) : content.length === 0 ? (
                        <p className="text-stone-500 italic text-center py-10">Nenhum conteúdo encontrado.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {content.map(item => {
                                const isInstalled = installedIds.has(item.id);
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
                                            Criado por: {item.createdBy === 'ai' ? 'Mestre IA' : 'Comunidade'}
                                        </p>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        {activeTab !== 'ai' && (
                                            <>
                                                <button
                                                    onClick={() => handleInstallToggle(item.id)}
                                                    disabled={!activeSessionId}
                                                    className={`w-full flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors disabled:bg-stone-600 disabled:text-stone-400 disabled:cursor-not-allowed ${
                                                        isInstalled ? 'bg-green-800 text-green-200' : 'bg-amber-700 hover:bg-amber-600 text-stone-900'
                                                    }`}
                                                >
                                                    {isInstalled ? <CheckCircle className="h-4 w-4"/> : <Download className="h-4 w-4"/>}
                                                    {isInstalled ? 'Instalado' : 'Instalar'}
                                                </button>
                                                {isInstalled && (
                                                    <button
                                                        onClick={() => handleInstallToggle(item.id)}
                                                        disabled={!activeSessionId}
                                                        className="p-2 bg-red-800/80 hover:bg-red-700 rounded-md text-red-200 transition-colors disabled:opacity-50"
                                                        title="Desinstalar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {activeTab === 'ai' && (
                                             <div className="w-full flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold bg-green-900/50 text-green-300 border border-green-800">
                                                <CheckCircle className="h-4 w-4"/>
                                                Sempre Ativo
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            </main>
            <footer className="mt-8">
                <button onClick={returnToMenu} className="text-stone-300 hover:text-amber-300 underline flex items-center gap-2 mx-auto">
                    <ArrowLeft className="h-4 w-4" /> Voltar ao Menu Principal
                </button>
            </footer>
        </div>
    );
};

export default HomebrewStore;
