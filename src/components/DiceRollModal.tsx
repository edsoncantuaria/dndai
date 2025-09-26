'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PlayerRollRequest } from '../types';
import DiceBox from '@3d-dice/dice-box';
import { Dices, Check, Loader2 } from 'lucide-react';

interface DiceRollModalProps {
  request: PlayerRollRequest;
  onRoll: (result: { total: number; rolls: number[] }) => void;
  onClose: () => void;
}

type RollStatus = 'normal' | 'critical-success' | 'critical-failure';

const DiceRollModal: React.FC<DiceRollModalProps> = ({ request, onRoll, onClose }) => {
  const diceBoxRef = useRef<HTMLDivElement>(null);
  const diceBoxInstance = useRef<DiceBox | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isDiceboxReady, setIsDiceboxReady] = useState(false);
  const [rollResult, setRollResult] = useState<{ total: number; rolls: number[] } | null>(null);
  const [rollStatus, setRollStatus] = useState<RollStatus>('normal');
  const [hasRolled, setHasRolled] = useState(false);

  // Efeito para inicializar o DiceBox
  useEffect(() => {
    if (diceBoxRef.current && !diceBoxInstance.current) {
      const diceBox = new DiceBox({
        container: '#dice-box',
        assetPath: '/assets/dice-box/',
        theme: 'default',
        offscreen: true,
        scale: 18,
      });
      
      diceBox.init().then(() => {
        diceBoxInstance.current = diceBox;
        setIsDiceboxReady(true);
        console.log("DiceBox na arena de rolagem inicializado e pronto.");
      }).catch(e => {
        console.error("Falha ao inicializar o DiceBox:", e);
      });
    }
    
    return () => {
      if (diceBoxInstance.current) {
        try {
          diceBoxInstance.current.clear();
        } catch(e) {
          console.error("Erro ao limpar o DiceBox:", e);
        }
      }
    }
  }, []);

  const handleRoll = useCallback(async () => {
    if (!diceBoxInstance.current || isRolling || !isDiceboxReady) return;
    
    console.log("Objeto PlayerRollRequest recebido e sendo rolado:", JSON.stringify(request, null, 2));

    setIsRolling(true);
    setHasRolled(true);

    try {
      let diceNotation: string[];
      // Vantagem/desvantagem só se aplicam a 1d20
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

      // Lógica para sucesso/falha crítica
      const isD20Roll = request.dice === '1d20';
      if (isD20Roll && finalRawRoll === 20) {
        setRollStatus('critical-success');
      } else if (isD20Roll && finalRawRoll === 1) {
        setRollStatus('critical-failure');
      } else {
        setRollStatus('normal');
      }

      setTimeout(() => {
        setRollResult({ total, rolls: diceValues });
        setIsRolling(false);
      }, 1500); // Adiciona um pequeno atraso para a animação terminar

    } catch (e) {
      console.error("Erro na rolagem de dados 3D:", e);
      const fallbackRoll = Math.floor(Math.random() * 20) + 1;
      setRollResult({ total: fallbackRoll + (request.modifier || 0), rolls: [fallbackRoll] });
      setIsRolling(false);
    }
  }, [request, isRolling, isDiceboxReady]);

  const handleContinue = () => {
    if (rollResult) {
      onRoll(rollResult);
    }
  };

  const getResultColorClass = () => {
    switch (rollStatus) {
      case 'critical-success':
        return 'text-green-400';
      case 'critical-failure':
        return 'text-red-500';
      default:
        return 'text-amber-400';
    }
  };

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
      <p className="text-stone-400">
        Rolagens: [{rollResult?.rolls.join(', ')}] {request.modifier >= 0 ? '+' : '-'} {Math.abs(request.modifier || 0)}
        {request.dc && <span className="ml-2"> (CD: {request.dc})</span>}
      </p>
      <p className={`text-8xl font-bold my-2 ${getResultColorClass()}`}>{rollResult?.total}</p>
      <button 
        onClick={handleContinue}
        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold rounded-md bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors"
      >
        <Check className="h-6 w-6" />
        Continuar
      </button>
    </div>
  );

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
        <div className="bg-stone-900 border-2 border-amber-600/50 p-6 rounded-lg shadow-2xl min-h-[180px]">
          <h3 className="text-xl font-semibold text-center text-stone-300 mb-4">{request.reason}</h3>
          {hasRolled ? (rollResult ? renderResult() : <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-amber-400"/></div>) : renderRollButton()}
        </div>
      </div>
    </div>
  );
};

export default DiceRollModal;
