// src/components/Homebrew/TraitCreator.tsx
'use client';
import React, { useState } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import ActionModal from '../ui/ActionModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onTraitCreated: (newTrait: any) => void;
}

const TraitCreator: React.FC<Props> = ({ isOpen, onClose, onTraitCreated }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!name || !description) {
            toast({
                variant: 'destructive',
                title: 'Campos Obrigatórios',
                description: 'Por favor, preencha o nome e a descrição do traço.',
            });
            return;
        }

        setIsLoading(true);
        try {
            const content = {
                index: name.toLowerCase().replace(/\s+/g, '-'),
                name: name,
                desc: [description],
                races: [], 
                subraces: [],
                proficiencies: []
            };

            const data: HomebrewService.CreateHomebrewData = {
                name: name,
                type: 'feat',
                content: content,
                isPublic: false,
            };

            const response = await HomebrewService.createHomebrewContent(data);
            
            toast({
                title: 'Traço Criado!',
                description: `"${name}" foi salvo com sucesso.`,
            });
            
            onTraitCreated(response);
            handleClose();

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Falha ao Criar',
                description: error.message || 'Ocorreu um erro ao salvar seu traço.',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleClose = () => {
        setName('');
        setDescription('');
        onClose();
    }

    return (
        <ActionModal
            isOpen={isOpen}
            title="Criar Nova Característica (Traço Racial)"
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: "Salvar Traço", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
            ]}
        >
            <div className="space-y-4">
                 <div>
                    <label htmlFor="trait-name" className="block text-sm font-medium text-stone-300 mb-1">Nome do Traço</label>
                    <input 
                        id="trait-name" 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Visão no Escuro Superior"
                        required 
                        className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500" 
                    />
                </div>
                 <div>
                    <label htmlFor="trait-desc" className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                    <textarea
                        id="trait-desc"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={5}
                        placeholder="Descreva o que este traço faz, mecanicamente e em termos de história."
                        required
                        className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                    />
                </div>
            </div>
        </ActionModal>
    );
};

export default TraitCreator;
