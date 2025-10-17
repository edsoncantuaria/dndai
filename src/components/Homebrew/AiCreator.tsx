// src/components/Homebrew/AiCreator.tsx
'use client';
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand } from 'lucide-react';
import ActionModal from '../ui/ActionModal';
import { createHomebrewContent } from '@/services/aiService'; // Atualizado para o novo serviço de API
import { HomebrewContentType } from '@/services/homebrewService';
import { translateApiString } from '@/utils/translator';
import { useSettingsContext } from '@/contexts/SettingsContext';

const CONTENT_TYPES: HomebrewContentType[] = [
    'race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'
];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onContentGenerated: (content: any, type: HomebrewContentType) => void;
}

const AiCreator: React.FC<Props> = ({ isOpen, onClose, onContentGenerated }) => {
    const [prompt, setPrompt] = useState('');
    const [type, setType] = useState<HomebrewContentType>('item');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { getApiKey } = useSettingsContext();

    const handleSubmit = async () => {
        if (!prompt.trim()) {
            toast({ variant: 'destructive', title: 'Prompt Obrigatório', description: 'Por favor, descreva o que você quer criar.' });
            return;
        }

        setIsLoading(true);
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error('Chave de API não encontrada nas configurações.');
            }
            // Chama o novo serviço que aponta para o backend
            const result = await createHomebrewContent({ prompt, type, apiKey });

            if (result && result.content) {
                onContentGenerated(result.content, type);
                toast({ title: 'Conteúdo Gerado!', description: 'O formulário foi preenchido com a sugestão da IA. Revise e salve.' });
                onClose();
            } else {
                throw new Error('A IA não conseguiu gerar o conteúdo.');
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na Geração', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ActionModal
            isOpen={isOpen}
            title="Gerar Conteúdo com IA"
            onClose={onClose}
            actions={[
                { text: "Cancelar", onClick: onClose, variant: 'secondary' },
                { text: "Gerar", onClick: handleSubmit, variant: 'primary', disabled: isLoading, icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Wand className="h-4 w-4"/> }
            ]}
        >
            <div className="space-y-4">
                 <div>
                    <label htmlFor="content-type" className="block text-sm font-medium text-stone-300 mb-1">Tipo de Conteúdo</label>
                    <select id="content-type" value={type} onChange={e => setType(e.target.value as HomebrewContentType)} className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200">
                         {CONTENT_TYPES.map(t => <option key={t} value={t}>{translateApiString(t)}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="ai-prompt" className="block text-sm font-medium text-stone-300 mb-1">Sua Ideia</label>
                    <textarea 
                        id="ai-prompt" 
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        rows={4}
                        placeholder={`Descreva sua ideia em linguagem natural. Ex:\n"Uma espada longa que causa 1d6 de dano de fogo extra."\n"Uma raça de seres feitos de pedra, fortes e lentos."\n"Uma magia que cria uma pequena chuva de meteoros."`}
                        className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                    />
                </div>
                <p className="text-xs text-stone-500 italic">
                    A IA tentará criar um objeto JSON completo baseado no seu pedido. Você poderá revisar e editar o resultado antes de salvar.
                </p>
            </div>
        </ActionModal>
    );
};

export default AiCreator;
