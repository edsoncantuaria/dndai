'use client';

import { MapPin, Volume2, VolumeX, Menu } from 'lucide-react';
import { DndBadge } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface GameplayTopBarProps {
  region?: string;
  timeLabel?: string;
  onMenuClick?: () => void;
  onNarrationToggle?: () => void;
  isNarrationActive?: boolean;
  /** Em mobile a aba Menu da bottom nav substitui o botão do header */
  hideMenuOnMobile?: boolean;
  className?: string;
}

export function GameplayTopBar({
  region = 'Floresta das Sombras',
  timeLabel = 'Anoitecer',
  onMenuClick,
  onNarrationToggle,
  isNarrationActive = false,
  hideMenuOnMobile = false,
  className,
}: GameplayTopBarProps) {
  return (
    <header
      className={cn(
        'relative z-20 flex min-h-[52px] items-center justify-between gap-3 border-b border-dnd-gold/15 px-3 py-2 md:px-4',
        'dnd-surface-glass pt-[var(--dnd-safe-top)]',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MapPin className="h-4 w-4 shrink-0 text-dnd-gold" aria-hidden />
        <span className="truncate font-display text-sm text-dnd-parchment md:text-base">{region}</span>
        {timeLabel ? (
          <DndBadge variant="muted" className="hidden shrink-0 sm:inline-flex max-w-[40%] truncate">
            {timeLabel}
          </DndBadge>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {onNarrationToggle ? (
          <button
            type="button"
            onClick={onNarrationToggle}
            className={cn(
              'flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition',
              isNarrationActive
                ? 'bg-dnd-gold/20 text-dnd-gold'
                : 'text-dnd-parchment-muted hover:bg-dnd-mist hover:text-dnd-parchment'
            )}
            aria-label={isNarrationActive ? 'Parar narração' : 'Ouvir narração'}
          >
            {isNarrationActive ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        ) : null}
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className={cn(
              'flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-dnd-parchment-muted hover:bg-dnd-mist hover:text-dnd-parchment',
              hideMenuOnMobile && 'hidden md:flex'
            )}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
