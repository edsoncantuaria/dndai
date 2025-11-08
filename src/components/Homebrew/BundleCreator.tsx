// src/components/Homebrew/BundleCreator.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import type { HomebrewContent, HomebrewBundle } from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Search, PackagePlus, Users, Shield, Layers } from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');
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

    const filteredContent = availableContent.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <ActionModal
            isOpen={isOpen}
            title={bundleToEdit ? 'Editar Pacote' : 'Criar Coleção Premium'}
            onClose={handleClose}
            actions={[
                { text: 'Cancelar', onClick: handleClose, variant: 'secondary' },
                {
                    text: bundleToEdit ? 'Salvar alterações' : 'Publicar pacote',
                    onClick: handleSubmit,
                    variant: 'primary',
                    disabled: isLoading,
                    icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />,
                },
            ]}
        >
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-inner shadow-black/40">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-400/70">
                            <PackagePlus className="h-4 w-4" /> Informações básicas
                        </div>
                        <div className="mt-3 space-y-3">
                            <div>
                                <label htmlFor="bundle-name" className="text-sm font-semibold text-stone-200">
                                    Nome do pacote
                                </label>
                                <input
                                    id="bundle-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ex: Arsenal Elemental"
                                    className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-stone-100 placeholder:text-stone-600 focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="bundle-description" className="text-sm font-semibold text-stone-200">
                                    Descrição
                                </label>
                                <textarea
                                    id="bundle-description"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Resuma a proposta da coleção."
                                    className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-stone-100 placeholder:text-stone-600 focus:border-amber-500"
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-2xl border border-stone-800 bg-stone-900/50 p-3">
                                <div>
                                    <p className="text-sm font-semibold text-stone-200">Compartilhar com a comunidade?</p>
                                    <p className="text-xs text-stone-500">Pacotes públicos aparecem para todos.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsPublic((prev) => !prev)}
                                    className={`flex h-7 w-12 items-center rounded-full p-1 transition ${isPublic ? 'bg-emerald-500/70' : 'bg-stone-600'}`}
                                >
                                    <span className={`h-5 w-5 rounded-full bg-white shadow ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-inner shadow-black/40">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-400/70">
                            <Users className="h-4 w-4" /> Resumo rápido
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-stone-300">
                            <li className="flex items-center justify-between rounded-xl border border-white/5 bg-stone-900/50 px-3 py-2">
                                <span>Total selecionado</span>
                                <span className="font-semibold text-amber-200">{selectedContentIds.size}</span>
                            </li>
                            <li className="flex items-center justify-between rounded-xl border border-white/5 bg-stone-900/50 px-3 py-2">
                                <span>Disponíveis</span>
                                <span className="font-semibold text-stone-200">{availableContent.length}</span>
                            </li>
                            <li className="flex items-center justify-between rounded-xl border border-white/5 bg-stone-900/50 px-3 py-2">
                                <span>Status</span>
                                <span className={`font-semibold ${isPublic ? 'text-emerald-300' : 'text-stone-400'}`}>
                                    {isPublic ? 'Público' : 'Privado'}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-inner shadow-black/40">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-400/70">
                            <Layers className="h-4 w-4" /> Selecione os itens ({selectedContentIds.size})
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar pelas suas criações..."
                                className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-stone-500 focus:border-amber-400/60"
                            />
                        </div>
                    </div>

                    <div className="mt-3 max-h-64 overflow-y-auto space-y-1 rounded-2xl border border-stone-800 bg-stone-950/60 p-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10 text-stone-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : filteredContent.length ? (
                            filteredContent.map((item) => {
                                const isSelected = selectedContentIds.has(item.id);
                                return (
                                    <label
                                        key={item.id}
                                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                                            isSelected ? 'border-amber-400/50 bg-amber-400/10 text-amber-50' : 'border-white/5 bg-white/5 text-stone-300 hover:border-amber-200/40 hover:text-amber-100'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-semibold">{item.name}</p>
                                            <p className="text-xs text-stone-400">{item.type}</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelection(item.id)}
                                            className="h-4 w-4 rounded border border-stone-500 bg-stone-800 text-amber-400 focus:ring-amber-500"
                                        />
                                    </label>
                                );
                            })
                        ) : (
                            <p className="py-8 text-center text-sm text-stone-500">Nenhuma criação disponível para este filtro.</p>
                        )}
                    </div>
                </div>
            </div>
        </ActionModal>
    );
};

export default BundleCreator;
