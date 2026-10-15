// src/components/Homebrew/forms/ActionCreator.tsx
'use client';
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import ActionModal from '../../ui/ActionModal';
import ActionForm from './ActionForm';
import { hb, hbChipClass, hbTileClass } from '@/features/homebrew/forms/formUi';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onActionCreated: (newAction: any) => void;
    initialData?: any;
}

const ActionCreator: React.FC<Props> = ({ isOpen, onClose, onActionCreated, initialData }) => {
    const [actionData, setActionData] = useState<any>(initialData || null);
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

        onActionCreated(actionData);
        toast({
            title: initialData ? 'Ação Atualizada' : 'Ação Adicionada',
            description: `"${actionData.name}" foi salva.`,
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
            title={initialData ? "Editar Ação" : "Criar Nova Ação"}
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: initialData ? "Atualizar Ação" : "Salvar Ação", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
            ]}
        >
            <div className={hb.root}>
                <ActionForm onDataChange={setActionData} initialData={initialData} />
            </div>
        </ActionModal>
    );
};

export default ActionCreator;
