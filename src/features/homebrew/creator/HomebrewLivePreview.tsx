'use client';

import { DndBadge } from '@/components/primitives';
import { SourceKindBadge } from '@/features/homebrew/sourceKindBadge';
import { cn } from '@/lib/utils';
import type * as HomebrewService from '@/services/homebrewService';
import { HomebrewPreviewContent } from './HomebrewPreviewContent';
import type { HomebrewCreatorStepId } from './constants';

export interface HomebrewLivePreviewProps {
  activeStep?: HomebrewCreatorStepId;
  type: HomebrewService.HomebrewContentType;
  sourceKind: HomebrewService.HomebrewSourceKind;
  contentData: Record<string, unknown>;
  isPublic: boolean;
  locale: string;
  variant?: 'sidebar' | 'compact';
  className?: string;
}

const TYPE_LABELS: Record<HomebrewService.HomebrewContentType, string> = {
  race: 'Raça',
  subrace: 'Sub-raça',
  class: 'Classe',
  subclass: 'Subclasse',
  spell: 'Magia',
  item: 'Item',
  monster: 'Monstro',
  background: 'Antecedente',
  feat: 'Talento',
  skill: 'Perícia',
  translation: 'Tradução',
};

function countHighlights(data: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const traits = data.traits;
  if (Array.isArray(traits) && traits.length) {
    parts.push(`${traits.length} traço${traits.length > 1 ? 's' : ''}`);
  }
  const bonuses = data.ability_bonuses;
  if (Array.isArray(bonuses) && bonuses.length) {
    parts.push(`${bonuses.length} bônus`);
  }
  if (typeof data.speed === 'number') parts.push(`${data.speed} pés`);
  if (data.level !== undefined) parts.push(`nível ${String(data.level)}`);
  return parts.length ? parts.join(' · ') : null;
}

function PreviewHeader({
  name,
  typeLabel,
  index,
  highlights,
  badges,
  showLabel = true,
}: {
  name: string;
  typeLabel: string;
  index: string;
  highlights: string | null;
  badges: React.ReactNode;
  showLabel?: boolean;
}) {
  return (
    <div className="shrink-0">
      {showLabel ? (
        <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-dnd-parchment-muted">
          Resumo ao vivo
        </p>
      ) : null}
      <h3
        className={cn(
          'font-display leading-tight text-dnd-parchment',
          showLabel ? 'mt-1 text-xl' : 'text-lg'
        )}
      >
        {name}
      </h3>
      <p className="mt-0.5 font-ui text-xs text-dnd-parchment-muted sm:text-sm">
        {typeLabel}
        {index !== '—' ? ` · ${index}` : ''}
        {highlights ? ` · ${highlights}` : ''}
      </p>
      <div className="mt-2">{badges}</div>
    </div>
  );
}

export function HomebrewLivePreview({
  type,
  sourceKind,
  contentData,
  isPublic,
  locale,
  variant = 'sidebar',
  className,
}: HomebrewLivePreviewProps) {
  const name = typeof contentData.name === 'string' && contentData.name.trim() ? contentData.name : 'Sem nome';
  const index = typeof contentData.index === 'string' && contentData.index ? contentData.index : '—';
  const typeLabel = TYPE_LABELS[type] ?? type;
  const highlights = countHighlights(contentData);
  const isCompact = variant === 'compact';

  const badges = (
    <div className="flex flex-wrap gap-1.5">
      <SourceKindBadge sourceKind={sourceKind} />
      <DndBadge variant={isPublic ? 'success' : 'muted'}>{isPublic ? 'Público' : 'Privado'}</DndBadge>
      <DndBadge variant="muted">{locale}</DndBadge>
    </div>
  );

  return (
    <div
      className={cn(
        'rounded-lg border border-dnd-gold/15 bg-dnd-obsidian-raised/40',
        !isCompact && 'lg:sticky lg:top-[calc(1rem+var(--dnd-safe-top))]',
        className
      )}
      aria-live="polite"
    >
      <div className={cn('border-b border-dnd-gold/10 p-4', isCompact && 'pb-3')}>
        <PreviewHeader
          name={name}
          typeLabel={typeLabel}
          index={index}
          highlights={highlights}
          badges={badges}
          showLabel
        />
      </div>
      <div className="p-4 pt-3">
        <HomebrewPreviewContent
          type={type}
          contentData={contentData}
          className={isCompact ? 'max-h-[min(50vh,360px)]' : 'max-h-[min(60vh,520px)]'}
        />
      </div>
    </div>
  );
}
