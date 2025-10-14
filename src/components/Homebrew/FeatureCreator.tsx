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
    classId: string; // Para associar a característica à classe correta
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

        setIsLoading(true);
        try {
            const data: HomebrewService.CreateHomebrewData = {
                name: featureData.name,
                type: 'feat',
                content: {
                    ...featureData,
                    class: { index: classId, name: classId, url: '' } // Link to parent class
                },
                isPublic: false,
            };

            const response = await HomebrewService.createHomebrewContent(data);
            
            toast({
                title: 'Característica Criada!',
                description: `"${featureData.name}" foi salva com sucesso.`,
            });
            
            onFeatureCreated(response.content);
            handleClose();

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Falha ao Criar',
                description: error.message || 'Ocorreu um erro ao salvar sua característica.',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleClose = () => {
        setFeatureData(null);
        onClose();
    }

    return (
        <ActionModal
            isOpen={isOpen}
            title="Criar Nova Característica de Classe"
            onClose={handleClose}
            actions={[
                { text: "Cancelar", onClick: handleClose, variant: 'secondary' },
                { text: "Salvar Característica", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/> }
            ]}
        >
            <div className="space-y-4">
                <FeatureForm onDataChange={setFeatureData} />
            </div>
        </ActionModal>
    );
};

export default FeatureCreator;
