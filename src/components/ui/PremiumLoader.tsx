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
}

const PremiumLoader: React.FC<PremiumLoaderProps> = ({
  title = 'Preparando sua experiência',
  subtitle = 'Aguarde um instante enquanto sincronizamos tudo para você.',
  description = 'Sincronizando dados da sessão, aliados, inventário e trilha de ambientação...',
  actionLabel,
  onAction,
  showSkeletons = true,
}) => {
  const skeletonBlocks = showSkeletons ? (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg animate-pulse">
        <div className="h-4 w-32 bg-white/30 rounded-full mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-white/10 rounded-full w-full" />
          <div className="h-3 bg-white/10 rounded-full w-5/6" />
          <div className="h-3 bg-white/10 rounded-full w-4/6" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg animate-pulse space-y-3">
            <div className="h-3 bg-white/20 rounded-full w-1/2" />
            <div className="h-5 bg-white/30 rounded-full w-2/3" />
            <div className="h-3 bg-white/10 rounded-full w-full" />
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen w-full bg-[#02060d] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.15),_transparent_60%)]" />
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 flex flex-col gap-10 animate-fadeIn">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-500/10 text-[10px] uppercase tracking-[0.45em] text-amber-200 animate-pulse">
            sincronizando
          </div>
          <h2 className="text-3xl font-serif text-white">{title}</h2>
          <p className="text-sm text-stone-400">{subtitle}</p>
        </div>
        {skeletonBlocks}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl border border-white/15 bg-white/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-amber-200 animate-spin" />
          </div>
          <p className="text-sm text-stone-300">{description}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>Seu progresso está seguro. Isso pode levar alguns segundos.</span>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="px-3 py-1.5 rounded-full border border-white/20 text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumLoader;
