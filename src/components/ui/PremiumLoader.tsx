'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface PremiumLoaderProps {
  title?: string;
  subtitle?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  showSkeletons?: boolean;
  statusLabel?: string;
  progress?: number;
}

const PremiumLoader: React.FC<PremiumLoaderProps> = ({
  title = 'Preparando sua experiência',
  subtitle = 'Aguarde um instante enquanto sincronizamos tudo para você.',
  description = 'Sincronizando dados da sessão, aliados, inventário e trilha de ambientação...',
  actionLabel,
  onAction,
  showSkeletons = true,
  statusLabel,
  progress,
}) => {
  const clampedProgress =
    typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : null;

  const skeletonBlocks = showSkeletons ? (
    <div className="space-y-4">
      <div className="animate-pulse rounded-3xl border border-dnd-gold/10 bg-dnd-obsidian-raised/60 p-5 backdrop-blur-lg">
        <div className="mb-3 h-4 w-32 rounded-full bg-dnd-parchment/20" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-dnd-parchment/10" />
          <div className="h-3 w-5/6 rounded-full bg-dnd-parchment/10" />
          <div className="h-3 w-4/6 rounded-full bg-dnd-parchment/10" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="animate-pulse space-y-3 rounded-2xl border border-dnd-gold/10 bg-dnd-obsidian-raised/50 p-4 backdrop-blur-lg"
          >
            <div className="h-3 w-1/2 rounded-full bg-dnd-parchment/15" />
            <div className="h-5 w-2/3 rounded-full bg-dnd-parchment/20" />
            <div className="h-3 w-full rounded-full bg-dnd-parchment/10" />
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen w-full overflow-hidden bg-dnd-obsidian">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_60%)]" />
      <div className="relative z-10 mx-auto flex max-w-4xl animate-fadeIn flex-col gap-10 px-6 py-16">
        <div className="space-y-3">
          <div className="inline-flex animate-pulse items-center gap-2 rounded-full border border-dnd-gold/25 bg-dnd-gold/10 px-3 py-1 font-ui text-[10px] uppercase tracking-[0.45em] text-dnd-gold">
            sincronizando
          </div>
          <h2 className="font-display text-3xl text-dnd-parchment">{title}</h2>
          <p className="font-ui text-sm text-dnd-parchment-muted">{subtitle}</p>
        </div>
        {skeletonBlocks}
        <div className="flex items-center gap-4 rounded-3xl border border-dnd-gold/10 bg-dnd-obsidian-raised/70 p-5 backdrop-blur-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dnd-gold/15 bg-dnd-obsidian">
            <Loader2 className="h-6 w-6 animate-spin text-dnd-gold" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-ui text-sm text-dnd-parchment-muted">{description}</p>
            {(statusLabel || clampedProgress !== null) && (
              <div className="space-y-1">
                {statusLabel ? (
                  <p className="font-ui text-xs uppercase tracking-[0.3em] text-dnd-gold/80">{statusLabel}</p>
                ) : null}
                {clampedProgress !== null ? (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-dnd-obsidian">
                    <div
                      className="h-full bg-gradient-to-r from-dnd-gold via-dnd-ember/80 to-dnd-ember transition-all duration-300"
                      style={{ width: `${clampedProgress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between font-ui text-xs text-dnd-parchment-muted/80">
          <span>Seu progresso está seguro. Isso pode levar alguns segundos.</span>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="rounded-full border border-dnd-gold/25 px-3 py-1.5 text-dnd-parchment transition hover:border-dnd-gold hover:text-dnd-gold"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PremiumLoader;
