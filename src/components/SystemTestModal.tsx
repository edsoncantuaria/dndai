'use client';
import React, { useState } from 'react';
import type { PlayerRollRequest } from '../types';
import { Dices, Bot, Send } from 'lucide-react';
import DiceRollModal from './DiceRollModal';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { AVAILABLE_MODELS, useSettingsContext } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd100', 'd12', 'd20'];

const DiceTestSection: React.FC = () => {
    const [numDice, setNumDice] = useState(1);
    const [dieType, setDieType] = useState('d20');
    const [modifier, setModifier] = useState(0);
    const [advantage, setAdvantage] = useState(false);
    const [disadvantage, setDisadvantage] = useState(false);
    const [rollRequest, setRollRequest] = useState<PlayerRollRequest | null>(null);

    const handlePrepareRoll = () => {
        const notation = `${numDice}${dieType}`;
        const newRollRequest: PlayerRollRequest = {
            reason: 'Teste de Rolagem 3D (Isolado)',
            dice: notation,
            modifier: modifier,
            rollType: 'check',
            advantage: advantage && numDice === 1 && dieType === 'd20',
            disadvantage: disadvantage && numDice === 1 && dieType === 'd20',
        };
        setRollRequest(newRollRequest);
    };

    const handleRollComplete = (result: { total: number; rolls: number[] }) => {
        console.log("Resultado final do teste de dados:", result);
        setRollRequest(null);
    };

    return (
        <div className="p-4 border border-stone-700 rounded-lg">
            <h3 className="font-semibold text-stone-300 mb-3">Teste de Rolagem 3D (Isolado)</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Qtd.</label>
                    <input type="number" value={numDice} onChange={e => setNumDice(parseInt(e.target.value))} min="1" max="10" className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Tipo</label>
                    <select value={dieType} onChange={e => setDieType(e.target.value)} className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200">
                        {DICE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium text-stone-300 mb-1">Modificador</label>
                <input type="number" value={modifier} onChange={e => setModifier(parseInt(e.target.value) || 0)} className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"/>
            </div>
            <div className="flex justify-around text-stone-300 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={advantage} onChange={e => { setAdvantage(e.target.checked); if (e.target.checked) setDisadvantage(false); }} disabled={numDice > 1 || dieType !== 'd20'} className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded disabled:opacity-50"/>
                    Vantagem
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={disadvantage} onChange={e => { setDisadvantage(e.target.checked); if (e.target.checked) setAdvantage(false); }} disabled={numDice > 1 || dieType !== 'd20'} className="form-checkbox text-red-500 bg-stone-700 border-stone-600 rounded disabled:opacity-50"/>
                    Desvantagem
                </label>
            </div>
            <button
                onClick={handlePrepareRoll}
                className="w-full px-4 py-2 rounded-md font-semibold text-stone-900 bg-amber-600 hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
            >
                Rolar o Dado <Dices className="h-4 w-4"/>
            </button>
            {rollRequest && (
                <DiceRollModal
                    request={rollRequest}
                    onRoll={handleRollComplete}
                    onClose={() => setRollRequest(null)}
                    show={!!rollRequest}
                />
            )}
        </div>
    );
};

const AiCompatibilitySection: React.FC = () => {
    const { processPlayerAction, isLoading } = useGameStateContext();
    const { model: currentModel } = useSettingsContext();
    const [tempModel, setTempModel] = useState(currentModel);
    const { toast } = useToast();

    const megaPrompt = "Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades. Narre um personagem que acabou de derrotar um inimigo (iniciando combate e encerrando-o), encontrou um item mágico (gerando um lootOffer), subiu de nível (levelUpState), entrou em uma cidade e foi a uma loja (shopState), e agora precisa fazer um teste de Furtividade para escalar um muro (playerRollRequest).";
    
    const handleStressTest = async () => {
        try {
            await processPlayerAction(megaPrompt, -1, tempModel);
             toast({
                title: "Sucesso no Teste de Estresse!",
                description: `O modelo '${tempModel}' respondeu corretamente e passou na validação do schema.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Falha no Teste de Estresse",
                description: `O modelo '${tempModel}' falhou ao gerar uma resposta válida. Erro: ${error.message}`,
            });
        }
    };

    return (
        <div className="p-4 border border-stone-700 rounded-lg space-y-4">
             <h3 className="font-semibold text-stone-300 mb-2">Teste de Compatibilidade da IA</h3>
             <p className="text-xs text-stone-400 -mt-2">Verifica se o modelo de IA consegue gerar uma resposta complexa que passe em todas as validações do sistema.</p>

             <div>
                <label htmlFor="ia-model-test-select" className="block text-sm font-medium text-stone-400 mb-1">Modelo de IA para Testar</label>
                <select
                    id="ia-model-test-select"
                    value={tempModel}
                    onChange={(e) => setTempModel(e.target.value)}
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
                    disabled={isLoading}
                >
                    {AVAILABLE_MODELS.map(modelName => (
                        <option key={modelName} value={modelName}>{modelName}</option>
                    ))}
                </select>
            </div>
            <button
                onClick={handleStressTest}
                disabled={isLoading}
                className="w-full px-4 py-2 rounded-md font-semibold text-white bg-purple-700 hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
                <Bot className="h-4 w-4"/>
                {isLoading ? 'Testando...' : 'Executar Teste de Estresse'}
            </button>
        </div>
    );
};


const SystemTestModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
            onClick={onClose}
        >
            <div 
                className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-garamond text-amber-300">Painel de Testes do Sistema</h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <main className="p-6 space-y-4 overflow-y-auto">
                    <DiceTestSection />
                    <AiCompatibilitySection />
                </main>
            </div>
        </div>
    );
};

export default SystemTestModal;
