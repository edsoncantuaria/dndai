'use client';

import { useMemo, useState } from 'react';
import type { SessaoIA } from '@/types';
import type { SessionFactsResponse } from '@/services/gameService';
import {
  BookOpen,
  ChevronRight,
  FlaskConical,
  HelpCircle,
  Languages,
  LogOut,
  Play,
  Plus,
  Scroll,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { DndButton } from '@/components/primitives';
import { cinematicImages } from '@/lib/cinematicAssets';
import { HubLayout, HubNavCard, HubSectionHeader, HubQuickStat } from './HubLayout';
import { HubCinematicPanel } from './HubCinematicPanel';
import { PenaiIntroModal } from './PenaiIntroModal';
import { SessionGrid } from './session/SessionGrid';
import { SessionActionsSheet } from './session/SessionCard';
import { getSessionMeta } from './session/sessionMeta';

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

function pickFeaturedSession(sessions: SessaoIA[]): SessaoIA | null {
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return sorted[0] ?? null;
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
  const [introOpen, setIntroOpen] = useState(false);

  const featured = useMemo(() => pickFeaturedSession(sessions), [sessions]);
  const recentSessions = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (!featured) return sorted.slice(0, 6);
    return sorted.filter((s) => s.id !== featured.id).slice(0, 5);
  }, [sessions, featured]);

  const hasHeroes = charactersCount > 0;
  const hasSessions = sessions.length > 0;

  const exploreCols =
    isAdmin && onOpenTranslation ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  const featuredMeta = featured ? getSessionMeta(featured) : null;
  const featuredUpdated = featured
    ? new Date(featured.updatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    : null;

  return (
    <HubLayout
      variant="home"
      label="Sua mesa"
      title="Suas crônicas"
      subtitle="Retome uma aventura em andamento ou acenda novos caminhos na fogueira."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {hasSessions ? (
            <DndButton variant="goldOutline" size="sm" className="hidden sm:inline-flex" onClick={onOpenAllSessions}>
              <BookOpen className="h-4 w-4" aria-hidden />
              Suas mesas
            </DndButton>
          ) : null}
          <div className="flex items-center gap-1 rounded-xl border border-dnd-gold/15 bg-dnd-obsidian-raised/50 p-1 shadow-[var(--dnd-shadow-card)]">
            <DndButton variant="ghost" size="sm" onClick={onOpenSettings} aria-label="Configurações">
              <Settings className="h-4 w-4" />
            </DndButton>
            <DndButton variant="ghost" size="sm" onClick={onLogout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </DndButton>
          </div>
        </div>
      }
    >
      <PenaiIntroModal openRequested={introOpen} onOpenRequestedChange={setIntroOpen} />

      <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-3">
        <HubQuickStat
          icon={Scroll}
          label="Crônicas"
          value={sessions.length}
          onClick={onOpenAllSessions}
          active={hasSessions}
        />
        <HubQuickStat
          icon={Users}
          label="Heróis"
          value={charactersCount}
          onClick={onOpenVault}
          active={hasHeroes}
        />
        <HubQuickStat
          icon={FlaskConical}
          label="Homebrew"
          value={useAiHomebrew ? 'IA+' : 'Manual'}
          onClick={onOpenHomebrew}
          accent={useAiHomebrew}
        />
      </div>

      {featured && featuredMeta ? (
        <HubCinematicPanel
          eyebrow="Continuar aventura"
          title={featured.nome}
          description={
            featuredSessionFacts?.storySummary ??
            `${featuredMeta.heroName}${featuredMeta.region ? ` · ${featuredMeta.region}` : ''} · Atualizada em ${featuredUpdated}`
          }
          image={cinematicImages.rpgStillLife}
          imageAlt="Mesa de RPG — retome sua crônica"
        >
          <DndButton variant="ember" size="lg" onClick={() => onContinueGame(featured.id)}>
            <Play className="h-4 w-4 fill-current" aria-hidden />
            Retomar jornada
          </DndButton>
        </HubCinematicPanel>
      ) : (
        <HubCinematicPanel
          eyebrow={hasHeroes ? 'Próximo passo' : 'Comece aqui'}
          title={hasHeroes ? 'Abra sua primeira mesa' : 'Forje seu primeiro herói'}
          description={
            hasHeroes
              ? 'Seu herói aguarda no cofre. Escolha uma região e deixe o mundo respirar enquanto você joga.'
              : 'Crie um personagem digno de uma crônica — depois acenda a fogueira da campanha.'
          }
          image={hasHeroes ? cinematicImages.spookyCastle : cinematicImages.rpgStillLife}
          imageAlt={
            hasHeroes
              ? 'Castelo sombrio — nova campanha aguarda'
              : 'Mesa de RPG — comece sua jornada'
          }
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {hasHeroes ? (
              <DndButton variant="ember" size="lg" onClick={onOpenAllSessions}>
                <Scroll className="h-4 w-4" aria-hidden />
                Abrir mesa
              </DndButton>
            ) : (
              <DndButton variant="ember" size="lg" onClick={onCreateHero}>
                <Plus className="h-4 w-4" aria-hidden />
                Criar herói
              </DndButton>
            )}
            <DndButton variant="goldOutline" size="lg" onClick={onOpenVault}>
              <Users className="h-4 w-4" aria-hidden />
              Cofre de heróis
            </DndButton>
          </div>
        </HubCinematicPanel>
      )}

      {recentSessions.length > 0 ? (
        <div className="mt-12">
          <HubSectionHeader
            title="Outras mesas"
            action={
              sessions.length > 6 ? (
                <button
                  type="button"
                  onClick={onOpenAllSessions}
                  className="inline-flex items-center gap-1 font-ui text-sm text-dnd-gold transition hover:text-dnd-parchment"
                >
                  Ver todas
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              ) : null
            }
          />
          <SessionGrid
            sessions={recentSessions}
            onPlay={onContinueGame}
            onManage={setManageSession}
            compact
          />
        </div>
      ) : null}

      <div className="mt-12">
        <HubSectionHeader title="Explorar" />
        <div className={`grid gap-3 ${exploreCols}`}>
          {!hasSessions ? (
            <HubNavCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Suas mesas"
              description="Gerencie campanhas, regiões e retomadas."
              onClick={onOpenAllSessions}
              accent="ember"
            />
          ) : null}
          <HubNavCard
            icon={<Users className="h-5 w-5" />}
            title="Cofre de heróis"
            description="Fichas prontas para qualquer saga."
            onClick={onOpenVault}
            accent="gold"
          />
          <HubNavCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Homebrew"
            description="Magias, itens e criaturas da sua mesa."
            onClick={onOpenHomebrew}
            badge={useAiHomebrew ? 'IA+' : undefined}
          />
          {isAdmin && onOpenTranslation ? (
            <HubNavCard
              icon={<Languages className="h-5 w-5" />}
              title="Tradução"
              description="Termos do sistema (admin)."
              onClick={onOpenTranslation}
              accent="cyan"
            />
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIntroOpen(true)}
        className="mt-10 flex w-full items-center justify-center gap-2 rounded-xl border border-dnd-gold/10 bg-dnd-obsidian-raised/30 py-3 font-ui text-xs text-dnd-parchment-muted transition hover:border-dnd-gold/25 hover:text-dnd-gold"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
        Como funciona o motor PENAI?
      </button>

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
