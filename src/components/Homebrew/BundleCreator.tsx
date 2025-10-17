// src/components/Homebrew/BundleCreator.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import type { HomebrewContent, HomebrewBundle } from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import ActionModal from '../ui/ActionModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onBundleCreated: () => void;
    bundleToEdit?: HomebrewBundle | null;
}

const BundleCreator: React.FC<Props> = ({ isOpen, onClose, onBundleCreated, bundleToEdit }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [availableContent, setAvailableContent] = useState<HomebrewContent[]>([]);
    const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (bundleToEdit) {
            setName(bundleToEdit.name);
            setDescription(bundleToEdit.description);
            setIsPublic(bundleToEdit.isPublic);
            setSelectedContentIds(new Set(bundleToEdit.contents.map(c => c.id)));
        }
    }, [bundleToEdit]);

    const fetchUnbundledContent = useCallback(async () => {
        setIsLoading(true);
        try {
            const myContent = await HomebrewService.listHomebrewContent('mine');
            // Se estiver editando, inclua os itens do próprio bundle na lista de disponíveis.
            const contentForThisBundle = bundleToEdit ? bundleToEdit.contents : [];
            const available = myContent.filter(c => !c.bundleId || c.bundleId === bundleToEdit?.id);

            const combined = Array.from(new Map([...available, ...contentForThisBundle].map(item => [item.id, item])).values());
            setAvailableContent(combined);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao buscar conteúdo', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast, bundleToEdit]);

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
            toast({ variant: 'destructive', title: 'Campos Obrigatórios', description: 'Preencha o nome e a descrição do pacote.' });
            return;
        }

        setIsLoading(true);
        try {
            const bundleData = {
                name,
                description,
                isPublic,
                contentIds: Array.from(selectedContentIds)
            };

            if (bundleToEdit) {
                await HomebrewService.updateHomebrewBundle(bundleToEdit.id, bundleData);
                toast({ title: 'Pacote Atualizado!', description: `"${name}" foi salvo com sucesso.` });
            } else {
                await HomebrewService.createHomebrewBundle(bundleData);
                toast({ title: 'Pacote Criado!', description: `O pacote "${name}" foi criado com sucesso.` });
            }
            
            onBundleCreated();
            handleClose();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Falha na Operação', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleClose = () => {
        setName('');
        setDescription('');
        setIsPublic(false);
        setSelectedContentIds(new Set());
        onClose();
    };

    return (
        <ActionModal
            isOpen={isOpen}
            title={bundleToEdit ? "Editar Pacote" : "Criar Novo Pacote"}
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: bundleToEdit ? "Salvar Alterações" : "Salvar Pacote", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
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
                <div className="flex items-center justify-between bg-stone-800/60 p-3 rounded-md">
                    <label htmlFor="bundle-public" className="flex flex-col cursor-pointer">
                        <span className="text-stone-200 font-semibold">Tornar Público?</span>
                        <span className="text-xs text-stone-400">Permitir que outros jogadores instalem seu pacote.</span>
                    </label>
                    <button
                        type="button"
                        id="bundle-public"
                        onClick={() => setIsPublic(p => !p)}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 ${isPublic ? 'bg-amber-600' : 'bg-stone-600'}`}
                    >
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>
        </ActionModal>
    );
};

export default BundleCreator;
