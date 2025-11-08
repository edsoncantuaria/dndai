'use client';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PlayerRollRequest } from '../types';
import DiceBox from '@3d-dice/dice-box';
import { Dice5, Loader2, Target, Sparkles } from 'lucide-react';

interface DiceRollModalProps {
  request: PlayerRollRequest;
  onRoll: (result: { rawRoll: number; rolls: number[] }) => void;
  onClose: () => void;
  show: boolean;
}

type RollStatus = 'normal' | 'critical-success' | 'critical-failure' | 'success' | 'failure';

const DiceRollModal: React.FC<DiceRollModalProps> = ({ request, onRoll, onClose, show }) => {
  const diceBoxRef = useRef<HTMLDivElement>(null);
  const diceBoxInstance = useRef<DiceBox | null>(null);
  const [isDiceboxReady, setIsDiceboxReady] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{ total: number; rolls: number[]; rawRoll: number } | null>(null);
  const [status, setStatus] = useState<RollStatus>('normal');
  const [hasRolled, setHasRolled] = useState(false);

  useEffect(() => {
    if (!show) {
      setIsRolling(false);
      setHasRolled(false);
      setRollResult(null);
      setStatus('normal');
    }
  }, [show, request]);

  useEffect(() => {
    if (show && diceBoxRef.current && !diceBoxInstance.current) {
      const diceBox = new DiceBox({
        container: '#dicebox-premium',
        assetPath: '/assets/dice-box/',
        theme: 'default',
        offscreen: true,
        scale: 28,
      });

      diceBox.init()
        .then(() => {
          diceBoxInstance.current = diceBox;
          setIsDiceboxReady(true);
        })
        .catch(err => {
          console.error('[DiceRollModal] Falha ao inicializar DiceBox:', err);
          setIsDiceboxReady(false);
        });
    }
  }, [show]);

  const handleRoll3D = useCallback(async () => {
    if (isRolling || hasRolled || !diceBoxInstance.current) return;
    setIsRolling(true);
    setHasRolled(true);

    try {
      const isAdvDis = (request.advantage || request.disadvantage) && request.dice === '1d20';
      const diceNotation = isAdvDis ? ['1d20', '1d20'] : [request.dice];
      const results = await diceBoxInstance.current.roll(diceNotation);
      const diceValues = results.map(r => r.value);
      let rawRoll: number;
      if (isAdvDis) {
        rawRoll = request.advantage ? Math.max(...diceValues) : Math.min(...diceValues);
      } else {
        rawRoll = diceValues.reduce((sum, value) => sum + value, 0);
      }

      const total = rawRoll + (request.modifier || 0);
      const isD20 = request.dice.toLowerCase() === '1d20';
      if (isD20 && rawRoll === 20) setStatus('critical-success');
      else if (isD20 && rawRoll === 1) setStatus('critical-failure');
      else if (request.dc !== undefined) setStatus(total >= request.dc ? 'success' : 'failure');
      else setStatus('normal');

      setTimeout(() => {
        setRollResult({ total, rolls: diceValues, rawRoll });
        setIsRolling(false);
      }, 1000);
    } catch (error) {
      console.error('[DiceRollModal] Erro ao rolar dados 3D:', error);
      setIsRolling(false);
      setHasRolled(false);
      setIsDiceboxReady(false);
    }
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
      onClick={handleRoll3D}
      disabled={isRolling || !isDiceboxReady}
      className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3 text-lg font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-900 transition disabled:opacity-50"
    >
      {isRolling ? <Loader2 className="animate-spin h-5 w-5" /> : <Dice5 className="h-5 w-5" />}
      {isRolling ? 'Rolando...' : isDiceboxReady ? `Rolar ${request.dice}` : 'Preparando dados...'}
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
        className="w-full max-w-4xl rounded-3xl border border-amber-500/40 bg-[#05060b]/95 shadow-[0_40px_120px_rgba(0,0,0,0.85)] overflow-hidden grid lg:grid-cols-[1.2fr,1fr]"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-black/70 border-r border-white/5 p-4 flex items-center justify-center">
          <div id="dicebox-premium" ref={diceBoxRef} className="w-full h-72 sm:h-96"></div>
        </div>
        <div className="flex flex-col">
          <header className="p-5 border-b border-white/10 bg-gradient-to-r from-black via-black to-amber-900/10">
            <p className="text-xs uppercase tracking-[0.5em] text-amber-300 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> TESTE DO MESTRE
            </p>
            <h1 className="text-2xl font-serif text-white mt-2 leading-tight">{request.reason}</h1>
          </header>

          <div className="p-6 space-y-4 text-stone-200 flex-1">
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
    </div>
  );
};

export default DiceRollModal;
