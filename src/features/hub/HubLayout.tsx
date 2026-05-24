'use client';

import { ArrowLeft } from 'lucide-react';
import { AmbientBackground, DndButton, DndHeading } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { HubHeroParallax } from '@/components/motion/HubHeroParallax';
import Vignette from '@/components/Vignette';

export interface HubLayoutProps {
  title: string;
  subtitle?: string;
  label?: string;
  onBack?: () => void;
  backLabel?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function HubLayout({
  title,
  subtitle,
  label = 'Mesa de comando',
  onBack,
  backLabel = 'Voltar',
  headerActions,
  children,
  className,
}: HubLayoutProps) {
  return (
    <div className={cn('relative min-h-full w-full overflow-x-hidden overflow-y-auto bg-dnd-obsidian', className)}>
      <AmbientBackground variant="ember" />
      <Vignette mode="subtle" />
      <div className="relative z-10 mx-auto max-w-screen-xl px-4 pb-12 pt-[calc(1rem+var(--dnd-safe-top))] sm:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <HubHeroParallax className="min-w-0 flex-1">
          <div className="min-w-0">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1.5 font-ui text-sm text-dnd-parchment-muted transition hover:text-dnd-gold"
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </button>
            ) : null}
            <DndHeading variant="label">{label}</DndHeading>
            <DndHeading variant="section" className="mt-1">
              {title}
            </DndHeading>
            {subtitle ? (
              <p className="mt-2 max-w-2xl font-narrative text-dnd-parchment-muted">{subtitle}</p>
            ) : null}
          </div>
          </HubHeroParallax>
          {headerActions ? <div className="flex flex-wrap gap-2">{headerActions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function HubFooterActions({ children }: { children: React.ReactNode }) {
  return (
    <footer className="mt-10 flex flex-wrap gap-2 border-t border-dnd-gold/15 pt-6">{children}</footer>
  );
}

export function HubStatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-dnd-gold/15 bg-dnd-mist px-4 py-3 text-center">
      <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">{label}</p>
      <p className="mt-1 font-display text-xl text-dnd-gold">{value}</p>
    </div>
  );
}
