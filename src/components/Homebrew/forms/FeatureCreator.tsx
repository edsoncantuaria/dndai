// src/components/Homebrew/forms/FeatureCreator.tsx
'use client';
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import ActionModal from '../../ui/ActionModal';
import FeatureForm from './FeatureForm';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onFeatureCreated: (newFeature: any) => void;
    classId: string;
    initialData?: any;
}

const FeatureCreator: React.FC<Props> = ({ isOpen, onClose, onFeatureCreated, classId, initialData }) => {
    const [featureData, setFeatureData] = useState<any>(initialData || null);
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

        onFeatureCreated(featureData);
        toast({
            title: initialData ? 'Característica Atualizada' : 'Característica Adicionada',
            description: `"${featureData.name}" foi salva. Salve a classe/subclasse para persistir.`,
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
            title={initialData ? "Editar Característica" : "Criar Nova Característica"}
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: initialData ? "Atualizar" : "Adicionar", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
            ]}
        >
            <div className="space-y-4">
                <FeatureForm onDataChange={setFeatureData} initialData={initialData} />
            </div>
        </ActionModal>
    );
};

export default FeatureCreator;
