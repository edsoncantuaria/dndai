// src/components/Homebrew/HomebrewCreator.tsx
'use client';
import React, { useState } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FlaskConical, Loader2, Info } from 'lucide-react';
import { translateApiString } from '@/utils/translator';
import RaceForm from './forms/RaceForm';
import ClassForm from './forms/ClassForm';
import SubclassForm from './forms/SubclassForm';
import SpellForm from './forms/SpellForm';
import ItemForm from './forms/ItemForm';
import MonsterForm from './forms/MonsterForm';
import BackgroundForm from './forms/BackgroundForm';
import FeatForm from './forms/FeatForm';
import HomebrewHelpModal from './HomebrewHelpModal'; // Importar o novo modal

const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'
];

interface Props {
    onContentCreated: () => void;
    onCancel: () => void;
}

const HomebrewCreator: React.FC<Props> = ({ onContentCreated, onCancel }) => {
    const [type, setType] = useState<HomebrewService.HomebrewContentType>('race');
    const [contentData, setContentData] = useState<any>(null);
    const [isPublic, setIsPublic] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false); // Estado para o modal de ajuda
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contentData || !contentData.name) {
             toast({
                variant: 'destructive',
                title: 'Dados Incompletos',
                description: 'Por favor, preencha pelo menos o nome do conteúdo.',
            });
            return;
        }

        setIsLoading(true);
        try {
            await HomebrewService.createHomebrewContent({ name: contentData.name, type, content: contentData, isPublic });
            toast({
                title: 'Conteúdo Criado!',
                description: `"${contentData.name}" foi adicionado à sua oficina.`,
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

    const renderFormForType = () => {
        switch (type) {
            case 'race': return <RaceForm onDataChange={setContentData} />;
            case 'class': return <ClassForm onDataChange={setContentData} />;
            case 'subclass': return <SubclassForm onDataChange={setContentData} />;
            case 'spell': return <SpellForm onDataChange={setContentData} />;
            case 'item': return <ItemForm onDataChange={setContentData} />;
            case 'monster': return <MonsterForm onDataChange={setContentData} />;
            case 'background': return <BackgroundForm onDataChange={setContentData} />;
            case 'feat': return <FeatForm onDataChange={setContentData} />;
            default:
                return <p className="text-stone-400 italic text-center py-8">Selecione um tipo de conteúdo para começar.</p>;
        }
    }

    return (
        <>
            <div className="bg-stone-800/50 p-4 sm:p-6 rounded-lg border border-stone-700 w-full max-w-4xl mx-auto flex flex-col animate-fadeIn max-h-[90vh]">
                <header className="mb-8 flex-shrink-0 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-amber-50 font-serif text-shadow-amber flex items-center justify-center gap-3">
                        Criador de Homebrew
                        <button onClick={() => setIsHelpModalOpen(true)} className="text-stone-400 hover:text-amber-300 transition-colors">
                            <Info className="h-6 w-6"/>
                        </button>
                    </h1>
                    <p className="text-stone-400 mt-2">Dê vida às suas ideias. Preencha os campos para criar seu conteúdo customizado.</p>
                </header>

                <form onSubmit={handleSubmit} className="bg-stone-900/50 p-6 rounded-lg border border-stone-700 flex flex-col flex-grow overflow-hidden">
                    <div className="overflow-y-auto pr-4 space-y-6 flex-grow">
                        <div>
                            <label htmlFor="homebrew-type" className="block text-sm font-medium text-stone-300 mb-1">Tipo de Conteúdo</label>
                            <select
                                id="homebrew-type"
                                value={type}
                                onChange={(e) => setType(e.target.value as HomebrewService.HomebrewContentType)}
                                className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                            >
                                {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{translateApiString(t)}</option>)}
                            </select>
                        </div>
                        
                        {renderFormForType()}
                    </div>
                    
                    <footer className="flex-shrink-0 mt-6 pt-6 border-t border-stone-700 space-y-4">
                        <div className="flex items-center justify-between bg-stone-800/60 p-3 rounded-md">
                            <label htmlFor="homebrew-public" className="flex flex-col cursor-pointer">
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

                        <div className="flex justify-between items-center">
                            <button type="button" onClick={onCancel} className="text-stone-300 hover:text-amber-300 underline flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4"/> Voltar
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || !contentData}
                                className="menu-button btn-new flex items-center justify-center gap-2 text-lg px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FlaskConical className="h-5 w-5"/>}
                                Salvar Criação
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
             <HomebrewHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
        </>
    );
};

export default HomebrewCreator;
