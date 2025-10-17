// src/components/Homebrew/HomebrewHelpModal.tsx
'use client';

import React from 'react';
import ActionModal from '../ui/ActionModal';
import { BookOpen } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const HomebrewHelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
    return (
        <ActionModal
            isOpen={isOpen}
            title="Guia do Criador de Homebrew"
            onClose={onClose}
            actions={[{ text: "Entendido", onClick: onClose, variant: 'primary' }]}
        >
            <div className="space-y-4 text-stone-300 text-sm leading-relaxed">
                <div>
                    <h3 className="font-bold text-amber-300 text-lg mb-2">O que é o Sistema Homebrew?</h3>
                    <p>
                        A Oficina Homebrew é sua ferramenta para expandir o universo de "Crônicas de Aventuras". Aqui, você pode criar seu próprio conteúdo — raças, classes, magias, itens e mais — que se integra perfeitamente ao jogo. O Mestre de Jogo IA reconhecerá e utilizará suas criações como se fossem conteúdo oficial.
                    </p>
                </div>
                <div>
                    <h3 className="font-bold text-amber-300 text-lg mb-2">A Fonte da Verdade: A API D&D 5e</h3>
                    <p>
                        Para garantir a compatibilidade, todo o conteúdo que você cria deve seguir a mesma estrutura da API oficial de Dungeons & Dragons 5ª Edição. Não se preocupe, os formulários foram projetados para guiá-lo nesse processo. O importante é saber que a consistência dos dados é o que permite que a IA entenda e aplique corretamente as regras do seu conteúdo.
                    </p>
                </div>
                <div className="p-4 bg-stone-800/60 rounded-md border border-stone-700">
                    <h3 className="font-bold text-amber-300 text-lg mb-2 flex items-center gap-2">
                        <BookOpen className="h-5 w-5" /> Exemplo Prático: Criando a Magia "Luz"
                    </h3>
                    <p className="mb-4">
                        Vamos recriar o truque (cantrip) "Luz" do Player's Handbook para ilustrar como o formulário funciona.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-stone-300">
                        <li>
                            <strong className="text-stone-100">Tipo de Conteúdo:</strong> Selecione <span className="font-mono text-cyan-400">"Magia"</span>.
                        </li>
                        <li>
                            <strong className="text-stone-100">Nome da Magia:</strong> Digite <span className="font-mono text-cyan-400">Luz</span>.
                        </li>
                         <li>
                            <strong className="text-stone-100">Descrição:</strong> Cole o texto: <span className="font-mono text-xs text-cyan-400">"Você toca um objeto que não seja maior do que 3 metros em qualquer dimensão. Até que o feitiço termine, o objeto emite luz brilhante em um raio de 6 metros e luz fraca por mais 6 metros."</span>
                        </li>
                        <li>
                            <strong className="text-stone-100">Nível:</strong> Selecione <span className="font-mono text-cyan-400">Truque (0)</span>.
                        </li>
                         <li>
                            <strong className="text-stone-100">Escola de Magia:</strong> Selecione <span className="font-mono text-cyan-400">Evocação</span>.
                        </li>
                         <li>
                            <strong className="text-stone-100">Tempo de Conjuração:</strong> Deixe como <span className="font-mono text-cyan-400">1 ação</span>.
                        </li>
                         <li>
                            <strong className="text-stone-100">Alcance:</strong> Selecione <span className="font-mono text-cyan-400">Toque</span>.
                        </li>
                        <li>
                            <strong className="text-stone-100">Duração:</strong> Selecione <span className="font-mono text-cyan-400">1 hora</span>.
                        </li>
                         <li>
                            <strong className="text-stone-100">Componentes:</strong> Marque <span className="font-mono text-cyan-400">V (Verbal)</span> e <span className="font-mono text-cyan-400">M (Material)</span>.
                        </li>
                         <li>
                            <strong className="text-stone-100">Componente Material:</strong> Digite <span className="font-mono text-cyan-400">"Um vaga-lume ou musgo fosforescente."</span>
                        </li>
                    </ol>
                     <p className="mt-4 text-xs text-stone-400">
                        Após preencher, você pode salvar a magia. Ela aparecerá em "Minhas Criações" e poderá ser instalada em suas sessões de jogo!
                    </p>
                </div>
                 <p className="mt-4 text-sm">
                    Divirta-se criando e expandindo seu mundo! Suas criações são o que tornam cada aventura única.
                </p>
            </div>
        </ActionModal>
    );
};

export default HomebrewHelpModal;
