'use client';

import { AmbientBackground } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

export interface HomebrewLayoutProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function HomebrewLayout({
  title,
  subtitle,
  onBack,
  backLabel = 'Voltar ao hub',
  headerActions,
  children,
  className,
}: HomebrewLayoutProps) {
  return (
    <div className={cn('relative h-full min-h-0 w-full overflow-x-hidden overflow-y-auto bg-dnd-obsidian', className)}>
      <AmbientBackground variant="ember" showVignette={false} />
      <div className="relative z-10 mx-auto max-w-screen-xl px-4 pb-16 pt-[calc(1rem+var(--dnd-safe-top))] sm:px-6">
        <header className="mb-8 border-b border-dnd-gold/12 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={onBack}
                className="mb-4 inline-flex items-center gap-1.5 font-ui text-sm text-dnd-parchment-muted transition hover:text-dnd-gold"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                {backLabel}
              </button>
              <h1 className="font-display text-3xl leading-tight tracking-tight text-dnd-parchment sm:text-[2rem]">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-3 max-w-lg font-narrative text-[0.95rem] leading-relaxed text-dnd-parchment-muted">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {headerActions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
