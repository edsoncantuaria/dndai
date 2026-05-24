'use client';

import { useState } from 'react';
import type { SessaoIA } from '@/types';
import { HubLayout, HubSectionHeader, HubStatPill } from './HubLayout';
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
      title="Suas mesas"
      subtitle="Cada sessão guardada. Continue do ponto exato onde parou."
      label="Crônicas"
      onBack={onBack}
      backLabel="Voltar"
    >
      <div className="mb-6">
        <HubStatPill variant="inline" label="Total" value={sessions.length} />
      </div>

      <HubSectionHeader title="Sessões" />

      <SessionGrid
        sessions={sessions}
        onPlay={onContinueGame}
        onManage={setManageSession}
        onCreateHero={onCreateHero}
        emptyTitle="Nenhuma crônica salva"
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
