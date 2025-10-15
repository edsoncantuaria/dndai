// src/components/Homebrew/HomebrewStore.tsx
'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Loader2, Plus, Trash2, CheckCircle, Download, Search, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as HomebrewService from '@/services/homebrewService';
import * as GameService from '@/services/gameService';
import HomebrewCreator from './HomebrewCreator';
import { useToast } from '@/hooks/use-toast';
import { translateApiString } from '@/utils/translator';
import { useGameStateContext } from '@/contexts/GameStateContext';
import ActionModal from '../ui/ActionModal';

type View = 'list' | 'create';
type Tab = 'public' | 'mine';
const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'
];

const DisclaimerModalContent: React.FC = () => (
    <div className="space-y-3 text-stone-300 text-sm">
        <p>Bem-vindo ao Laboratório! Antes de começar, é crucial entender como suas criações ganham vida no jogo.</p>
        <p>O sistema permite que você **descreva** regras, habilidades e mecânicas (como 'Ataque Extra', 'Fúria' ou 'Pontos de Ki'). O Mestre de Jogo IA é treinado para ler e interpretar essas descrições durante a aventura.</p>
        <p className="font-semibold text-amber-300">O que isso significa: Você pode recriar quase todo o conteúdo dos livros, mas o sistema não possui um <strong className="text-amber-200">motor de jogo codificado</strong> para forçar a aplicação mecânica dessas regras na interface. A execução depende da interpretação da IA.</p>
        <p>Sua criatividade na descrição é a chave para o sucesso do seu conteúdo!</p>
    </div>
);


const HomebrewStore: React.FC<{ returnToMenu: () => void }> = ({ returnToMenu }) => {
    const [view, setView] = useState<View>('list');
    const [activeTab, setActiveTab] = useState<Tab>('public');
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState<HomebrewService.HomebrewContent[]>([]);
    const { toast } = useToast();
    const { sessionId } = useGameStateContext();

    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<HomebrewService.HomebrewContentType | 'all'>('all');
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    
    // Supondo que a sessão ativa é conhecida, aqui pegamos um ID fixo para o exemplo.
    // Em um app real, isso viria de um contexto ou estado global.
    const activeSessionId = sessionId;

    const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

    const fetchContentAndInstalledIds = useCallback(async () => {
        setIsLoading(true);
        try {
            const createdByFilter = activeTab === 'public' ? 'user' : undefined;
            const [contentResult, sessionsResult] = await Promise.all([
                HomebrewService.listHomebrewContent(activeTab, undefined, createdByFilter),
                GameService.getGameSessions() // Precisamos saber o estado de todas as sessões
            ]);

            setContent(contentResult);

            if (activeSessionId) {
                const activeSession = sessionsResult.find(s => s.id === activeSessionId);
                setInstalledIds(new Set(activeSession?.homebrewContentIds || []));
            } else {
                 setInstalledIds(new Set()); // Se não há sessão ativa, nada está instalado.
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
            await GameService.updateSessionHomebrew(activeSessionId, contentId, action);
            setInstalledIds(prev => {
                const newSet = new Set(prev);
                if (isInstalled) {
                    newSet.delete(contentId);
                } else {
                    newSet.add(contentId);
                }
                return newSet;
            });
            toast({
                title: `Conteúdo ${isInstalled ? 'Desinstalado' : 'Instalado'}!`,
                description: `O item foi ${isInstalled ? 'removido da' : 'adicionado à'} sua sessão ativa.`,
            });
        } catch (error: any) {
             toast({ variant: 'destructive', title: `Falha na ${isInstalled ? 'Desinstalação' : 'Instalação'}`, description: error.message });
        }
    };

    const filteredContent = useMemo(() => {
        return content.filter(item => {
            const matchesType = typeFilter === 'all' || item.type === typeFilter;
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [content, typeFilter, searchTerm]);


    if (view === 'create') {
        return <HomebrewCreator onContentCreated={() => setView('list')} onCancel={() => setView('list')} />;
    }

    return (
        <>
        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col text-center animate-fadeIn p-4 sm:p-6">
            <header className="mb-8 text-center">
                <div className="flex items-center justify-center gap-3">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-amber-50 font-serif text-shadow-amber">
                        Oficina Homebrew
                    </h1>
                     <button onClick={() => setShowDisclaimer(true)} className="text-stone-500 hover:text-amber-300 transition-colors" title="Informações Importantes">
                        <Info className="h-6 w-6"/>
                    </button>
                </div>
                <p className="text-stone-400 mt-2">Crie, compartilhe e descubra novo conteúdo para suas aventuras.</p>
            </header>
            <main className="w-full">
                {/* --- Barra de Filtros --- */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                        <input 
                            type="text"
                            placeholder="Buscar por nome..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-stone-900/70 border-2 border-stone-700 rounded-md p-2 pl-10 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <button onClick={() => setTypeFilter('all')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${typeFilter === 'all' ? 'bg-amber-600 text-stone-900' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>Todos</button>
                        {CONTENT_TYPES.map(t => (
                            <button key={t} onClick={() => setTypeFilter(t)} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${typeFilter === t ? 'bg-amber-600 text-stone-900' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
                                {translateApiString(t)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- Aba Pública / Minhas Criações --- */}
                 <div className="flex justify-between items-center mb-4">
                     <div className="border-b border-stone-700">
                        <button onClick={() => setActiveTab('public')} className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'public' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-white'}`}>
                            Comunidade
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
                    ) : filteredContent.length === 0 ? (
                        <p className="text-stone-500 italic text-center py-10">Nenhum conteúdo encontrado com estes filtros.</p>
                    ) : (
                        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <AnimatePresence>
                                {filteredContent.map((item, i) => {
                                    const isInstalled = installedIds.has(item.id);
                                    return (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ duration: 0.2 }}
                                        className="bg-stone-800/70 p-4 rounded-lg border border-stone-600 text-left flex flex-col justify-between"
                                    >
                                        <div>
                                            <h3 className="font-bold text-lg text-amber-200 truncate">{item.name}</h3>
                                            <p className="text-sm text-stone-400 capitalize">{translateApiString(item.type)}</p>
                                            <p className="text-xs text-stone-500 mt-2">Criado em: {new Date(item.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="mt-4 flex gap-2">
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
                                        </div>
                                    </motion.div>
                                )})}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </main>
            <footer className="mt-8">
                <button onClick={returnToMenu} className="text-stone-300 hover:text-amber-300 underline flex items-center gap-2 mx-auto">
                    <ArrowLeft className="h-4 w-4" /> Voltar ao Menu Principal
                </button>
            </footer>
        </div>
        
        {showDisclaimer && (
            <ActionModal
                isOpen={showDisclaimer}
                title="Aviso Importante: Como Funciona o Homebrew"
                onClose={() => setShowDisclaimer(false)}
                actions={[{ text: "Entendido", onClick: () => setShowDisclaimer(false), variant: 'primary' }]}
            >
                <DisclaimerModalContent />
            </ActionModal>
        )}
        </>
    );
};

export default HomebrewStore;
