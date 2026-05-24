'use client';

import {
  BookOpen,
  ChevronRight,
  FlaskConical,
  Languages,
  LogOut,
  Play,
  Settings,
  Users,
} from 'lucide-react';
import type { SessaoIA } from '@/types';
import type { SessionFactsResponse } from '@/services/gameService';
import { DndButton } from '@/components/primitives';
import { HubLayout, HubNavCard, HubSectionHeader, HubStatPill } from './HubLayout';
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

function FeaturedChronicle({
  session,
  summary,
  onContinue,
}: {
  session: SessaoIA;
  summary?: string | null;
  onContinue: () => void;
}) {
  const updated = new Date(session.updatedAt).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-dnd-gold/15 bg-dnd-obsidian-raised/50">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-dnd-gold/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-dnd-obsidian/80 to-transparent"
        aria-hidden
      />

      <div className="relative p-5 sm:p-6">
        <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.2em] text-dnd-gold/90">
          Última mesa
        </p>
        <h2 className="mt-1 font-display text-2xl leading-tight text-dnd-parchment sm:text-[1.65rem]">
          {session.nome}
        </h2>
        <p className="mt-1 font-ui text-xs text-dnd-parchment-muted">Atualizada em {updated}</p>

        {summary ? (
          <p className="mt-3 max-w-2xl font-narrative text-sm leading-relaxed text-dnd-parchment-muted line-clamp-3">
            {summary}
          </p>
        ) : (
          <p className="mt-3 font-narrative text-sm text-dnd-parchment-muted">
            Retome a aventura exatamente de onde você parou.
          </p>
        )}

        <DndButton variant="ember" className="mt-5" onClick={onContinue}>
          <Play className="h-4 w-4" />
          Retomar agora
        </DndButton>
      </div>
    </section>
  );
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
  const visibleSessions = sessions.slice(0, 6);

  const navCols =
    isAdmin && onOpenTranslation ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <HubLayout
      title="Suas crônicas"
      subtitle="Retome uma aventura em andamento ou abra novos caminhos na mesa."
      label="Sua mesa"
      headerActions={
        <div className="flex items-center gap-1 rounded-xl border border-dnd-gold/12 bg-dnd-obsidian-raised/40 p-1">
          <DndButton variant="ghost" size="sm" onClick={onOpenSettings} aria-label="Configurações">
            <Settings className="h-4 w-4" />
          </DndButton>
          <DndButton variant="ghost" size="sm" onClick={onLogout} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </DndButton>
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <HubStatPill variant="inline" label="Crônicas" value={sessions.length} />
        <HubStatPill variant="inline" label="Heróis" value={charactersCount} />
        <HubStatPill variant="inline" label="Homebrew" value={useAiHomebrew ? 'IA+' : 'Manual'} />
      </div>

      {featured ? (
        <FeaturedChronicle
          session={featured}
          summary={featuredSessionFacts?.storySummary}
          onContinue={() => onContinueGame(featured.id)}
        />
      ) : null}

      <HubSectionHeader
        title="Mesas recentes"
        action={
          sessions.length > 6 ? (
            <button
              type="button"
              onClick={onOpenAllSessions}
              className="inline-flex items-center gap-1 font-ui text-sm text-dnd-gold transition hover:text-dnd-parchment"
            >
              Ver todas
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null
        }
      />

      <SessionGrid
        sessions={visibleSessions}
        onPlay={onContinueGame}
        onManage={setManageSession}
        onCreateHero={onCreateHero}
      />

      <HubSectionHeader title="Explorar" className="mt-10" />
      <div className={`grid gap-3 ${navCols}`}>
        <HubNavCard
          accent="ember"
          icon={<Users className="h-5 w-5" />}
          title="Cofre de heróis"
          description="Fichas prontas para qualquer saga"
          onClick={onOpenVault}
        />
        <HubNavCard
          icon={<FlaskConical className="h-5 w-5" />}
          title="Grimório"
          description="Homebrew, magias e criaturas"
          onClick={onOpenHomebrew}
        />
        <HubNavCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Todas as crônicas"
          description="Lista completa de sessões"
          onClick={onOpenAllSessions}
        />
        {isAdmin && onOpenTranslation ? (
          <HubNavCard
            accent="cyan"
            icon={<Languages className="h-5 w-5" />}
            title="Tradução"
            description="Termos do sistema (admin)"
            onClick={onOpenTranslation}
          />
        ) : null}
      </div>

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
