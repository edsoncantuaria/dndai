'use client';

import { Copy, Edit, MoreVertical, Play, Trash2 } from 'lucide-react';
import type { SessaoIA } from '@/types';
import { DndButton, DndCard } from '@/components/primitives';
import { SessionCover } from './SessionCover';
import { getSessionMeta } from './sessionMeta';
import { cn } from '@/lib/utils';

export interface SessionCardProps {
  session: SessaoIA;
  onPlay: () => void;
  onManage: () => void;
  compact?: boolean;
}

export function SessionCard({ session, onPlay, onManage, compact }: SessionCardProps) {
  const meta = getSessionMeta(session);
  const updated = new Date(session.updatedAt).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <DndCard
      padding="none"
      hover
      className="group relative flex flex-col overflow-hidden border-dnd-gold/12"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-dnd-gold/80 via-dnd-ember/50 to-transparent opacity-90"
        aria-hidden
      />

      {!compact ? <SessionCover title={session.nome} /> : null}

      <div className={cn('flex flex-1 flex-col', compact ? 'p-4 md:p-5' : 'p-4 pt-3 md:p-5 md:pt-4')}>
        <div className="flex flex-wrap items-center gap-1.5">
          {meta.region ? (
            <span className="rounded-md bg-dnd-gold/12 px-2 py-0.5 font-ui text-[10px] font-medium uppercase tracking-wide text-dnd-gold">
              {meta.region}
            </span>
          ) : null}
          {meta.level != null ? (
            <span className="rounded-md bg-dnd-obsidian/60 px-2 py-0.5 font-ui text-[10px] text-dnd-parchment-muted">
              Nv. {meta.level}
            </span>
          ) : null}
          {meta.className ? (
            <span className="max-w-[8rem] truncate rounded-md bg-dnd-obsidian/60 px-2 py-0.5 font-ui text-[10px] text-dnd-parchment-muted">
              {meta.className}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 line-clamp-2 font-display text-lg leading-snug text-dnd-parchment">
          {session.nome}
        </h3>
        <p className="mt-1 truncate font-ui text-xs text-dnd-parchment-muted">
          {meta.heroName ? `${meta.heroName} · ` : ''}
          {updated}
        </p>

        <div className="mt-4 flex gap-2">
          <DndButton variant="ember" size="sm" className="min-h-[44px] flex-1" onClick={onPlay}>
            <Play className="h-4 w-4" />
            Jogar
          </DndButton>
          <DndButton
            variant="goldOutline"
            size="sm"
            className="min-h-[44px] min-w-[44px] px-3"
            onClick={onManage}
            aria-label="Gerenciar sessão"
          >
            <MoreVertical className="h-4 w-4" />
          </DndButton>
        </div>
      </div>
    </DndCard>
  );
}

export interface SessionActionsSheetProps {
  session: SessaoIA | null;
  open: boolean;
  onClose: () => void;
  onRename: (session: SessaoIA) => void;
  onClone: (session: SessaoIA) => void;
  onDelete: (session: SessaoIA) => void;
}

export function SessionActionsSheet({
  session,
  open,
  onClose,
  onRename,
  onClone,
  onDelete,
}: SessionActionsSheetProps) {
  if (!session) return null;

  return (
    <>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Fechar"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-dnd-gold/20 dnd-surface-glass p-4 pb-[calc(1rem+var(--dnd-safe-bottom))] md:inset-x-auto md:right-4 md:bottom-4 md:w-80 md:rounded-2xl md:border">
            <p className="font-display text-lg text-dnd-parchment">{session.nome}</p>
            <p className="mb-4 font-ui text-xs text-dnd-parchment-muted">Ações da crônica</p>
            <div className="flex flex-col gap-2">
              <DndButton
                variant="goldOutline"
                className="w-full justify-start"
                onClick={() => {
                  onRename(session);
                  onClose();
                }}
              >
                <Edit className="h-4 w-4" />
                Renomear
              </DndButton>
              <DndButton
                variant="goldOutline"
                className="w-full justify-start"
                onClick={() => {
                  onClone(session);
                  onClose();
                }}
              >
                <Copy className="h-4 w-4" />
                Clonar linha do tempo
              </DndButton>
              <DndButton
                variant="ghost"
                className="w-full justify-start text-dnd-danger hover:bg-dnd-danger/10"
                onClick={() => {
                  onDelete(session);
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </DndButton>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
