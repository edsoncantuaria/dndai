'use client';

import { Copy, Edit, MoreVertical, Play, Trash2 } from 'lucide-react';
import type { SessaoIA } from '@/types';
import { DndBadge, DndButton, DndCard } from '@/components/primitives';
import { SessionCover } from './SessionCover';
import { getSessionMeta } from './sessionMeta';

export interface SessionCardProps {
  session: SessaoIA;
  onPlay: () => void;
  onManage: () => void;
  compact?: boolean;
}

export function SessionCard({ session, onPlay, onManage, compact }: SessionCardProps) {
  const meta = getSessionMeta(session);
  const updated = new Date(session.updatedAt).toLocaleDateString('pt-BR');

  return (
    <DndCard padding="none" hover className="overflow-hidden">
      {!compact ? <SessionCover title={session.nome} /> : null}
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {meta.region ? <DndBadge variant="default">{meta.region}</DndBadge> : null}
          {meta.level != null ? <DndBadge variant="muted">Nv. {meta.level}</DndBadge> : null}
          {meta.className ? <DndBadge variant="muted">{meta.className}</DndBadge> : null}
        </div>
        <h3 className="mt-2 font-display text-lg text-dnd-parchment line-clamp-1">{session.nome}</h3>
        <p className="mt-1 font-ui text-xs text-dnd-parchment-muted">
          {meta.heroName} · {updated}
        </p>
        <div className="mt-4 flex gap-2">
          <DndButton variant="ember" size="sm" className="flex-1" onClick={onPlay}>
            <Play className="h-4 w-4" />
            Jogar
          </DndButton>
          <DndButton variant="goldOutline" size="icon" onClick={onManage} aria-label="Gerenciar sessão">
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
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-dnd-gold/20 dnd-surface-glass p-4 pb-[calc(1rem+var(--dnd-safe-bottom))] md:inset-x-auto md:right-4 md:bottom-4 md:w-80 md:rounded-xl md:border">
            <p className="font-display text-lg text-dnd-gold">{session.nome}</p>
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
