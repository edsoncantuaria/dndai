// src/components/Homebrew/FeatureCreator.tsx
'use client';
import React, { useState } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import ActionModal from '../ui/ActionModal';
import FeatureForm from './forms/FeatureForm';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onFeatureCreated: (newFeature: any) => void;
    classId: string;
}

const FeatureCreator: React.FC<Props> = ({ isOpen, onClose, onFeatureCreated, classId }) => {
    const [featureData, setFeatureData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!featureData || !featureData.name || !featureData.level) {
            toast({
                variant: 'destructive',
                title: 'Dados Incompletos',
                description: 'Por favor, preencha o nome, nível e descrição da característica.',
            });
            return;
        }

        // Em vez de salvar no DB, apenas passamos de volta para o formulário da classe/subclasse.
        // A característica será salva como parte do objeto da classe/subclasse.
        onFeatureCreated(featureData);
        toast({
            title: 'Característica Adicionada',
            description: `"${featureData.name}" foi adicionada. Salve a classe/subclasse para persistir.`,
        });
        handleClose();
    };
    
    const handleClose = () => {
        setFeatureData(null);
        onClose();
    }

    return (
        <ActionModal
            isOpen={isOpen}
            title="Criar Nova Característica"
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: "Adicionar Característica", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
            ]}
        >
            <div className="space-y-4">
                <FeatureForm onDataChange={setFeatureData} />
            </div>
        </ActionModal>
    );
};

export default FeatureCreator;
