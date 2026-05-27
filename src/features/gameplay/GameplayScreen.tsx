'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { useToast } from '@/hooks/use-toast';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { resolveLoadingState } from '@/hooks/game/loadingLabels';
import PremiumLoader from '@/components/ui/PremiumLoader';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GameplayNarrativeLog } from './components/GameplayNarrativeLog';
import DiceRollModal from '@/components/DiceRollModal';
import SkillCheckModal from '@/components/ui/SkillCheckModal';
import SpellCastModal from '@/components/ui/SpellCastModal';
import LevelUpModal from '@/components/LevelUpModal';
import ShopModal from '@/components/ShopModal';
import WorldMapModal from '@/components/world-map/WorldMapModal';
import GuidedTipsOverlay from '@/components/GuidedTipsOverlay';
import ActionModal from '@/components/ui/ActionModal';
import { getWorldMapSnapshot, type WorldMapSnapshot } from '@/services/gameService';
import { Download, Loader2, Dice5 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameplayShell } from './GameplayShell';
import { GameplayActionDock } from './components/GameplayActionDock';
import { GameplaySidePanelContent } from './components/GameplaySidePanelContent';
import { GameplayFreeActionSheet } from './GameplayFreeActionSheet';
import { LoadingOracle } from './components/LoadingOracle';
import { useGameplayScrollLock } from '@/hooks/useGameplayScrollLock';

export interface GameplayScreenProps {
  returnToMenu: () => void;
}

