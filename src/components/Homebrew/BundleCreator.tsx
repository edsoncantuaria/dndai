// src/components/Homebrew/BundleCreator.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import type { HomebrewContent } from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, PackagePlus } from 'lucide-react';
import ActionModal from '../ui/ActionModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onBundleCreated: () => void;
}

const BundleCreator: React.FC<Props> = ({ isOpen, onClose, onBundleCreated }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [availableContent, setAvailableContent] = useState<HomebrewContent[]>([]);
    const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const fetchUnbundledContent = useCallback(async () => {
        setIsLoading(true);
        try {
            // No backend, essa lógica seria mais eficiente.
            // Aqui, pegamos todo o conteúdo "meu" e filtramos os que já estão em algum pacote.
            const myContent = await HomebrewService.listHomebrewContent('mine');
            const bundles = await HomebrewService.listHomebrewBundles();
            const bundledContentIds = new Set(bundles.flatMap(b => b.contents.map(c => c.id)));
            
            setAvailableContent(myContent.filter(c => !bundledContentIds.has(c.id)));

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao buscar conteúdo',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (isOpen) {
            fetchUnbundledContent();
        }
    }, [isOpen, fetchUnbundledContent]);
    
    const handleToggleSelection = (contentId: string) => {
        setSelectedContentIds(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(contentId)) {
                newSelection.delete(contentId);
            } else {
                newSelection.add(contentId);
            }
            return newSelection;
        });
    };

    const handleSubmit = async () => {
        if (!name.trim() || !description.trim()) {
            toast({
                variant: 'destructive',
                title: 'Campos Obrigatórios',
                description: 'Por favor, preencha o nome e a descrição do pacote.',
            });
            return;
        }
        if (selectedContentIds.size === 0) {
            toast({
                variant: 'destructive',
                title: 'Nenhum Conteúdo Selecionado',
                description: 'Você precisa selecionar pelo menos um item para criar um pacote.',
            });
            return;
        }

        setIsLoading(true);
        try {
            await HomebrewService.createHomebrewBundle({
                name,
                description,
                contentIds: Array.from(selectedContentIds)
            });
            toast({
                title: 'Pacote Criado!',
                description: `O pacote "${name}" foi criado com sucesso.`,
            });
            onBundleCreated();
            handleClose();
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Falha ao Criar Pacote',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleClose = () => {
        setName('');
        setDescription('');
        setSelectedContentIds(new Set());
        onClose();
    }

    return (
        <ActionModal
            isOpen={isOpen}
            title="Criar Novo Pacote de Conteúdo"
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: "Salvar Pacote", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
            ]}
        >
            <div className="space-y-4">
                <div>
                    <label htmlFor="bundle-name" className="block text-sm font-medium text-stone-300 mb-1">Nome do Pacote</label>
                    <input id="bundle-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200" placeholder="Ex: Pacote de Magias de Gelo"/>
                </div>
                <div>
                    <label htmlFor="bundle-description" className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                    <textarea id="bundle-description" value={description} onChange={e => setDescription(e.target.value)} required rows={2} className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200" placeholder="Descreva o que este pacote contém."/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Selecione o Conteúdo ({selectedContentIds.size})</label>
                    <div className="max-h-60 overflow-y-auto bg-stone-900/50 p-2 rounded-md border border-stone-700 space-y-1">
                        {isLoading ? <Loader2 className="animate-spin mx-auto text-stone-400" /> : availableContent.length > 0 ? availableContent.map(item => {
                            const isSelected = selectedContentIds.has(item.id);
                            return (
                                 <label key={item.id} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-amber-900/40' : 'hover:bg-stone-800'}`}>
                                    <input type="checkbox" checked={isSelected} onChange={() => handleToggleSelection(item.id)} className="form-checkbox h-4 w-4 text-amber-500 bg-stone-700 border-stone-600 rounded focus:ring-amber-500" />
                                    <span className="text-sm text-stone-300">{item.name}</span>
                                </label>
                            );
                        }) : (
                            <p className="text-center text-sm text-stone-500 italic p-4">Você não tem criações que não estejam em um pacote.</p>
                        )}
                    </div>
                </div>
            </div>
        </ActionModal>
    );
};

export default BundleCreator;
