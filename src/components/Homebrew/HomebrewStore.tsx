// src/components/Homebrew/HomebrewStore.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import * as HomebrewService from '@/services/homebrewService';
import HomebrewCreator from './HomebrewCreator';
import { useToast } from '@/hooks/use-toast';

type View = 'list' | 'create';

const HomebrewStore: React.FC<{ returnToMenu: () => void }> = ({ returnToMenu }) => {
    const [view, setView] = useState<View>('list');
    const [activeTab, setActiveTab] = useState<'public' | 'mine'>('public');
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState<HomebrewService.HomebrewContent[]>([]);
    const { toast } = useToast();

    const fetchContent = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await HomebrewService.listHomebrewContent(activeTab);
            setContent(result);
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
    }, [activeTab, toast]);

    useEffect(() => {
        if (view === 'list') {
            fetchContent();
        }
    }, [view, activeTab, fetchContent]);

    if (view === 'create') {
        return <HomebrewCreator 
            onContentCreated={() => {
                setView('list'); // Volta para a lista após criar
                fetchContent(); // Atualiza a lista
            }} 
            onCancel={() => setView('list')} 
        />;
    }

    return (
        <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col text-center animate-fadeIn p-4 sm:p-6">
            <header className="mb-8">
                <h1 className="text-5xl md:text-7xl font-bold text-amber-50 font-serif text-shadow-amber">
                    Laboratório Homebrew
                </h1>
                <p className="text-stone-400 mt-2">Crie, compartilhe e descubra novo conteúdo para suas aventuras.</p>
            </header>

            <main className="w-full">
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

                <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 min-h-[300px]">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full text-stone-400">
                            <Loader2 className="h-8 w-8 animate-spin mr-3" /> Carregando...
                        </div>
                    ) : content.length === 0 ? (
                        <p className="text-stone-500 italic text-center py-10">Nenhum conteúdo encontrado nesta categoria.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {content.map(item => (
                                <div key={item.id} className="bg-stone-800/70 p-4 rounded-lg border border-stone-600 text-left">
                                    <h3 className="font-bold text-lg text-amber-200 truncate">{item.name}</h3>
                                    <p className="text-sm text-stone-400 capitalize">{item.type}</p>
                                    <p className="text-xs text-stone-500 mt-2">Criado em: {new Date(item.createdAt).toLocaleDateString()}</p>
                                </div>
                            ))}
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
