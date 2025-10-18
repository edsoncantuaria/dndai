// src/components/Homebrew/HomebrewCreator.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FlaskConical, Loader2, Info, BookOpen } from 'lucide-react';
import RaceForm from './forms/RaceForm';
import ClassForm from './forms/ClassForm';
import SubclassForm from './forms/SubclassForm';
import SpellForm from './forms/SpellForm';
import ItemForm from './forms/ItemForm';
import MonsterForm from './forms/MonsterForm';
import BackgroundForm from './forms/BackgroundForm';
import FeatForm from './forms/FeatForm';
import SkillForm from './forms/SkillForm'; // Importar SkillForm
import HomebrewHelpModal from './HomebrewHelpModal';
import SubraceForm from './forms/SubraceForm'; 
import ExampleModal from './ExampleModal';
import { EXAMPLES } from '@/data/examples';

const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat', 'skill'
];

interface Props {
    onContentCreated: () => void;
    onCancel: () => void;
    contentToEdit?: HomebrewService.HomebrewContent | null;
}

const HomebrewCreator: React.FC<Props> = ({ onContentCreated, onCancel, contentToEdit }) => {
    const [type, setType] = useState<HomebrewService.HomebrewContentType>(contentToEdit?.type || 'race');
    const [contentData, setContentData] = useState<any>(contentToEdit?.content || {});
    const [isPublic, setIsPublic] = useState(contentToEdit?.isPublic || false);
    const [isLoading, setIsLoading] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);
    const [exampleToLoad, setExampleToLoad] = useState<any | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (contentToEdit) {
            setType(contentToEdit.type);
            setContentData(contentToEdit.content);
            setIsPublic(contentToEdit.isPublic);
        }
    }, [contentToEdit]);

    const handleLoadExample = () => {
        const exampleData = EXAMPLES[type];
        if(exampleData) {
            setExampleToLoad(exampleData);
             toast({
                title: 'Exemplo Carregado',
                description: `O formulário foi preenchido com dados de exemplo para "${type}".`,
            });
        }
    };
    
    useEffect(() => {
        if (contentData.name && !contentData.index) {
             setContentData((prev: any) => ({
                ...prev,
                index: prev.official_index || prev.name.toLowerCase().replace(/\s+/g, '-')
            }));
        }
    }, [contentData.name, contentData.index, contentData.official_index]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const finalContentData = {
            ...contentData,
            index: contentData.official_index || contentData.index || contentData.name.toLowerCase().replace(/\s+/g, '-')
        };

        if (!finalContentData.name) {
             toast({
                variant: 'destructive',
                title: 'Dados Incompletos',
                description: 'Por favor, preencha pelo menos o nome do conteúdo.',
            });
            return;
        }

        setIsLoading(true);
        try {
            if (!contentToEdit) {
                const { exists } = await HomebrewService.checkNameExists(finalContentData.name, type);
                if (exists && !finalContentData.official_index) { // Não bloqueia se for uma tradução/override de admin
                    toast({
                        variant: 'destructive',
                        title: 'Nome Duplicado',
                        description: `Um conteúdo do tipo '${type}' com um nome ou índice similar já existe. Por favor, escolha outro nome.`,
                    });
                    setIsLoading(false);
                    return;
                }
            }
            
            const dataToSave: HomebrewService.CreateHomebrewData = {
                name: finalContentData.name,
                type,
                content: finalContentData,
                isPublic,
                dependencies: finalContentData.dependencies || [],
            };
            
            if (contentToEdit) {
                await HomebrewService.updateHomebrewContent(contentToEdit.id, dataToSave);
                 toast({
                    title: 'Conteúdo Atualizado!',
                    description: `"${finalContentData.name}" foi salvo com sucesso.`,
                });
            } else {
                await HomebrewService.createHomebrewContent(dataToSave);
                toast({
                    title: 'Conteúdo Criado!',
                    description: `"${finalContentData.name}" foi adicionado à sua oficina.`,
                });
            }
            onContentCreated();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: contentToEdit ? 'Falha ao Atualizar' : 'Falha ao Criar',
                description: error.message || 'Ocorreu um erro ao salvar seu conteúdo.',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const initialDataForForm = useMemo(() => {
        if (exampleToLoad) return exampleToLoad;
        if (contentToEdit?.type === type) return contentToEdit.content;
        return {};
    }, [exampleToLoad, contentToEdit, type]);


    const renderFormForType = () => {
        switch (type) {
            case 'race': return <RaceForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'subrace': return <SubraceForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'class': return <ClassForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'subclass': return <SubclassForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'spell': return <SpellForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'item': return <ItemForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'monster': return <MonsterForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'background': return <BackgroundForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'feat': return <FeatForm onDataChange={setContentData} initialData={initialDataForForm} />;
            case 'skill': return <SkillForm onDataChange={setContentData} initialData={initialDataForForm} />;
            default:
                return <p className="text-stone-400 italic text-center py-8">Selecione um tipo de conteúdo para começar.</p>;
        }
    }

    return (
        <>
            <div className="bg-stone-800/50 p-4 sm:p-6 rounded-lg border border-stone-700 w-full max-w-4xl mx-auto flex flex-col animate-fadeIn max-h-[90vh]">
                <header className="mb-8 flex-shrink-0 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-amber-50 font-serif text-shadow-amber flex items-center justify-center gap-3">
                        {contentToEdit ? 'Editando Conteúdo' : 'Criador de Homebrew'}
                        <button onClick={() => setIsHelpModalOpen(true)} className="text-stone-400 hover:text-amber-300 transition-colors">
                            <Info className="h-6 w-6"/>
                        </button>
                    </h1>
                    <p className="text-stone-400 mt-2">Dê vida às suas ideias. Preencha os campos para criar seu conteúdo customizado.</p>
                </header>

                <form onSubmit={handleSubmit} className="bg-stone-900/50 p-6 rounded-lg border border-stone-700 flex flex-col flex-grow overflow-hidden">
                    <div className="overflow-y-auto pr-4 space-y-6 flex-grow">
                        <div className="flex items-end gap-2">
                            <div className="flex-grow">
                                <label htmlFor="homebrew-type" className="block text-sm font-medium text-stone-300 mb-1">Tipo de Conteúdo</label>
                                <select
                                    id="homebrew-type"
                                    value={type}
                                    onChange={(e) => {
                                        const newType = e.target.value as HomebrewService.HomebrewContentType;
                                        setType(newType);
                                        if (!contentToEdit || contentToEdit.type !== newType) {
                                            setContentData({});
                                            setExampleToLoad(null);
                                        }
                                    }}
                                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                                    disabled={!!contentToEdit}
                                >
                                    {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                                </select>
                            </div>
                            <button 
                                type="button" 
                                onClick={handleLoadExample}
                                className="flex-shrink-0 px-3 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-md flex items-center gap-2"
                                title="Carregar Exemplo no Formulário"
                            >
                                <BookOpen className="h-4 w-4" />
                                <span className="hidden sm:inline">Carregar Exemplo</span>
                            </button>
                             <button 
                                type="button" 
                                onClick={() => setIsExampleModalOpen(true)}
                                className="flex-shrink-0 px-3 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-md flex items-center gap-2"
                                title="Ver Exemplo de Estrutura"
                            >
                                <Info className="h-4 w-4" />
                                <span className="hidden sm:inline">Info</span>
                            </button>
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
                                disabled={isLoading || !contentData.name}
                                className="menu-button btn-new flex items-center justify-center gap-2 text-lg px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FlaskConical className="h-5 w-5"/>}
                                {contentToEdit ? 'Atualizar Criação' : 'Salvar Criação'}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
             <HomebrewHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
             {isExampleModalOpen && (
                <ExampleModal 
                    isOpen={isExampleModalOpen}
                    onClose={() => setIsExampleModalOpen(false)}
                    contentType={type}
                    exampleData={EXAMPLES[type]}
                />
             )}
        </>
    );
};

export default HomebrewCreator;
