'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PlayerRollRequest } from '../types';
import DiceBox from '@3d-dice/dice-box';
import { Dices, Check, Loader2, Target } from 'lucide-react';

interface DiceRollModalProps {
  request: PlayerRollRequest;
  onRoll: (result: { total: number; rolls: number[] }) => void;
  onClose: () => void;
  show: boolean;
}

type RollStatus = 'normal' | 'critical-success' | 'critical-failure' | 'success' | 'failure';

const DiceRollModal: React.FC<DiceRollModalProps> = ({ request, onRoll, onClose, show }) => {
  const diceBoxRef = useRef<HTMLDivElement>(null);
  const diceBoxInstance = useRef<DiceBox | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isDiceboxReady, setIsDiceboxReady] = useState(false);
  const [rollResult, setRollResult] = useState<{ total: number; rolls: number[] } | null>(null);
  const [rollStatus, setRollStatus] = useState<RollStatus>('normal');
  const [hasRolled, setHasRolled] = useState(false);

  // Initialize DiceBox
  useEffect(() => {
    if (show && diceBoxRef.current && !diceBoxInstance.current) {
      const diceBox = new DiceBox({
        container: '#dice-box',
        assetPath: '/assets/dice-box/',
        theme: 'default',
        offscreen: true,
        scale: 23,
      });
      
      diceBox.init().then(() => {
        diceBoxInstance.current = diceBox;
        setIsDiceboxReady(true);
      }).catch(e => {
          console.error("Falha ao inicializar o DiceBox:", e);
          setIsDiceboxReady(false); // Mark as not ready on failure
      });
    }
    
    // Cleanup on unmount or when modal is hidden
    return () => {
      if (diceBoxInstance.current) {
        try {
          // A proper cleanup might be needed if the library provides one.
          // For now, we just ensure we don't hold onto the instance.
        } catch(e) {
          // Ignore cleanup errors
        }
      }
    }
  }, [show]);

  const handleRoll = useCallback(async () => {
    if (isRolling || hasRolled) return;
    
    setIsRolling(true);
    setHasRolled(true);

    // Fallback for when DiceBox fails to initialize
    if (!diceBoxInstance.current || !isDiceboxReady) {
        console.warn("DiceBox not ready, using fallback roll.");
        const fallbackRolls: number[] = [];
        let numDice = 1;
        let numSides = 20;
        const diceMatch = request.dice.match(/(\d+)d(\d+)/);
        if (diceMatch) {
            numDice = parseInt(diceMatch[1], 10);
            numSides = parseInt(diceMatch[2], 10);
        }

        let diceResult = 0;
        for(let i=0; i<numDice; i++){
            const roll = Math.floor(Math.random() * numSides) + 1;
            fallbackRolls.push(roll);
            diceResult += roll;
        }

        const total = diceResult + (request.modifier || 0);
        setTimeout(() => {
            setRollResult({ total, rolls: fallbackRolls });
            setIsRolling(false);
        }, 500); // Short delay to simulate rolling
        return;
    }


    try {
      let diceNotation: string[];
      const isAdvDis = (request.advantage || request.disadvantage) && request.dice === '1d20';

      if (isAdvDis) {
        diceNotation = ['1d20', '1d20'];
      } else {
        diceNotation = [request.dice];
      }
      
      const results = await diceBoxInstance.current.roll(diceNotation);
      
      const diceValues = results.map(r => r.value);
      let finalRawRoll: number;

      if (isAdvDis) {
        finalRawRoll = request.advantage ? Math.max(...diceValues) : Math.min(...diceValues);
      } else {
        finalRawRoll = diceValues.reduce((sum, val) => sum + val, 0);
      }
      
      const total = finalRawRoll + (request.modifier || 0);

      const isD20Roll = request.dice === '1d20';
      if (isD20Roll && finalRawRoll === 20) {
        setRollStatus('critical-success');
      } else if (isD20Roll && finalRawRoll === 1) {
        setRollStatus('critical-failure');
      } else if (request.dc !== undefined) {
        setRollStatus(total >= request.dc ? 'success' : 'failure');
      } else {
        setRollStatus('normal');
      }

      setTimeout(() => {
        setRollResult({ total, rolls: diceValues });
        setIsRolling(false);
      }, 1500);

    } catch (e) {
      console.error("Erro na rolagem de dados 3D:", e);
      const fallbackRoll = Math.floor(Math.random() * 20) + 1;
      const total = fallbackRoll + (request.modifier || 0);
      if (request.dc) {
         setRollStatus(total >= request.dc ? 'success' : 'failure');
      }
      setRollResult({ total, rolls: [fallbackRoll] });
      setIsRolling(false);
    }
  }, [request, isRolling, isDiceboxReady, hasRolled]);

  const handleContinue = () => {
    if (rollResult) {
      onRoll(rollResult);
    }
  };

  const getResultPresentation = () => {
    switch (rollStatus) {
      case 'critical-success':
        return { color: 'text-green-400', text: 'Sucesso Crítico!' };
      case 'success':
         return { color: 'text-green-400', text: 'Sucesso!' };
      case 'critical-failure':
        return { color: 'text-red-500', text: 'Falha Crítica!' };
      case 'failure':
        return { color: 'text-red-500', text: 'Falha.' };
      default:
        return { color: 'text-amber-400', text: '' };
    }
  };
  
  const { color: resultColor, text: resultText } = getResultPresentation();

  const renderRollButton = () => (
    <button
      onClick={handleRoll}
      disabled={isRolling || !isDiceboxReady}
      className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold rounded-md bg-amber-600 hover:bg-amber-700 text-stone-900 transition-colors disabled:opacity-50"
    >
      {isRolling ? <Loader2 className="animate-spin h-6 w-6" /> : (isDiceboxReady ? <Dices className="h-6 w-6" /> : <Loader2 className="animate-spin h-6 w-6" />) }
      {isDiceboxReady ? `Rolar ${request.dice}` : 'Carregando Dados...'}
    </button>
  );

  const renderResult = () => (
    <div className="text-center animate-fadeIn">
      <p className={`text-8xl font-bold my-2 ${resultColor}`}>{rollResult?.total}</p>
      <p className="text-stone-400">
        Rolagens: [{rollResult?.rolls.join(', ')}] {request.modifier >= 0 ? '+' : '-'} {Math.abs(request.modifier || 0)}
        
      </p>
      {resultText && <p className={`font-bold text-lg mt-1 ${resultColor}`}>{resultText}</p>}
      <button 
        onClick={handleContinue}
        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors"
      >
        <Check className="h-6 w-6" />
        Continuar
      </button>
    </div>
  );

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-end p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div id="dice-box" ref={diceBoxRef} className="w-full h-48 sm:h-64"></div>
        <div className="bg-stone-900 border-2 border-amber-600/50 p-6 rounded-lg shadow-2xl min-h-[220px]">
          <h3 className="text-xl font-semibold text-center text-stone-300 mb-2">{request.reason}</h3>
          {request.advantage && <p className="text-center font-bold text-green-400">Com Vantagem</p>}
          {request.disadvantage && <p className="text-center font-bold text-red-500">Com Desvantagem</p>}
          {request.dc !== undefined && request.rollType !== 'damage' && (
            <div className="text-center text-stone-400 font-mono text-lg flex items-center justify-center gap-2 mb-4">
              <Target className="h-5 w-5 text-amber-400"/>
              <span>CD: {request.dc}</span>
            </div>
          )}
          {hasRolled ? (rollResult ? renderResult() : <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-amber-400"/></div>) : renderRollButton()}
        </div>
      </div>
    </div>
  );
};

export default DiceRollModal;
