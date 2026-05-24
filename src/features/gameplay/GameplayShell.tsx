'use client';

import { useState } from 'react';
import { AmbientBackground } from '@/components/primitives';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useKeyboardViewportInset } from '@/hooks/useKeyboardViewportInset';
import { GameplaySidePanel } from './components/GameplaySidePanel';
import { GameplayTopBar } from './components/GameplayTopBar';
import { GameplayMobileMenuPanel } from './components/GameplayMobileMenuPanel';
import { DndTabs, type DndTabItem } from '@/components/primitives';
import { BookOpen, Map, Menu, Package, User } from 'lucide-react';
import NewCombatTracker from '@/components/NewCombatTracker';
import { cn } from '@/lib/utils';
import Vignette from '@/components/Vignette';

const MOBILE_NAV: DndTabItem[] = [
  { id: 'narrative', label: 'Narrativa', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'map', label: 'Mapa', icon: <Map className="h-4 w-4" /> },
  { id: 'inventory', label: 'Inventário', icon: <Package className="h-4 w-4" /> },
  { id: 'sheet', label: 'Ficha', icon: <User className="h-4 w-4" /> },
  { id: 'menu', label: 'Menu', icon: <Menu className="h-4 w-4" /> },
];

export interface GameplayShellProps {
  region: string;
  timeLabel?: string;
  weatherLabel?: string;
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
  const [sideTab, setSideTab] = useState('map');
  const [mobileTab, setMobileTab] = useState('narrative');

  const showSidePanel = isLgUp;
  const showMobileNav = !isLgUp;
  const timeBadge = [timeLabel, weatherLabel].filter(Boolean).join(' · ') || undefined;

  const narrativeColumn = (
    <>
      {showCombat ? (
        <div className="shrink-0 border-b border-dnd-gold/10 px-2 py-2 pl-[max(0.5rem,var(--dnd-safe-left))] pr-[max(0.5rem,var(--dnd-safe-right))]">
          <NewCombatTracker />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{narrative}</div>
      <div
        className="shrink-0 transition-[padding] duration-150 ease-out"
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
        'relative flex h-full min-h-0 w-full flex-col bg-dnd-obsidian text-dnd-parchment',
        'pl-[var(--dnd-safe-left)] pr-[var(--dnd-safe-right)]'
      )}
    >
      <AmbientBackground variant="ember" />
      <Vignette mode="hp" />
      <GameplayTopBar
        region={region}
        timeLabel={timeBadge}
        onMenuClick={onMenuClick}
        onNarrationToggle={onNarrationToggle}
        isNarrationActive={isNarrationActive}
        hideMenuOnMobile={showMobileNav}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main
          className={`flex min-h-0 flex-1 flex-col ${showSidePanel ? 'md:w-[58%] lg:w-[55%]' : 'w-full'}`}
        >
          {(!showMobileNav || mobileTab === 'narrative') && narrativeColumn}
          {showMobileNav && mobileTab !== 'narrative' && mobileTab !== 'menu' && (
            <div className="gameplay-panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
              {sidePanel(mobileTab)}
            </div>
          )}
          {showMobileNav && mobileTab === 'menu' && (
            <div className="gameplay-panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
              <GameplayMobileMenuPanel
                onOpenWorldMap={onOpenWorldMap}
                onOpenSettings={onOpenSettings}
                onNarrationToggle={onNarrationToggle}
                isNarrationActive={isNarrationActive}
                onExitSession={() => onMenuClick?.()}
              />
            </div>
          )}
        </main>
        {showSidePanel ? (
          <div className="hidden min-h-0 w-[42%] lg:flex">
            <GameplaySidePanel activeTab={sideTab} onTabChange={setSideTab}>
              {sidePanel(sideTab)}
            </GameplaySidePanel>
          </div>
        ) : null}
        {isMdUp && !isLgUp ? (
          <div className="hidden min-h-0 w-[42%] md:flex lg:hidden">
            <GameplaySidePanel activeTab={sideTab} onTabChange={setSideTab}>
              {sidePanel(sideTab)}
            </GameplaySidePanel>
          </div>
        ) : null}
      </div>
      {showMobileNav ? (
        <nav className="shrink-0 md:hidden" aria-label="Navegação principal">
          <DndTabs items={MOBILE_NAV} value={mobileTab} onValueChange={setMobileTab} variant="bottomNav" />
        </nav>
      ) : null}
    </div>
  );
}
