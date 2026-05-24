'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PlayerRollRequest } from '../types';
import DiceBox from '@3d-dice/dice-box';
import { Dice5, Loader2, Target, Sparkles } from 'lucide-react';
import { DndButton } from '@/components/primitives';
import { isUiV2Enabled } from '@/lib/uiV2';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useEventFeedback } from '@/hooks/useEventFeedback';
import { cn } from '@/lib/utils';

interface DiceRollModalProps {
  request: PlayerRollRequest;
  onRoll: (result: { rawRoll: number; rolls: number[] }) => void;
  show: boolean;
  /** ID do elemento raiz — usado pelo banner “Abrir dados” (scroll + foco) */
  anchorId?: string;
}

type RollStatus = 'normal' | 'critical-success' | 'critical-failure' | 'success' | 'failure';

const DICEBOX_CONTAINER_ID = 'dicebox-premium';

const DiceRollModal: React.FC<DiceRollModalProps> = ({ request, onRoll, show, anchorId = 'dice-roll-modal-anchor' }) => {
  const isV2 = isUiV2Enabled();
  const { isMobile } = useBreakpoint();
  const { playCue } = useEventFeedback();

  const diceBoxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const diceBoxInstance = useRef<DiceBox | null>(null);
  const [isDiceboxReady, setIsDiceboxReady] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{ total: number; rolls: number[]; rawRoll: number } | null>(null);
  const [status, setStatus] = useState<RollStatus>('normal');
  const [hasRolled, setHasRolled] = useState(false);

  const fullscreenMobile = isV2 && isMobile && show;

  useEffect(() => {
    if (!show) {
      setIsRolling(false);
      setHasRolled(false);
      setRollResult(null);
      setStatus('normal');
    }
  }, [show, request]);

  useEffect(() => {
    if (!show) return;
    const focusPanel = () => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      panelRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener('game-focus-roll-modal', focusPanel);
    return () => window.removeEventListener('game-focus-roll-modal', focusPanel);
  }, [show]);

  useEffect(() => {
    if (show && panelRef.current) {
      const t = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(t);
    }
  }, [show, request]);

  useEffect(() => {
    if (!show || !diceBoxRef.current || diceBoxInstance.current) return;

    const diceBox = new DiceBox({
      container: `#${DICEBOX_CONTAINER_ID}`,
      assetPath: '/assets/dice-box/',
      theme: 'default',
      offscreen: true,
      scale: isMobile ? 32 : 28,
    });

    diceBox
      .init()
      .then(() => {
        diceBoxInstance.current = diceBox;
        setIsDiceboxReady(true);
      })
      .catch((err) => {
        console.error('[DiceRollModal] Falha ao inicializar DiceBox:', err);
        setIsDiceboxReady(false);
      });

    return () => {
      diceBoxInstance.current = null;
      setIsDiceboxReady(false);
    };
  }, [show, isMobile]);

  const playOutcomeFeedback = useCallback(
    (nextStatus: RollStatus) => {
      if (!isV2) return;
      if (nextStatus === 'critical-success') playCue('diceCritical');
      else if (nextStatus === 'critical-failure') playCue('diceFailure');
      else if (nextStatus === 'success') playCue('xp');
      else if (nextStatus === 'failure') playCue('hpLoss');
    },
    [isV2, playCue]
  );

  const handleRoll3D = useCallback(async () => {
    if (isRolling || hasRolled || !diceBoxInstance.current) return;
    if (isV2) playCue('diceRoll');
    setIsRolling(true);
    setHasRolled(true);

    try {
      const isAdvDis = (request.advantage || request.disadvantage) && request.dice === '1d20';
      const diceNotation = isAdvDis ? ['1d20', '1d20'] : [request.dice];
      const results = await diceBoxInstance.current.roll(diceNotation);
      const diceValues = results.map((r) => r.value);
      let rawRoll: number;
      if (isAdvDis) {
        rawRoll = request.advantage ? Math.max(...diceValues) : Math.min(...diceValues);
      } else {
        rawRoll = diceValues.reduce((sum, value) => sum + value, 0);
      }

      const total = rawRoll + (request.modifier || 0);
      const isD20 = request.dice.toLowerCase() === '1d20';
      let nextStatus: RollStatus = 'normal';
      if (isD20 && rawRoll === 20) nextStatus = 'critical-success';
      else if (isD20 && rawRoll === 1) nextStatus = 'critical-failure';
      else if (request.dc !== undefined) nextStatus = total >= request.dc ? 'success' : 'failure';

      setStatus(nextStatus);
      playOutcomeFeedback(nextStatus);

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
  }, [request, isRolling, hasRolled, isV2, playCue, playOutcomeFeedback]);

  const handleContinue = () => {
    if (rollResult) {
      onRoll({ rawRoll: rollResult.rawRoll, rolls: rollResult.rolls });
    }
  };

  const getResultPresentation = () => {
    if (isV2) {
      switch (status) {
        case 'critical-success':
          return { color: 'text-dnd-gold', text: 'Sucesso Crítico!', glow: 'text-shadow-dnd-gold' };
        case 'success':
          return { color: 'text-dnd-success', text: 'Sucesso!', glow: '' };
        case 'critical-failure':
          return { color: 'text-dnd-danger', text: 'Falha Crítica!', glow: '' };
        case 'failure':
          return { color: 'text-dnd-danger', text: 'Falha.', glow: '' };
        default:
          return { color: 'text-dnd-gold', text: '', glow: '' };
      }
    }
    switch (status) {
      case 'critical-success':
        return { color: 'text-green-400', text: 'Sucesso Crítico!', glow: '' };
      case 'success':
        return { color: 'text-green-400', text: 'Sucesso!', glow: '' };
      case 'critical-failure':
        return { color: 'text-red-500', text: 'Falha Crítica!', glow: '' };
      case 'failure':
        return { color: 'text-red-500', text: 'Falha.', glow: '' };
      default:
        return { color: 'text-amber-400', text: '', glow: '' };
    }
  };

  const { color: resultColor, text: resultText, glow: resultGlow } = getResultPresentation();

  const overlayFlashClass =
    isV2 && rollResult
      ? status === 'critical-success'
        ? 'dice-roll-flash-critical'
        : status === 'critical-failure'
          ? 'dice-roll-flash-failure'
          : ''
      : '';

  const renderRollButton = () =>
    isV2 ? (
      <DndButton
        variant="ember"
        size="lg"
        className="mt-5 w-full"
        disabled={isRolling || !isDiceboxReady}
        loading={isRolling}
        onClick={handleRoll3D}
      >
        {!isRolling && <Dice5 className="h-5 w-5" />}
        {isRolling ? 'Rolando…' : isDiceboxReady ? `Rolar ${request.dice}` : 'Preparando dados…'}
      </DndButton>
    ) : (
      <button
        type="button"
        onClick={handleRoll3D}
        disabled={isRolling || !isDiceboxReady}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-lg font-semibold text-stone-900 transition hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
      >
        {isRolling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Dice5 className="h-5 w-5" />}
        {isRolling ? 'Rolando...' : isDiceboxReady ? `Rolar ${request.dice}` : 'Preparando dados...'}
      </button>
    );

  const renderResult = () => (
    <div className={cn('mt-6 space-y-2 text-center animate-fadeIn', isV2 && 'mt-4')}>
      <p
        className={cn(
          'font-bold tabular-nums',
          isV2 ? cn('font-display text-7xl md:text-8xl', resultColor, resultGlow) : cn('text-7xl', resultColor)
        )}
      >
        {rollResult?.total}
      </p>
      <p
        className={cn(
          'uppercase tracking-[0.35em]',
          isV2 ? 'font-ui text-xs text-dnd-parchment-muted' : 'text-sm text-stone-400'
        )}
      >
        Total
      </p>
      <p className={isV2 ? 'font-ui text-sm text-dnd-parchment' : 'text-stone-300'}>
        Rolagens: [{rollResult?.rolls.join(', ')}] {request.modifier >= 0 ? '+' : '−'}{' '}
        {Math.abs(request.modifier || 0)}
      </p>
      {resultText ? (
        <p className={cn('text-lg font-semibold', isV2 ? cn('font-display', resultColor) : resultColor)}>
          {resultText}
        </p>
      ) : null}
      {isV2 ? (
        <DndButton variant="goldOutline" size="lg" className="mt-4 w-full" onClick={handleContinue}>
          Continuar
        </DndButton>
      ) : (
        <button
          type="button"
          onClick={handleContinue}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-lg font-semibold text-white transition hover:bg-black/40"
        >
          Continuar
        </button>
      )}
    </div>
  );

  const renderMeta = () => (
    <>
      {request.dc !== undefined && request.rollType !== 'damage' && (
        <div
          className={cn(
            'flex items-center justify-center gap-2 font-mono text-sm',
            isV2 ? 'font-ui text-dnd-gold' : 'text-amber-300'
          )}
        >
          <Target className="h-4 w-4" />
          CD: {request.dc}
        </div>
      )}
      {(request.advantage || request.disadvantage) && (
        <p
          className={cn(
            'text-center font-semibold uppercase tracking-[0.4em]',
            request.advantage
              ? isV2
                ? 'text-dnd-success'
                : 'text-green-400'
              : isV2
                ? 'text-dnd-danger'
                : 'text-red-400'
          )}
        >
          {request.advantage ? 'Vantagem' : 'Desvantagem'}
        </p>
      )}
      {!hasRolled && (
        <p className={cn('text-center text-sm', isV2 ? 'font-narrative text-dnd-parchment-muted' : 'text-stone-400')}>
          Use seu instinto. Se a sorte estiver ao seu lado, um novo caminho se abrirá.
        </p>
      )}
    </>
  );

  if (!show) return null;

  if (!isV2) {
    return (
      <div
        id={anchorId}
        className="fixed inset-0 z-[100] flex animate-fadeIn items-center justify-center bg-black/85 p-4"
      >
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-amber-500/40 bg-[#05060b]/95 shadow-[0_40px_120px_rgba(0,0,0,0.85)] lg:grid-cols-[1.2fr,1fr]">
          <div className="flex items-center justify-center border-r border-white/5 bg-black/70 p-4">
            <div id={DICEBOX_CONTAINER_ID} ref={diceBoxRef} className="h-72 w-full sm:h-96" />
          </div>
          <div className="flex flex-col">
            <header className="border-b border-white/10 bg-gradient-to-r from-black via-black to-amber-900/10 p-5">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.5em] text-amber-300">
                <Sparkles className="h-4 w-4" /> TESTE DO MESTRE
              </p>
              <p className="mt-1 font-ui text-xs uppercase tracking-wider text-dnd-gold/90">
                Mestre solicita — role nos dados 3D
              </p>
              <h1 className="mt-2 font-serif text-2xl leading-tight text-white">{request.reason}</h1>
            </header>
            <div className="flex-1 space-y-4 p-6 text-stone-200">
              {renderMeta()}
              {hasRolled ? (
                rollResult ? (
                  renderResult()
                ) : (
                  <div className="flex h-24 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                  </div>
                )
              ) : (
                renderRollButton()
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={anchorId}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dice-roll-modal-title"
      className={cn(
        'fixed inset-0 z-[100] flex animate-fadeIn items-center justify-center',
        'bg-dnd-obsidian/75 backdrop-blur-md',
        overlayFlashClass,
        fullscreenMobile ? 'p-0' : 'p-3 md:p-6'
      )}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'dnd-border-gold dnd-surface-glass flex w-full flex-col overflow-hidden shadow-[var(--dnd-shadow-elevated)] outline-none',
          fullscreenMobile
            ? 'h-full max-h-none rounded-none border-0'
            : 'max-h-[min(96vh,900px)] max-w-4xl rounded-lg',
          !fullscreenMobile && 'md:grid md:max-h-[min(92vh,820px)] md:grid-cols-[1.15fr,1fr]'
        )}
      >
        <div
          className={cn(
            'relative flex min-h-0 items-center justify-center border-dnd-gold/15 bg-dnd-obsidian',
            fullscreenMobile ? 'min-h-[42vh] flex-1 border-b' : 'border-b p-3 md:border-b-0 md:border-r md:p-4'
          )}
        >
          <div
            id={DICEBOX_CONTAINER_ID}
            ref={diceBoxRef}
            className={cn('w-full', fullscreenMobile ? 'h-full min-h-[240px]' : 'h-56 sm:h-72 md:h-80')}
          />
          {isRolling ? (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
              <span className="rounded-full border border-dnd-gold/30 bg-dnd-obsidian-raised/90 px-3 py-1 font-ui text-xs text-dnd-gold">
                Dados em movimento…
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col">
          <header className="border-b border-dnd-gold/15 bg-dnd-obsidian-raised/50 px-4 py-4 md:px-5">
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-[0.45em] text-dnd-gold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Teste do mestre
            </p>
            <h1
              id="dice-roll-modal-title"
              className="mt-1.5 font-display text-xl leading-snug text-dnd-parchment md:text-2xl"
            >
              {request.reason}
            </h1>
          </header>

          <div className="flex flex-1 flex-col justify-center space-y-4 overflow-y-auto px-4 py-5 md:px-6">
            {renderMeta()}
            {hasRolled ? (
              rollResult ? (
                renderResult()
              ) : (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-dnd-gold" />
                </div>
              )
            ) : (
              renderRollButton()
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiceRollModal;