export function GameplayScreen({ returnToMenu }: GameplayScreenProps) {
  const {
    character,
    sessionId,
    isLoading,
    actionPhaseLabel,
    isRollPending,
    levelUpState,
    shopState,
    playerRollRequest,
    handleRollResult,
    skillCheckRequest,
    setSkillCheckRequest,
    handleSkillCheckSubmit,
    spellCastRequest,
    setSpellCastRequest,
    submitSpellCast,
    combatState,
    processPlayerAction,
    reinstallModal,
    setReinstallModal,
  } = useGameStateContext();

  const { toast } = useToast();
  const { hasSeenGuidedTips, setHasSeenGuidedTips } = useSettingsContext();

  const [freeActionOpen, setFreeActionOpen] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [isNarrationActive, setIsNarrationActive] = useState(false);
  const [isWorldMapOpen, setIsWorldMapOpen] = useState(false);
  const [worldMapState, setWorldMapState] = useState<{ sessionId: number; snapshot: WorldMapSnapshot } | null>(null);
  const [isWorldMapLoading, setIsWorldMapLoading] = useState(false);
  const [isGuidedTipsOpen, setIsGuidedTipsOpen] = useState(false);
  const [guidedDismissed, setGuidedDismissed] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);

  const showDiceModal = Boolean(playerRollRequest);
  const showCombatHud = combatState?.isActive;

  useGameplayScrollLock(Boolean(character));

  const loadingState = useMemo(
    () => resolveLoadingState({ isLoading, isRollPending, actionPhaseLabel }),
    [isLoading, isRollPending, actionPhaseLabel]
  );

  const showNarrationBanner =
    Boolean(actionPhaseLabel) && isLoading && loadingState.kind === 'narration';
  const showBlockingLoader =
    Boolean(actionPhaseLabel) && isLoading && loadingState.kind !== 'narration' && loadingState.kind !== 'idle';

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setIsNarrationActive(Boolean(detail?.active));
    };
    window.addEventListener('narration-speech', handler as EventListener);
    return () => window.removeEventListener('narration-speech', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!character || hasSeenGuidedTips || guidedDismissed) return;
    const t = setTimeout(() => setIsGuidedTipsOpen(true), 1500);
    return () => clearTimeout(t);
  }, [character, hasSeenGuidedTips, guidedDismissed]);

  const handleNarrationToggle = useCallback(() => {
    if (isNarrationActive) {
      window.dispatchEvent(new Event('narration-stop-request'));
    } else {
      window.dispatchEvent(new Event('narration-play-request'));
    }
  }, [isNarrationActive]);

  const handleOpenWorldMap = useCallback(async () => {
    if (!sessionId) return;
    setIsWorldMapOpen(true);
    if (worldMapState?.sessionId === sessionId) return;
    setIsWorldMapLoading(true);
    try {
      const snapshot = await getWorldMapSnapshot(sessionId);
      setWorldMapState({ sessionId, snapshot });
    } catch {
      toast({ variant: 'destructive', description: 'Não foi possível carregar o mapa mundi.' });
    } finally {
      setIsWorldMapLoading(false);
    }
  }, [sessionId, worldMapState, toast]);

  const handleFreeSubmit = useCallback(() => {
    const text = freeText.trim();
    if (!text) return;
    processPlayerAction(text);
    setFreeText('');
    setFreeActionOpen(false);
  }, [freeText, processPlayerAction]);

  if (isLoading && !character) {
    return (
      <PremiumLoader
        title="O Mestre está remontando a cena"
        subtitle="Recuperando aliados, inventário e o último ponto da história."
      />
    );
  }

  if (!character) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-dnd-danger">
        <p className="font-display text-lg">Erro ao carregar personagem</p>
        <button type="button" onClick={returnToMenu} className="font-ui text-sm text-dnd-gold underline">
          Voltar ao menu
        </button>
      </div>
    );
  }

  const region =
    character.worldState?.currentRegion || character.currentRegion || 'Região desconhecida';

  return (
    <TooltipProvider>
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        {loadingState.banner && (
          <div
            className={cn(
              'pointer-events-none absolute right-3 top-14 z-40 flex items-center gap-2 rounded-lg border px-3 py-1.5 font-ui text-xs shadow-lg',
              loadingState.kind === 'roll'
                ? 'border-dnd-gold/50 bg-dnd-obsidian-raised/95 text-dnd-gold'
                : 'border-dnd-gold/30 bg-dnd-obsidian-raised/90 text-dnd-parchment-muted'
            )}
          >
            {loadingState.kind === 'roll' ? (
              <Dice5 className="h-3.5 w-3.5" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            <span>{loadingState.banner}</span>
          </div>
        )}

        {reinstallModal.open && (
          <ActionModal
            isOpen
            title="Dependências faltando"
            onClose={() => setReinstallModal({ open: false, deps: [], onConfirm: () => {} })}
            actions={[
              {
                text: `Reinstalar (${reinstallModal.deps.length})`,
                onClick: reinstallModal.onConfirm,
                variant: 'primary',
              },
            ]}
          >
            <p className="text-stone-300 mb-2">Conteúdo homebrew necessário para esta sessão.</p>
          </ActionModal>
        )}

        {levelUpState?.isPending && <LevelUpModal />}
        {shopState?.isOpen && <ShopModal />}

        {showDiceModal && playerRollRequest && (
          <DiceRollModal
            request={playerRollRequest}
            onRoll={handleRollResult}
            show={showDiceModal}
            anchorId="dice-roll-modal-anchor"
          />
        )}

        {skillCheckRequest && (
          <SkillCheckModal
            skillName={skillCheckRequest.skillName}
            promptHint={skillCheckRequest.promptText}
            onConfirm={handleSkillCheckSubmit}
            onClose={() => setSkillCheckRequest(null)}
          />
        )}
        {spellCastRequest && (
          <SpellCastModal
            spell={spellCastRequest.spell}
            slotLevel={spellCastRequest.slotLevel}
            slotsBefore={spellCastRequest.slotsBefore}
            onConfirm={(spell, desc) => submitSpellCast(spell, desc)}
            onClose={() => setSpellCastRequest(null)}
          />
        )}

        <GameplayShell
          region={region}
          timeLabel={character.worldState?.timeOfDay}
          weatherLabel={character.worldState?.weather}
          onMenuClick={returnToMenu}
          onOpenWorldMap={handleOpenWorldMap}
          onOpenSettings={() => window.dispatchEvent(new Event('game-open-settings'))}
          onNarrationToggle={handleNarrationToggle}
          isNarrationActive={isNarrationActive}
          showCombat={showCombatHud}
          narrative={
            <div className="relative flex min-h-0 flex-1 flex-col">
              {showNarrationBanner ? (
                <div
                  className="sticky top-0 z-10 border-b border-dnd-gold/15 bg-dnd-obsidian/90 px-3 py-2 backdrop-blur-sm"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-center font-ui text-xs tracking-wide text-dnd-parchment-muted">
                    {loadingState.shortLabel ?? actionPhaseLabel}
                  </p>
                </div>
              ) : null}
              {showBlockingLoader ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-dnd-obsidian/60 backdrop-blur-[2px]">
                  <LoadingOracle label={loadingState.shortLabel ?? actionPhaseLabel ?? undefined} />
                </div>
              ) : null}
              <div className="gameplay-narrative-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3 pb-28 max-md:pb-36 md:px-4 md:pb-3">
                <GameplayNarrativeLog />
              </div>
            </div>
          }
          actionDock={<GameplayActionDock onFreeAction={() => setFreeActionOpen(true)} />}
          sidePanel={(tab) => (
            <GameplaySidePanelContent
              tab={tab}
              character={character}
              sessionId={sessionId}
              onOpenWorldMap={handleOpenWorldMap}
            />
          )}
        />

        <GameplayFreeActionSheet
          open={freeActionOpen}
          onOpenChange={setFreeActionOpen}
          value={freeText}
          onChange={setFreeText}
          onSubmit={handleFreeSubmit}
        />

        <WorldMapModal
          isOpen={isWorldMapOpen}
          onClose={() => setIsWorldMapOpen(false)}
          snapshot={sessionId && worldMapState?.sessionId === sessionId ? worldMapState.snapshot : null}
          isLoading={isWorldMapLoading && (!worldMapState || worldMapState.sessionId !== sessionId)}
        />

        <GuidedTipsOverlay
          isOpen={isGuidedTipsOpen}
          initialStep={guidedStep}
          onStepChange={setGuidedStep}
          onClose={() => {
            setGuidedDismissed(true);
            setIsGuidedTipsOpen(false);
          }}
          onComplete={() => {
            setHasSeenGuidedTips(true);
            setGuidedDismissed(true);
            setIsGuidedTipsOpen(false);
          }}
        />

        <button
          type="button"
          onClick={returnToMenu}
          className="fixed bottom-[calc(4.5rem+var(--dnd-safe-bottom))] right-[max(0.75rem,var(--dnd-safe-right))] z-30 hidden h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-dnd-danger/40 bg-dnd-danger/15 text-red-200 md:bottom-4 md:flex"
          aria-label="Sair da sessão"
        >
          <Download className="h-4 w-4 rotate-180" />
        </button>
      </div>
    </TooltipProvider>
  );
}
