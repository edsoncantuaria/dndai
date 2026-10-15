'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorModalProps {
  message: string;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose, actionLabel, onAction }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-black/70 p-4"
      style={{ animationDuration: '200ms' }}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-dnd-ember/40 bg-dnd-obsidian-raised shadow-2xl backdrop-blur-sm">
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-dnd-ember/30 p-4">
          <AlertTriangle className="h-6 w-6 text-dnd-ember" />
          <h2 className="font-display text-xl font-bold text-dnd-parchment">Erro do Mestre de Jogo</h2>
        </header>
        <main className="overflow-y-auto p-6">
          <p className="whitespace-pre-wrap font-narrative text-sm text-dnd-parchment-muted">{message}</p>
        </main>
        <footer className="flex flex-shrink-0 items-center justify-end gap-4 rounded-b-2xl bg-dnd-obsidian/80 p-4">
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="rounded-full border border-dnd-gold/40 px-5 py-2 font-ui text-sm font-semibold text-dnd-gold transition hover:bg-dnd-gold/10"
            >
              {actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-dnd-ember px-6 py-2 font-ui font-semibold text-dnd-parchment transition hover:brightness-110"
          >
            Entendido
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ErrorModal;
