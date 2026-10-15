// src/components/Homebrew/ExampleModal.tsx
'use client';

import React from 'react';
import ActionModal from '../ui/ActionModal';
import { BookOpen } from 'lucide-react';
import { HomebrewContentType } from '@/services/homebrewService';
import ExampleViewer from './ExampleViewer'; // Importa o novo componente

interface Props {
    isOpen: boolean;
    onClose: () => void;
    contentType: HomebrewContentType;
    exampleData: any;
}

const ExampleModal: React.FC<Props> = ({ isOpen, onClose, contentType, exampleData }) => {
    return (
        <ActionModal
            isOpen={isOpen}
            title={`Exemplo de Estrutura: ${contentType}`}
            onClose={onClose}
            actions={[{ text: "Entendido", onClick: onClose, variant: 'primary' }]}
        >
            <div className="space-y-4 text-stone-300 text-sm leading-relaxed">
                <p>
                    Abaixo está um exemplo de como os dados de um(a) <strong className="text-amber-300">{contentType}</strong> são estruturados. Use isso como guia para preencher os campos.
                </p>
                {/* Substitui o <pre> pelo novo componente ExampleViewer */}
                <div className="bg-stone-950/70 p-4 rounded-md border border-stone-700 max-h-[60vh] overflow-y-auto">
                   <ExampleViewer contentType={contentType} data={exampleData} />
                </div>
                <p className="text-xs text-stone-500 italic">
                    Esta estrutura é baseada na API de D&D 5e e pode ser consultada no arquivo openapi.yaml do projeto.
                </p>
            </div>
        </ActionModal>
    );
};

export default ExampleModal;
