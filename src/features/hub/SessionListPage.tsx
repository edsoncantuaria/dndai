'use client';

import { useState } from 'react';
import type { SessaoIA } from '@/types';
import { HubLayout } from './HubLayout';
import { SessionGrid } from './session/SessionGrid';
import { SessionActionsSheet } from './session/SessionCard';

export interface SessionListPageProps {
  sessions: SessaoIA[];
  onBack: () => void;
  onContinueGame: (sessionId: number) => void;
  onCreateHero: () => void;
  onRequestRenameSession: (session: SessaoIA) => void;
  onRequestCloneSession: (session: SessaoIA) => void;
  onRequestDeleteSession: (session: SessaoIA) => void;
}

export function SessionListPage({
  sessions,
  onBack,
  onContinueGame,
  onCreateHero,
  onRequestRenameSession,
  onRequestCloneSession,
  onRequestDeleteSession,
}: SessionListPageProps) {
  const [manageSession, setManageSession] = useState<SessaoIA | null>(null);

  return (
    <HubLayout
      title="Retome uma crônica"
      subtitle="Todas as sessões guardadas. Continue do ponto exato onde parou."
      label="Continuar"
      onBack={onBack}
      backLabel="Voltar ao hub"
    >
      <SessionGrid
        sessions={sessions}
        onPlay={onContinueGame}
        onManage={setManageSession}
        onCreateHero={onCreateHero}
      />
      <SessionActionsSheet
        session={manageSession}
        open={!!manageSession}
        onClose={() => setManageSession(null)}
        onRename={onRequestRenameSession}
        onClone={onRequestCloneSession}
        onDelete={onRequestDeleteSession}
      />
    </HubLayout>
  );
}
