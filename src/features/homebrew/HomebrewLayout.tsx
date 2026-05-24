'use client';

import { AmbientBackground, DndHeading } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

/** Layout do Grimório — criação/instalação de conteúdo (ouro/ember) */
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
    <div className={cn('relative min-h-full w-full overflow-x-hidden overflow-y-auto bg-dnd-obsidian', className)}>
      <AmbientBackground variant="ember" />
      <div className="relative z-10 mx-auto max-w-screen-xl px-4 pb-12 pt-[calc(1rem+var(--dnd-safe-top))] sm:px-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-3 inline-flex items-center gap-1.5 font-ui text-sm text-dnd-parchment-muted hover:text-dnd-gold"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </button>
            <DndHeading variant="label">Grimório da comunidade</DndHeading>
            <DndHeading variant="section" className="mt-1">
              {title}
            </DndHeading>
            {subtitle ? (
              <p className="mt-2 max-w-2xl font-narrative text-dnd-parchment-muted">{subtitle}</p>
            ) : null}
          </div>
          {headerActions}
        </header>
        {children}
      </div>
    </div>
  );
}
