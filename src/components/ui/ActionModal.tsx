'use client';

import React, { ReactNode, useId } from 'react';
import { Loader2 } from 'lucide-react';

export interface ActionButton {
  text: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  icon?: ReactNode;
}

interface ActionModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ActionButton[];
}

const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  title,
  onClose,
  children,
  actions = [],
}) => {
  if (!isOpen) return null;

  const getButtonClass = (variant: ActionButton['variant']) => {
    switch (variant) {
      case 'primary':
        return 'bg-dnd-ember text-dnd-parchment hover:brightness-110';
      case 'destructive':
        return 'bg-dnd-ember/90 text-dnd-parchment hover:bg-dnd-ember';
      case 'secondary':
      default:
        return 'border border-dnd-gold/25 bg-dnd-obsidian-raised/80 font-ui text-dnd-parchment hover:border-dnd-gold/50';
    }
  };

  const titleId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      style={{ animationDuration: '200ms' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-dnd-gold/20 bg-dnd-obsidian-raised shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-dnd-gold/10 p-6">
          <div>
            <p className="font-ui text-xs uppercase tracking-[0.35em] text-dnd-gold">Ação necessária</p>
            <h2 id={titleId} className="mt-1 font-display text-2xl text-dnd-parchment">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-dnd-gold/15 font-ui text-dnd-parchment-muted transition hover:border-dnd-gold/40 hover:text-dnd-parchment"
            aria-label="Fechar"
          >
            &times;
          </button>
        </header>
        <main className="overflow-y-auto p-6 font-ui text-sm leading-relaxed text-dnd-parchment-muted">
          {children}
        </main>
        {actions.length > 0 && (
          <footer className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-dnd-gold/10 bg-dnd-obsidian/50 p-6">
            {actions.map((action) => (
              <button
                key={action.text}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`flex items-center gap-2 rounded-full px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${getButtonClass(action.variant)}`}
              >
                {action.disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : action.icon}
                {action.text}
              </button>
            ))}
          </footer>
        )}
      </div>
    </div>
  );
};

export default ActionModal;
