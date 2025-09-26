'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PlayerRollRequest } from '../types';
import { Dices } from 'lucide-react';
import DiceRollModal from './DiceRollModal';

interface DiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd100', 'd12', 'd20'];

const DiceTestModal: React.FC<DiceTestModalProps> = ({ isOpen, onClose }) => {
    const [numDice, setNumDice] = useState(1);
    const [dieType, setDieType] = useState('d20');
    const [modifier, setModifier] = useState(0);
    const [advantage, setAdvantage] = useState(false);
    const [disadvantage, setDisadvantage] = useState(false);

    // Novo estado para controlar o modal de rolagem
    const [rollRequest, setRollRequest] = useState<PlayerRollRequest | null>(null);

    const handlePrepareRoll = () => {
        const notation = `${numDice}${dieType}`;
        const newRollRequest: PlayerRollRequest = {
            reason: 'Teste de Rolagem',
            dice: notation,
            modifier: modifier,
            rollType: 'check',
            // Vantagem/desvantagem só se aplicam a 1d20
            advantage: advantage && numDice === 1 && dieType === 'd20',
            disadvantage: disadvantage && numDice === 1 && dieType === 'd20',
        };
        setRollRequest(newRollRequest);
    };

    const handleRollComplete = (result: { total: number; rolls: number[] }) => {
        console.log("Resultado final do teste:", result);
        // Em um jogo real, este resultado seria enviado de volta para a IA.
        // Para o teste, apenas fechamos o modal.
        setRollRequest(null);
    };
    
    if (!isOpen) return null;

    return (
        <>
            <div 
                className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fadeIn"
                style={{ animationDuration: '200ms' }}
                onClick={onClose}
            >
                <div 
                    className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-md flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                        <h2 className="text-xl font-bold font-garamond text-amber-300">Configurar Teste de Dados</h2>
                        <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                    </header>
                    <main className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-300 mb-1">Quantidade</label>
                                <input type="number" value={numDice} onChange={e => setNumDice(parseInt(e.target.value))} min="1" max="10" className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-300 mb-1">Tipo de Dado</label>
                                <select value={dieType} onChange={e => setDieType(e.target.value)} className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200">
                                    {DICE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-300 mb-1">Modificador</label>
                            <input type="number" value={modifier} onChange={e => setModifier(parseInt(e.target.value))} className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"/>
                        </div>
                        <div className="flex justify-around text-stone-300">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={advantage} onChange={e => { setAdvantage(e.target.checked); if (e.target.checked) setDisadvantage(false); }} disabled={numDice > 1 || dieType !== 'd20'} className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded disabled:opacity-50"/>
                                Vantagem
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={disadvantage} onChange={e => { setDisadvantage(e.target.checked); if (e.target.checked) setAdvantage(false); }} disabled={numDice > 1 || dieType !== 'd20'} className="form-checkbox text-red-500 bg-stone-700 border-stone-600 rounded disabled:opacity-50"/>
                                Desvantagem
                            </label>
                        </div>
                    </main>
                    <footer className="p-4 flex justify-end items-center gap-4 bg-stone-950/50 rounded-b-lg">
                        <button
                            onClick={handlePrepareRoll}
                            className="px-6 py-2 rounded-md font-semibold text-stone-900 bg-amber-600 hover:bg-amber-700 transition-colors flex items-center gap-2"
                        >
                            Rolar o Dado
                            <Dices className="h-4 w-4"/>
                        </button>
                    </footer>
                </div>
            </div>

            {rollRequest && (
                <DiceRollModal
                    request={rollRequest}
                    onRoll={handleRollComplete}
                    onClose={() => setRollRequest(null)}
                />
            )}
        </>
    );
};

export default DiceTestModal;
