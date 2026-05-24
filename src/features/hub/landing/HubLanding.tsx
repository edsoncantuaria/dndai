'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, FlaskConical, Languages, Play, Plus, Users } from 'lucide-react';
import {
  AmbientBackground,
  DndBadge,
  DndButton,
  DndCard,
  DndDivider,
  DndHeading,
} from '@/components/primitives';
import { CinematicBackdrop } from '@/components/cinematic';
import { cinematicImages } from '@/lib/cinematicAssets';
import { useAuth } from '@/contexts/AuthContext';
import type { HubIntent } from '@/contexts/HubIntentContext';
import * as GameService from '@/services/gameService';
import type { SessaoIA } from '@/types';
import type { SessionFactsResponse } from '@/services/gameService';
import { LandscapeBlocker } from '@/features/intro/LandscapeBlocker';
import { HubHeroParallax } from '@/components/motion/HubHeroParallax';

export interface HubLandingProps {
  onNavigate: (intent: HubIntent) => void;
}

export function HubLanding({ onNavigate }: HubLandingProps) {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<SessaoIA[]>([]);
  const [facts, setFacts] = useState<SessionFactsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await GameService.getGameSessions();
      const sorted = (list || []).slice().sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setSessions(sorted);
      if (sorted.length > 0) {
        try {
          const f = await GameService.getSessionFacts(sorted[0].id);
          setFacts(f);
        } catch {
          setFacts(null);
        }
      } else {
        setFacts(null);
      }
    } catch (e) {
      console.warn('[HubLanding] Falha ao carregar sessões', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const latestSession = sessions[0];

  const cards = [
    {
      id: 'continue' as const,
      title: 'Continuar',
      desc: latestSession
        ? `Retomar "${latestSession.nome}"`
        : 'Nenhuma crônica em andamento',
      icon: <Play className="h-6 w-6" />,
      disabled: !latestSession,
      action: () => {
        if (latestSession) onNavigate({ type: 'continue', sessionId: latestSession.id });
      },
    },
    {
      id: 'sessions' as const,
      title: 'Suas mesas',
      desc: 'Crônicas salvas e sessões em andamento',
      icon: <BookOpen className="h-6 w-6" />,
      action: () => onNavigate({ type: 'session_list' }),
    },
    {
      id: 'new' as const,
      title: 'Nova aventura',
      desc: 'Escolha um herói e abra uma mesa',
      icon: <Plus className="h-6 w-6" />,
      action: () => onNavigate({ type: 'character_vault' }),
    },
    {
      id: 'vault' as const,
      title: 'Cofre de heróis',
      desc: 'Personagens prontos para a jornada',
      icon: <Users className="h-6 w-6" />,
      action: () => onNavigate({ type: 'character_vault' }),
    },
    {
      id: 'homebrew' as const,
      title: 'Homebrew',
      desc: 'Itens, magias e criaturas da comunidade',
      icon: <FlaskConical className="h-6 w-6" />,
      action: () => onNavigate({ type: 'homebrew_store' }),
    },
    ...(user?.id === 1
      ? [
          {
            id: 'translation' as const,
            title: 'Tradução',
            desc: 'Termos do sistema (não é homebrew)',
            icon: <Languages className="h-6 w-6" />,
            action: () => onNavigate({ type: 'translation_studio' }),
          },
        ]
      : []),
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <AmbientBackground variant="cinematic" showVignette={false} />
      <LandscapeBlocker />

      <div className="relative z-10 mx-auto max-w-screen-xl px-4 pb-12 pt-[calc(2rem+var(--dnd-safe-top))]">
        <section className="relative mb-12 overflow-hidden rounded-2xl border border-dnd-gold/15 shadow-[var(--dnd-shadow-hero)]">
          <CinematicBackdrop
            image={cinematicImages.finalBattle}
            imageAlt="Céu dramático sobre as terras da aventura"
            intensity="strong"
            kenBurns
            className="min-h-[min(52vh,420px)]"
          >
            <header className="dnd-hero-stage flex min-h-[min(52vh,420px)] flex-col justify-end p-6 sm:p-10">
              <HubHeroParallax>
                <div className="max-w-3xl">
                  <div className="dnd-brand-accent mb-4" aria-hidden />
                  <DndHeading variant="label">Sua jornada começa aqui</DndHeading>
                  <DndHeading variant="hero" className="mt-3 max-w-4xl">
                    Bem-vindo, {user?.username ?? 'aventureiro'}
                  </DndHeading>
                  <p className="mt-5 max-w-xl font-narrative text-xl leading-relaxed text-dnd-parchment md:text-2xl">
                    Escolha um destino. O destino observa.
                  </p>
                </div>
              </HubHeroParallax>
              <DndButton variant="ghost" size="sm" className="absolute right-4 top-4 border border-dnd-gold/20 bg-dnd-obsidian/50" onClick={logout}>
                Sair
              </DndButton>
            </header>
          </CinematicBackdrop>
        </section>

        <DndHeading variant="section" className="mb-6">
          Escolha seu caminho
        </DndHeading>

        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              disabled={card.disabled || loading}
              onClick={card.action}
              className="group text-left disabled:opacity-40"
            >
              <DndCard
                padding="lg"
                hover
                className="h-full border-dnd-gold/10 transition duration-300 group-hover:border-dnd-ember/30 group-hover:shadow-[var(--dnd-shadow-elevated)]"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl border border-dnd-gold/25 bg-gradient-to-br from-dnd-ember/20 to-dnd-obsidian-raised p-3.5 text-dnd-gold shadow-[0_0_24px_-8px_var(--dnd-ember-glow)] transition group-hover:border-dnd-ember/40">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="font-display text-xl text-dnd-parchment transition group-hover:text-dnd-gold-bright md:text-2xl">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 font-ui text-sm leading-relaxed text-dnd-parchment-muted">{card.desc}</p>
                  </div>
                </div>
              </DndCard>
            </button>
          ))}
        </div>

        <DndDivider className="my-10" />

        <section>
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-dnd-gold" />
            <DndHeading variant="section">Destaques da comunidade</DndHeading>
            {sessions.length > 0 ? (
              <DndBadge variant="muted">{sessions.length} crônicas</DndBadge>
            ) : null}
          </div>

          {loading ? (
            <p className="font-ui text-sm text-dnd-parchment-muted">Consultando os pergaminhos…</p>
          ) : facts?.storySummary ? (
            <DndCard padding="md">
              <p className="font-narrative text-base leading-relaxed text-dnd-parchment">{facts.storySummary}</p>
            </DndCard>
          ) : (
            <DndCard padding="md" className="text-center">
              <p className="font-narrative text-lg italic text-dnd-parchment-muted">
                Nenhuma crônica iniciada — forje seu destino.
              </p>
              <DndButton
                variant="ember"
                className="mt-4"
                onClick={() => onNavigate({ type: 'creating_character' })}
              >
                Criar primeiro herói
              </DndButton>
            </DndCard>
          )}
        </section>

        <footer className="mt-12 text-center font-ui text-[10px] text-dnd-parchment-muted/70">
          Crônicas de Aventuras · UI v2
        </footer>
      </div>
    </div>
  );
}
