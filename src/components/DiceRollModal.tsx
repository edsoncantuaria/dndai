'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PlayerRollRequest } from '../types';
import DiceBox from '@3d-dice/dice-box';
import { Dices, Check, Loader2 } from 'lucide-react';
import { translateApiString } from '../utils/translator';

interface DiceRollModalProps {
  request: PlayerRollRequest;
  onRoll: (result: { total: number; rolls: number[] }) => void;
  onClose: () => void; // Adicionado para poder fechar
}

const DiceRollModal: React.FC<DiceRollModalProps> = ({ request, onRoll, onClose }) => {
  const diceBoxRef = useRef<HTMLDivElement>(null);
  const diceBoxInstance = useRef<DiceBox | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{ total: number; rolls: number[] } | null>(null);
  
  // Efeito para inicializar o DiceBox
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
        console.log("DiceBox na arena de rolagem inicializado.");
      });
    }
    // Não inclua 'request' nas dependências para não reinicializar a cada abertura
  }, []);

  const handleRoll = useCallback(async () => {
    if (!diceBoxInstance.current || isRolling) return;
    setIsRolling(true);
    
    // Log do objeto exato que seria passado no jogo
    console.log("Objeto PlayerRollRequest recebido pela modal de rolagem:", JSON.stringify(request, null, 2));

    try {
        let diceNotation: string[];
        // Vantagem/desvantagem cancelam-se mutuamente e são apenas para 1d20
        const isAdvDis = (request.advantage || request.disadvantage) && request.dice === '1d20';

        if (isAdvDis) {
            diceNotation = ['1d20', '1d20'];
        } else {
            diceNotation = [request.dice];
        }

        const results = await diceBoxInstance.current.roll(diceNotation);
        
        const diceValues = results.map(r => r.value);
        let finalRollResult: number;

        if (isAdvDis) {
            finalRollResult = request.advantage ? Math.max(...diceValues) : Math.min(...diceValues);
        } else {
            finalRollResult = diceValues.reduce((sum, val) => sum + val, 0);
        }
        
        const total = finalRollResult + (request.modifier || 0);
        setRollResult({ total, rolls: diceValues });

    } catch (e) {
      console.error("Erro na rolagem de dados 3D:", e);
      // Fallback para rolagem simples caso o 3D falhe
      const fallbackRoll = Math.floor(Math.random() * 20) + 1;
      setRollResult({ total: fallbackRoll + (request.modifier || 0), rolls: [fallbackRoll] });
    } finally {
        setIsRolling(false);
    }
  }, [request, isRolling]);

  const handleContinue = () => {
    if (rollResult) {
      onRoll(rollResult);
      onClose(); // Fecha o modal após a rolagem ser submetida
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
    <div className="text-center animate-fadeIn">
      <p className="text-stone-400">
        Rolagens: [{rollResult?.rolls.join(', ')}] {request.modifier >= 0 ? '+' : '-'} {Math.abs(request.modifier)}
        {request.dc && <span className="ml-2"> (CD: {request.dc})</span>}
      </p>
      <p className="text-8xl font-bold text-amber-400 my-2">{rollResult?.total}</p>
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
        <div id="dice-box" className="w-full h-48 sm:h-64"></div>
        <div className="bg-stone-900 border-2 border-amber-600/50 p-6 rounded-lg shadow-2xl min-h-[180px]">
          <h3 className="text-xl font-semibold text-center text-stone-300 mb-4">{request.reason}</h3>
          {rollResult ? renderResult() : renderRollButton()}
        </div>
      </div>
    </div>
  );
};

export default DiceRollModal;
