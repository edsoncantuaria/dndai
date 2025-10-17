// src/components/Homebrew/ExampleModal.tsx
'use client';

import React from 'react';
import ActionModal from '../ui/ActionModal';
import { BookOpen } from 'lucide-react';
import { translateApiString } from '@/utils/translator';
import { HomebrewContentType } from '@/services/homebrewService';

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
            title={`Exemplo de Estrutura: ${translateApiString(contentType)}`}
            onClose={onClose}
            actions={[{ text: "Entendido", onClick: onClose, variant: 'primary' }]}
        >
            <div className="space-y-4 text-stone-300 text-sm leading-relaxed">
                <p>
                    Abaixo está um exemplo da estrutura JSON para um(a) <strong className="text-amber-300">{translateApiString(contentType)}</strong>.
                    Seu conteúdo deve seguir este formato para ser corretamente interpretado pela IA e pelo sistema de jogo.
                </p>
                <div className="bg-stone-950/70 p-4 rounded-md border border-stone-700 max-h-96 overflow-y-auto">
                    <pre className="text-xs text-cyan-300 whitespace-pre-wrap break-words">
                        {JSON.stringify(exampleData, null, 2)}
                    </pre>
                </div>
                <p className="text-xs text-stone-500 italic">
                    Esta estrutura é baseada na API de D&D 5e e pode ser consultada no arquivo `openapi.yaml` do projeto.
                </p>
            </div>
        </ActionModal>
    );
};

export default ExampleModal;
