// src/components/system/ArchitectureHelpModal.tsx
'use client';

import React from 'react';
import ActionModal from '../ui/ActionModal';
import { GitMerge, Database, Server, Cloud, Bot, CheckCircle, Cpu, FileText, Gamepad2, List } from 'lucide-react';

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
                        <GitMerge className="h-5 w-5" /> O Backend como Orquestrador Mestre
                    </h3>
                    <p>
                        Para criar uma experiência de jogo consistente e expansível, o aplicativo (frontend) **nunca** fala diretamente com fontes de dados externas. Ele se comunica **apenas com o seu próprio backend**.
                    </p>
                    <p className="mt-2">
                        Seu backend age como um "Orquestrador Inteligente", que busca, combina e traduz informações de três fontes distintas para criar a **fonte da verdade única** do seu jogo em tempo real.
                    </p>
                </div>
                
                <div className="space-y-6 pt-4 border-t border-stone-700">
                    <h3 className="font-bold text-amber-300 text-lg mb-2">As Três Fontes da Verdade</h3>
                    
                    <div className="flex items-start gap-4">
                        <div className="pt-1 text-blue-400"><Cloud className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-blue-300">1. Conteúdo Oficial (API dnd5eapi.co)</h4>
                            <p className="text-xs text-stone-400">
                                A base de tudo. O conteúdo padrão do SRD (raças, classes, magias, monstros, etc.) serve como alicerce do nosso mundo.
                            </p>
                        </div>
                    </div>

                     <div className="flex items-start gap-4">
                        <div className="pt-1 text-purple-400"><Database className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-purple-300">2. Conteúdo Homebrew (Seu Banco de Dados)</h4>
                            <p className="text-xs text-stone-400">
                                Sua criatividade em ação. Todo o conteúdo que você cria ou baixa da comunidade e decide "instalar" na sua conta. Ele tem o poder de sobrescrever as regras e itens oficiais.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="pt-1 text-teal-400"><Bot className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-teal-300">3. Criações da IA (Sessão de Jogo)</h4>
                            <p className="text-xs text-stone-400">
                                Itens mágicos, monstros únicos ou NPCs criados pelo Mestre de Jogo durante a aventura. Este conteúdo é **automaticamente salvo e vinculado à sua sessão**, garantindo a consistência da sua história.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 pt-4 border-t border-stone-700">
                     <h3 className="font-bold text-amber-300 text-lg mb-2">A Harmonia em Ação: Dois Cenários</h3>

                     <div className="flex items-start gap-4 p-4 bg-stone-800/50 rounded-lg">
                        <div className="pt-1 text-green-400"><List className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-green-300">Cenário 1: Exibindo uma Lista (Ex: Criador de Personagem)</h4>
                            <p className="text-xs text-stone-400">
                                Quando você abre a lista de raças, o Orquestrador busca nas 3 fontes, mescla tudo (dando prioridade ao seu conteúdo homebrew instalado) e envia uma **lista única e finalizada** para a interface. O frontend não precisa se preocupar com a origem dos dados.
                            </p>
                        </div>
                    </div>
                    
                     <div className="flex items-start gap-4 p-4 bg-stone-800/50 rounded-lg">
                        <div className="pt-1 text-cyan-400"><Cpu className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-cyan-300">Cenário 2: Narração da IA (A Otimização Inteligente)</h4>
                            <p className="text-xs text-stone-400">
                                Enviar todo o JSON do seu conteúdo homebrew para a IA a cada turno seria lento e caro. Em vez disso, o Orquestrador **traduz suas criações para linguagem natural**. Ele envia um resumo conciso para a IA, como: <br/>
                                <span className="font-mono text-teal-300/80 text-[10px]">'[Magia Homebrew]: Lança de Gelo (Nível 2): Causa 3d8 de dano de frio.'</span><br/>
                                A IA entende a regra sem precisar processar o JSON complexo, tornando o jogo rápido e eficiente.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </ActionModal>
    );
};

export default ArchitectureHelpModal;
