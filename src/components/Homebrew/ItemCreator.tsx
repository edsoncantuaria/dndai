// src/components/Homebrew/ItemCreator.tsx
'use client';
import React, { useState } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import ActionModal from '../ui/ActionModal';
import ItemForm from './forms/ItemForm';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onItemCreated: (newItem: any) => void;
}

const ItemCreator: React.FC<Props> = ({ isOpen, onClose, onItemCreated }) => {
    const [itemData, setItemData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!itemData || !itemData.name) {
            toast({
                variant: 'destructive',
                title: 'Nome Obrigatório',
                description: 'Por favor, forneça um nome para o item.',
            });
            return;
        }

        setIsLoading(true);
        try {
            const data: HomebrewService.CreateHomebrewData = {
                name: itemData.name,
                type: 'item',
                content: itemData,
                isPublic: false,
            };

            const response = await HomebrewService.createHomebrewContent(data);
            
            toast({
                title: 'Item Criado!',
                description: `"${itemData.name}" foi salvo com sucesso.`,
            });
            
            onItemCreated(response.content);
            handleClose();

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Falha ao Criar',
                description: error.message || 'Ocorreu um erro ao salvar seu item.',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleClose = () => {
        setItemData(null);
        onClose();
    }

    return (
        <ActionModal
            isOpen={isOpen}
            title="Criar Novo Item"
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: "Salvar Item", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
            ]}
        >
            <div className="space-y-4">
                <ItemForm onDataChange={setItemData} />
            </div>
        </ActionModal>
    );
};

export default ItemCreator;
