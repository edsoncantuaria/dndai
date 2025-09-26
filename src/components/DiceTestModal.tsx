'use client';
import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import type { PlayerRollRequest } from '../types';
import DiceBox from '@3d-dice/dice-box';
import { Dices, Check, Loader2 } from 'lucide-react';

interface DiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd100', 'd12', 'd20'];

const DiceTestModal: React.FC<DiceTestModalProps> = ({ isOpen, onClose }) => {
  const diceBoxRef = useRef<HTMLDivElement>(null);
  const diceBoxInstance = useRef<DiceBox | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{ total: number; rolls: number[] } | null>(null);

  const [numDice, setNumDice] = useState(1);
  const [dieType, setDieType] = useState('d20');
  const [modifier, setModifier] = useState(0);
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);

  useEffect(() => {
    if (isOpen && diceBoxRef.current && !diceBoxInstance.current) {
      const diceBox = new DiceBox("#dice-box-test", {
        assetPath: '/assets/dice-box/',
        theme: 'default',
        offscreen: true,
        scale: 6,
      });
      diceBox.init().then(() => {
        diceBoxInstance.current = diceBox;
        console.log("DiceBox Initialized for testing");
      });
    }
  }, [isOpen]);

  const handleRoll = async () => {
    if (!diceBoxInstance.current) return;
    setIsRolling(true);
    setRollResult(null);

    const notation = `${numDice}${dieType}`;
    const rollRequest: PlayerRollRequest = {
        reason: "Teste de Rolagem de Dados",
        dice: notation,
        modifier: modifier,
        rollType: 'check',
        advantage,
        disadvantage,
    };
    
    console.log("Objeto de Rolagem (como seria no jogo):", JSON.stringify(rollRequest, null, 2));

    try {
        const diceNotationForLib = `${numDice}${dieType}`;
        const notations = [diceNotationForLib];
        if(advantage || disadvantage) notations.push(diceNotationForLib);

        const results = await diceBoxInstance.current.roll(notations, { newRoll: true });
        
        let diceSum;
        if (advantage) {
            diceSum = Math.max(...results.map(r => r.value));
        } else if (disadvantage) {
            diceSum = Math.min(...results.map(r => r.value));
        } else {
            diceSum = results.reduce((sum, r) => sum + r.value, 0);
        }

        const total = diceSum + modifier;
        setRollResult({ total, rolls: results.map(r => r.value) });

    } catch (e) {
        console.error("Erro na rolagem dos dados:", e);
    } finally {
        setIsRolling(false);
    }
  };

  const resetAndClose = () => {
    setRollResult(null);
    setNumDice(1);
    setDieType('d20');
    setModifier(0);
    setAdvantage(false);
    setDisadvantage(false);
    onClose();
  }

  const renderConfig = () => (
    <div className="space-y-4">
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
        <div className="flex justify-around">
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={advantage} onChange={e => { setAdvantage(e.target.checked); if (e.target.checked) setDisadvantage(false); }} className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded"/>
                Vantagem
            </label>
             <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={disadvantage} onChange={e => { setDisadvantage(e.target.checked); if (e.target.checked) setAdvantage(false); }} className="form-checkbox text-red-500 bg-stone-700 border-stone-600 rounded"/>
                Desvantagem
            </label>
        </div>
        <button onClick={handleRoll} disabled={isRolling} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold rounded-md bg-amber-600 hover:bg-amber-700 text-stone-900 transition-colors disabled:opacity-50">
            {isRolling ? <Loader2 className="animate-spin h-6 w-6"/> : <Dices className="h-6 w-6" />}
            Rolar
        </button>
    </div>
  );

  const renderResult = () => (
    <div className="text-center space-y-4">
        <p className="text-stone-400">Rolagens: [{rollResult?.rolls.join(', ')}] | Modificador: {modifier}</p>
        <p className="text-7xl font-bold text-amber-400 animate-fadeIn">{rollResult?.total}</p>
        <button onClick={resetAndClose} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors">
            <Check className="h-6 w-6" />
            Continuar
        </button>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-end p-4 animate-fadeIn" onClick={onClose}>
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div id="dice-box-test" className="w-full h-48 sm:h-64"></div>
        <div className="bg-stone-900 border-2 border-amber-600/50 p-6 rounded-lg shadow-2xl">
          <h3 className="text-xl font-semibold text-center text-stone-300 mb-4">Teste de Rolagem de Dados</h3>
          {rollResult ? renderResult() : renderConfig()}
        </div>
      </div>
    </div>
  );
};

export default DiceTestModal;
