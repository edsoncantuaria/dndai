// src/components/Homebrew/ActionCreator.tsx
'use client';
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import ActionModal from '../ui/ActionModal';
import ActionForm from './forms/ActionForm';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onActionCreated: (newAction: any) => void;
}

const ActionCreator: React.FC<Props> = ({ isOpen, onClose, onActionCreated }) => {
    const [actionData, setActionData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!actionData || !actionData.name) {
            toast({
                variant: 'destructive',
                title: 'Nome Obrigatório',
                description: 'A ação precisa de um nome.',
            });
            return;
        }

        // Em uma implementação real, isso poderia salvar no DB.
        // Aqui, apenas passamos de volta para o MonsterForm.
        onActionCreated(actionData);
        toast({
            title: 'Ação Adicionada',
            description: `"${actionData.name}" foi adicionada ao monstro.`,
        });
        handleClose();
    };
    
    const handleClose = () => {
        setActionData(null);
        onClose();
    }

    return (
        <ActionModal
            isOpen={isOpen}
            title="Criar Nova Ação de Monstro"
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: "Salvar Ação", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
            ]}
        >
            <div className="space-y-4">
                <ActionForm onDataChange={setActionData} />
            </div>
        </ActionModal>
    );
};

export default ActionCreator;
