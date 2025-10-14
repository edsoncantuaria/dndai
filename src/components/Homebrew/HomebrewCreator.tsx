// src/components/Homebrew/HomebrewCreator.tsx
'use client';
import React, { useState } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FlaskConical, Loader2 } from 'lucide-react';

const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'
];

interface Props {
    onContentCreated: () => void;
    onCancel: () => void;
}

const HomebrewCreator: React.FC<Props> = ({ onContentCreated, onCancel }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<HomebrewService.HomebrewContentType>('race');
    const [contentJson, setContentJson] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let content;
        try {
            content = JSON.parse(contentJson);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro no JSON',
                description: 'O conteúdo JSON fornecido não é válido. Verifique a sintaxe.',
            });
            return;
        }

        setIsLoading(true);
        try {
            await HomebrewService.createHomebrewContent({ name, type, content, isPublic });
            toast({
                title: 'Conteúdo Criado!',
                description: `"${name}" foi adicionado ao seu laboratório.`,
            });
            onContentCreated();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Falha ao Criar',
                description: error.message || 'Ocorreu um erro ao salvar seu conteúdo.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col animate-fadeIn p-4 sm:p-6">
            <header className="mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-amber-50 font-serif text-shadow-amber text-center">
                    Criar Novo Homebrew
                </h1>
                <p className="text-stone-400 mt-2 text-center">Dê vida às suas ideias. Siga o padrão da D&D 5e API para criar seu conteúdo.</p>
            </header>

            <form onSubmit={handleSubmit} className="bg-stone-900/50 p-6 rounded-lg border border-stone-700 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="homebrew-name" className="block text-sm font-medium text-stone-300 mb-1">Nome do Conteúdo</label>
                        <input
                            id="homebrew-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                            placeholder="Ex: Anão das Profundezas, Magia do Caos"
                        />
                    </div>
                    <div>
                        <label htmlFor="homebrew-type" className="block text-sm font-medium text-stone-300 mb-1">Tipo de Conteúdo</label>
                        <select
                            id="homebrew-type"
                            value={type}
                            onChange={(e) => setType(e.target.value as HomebrewService.HomebrewContentType)}
                            className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                        >
                            {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor="homebrew-json" className="block text-sm font-medium text-stone-300 mb-1">Conteúdo (JSON)</label>
                    <textarea
                        id="homebrew-json"
                        value={contentJson}
                        onChange={(e) => setContentJson(e.target.value)}
                        required
                        rows={12}
                        className="w-full bg-stone-800 border-stone-700 rounded-md p-3 text-stone-200 font-mono text-sm"
                        placeholder='Cole aqui o JSON seguindo o schema da D&D 5e API...'
                    />
                     <a href="/openapi.yaml" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 underline mt-2 inline-block">
                        Ver o schema de referência (OpenAPI)
                    </a>
                </div>
                
                 <div className="flex items-center justify-between bg-stone-800/60 p-3 rounded-md">
                    <label htmlFor="homebrew-public" className="flex flex-col">
                        <span className="text-stone-200 font-semibold">Tornar Público?</span>
                        <span className="text-xs text-stone-400">Permitir que outros jogadores vejam e usem sua criação.</span>
                    </label>
                    <button
                        type="button"
                        id="homebrew-public"
                        onClick={() => setIsPublic(p => !p)}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 ${isPublic ? 'bg-amber-600' : 'bg-stone-600'}`}
                    >
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>


                <footer className="flex justify-between items-center pt-4 border-t border-stone-700">
                    <button type="button" onClick={onCancel} className="text-stone-300 hover:text-amber-300 underline flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4"/> Voltar
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="menu-button btn-new flex items-center justify-center gap-2 text-lg px-6 py-2"
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FlaskConical className="h-5 w-5"/>}
                        Salvar Criação
                    </button>
                </footer>
            </form>
        </div>
    );
};

export default HomebrewCreator;
