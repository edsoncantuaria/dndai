'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PlayerRollRequest } from '../types';
import DiceBox from '@3d-dice/dice-box';
import { Dices, Check, Loader2 } from 'lucide-react';
import { translateApiString } from '../utils/translator';

interface DiceRollModalProps {
  request: PlayerRollRequest;
  onRoll: (result: { total: number; rolls: number[] }) => void;
}

const DiceRollModal: React.FC<DiceRollModalProps> = ({ request, onRoll }) => {
  const diceBoxRef = useRef<HTMLDivElement>(null);
  const diceBoxInstance = useRef<DiceBox | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{ total: number; rolls: number[] } | null>(null);
  
  useEffect(() => {
    if (diceBoxRef.current && !diceBoxInstance.current) {
      const diceBox = new DiceBox("#dice-box", {
        assetPath: '/assets/dice-box/',
        theme: 'default',
        offscreen: true,
        scale: 6,
      });
      diceBox.init().then(() => {
        diceBoxInstance.current = diceBox;
        console.log("DiceBox Initialized");
      });
    }

    // Cleanup on unmount
    return () => {
        if (diceBoxInstance.current) {
            // diceBoxInstance.current.clear(); // Might be useful if issues persist
        }
    };
  }, []);

  const handleRoll = async () => {
    if (!diceBoxInstance.current || isRolling) return;
    setIsRolling(true);
    
    // Construct the dice notation for the library
    const notations: string[] = [request.dice];
    if (request.advantage || request.disadvantage) {
        notations.push(request.dice);
    }
    
    try {
      const results = await diceBoxInstance.current.roll(notations, { newRoll: true });
      
      let finalRolls: number[];
      let diceSum: number;

      if (request.advantage) {
          const sum1 = results[0].value;
          const sum2 = results[1].value;
          diceSum = Math.max(sum1, sum2);
          finalRolls = sum1 >= sum2 ? [results[0].value] : [results[1].value];
      } else if (request.disadvantage) {
          const sum1 = results[0].value;
          const sum2 = results[1].value;
          diceSum = Math.min(sum1, sum2);
          finalRolls = sum1 <= sum2 ? [results[0].value] : [results[1].value];
      } else {
          diceSum = results.reduce((sum, r) => sum + r.value, 0);
          finalRolls = results.map(r => r.value);
      }
      
      const total = diceSum + request.modifier;
      setRollResult({ total, rolls: finalRolls });

    } catch (e) {
      console.error("Dice roll error:", e);
      // Fallback for simple roll if 3D fails
      const fallbackRolls = [Math.floor(Math.random() * 20) + 1];
      setRollResult({ total: fallbackRolls[0] + request.modifier, rolls: fallbackRolls });
    } finally {
        setIsRolling(false);
    }
  };

  const renderRollButton = () => (
    <button
      onClick={handleRoll}
      disabled={isRolling}
      className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold rounded-md bg-amber-600 hover:bg-amber-700 text-stone-900 transition-colors disabled:opacity-50"
    >
      {isRolling ? <Loader2 className="animate-spin h-6 w-6" /> : <Dices className="h-6 w-6" />}
      Rolar {request.dice}
    </button>
  );

  const renderResult = () => (
    <div className="text-center">
      <p className="text-stone-400">
        Resultado: ({rollResult?.rolls.join(' + ')} {request.modifier >= 0 ? '+' : '-'} {Math.abs(request.modifier)})
        {request.dc && <span className="ml-2"> (CD: {request.dc})</span>}
      </p>
      <p className="text-8xl font-bold text-amber-400 my-2 animate-fadeIn">{rollResult?.total}</p>
      <button 
        onClick={() => onRoll(rollResult!)}
        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors"
      >
        <Check className="h-6 w-6" />
        Continuar
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-end p-4 animate-fadeIn">
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div id="dice-box" className="w-full h-48 sm:h-64"></div>
        <div className="bg-stone-900 border-2 border-amber-600/50 p-6 rounded-lg shadow-2xl">
          <h3 className="text-xl font-semibold text-center text-stone-300 mb-4">{translateApiString(request.reason)}</h3>
          {rollResult ? renderResult() : renderRollButton()}
        </div>
      </div>
    </div>
  );
};

export default DiceRollModal;
