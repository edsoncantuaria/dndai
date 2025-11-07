// src/components/Homebrew/TranslationStudio.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, Loader2, Save } from 'lucide-react';
import * as HomebrewService from '@/services/homebrewService';
import * as translationService from '@/services/translationService';
import PremiumLoader from '@/components/ui/PremiumLoader';

// Lista expandida para incluir todos os novos tipos de tradução
const TRANSLATION_CATEGORIES = [
    "Attributes", "Races", "Content Types", "Classes", "Subclasses", 
    "Alignments", "Skills & Proficiencies", "Magic Schools", "Conditions", 
    "Languages", "World State"
];

const TranslationStudio: React.FC<{ onCancel: () => void; }> = ({ onCancel }) => {
    const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string>(TRANSLATION_CATEGORIES[0]);
    const { toast } = useToast();

    const fetchTranslations = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await translationService.getTranslations();
            // Preenche categorias vazias para garantir que todas apareçam na UI
            const fullData: Record<string, Record<string, string>> = {};
            TRANSLATION_CATEGORIES.forEach(cat => {
                fullData[cat] = data[cat] || {};
            });
            setTranslations(fullData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Carregar Traduções', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchTranslations();
    }, [fetchTranslations]);

    const handleValueChange = (category: string, key: string, value: string) => {
        setTranslations(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value,
            },
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // No backend, cada categoria será salva como um 'HomebrewContent' do tipo 'translation'
            for (const category of TRANSLATION_CATEGORIES) {
                const contentData = translations[category];
                if (contentData && Object.keys(contentData).length > 0) {
                     await HomebrewService.createHomebrewContent({
                        type: 'translation',
                        name: category, // O nome da categoria é o identificador
                        content: contentData,
                        isPublic: true, // Traduções são sempre públicas
                    });
                }
            }
            toast({ title: 'Sucesso!', description: 'Todas as traduções foram salvas.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Salvar', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    if(isLoading) {
        return (
            <PremiumLoader
                title="Carregando o Estúdio de Tradução"
                subtitle="Sincronizando termos base, categorias e conteúdo compartilhado."
                description="Requisitando todas as traduções para você editar em um só lugar..."
                actionLabel="Voltar para a Oficina"
                onAction={onCancel}
            />
        )
    }

    return (
         <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col text-center animate-fadeIn p-4 sm:p-6">
            <header className="mb-8">
                <h1 className="text-5xl md:text-7xl font-bold text-amber-50 font-serif text-shadow-amber">
                    Estúdio de Tradução
                </h1>
                <p className="text-stone-400 mt-2">Edite os termos base do jogo para todo o sistema.</p>
            </header>
             <main className="w-full bg-stone-900/50 p-4 rounded-lg border border-stone-700 max-h-[70vh] flex flex-col md:flex-row gap-6">
                <nav className="flex-shrink-0 md:w-64 border-b md:border-b-0 md:border-r border-stone-700 pb-4 md:pb-0 md:pr-4">
                    <ul className="space-y-1">
                        {TRANSLATION_CATEGORIES.map(cat => (
                            <li key={cat}>
                                <button
                                    onClick={() => setActiveCategory(cat)}
                                    className={`w-full text-left p-2 rounded-md text-sm font-semibold transition-colors ${activeCategory === cat ? 'bg-amber-800/50 text-amber-200' : 'text-stone-300 hover:bg-stone-800'}`}
                                >
                                    {cat}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="flex-grow overflow-y-auto pr-2">
                    <h3 className="text-2xl font-bold text-amber-200 mb-4">{activeCategory}</h3>
                    <div className="space-y-3">
                         {Object.keys(translations[activeCategory] || {}).map(key => (
                            <div key={key} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                                <label htmlFor={`translation-${key}`} className="text-sm font-medium text-stone-400 text-left">{key}</label>
                                <input
                                    id={`translation-${key}`}
                                    type="text"
                                    value={translations[activeCategory][key]}
                                    onChange={(e) => handleValueChange(activeCategory, key, e.target.value)}
                                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
                                />
                            </div>
                         ))}
                         {Object.keys(translations[activeCategory] || {}).length === 0 && (
                            <p className="text-stone-500 italic text-center">Nenhum termo encontrado nesta categoria. Isso pode precisar de uma migração inicial de dados.</p>
                         )}
                    </div>
                </div>
            </main>
             <footer className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <button
                    onClick={onCancel}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-stone-200 transition hover:border-amber-300 hover:text-amber-200"
                >
                    <ArrowLeft className="h-4 w-4" /> Voltar para a Oficina
                </button>
                 <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/85 via-amber-400/80 to-rose-500/80 px-6 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin text-stone-950" /> : <Save className="h-5 w-5" />}
                    Salvar Traduções
                </button>
            </footer>
        </div>
    );
};

export default TranslationStudio;
