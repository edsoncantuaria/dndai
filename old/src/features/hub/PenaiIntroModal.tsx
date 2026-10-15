'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DndButton } from '@/components/primitives';
import { PenaiEngineIntro } from './PenaiEngineIntro';

const STORAGE_KEY = 'penai_intro_seen';

export interface PenaiIntroModalProps {
  /** Abre o modal manualmente (ex.: link "Como funciona"). */
  openRequested?: boolean;
  onOpenRequestedChange?: (open: boolean) => void;
}

export function PenaiIntroModal({ openRequested, onOpenRequestedChange }: PenaiIntroModalProps = {}) {
  const [autoOpen, setAutoOpen] = useState(false);
  const controlled = openRequested !== undefined;
  const open = controlled ? openRequested : autoOpen;

  useEffect(() => {
    if (controlled) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') {
        setAutoOpen(true);
      }
    } catch {
      setAutoOpen(false);
    }
  }, [controlled]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    if (controlled) {
      onOpenRequestedChange?.(false);
    } else {
      setAutoOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="penai-intro-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-dnd-gold/20 bg-dnd-obsidian p-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 text-dnd-parchment/60 hover:text-dnd-parchment"
          onClick={dismiss}
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <p id="penai-intro-title" className="font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
          Bem-vindo ao PENAI
        </p>
        <PenaiEngineIntro />
        <DndButton variant="ember" size="lg" className="mt-2 w-full sm:w-auto" onClick={dismiss}>
          Entendi — vamos jogar
        </DndButton>
      </div>
    </div>
  );
}
