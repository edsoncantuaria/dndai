'use client';

import { useState } from 'react';
import { AmbientBackground } from '@/components/primitives';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useKeyboardViewportInset } from '@/hooks/useKeyboardViewportInset';
import { GameplaySidePanel } from './components/GameplaySidePanel';
import { GameplayTopBar } from './components/GameplayTopBar';
import { GameplayMobileMenuPanel } from './components/GameplayMobileMenuPanel';
import { DndTabs, type DndTabItem } from '@/components/primitives';
import { BookOpen, Map, Menu, Package } from 'lucide-react';
import { GameplayCombatTracker } from './combat/GameplayCombatTracker';
import { cn } from '@/lib/utils';
import Vignette from '@/components/Vignette';
import { useHeroDamageFlash } from '@/hooks/useHeroDamageFlash';
import { isDebugWsEnabled } from '@/lib/debugFlags';
import type { Character, CombatState } from '@/types';

const MOBILE_NAV: DndTabItem[] = [
  { id: 'narrative', label: 'Narração', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'map', label: 'Mapa', icon: <Map className="h-4 w-4" /> },
  { id: 'inventory', label: 'Bolsa', icon: <Package className="h-4 w-4" /> },
  { id: 'menu', label: 'Mais', icon: <Menu className="h-4 w-4" /> },
];

export interface GameplayShellProps {
  region: string;
  timeLabel?: string;
  weatherLabel?: string;
  character?: Character | null;
  combatState?: CombatState;
  sessionId?: number | null;
  onMenuClick?: () => void;
  onOpenWorldMap?: () => void;
  onOpenSettings?: () => void;
  onNarrationToggle?: () => void;
  isNarrationActive?: boolean;
  narrative: React.ReactNode;
  actionDock: React.ReactNode;
  sidePanel: (tab: string) => React.ReactNode;
  showCombat?: boolean;
}

export function GameplayShell({
  region,
  timeLabel,
  weatherLabel,
  character,
  combatState,
  sessionId,
  onMenuClick,
  onOpenWorldMap,
  onOpenSettings,
  onNarrationToggle,
  isNarrationActive,
  narrative,
  actionDock,
  sidePanel,
  showCombat = false,
}: GameplayShellProps) {
  const { isLgUp, isMdUp } = useBreakpoint();
  const keyboardInset = useKeyboardViewportInset();
  const damageFlash = useHeroDamageFlash(character, combatState);
  const [sideTab, setSideTab] = useState('map');
  const [mobileTab, setMobileTab] = useState('narrative');

  const showSidePanel = isLgUp;
  const showMobileNav = !isLgUp;
  const timeBadge = [timeLabel, weatherLabel].filter(Boolean).join(' · ') || undefined;

  const narrativeColumn = (
    <>
      {showCombat ? (
        <div className="shrink-0 border-b border-dnd-gold/10 px-2 py-2 pl-[max(0.5rem,var(--dnd-safe-left))] pr-[max(0.5rem,var(--dnd-safe-right))]">
          <GameplayCombatTracker />
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{narrative}</div>
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-stretch justify-end transition-[padding] duration-150 ease-out',
          'md:pointer-events-auto md:static md:z-auto md:block md:transition-none'
        )}
        style={{
          paddingBottom:
            keyboardInset > 0
              ? `calc(${keyboardInset}px + var(--dnd-safe-bottom))`
              : undefined,
        }}
      >
        {actionDock}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-dnd-obsidian text-dnd-parchment',
        'pl-[var(--dnd-safe-left)] pr-[var(--dnd-safe-right)]'
      )}
    >
      <AmbientBackground variant="cinematic" />
      <Vignette mode="hp" />
      {damageFlash ? (
        <div
          className="pointer-events-none fixed inset-0 z-[95] animate-pulse border-4 border-dnd-ember/70 bg-dnd-ember/20 shadow-[inset_0_0_120px_rgba(228,7,18,0.35)]"
          aria-hidden
        />
      ) : null}
      <GameplayTopBar
        region={region}
        timeLabel={timeBadge}
        character={character}
        combatState={combatState}
        onMenuClick={onMenuClick}
        onNarrationToggle={onNarrationToggle}
        isNarrationActive={isNarrationActive}
        hideMenuOnMobile={showMobileNav}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main
          className={`flex min-h-0 flex-1 flex-col ${showSidePanel ? 'md:w-[62%] lg:w-[62%]' : 'w-full'}`}
        >
          {(!showMobileNav || mobileTab === 'narrative') && narrativeColumn}
          {showMobileNav && mobileTab !== 'narrative' && mobileTab !== 'menu' && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-2">
              <div className="gameplay-panel-scroll min-h-0 flex-1 overflow-y-auto">
                {sidePanel(mobileTab)}
              </div>
            </div>
          )}
          {showMobileNav && mobileTab === 'menu' && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-2">
              <div className="gameplay-panel-scroll min-h-0 flex-1 overflow-y-auto">
                <GameplayMobileMenuPanel
                  sessionId={sessionId ?? character?.sessionId ?? null}
                  onOpenWorldMap={onOpenWorldMap}
                  onOpenSettings={onOpenSettings}
                  onNarrationToggle={onNarrationToggle}
                  isNarrationActive={isNarrationActive}
                  onOpenSessionLog={isDebugWsEnabled() ? () => setMobileTab('logs') : undefined}
                  onExitSession={() => onMenuClick?.()}
                />
              </div>
            </div>
          )}
          {showMobileNav && mobileTab === 'logs' && isDebugWsEnabled() && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-2">
              <div className="gameplay-panel-scroll min-h-0 flex-1 overflow-y-auto">
                {sidePanel('logs')}
              </div>
            </div>
          )}
        </main>
        {showSidePanel ? (
          <div className="hidden min-h-0 w-[38%] lg:flex">
            <GameplaySidePanel activeTab={sideTab} onTabChange={setSideTab}>
              {sidePanel(sideTab)}
            </GameplaySidePanel>
          </div>
        ) : null}
        {isMdUp && !isLgUp ? (
          <div className="hidden min-h-0 w-[38%] md:flex lg:hidden">
            <GameplaySidePanel activeTab={sideTab} onTabChange={setSideTab}>
              {sidePanel(sideTab)}
            </GameplaySidePanel>
          </div>
        ) : null}
      </div>
      {showMobileNav ? (
        <nav className="shrink-0 pb-[var(--dnd-safe-bottom)] md:hidden" aria-label="Navegação principal">
          <DndTabs items={MOBILE_NAV} value={mobileTab} onValueChange={setMobileTab} variant="bottomNav" />
        </nav>
      ) : null}
    </div>
  );
}
