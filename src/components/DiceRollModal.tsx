'use client';
import React, { useState, useCallback } from 'react';
import type { PlayerRollRequest } from '../types';
import { Dice5, Loader2, Target, Sparkles } from 'lucide-react';

interface DiceRollModalProps {
  request: PlayerRollRequest;
  onRoll: (result: { rawRoll: number; rolls: number[] }) => void;
  onClose: () => void;
  show: boolean;
}

type RollStatus = 'normal' | 'critical-success' | 'critical-failure' | 'success' | 'failure';

const DiceRollModal: React.FC<DiceRollModalProps> = ({ request, onRoll, onClose, show }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{ total: number; rolls: number[]; rawRoll: number } | null>(null);
  const [status, setStatus] = useState<RollStatus>('normal');
  const [hasRolled, setHasRolled] = useState(false);

  const simulateRoll = useCallback(() => {
    if (isRolling || hasRolled) return;
    setIsRolling(true);
    setHasRolled(true);

    setTimeout(() => {
      const isAdvDis = (request.advantage || request.disadvantage) && request.dice === '1d20';
      const extractDieValue = (notation: string) => {
        const match = notation.match(/d(\d+)/i);
        return match ? Number(match[1]) : 20;
      };
      const dieValue = extractDieValue(request.dice);
      const rollSingle = () => Math.floor(Math.random() * dieValue) + 1;

      let rolls: number[];
      let rawRoll: number;
      if (isAdvDis) {
        const first = rollSingle();
        const second = rollSingle();
        rolls = [first, second];
        rawRoll = request.advantage ? Math.max(first, second) : Math.min(first, second);
      } else {
        const numDiceMatch = request.dice.match(/(\d+)d/i);
        const numDice = numDiceMatch ? Number(numDiceMatch[1]) : 1;
        rolls = Array.from({ length: numDice }, rollSingle);
        rawRoll = rolls.reduce((sum, value) => sum + value, 0);
      }

      const total = rawRoll + (request.modifier || 0);
      const isD20 = request.dice.toLowerCase() === '1d20';
      if (isD20 && rawRoll === 20) {
        setStatus('critical-success');
      } else if (isD20 && rawRoll === 1) {
        setStatus('critical-failure');
      } else if (request.dc !== undefined) {
        setStatus(total >= request.dc ? 'success' : 'failure');
      } else {
        setStatus('normal');
      }

      setRollResult({ total, rolls, rawRoll });
      setIsRolling(false);
    }, 900);
  }, [request, isRolling, hasRolled]);

  const handleContinue = () => {
    if (rollResult) {
      // Pass the raw roll and the individual dice rolls to the manager
      onRoll({ rawRoll: rollResult.rawRoll, rolls: rollResult.rolls });
    }
  };

  const getResultPresentation = () => {
    switch (status) {
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
      onClick={simulateRoll}
      disabled={isRolling}
      className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3 text-lg font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-900 transition disabled:opacity-50"
    >
      {isRolling ? <Loader2 className="animate-spin h-5 w-5" /> : <Dice5 className="h-5 w-5" />}
      {isRolling ? 'Rolando...' : `Rolar ${request.dice}`}
    </button>
  );

  const renderResult = () => (
    <div className="text-center animate-fadeIn mt-6 space-y-2">
      <p className={`text-7xl font-bold ${resultColor}`}>{rollResult?.total}</p>
      <p className="text-sm text-stone-400 uppercase tracking-[0.35em]">Total</p>
      <p className="text-stone-300">
        Rolagens: [{rollResult?.rolls.join(', ')}] {request.modifier >= 0 ? '+' : '-'} {Math.abs(request.modifier || 0)}
      </p>
      {resultText && <p className={`font-semibold text-lg ${resultColor}`}>{resultText}</p>}
      <button
        onClick={handleContinue}
        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-lg font-semibold rounded-xl bg-black/30 border border-white/10 text-white hover:bg-black/40 transition"
      >
        Continuar
      </button>
    </div>
  );

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#0a0d13]/95 shadow-[0_40px_120px_rgba(0,0,0,0.75)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-5 border-b border-white/10 bg-gradient-to-r from-black via-black to-amber-900/10">
          <p className="text-xs uppercase tracking-[0.5em] text-amber-300 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> TESTE DO MESTRE
          </p>
          <h1 className="text-2xl font-serif text-white mt-2 leading-tight">{request.reason}</h1>
        </header>

        <div className="p-6 space-y-4 text-stone-200">
          {request.dc !== undefined && request.rollType !== 'damage' && (
            <div className="flex items-center justify-center gap-2 text-sm font-mono text-amber-300">
              <Target className="h-4 w-4" />
              CD: {request.dc}
            </div>
          )}
          {(request.advantage || request.disadvantage) && (
            <p className={`text-center font-semibold uppercase tracking-[0.4em] ${request.advantage ? 'text-green-400' : 'text-red-400'}`}>
              {request.advantage ? 'Vantagem' : 'Desvantagem'}
            </p>
          )}

          {!hasRolled && (
            <p className="text-center text-sm text-stone-400">
              Use seu instinto. Se a sorte estiver ao seu lado, um novo caminho se abrirá.
            </p>
          )}

          {hasRolled ? (rollResult ? renderResult() : <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-amber-400"/></div>) : renderRollButton()}
        </div>
      </div>
    </div>
  );
};

export default DiceRollModal;
