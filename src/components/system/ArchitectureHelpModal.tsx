// src/components/system/ArchitectureHelpModal.tsx
'use client';

import React from 'react';
import ActionModal from '../ui/ActionModal';
import { GitMerge, Database, Server, Cloud, User, CheckCircle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const ArchitectureHelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
    return (
        <ActionModal
            isOpen={isOpen}
            title="Arquitetura de Dados: Oficial + Homebrew"
            onClose={onClose}
            actions={[{ text: "Entendi", onClick: onClose, variant: 'primary' }]}
        >
            <div className="space-y-4 text-stone-300 text-sm leading-relaxed">
                <div>
                    <h3 className="font-bold text-amber-300 text-lg mb-2 flex items-center gap-2">
                        <GitMerge className="h-5 w-5" /> O Conceito: Backend como Orquestrador
                    </h3>
                    <p>
                        Para garantir que o jogo funcione de forma consistente, o aplicativo do seu navegador (frontend) **nunca** fala diretamente com a API externa de D&D 5e. Em vez disso, ele se comunica **apenas com o seu próprio backend**.
                    </p>
                    <p className="mt-2">
                        Seu backend age como um "orquestrador inteligente", buscando dados de duas fontes e unindo-os antes de enviar uma resposta limpa e pronta para o jogo.
                    </p>
                </div>
                
                <div className="space-y-6 pt-4 border-t border-stone-700">
                    <div className="flex items-start gap-4">
                        <div className="pt-1 text-blue-400"><Cloud className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-blue-300">Fonte 1: A API Oficial (dnd5eapi.co)</h4>
                            <p className="text-xs text-stone-400">
                                O seu backend busca os dados brutos e em inglês das regras, monstros, magias e itens do SRD (Documento de Referência do Sistema) de D&D 5ª Edição. Esses dados são cacheados no Redis para máxima performance.
                            </p>
                        </div>
                    </div>

                     <div className="flex items-start gap-4">
                        <div className="pt-1 text-purple-400"><Database className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-purple-300">Fonte 2: Seu Banco de Dados Homebrew</h4>
                            <p className="text-xs text-stone-400">
                                O backend então consulta sua própria base de dados em busca de todo o conteúdo homebrew (criações suas, da comunidade e as traduções) que está "instalado" na sua sessão de jogo ou que é parte estrutural do seu personagem.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="pt-1 text-amber-400"><Server className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-amber-300">A Mágica da Mesclagem (Backend)</h4>
                             <p className="text-xs text-stone-400">
                                Esta é a parte mais importante. O backend compara as duas listas. Se ele encontra um item homebrew com o mesmo `index` de um item oficial (ex: sua tradução da magia "Fireball" tem o index `fireball`), a versão homebrew **sobrescreve** a versão oficial.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                        <div className="pt-1 text-green-400"><CheckCircle className="h-6 w-6"/></div>
                        <div>
                            <h4 className="font-semibold text-green-300">O Resultado: Uma Fonte Única da Verdade</h4>
                            <p className="text-xs text-stone-400">
                                O frontend recebe uma lista final, única e já traduzida. Ele não precisa se preocupar com duplicatas, traduções ou de onde os dados vieram. Isso simplifica a interface e garante que a IA do Mestre de Jogo também receba um conjunto de regras coeso e consistente, misturando perfeitamente o oficial com o seu toque pessoal.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </ActionModal>
    );
};

export default ArchitectureHelpModal;
