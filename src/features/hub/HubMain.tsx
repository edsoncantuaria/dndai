'use client';

import { BookOpen, FlaskConical, Languages, LogOut, Settings, Users } from 'lucide-react';
import type { SessaoIA } from '@/types';
import type { SessionFactsResponse } from '@/services/gameService';
import { DndButton, DndCard, DndDivider } from '@/components/primitives';
import { HubFooterActions, HubLayout, HubStatPill } from './HubLayout';
import { SessionGrid } from './session/SessionGrid';
import { SessionActionsSheet } from './session/SessionCard';
import { useState } from 'react';

export interface HubMainProps {
  sessions: SessaoIA[];
  charactersCount: number;
  featuredSessionFacts: SessionFactsResponse | null;
  useAiHomebrew: boolean;
  isAdmin?: boolean;
  onContinueGame: (sessionId: number) => void;
  onOpenVault: () => void;
  onOpenHomebrew: () => void;
  onOpenTranslation?: () => void;
  onOpenAllSessions: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onRequestRenameSession: (session: SessaoIA) => void;
  onRequestCloneSession: (session: SessaoIA) => void;
  onRequestDeleteSession: (session: SessaoIA) => void;
  onCreateHero: () => void;
}

export function HubMain({
  sessions,
  charactersCount,
  featuredSessionFacts,
  useAiHomebrew,
  isAdmin,
  onContinueGame,
  onOpenVault,
  onOpenHomebrew,
  onOpenTranslation,
  onOpenAllSessions,
  onOpenSettings,
  onLogout,
  onRequestRenameSession,
  onRequestCloneSession,
  onRequestDeleteSession,
  onCreateHero,
}: HubMainProps) {
  const [manageSession, setManageSession] = useState<SessaoIA | null>(null);
  const featured = sessions[0];

  return (
    <HubLayout
      title="Suas crônicas"
      subtitle="Retome uma aventura ou forje um novo capítulo na mesa."
      label="Hub de aventuras"
      headerActions={
        <>
          <DndButton variant="ghost" size="sm" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </DndButton>
          <DndButton variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </DndButton>
        </>
      }
    >
      <div className="mb-8 grid grid-cols-3 gap-3">
        <HubStatPill label="Crônicas" value={sessions.length} />
        <HubStatPill label="Heróis" value={charactersCount} />
        <HubStatPill label="Homebrew" value={useAiHomebrew ? 'IA+' : 'Manual'} />
      </div>

      {featured && featuredSessionFacts?.storySummary ? (
        <DndCard padding="md" className="mb-8">
          <p className="font-ui text-xs uppercase tracking-wider text-dnd-gold">Última crônica</p>
          <h3 className="mt-1 font-display text-xl text-dnd-parchment">{featured.nome}</h3>
          <p className="mt-2 font-narrative text-sm leading-relaxed text-dnd-parchment-muted line-clamp-3">
            {featuredSessionFacts.storySummary}
          </p>
          <DndButton variant="ember" size="sm" className="mt-4" onClick={() => onContinueGame(featured.id)}>
            Retomar agora
          </DndButton>
        </DndCard>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-dnd-gold">Todas as mesas</h2>
        {sessions.length > 6 ? (
          <DndButton variant="ghost" size="sm" onClick={onOpenAllSessions}>
            Ver todas
          </DndButton>
        ) : null}
      </div>

      <SessionGrid
        sessions={sessions.slice(0, 6)}
        onPlay={onContinueGame}
        onManage={setManageSession}
        onCreateHero={onCreateHero}
      />

      <DndDivider className="my-10" />

      <div className={`grid gap-3 ${isAdmin && onOpenTranslation ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <DndButton variant="goldOutline" className="h-auto flex-col gap-2 py-4" onClick={onOpenVault}>
          <Users className="h-5 w-5" />
          Cofre de heróis
        </DndButton>
        <DndButton variant="goldOutline" className="h-auto flex-col gap-2 py-4" onClick={onOpenHomebrew}>
          <FlaskConical className="h-5 w-5" />
          Grimório
        </DndButton>
        {isAdmin && onOpenTranslation ? (
          <DndButton
            variant="goldOutline"
            className="h-auto flex-col gap-2 border-cyan-500/30 py-4 text-cyan-200/90 hover:border-cyan-400/50"
            onClick={onOpenTranslation}
          >
            <Languages className="h-5 w-5" />
            Tradução
          </DndButton>
        ) : null}
        <DndButton variant="goldOutline" className="h-auto flex-col gap-2 py-4" onClick={onOpenAllSessions}>
          <BookOpen className="h-5 w-5" />
          Todas as crônicas
        </DndButton>
      </div>

      <HubFooterActions>
        <DndButton variant="ghost" size="sm" onClick={onOpenSettings}>
          Configurações
        </DndButton>
      </HubFooterActions>

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
