// src/components/system/ArchitectureHelpModal.tsx
'use client';

import React from 'react';
import ActionModal from '../ui/ActionModal';
import { GitMerge, Database, Server, Cloud, Bot, CheckCircle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const ArchitectureHelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
    return (
        <ActionModal
            isOpen={isOpen}
            title="Arquitetura de Dados: A Fonte da Verdade"
            onClose={onClose}
            actions={[{ text: "Entendi", onClick: onClose, variant: 'primary' }]}
        >
            <div className="space-y-4 text-stone-300 text-sm leading-relaxed">
                <div>
                    <h3 className="font-bold text-amber-300 text-lg mb-2 flex items-center gap-2">
                        <GitMerge className="h-5 w-5" /> O Conceito: Três Fontes, Um Universo
                    </h3>
                    <p>
                        Para garantir que seu jogo funcione de forma consistente, o aplicativo (frontend) **nunca** fala diretamente com a API externa de D&D 5e. Em vez disso, ele se comunica **apenas com o seu próprio backend**.
                    </p>
                    <p className="mt-2">
                        Seu backend age como um "orquestrador inteligente", buscando e unindo dados de três fontes distintas para criar a "fonte da verdade" do seu jogo antes de enviar uma resposta limpa e coesa.
                    </p>
                </div>
                
                <div className="space-y-6 pt-4 border-t border-stone-700">
                    <div className="flex items-start gap-4">
                        <div className="pt-1 text-blue-400"><Cloud className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-blue-300">Fonte 1: A API Oficial (dnd5eapi.co)</h4>
                            <p className="text-xs text-stone-400">
                                O conteúdo base do SRD (Documento de Referência do Sistema). Isso inclui todas as raças, classes, magias e itens padrão.
                            </p>
                        </div>
                    </div>

                     <div className="flex items-start gap-4">
                        <div className="pt-1 text-purple-400"><Database className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-purple-300">Fonte 2: Conteúdo Homebrew Instalado</h4>
                            <p className="text-xs text-stone-400">
                                Todo o conteúdo que você cria ou baixa da comunidade e decide "instalar" na sua conta. Ele sobrescreve ou adiciona ao conteúdo oficial.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="pt-1 text-teal-400"><Bot className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-teal-300">Fonte 3: Criações da IA (Sempre Ativas)</h4>
                            <p className="text-xs text-stone-400">
                                Itens mágicos, monstros únicos ou NPCs criados pelo Mestre de Jogo durante suas aventuras. **Este conteúdo é automaticamente considerado parte do seu mundo** e não precisa ser instalado. Ele é permanente para garantir a consistência da sua história.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 pt-4 border-t border-stone-700">
                        <div className="pt-1 text-green-400"><CheckCircle className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-green-300">O Resultado: Uma Fonte Única da Verdade</h4>
                            <p className="text-xs text-stone-400">
                                O backend mescla tudo, dando prioridade ao seu conteúdo instalado e às criações da IA sobre o conteúdo oficial. O frontend e a IA recebem uma lista final e consistente, criando um universo de jogo que evolui e é verdadeiramente seu.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </ActionModal>
    );
};

export default ArchitectureHelpModal;
