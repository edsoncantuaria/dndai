'use client';

import { AmbientBackground, DndHeading } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { ArrowLeft, Languages } from 'lucide-react';

/** Layout do Arquivo Lexical — separado do Grimório (tom frio/ciano) */
export interface TranslationLayoutProps {
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export function TranslationLayout({
  onBack,
  backLabel = 'Voltar ao hub',
  children,
  className,
}: TranslationLayoutProps) {
  return (
    <div className={cn('relative h-full min-h-0 w-full overflow-x-hidden overflow-y-auto bg-dnd-obsidian', className)}>
      <AmbientBackground variant="midnight" />
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(56, 189, 248, 0.12), transparent)',
        }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-screen-xl px-4 pb-12 pt-[calc(1rem+var(--dnd-safe-top))] sm:px-6">
        <header className="mb-6">
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1.5 font-ui text-sm text-dnd-parchment-muted hover:text-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-300">
              <Languages className="h-8 w-8" />
            </div>
            <div>
              <DndHeading variant="label" className="text-cyan-400/90">
                Arquivo lexical
              </DndHeading>
              <DndHeading variant="section" className="mt-1 text-dnd-parchment">
                Estúdio de tradução
              </DndHeading>
              <p className="mt-2 max-w-2xl font-narrative text-sm text-dnd-parchment-muted">
                Ajuste termos do sistema (atributos, classes, condições). Isso é diferente de criar raças, itens ou
                magias no Grimório.
              </p>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
