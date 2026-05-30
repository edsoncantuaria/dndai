'use client';

import { motion } from 'framer-motion';
import { Dices, ScrollText, Shield, Sparkles, Swords } from 'lucide-react';
import { DndButton, DndDivider, DndHeading } from '@/components/primitives';
import { CinematicBackdrop } from '@/components/cinematic';
import { introSlides } from '@/lib/cinematicAssets';
import { LandscapeBlocker } from '@/features/intro/LandscapeBlocker';
import { cn } from '@/lib/utils';

const HIGHLIGHTS = [
  {
    icon: <ScrollText className="h-6 w-6 text-dnd-gold" />,
    title: 'Mestre com regras reais',
    body: 'D&D 5e com motor autoritativo — HP, combate e inventário não dependem da IA.',
  },
  {
    icon: <Swords className="h-6 w-6 text-dnd-ember" />,
    title: 'Mesa que não trava',
    body: 'Resultado mecânico na hora; narração cinematográfica chega em seguida.',
  },
  {
    icon: <Dices className="h-6 w-6 text-dnd-gold" />,
    title: 'Dados 3D e som imersivo',
    body: 'Rolagens físicas, trilhas ambientais e feedback sonoro na mesa.',
  },
  {
    icon: <Shield className="h-6 w-6 text-dnd-parchment" />,
    title: 'Sua chave ou créditos inclusos',
    body: 'Traga sua API Gemini (BYOK) ou use créditos da plataforma — custo previsível.',
  },
];

const legibleShadow = 'drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]';

export interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const hero = introSlides[0];

  return (
    <div className="relative h-full max-h-[100dvh] overflow-x-hidden overflow-y-auto">
      <CinematicBackdrop
        image={hero.image}
        imageAlt={hero.imageAlt}
        intensity="strong"
        kenBurns
        className="fixed inset-0 min-h-[100dvh]"
      />
      {/* Scrim extra para texto legível sobre arte clara */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] min-h-[100dvh] bg-gradient-to-b from-dnd-obsidian/95 via-dnd-obsidian/88 to-dnd-obsidian/96"
        aria-hidden
      />
      <LandscapeBlocker />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-4 pb-[calc(1.5rem+var(--dnd-safe-bottom))] pt-[calc(1.25rem+var(--dnd-safe-top))] sm:px-6 sm:pb-[calc(2rem+var(--dnd-safe-bottom))] sm:pt-[calc(2.5rem+var(--dnd-safe-top))]">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'shrink-0 rounded-2xl border border-dnd-gold/20 p-5 shadow-[var(--dnd-shadow-elevated)] sm:p-7',
            'bg-dnd-obsidian/95 backdrop-blur-md',
          )}
        >
          <header className="text-center">
            <div className="dnd-brand-accent mx-auto mb-2 sm:mb-3" aria-hidden />
            <p
              className={cn(
                'font-ui text-[10px] font-bold uppercase tracking-[0.32em] text-dnd-ember sm:text-[11px] sm:tracking-[0.35em]',
                legibleShadow,
              )}
            >
              Crônicas de Aventuras
            </p>
            <DndHeading
              variant="hero"
              className={cn(
                'mt-2 text-[1.65rem] leading-[1.1] sm:text-4xl md:text-5xl lg:text-7xl',
                legibleShadow,
              )}
            >
              RPG de mesa com IA que respeita as regras
            </DndHeading>
            <p
              className={cn(
                'mx-auto mt-3 max-w-2xl font-narrative text-sm leading-relaxed text-dnd-parchment sm:mt-4 sm:text-lg',
                legibleShadow,
              )}
            >
              Crie heróis, explore mundos vivos e jogue campanhas solo — sem a IA inventar dano ou ouro.
            </p>
          </header>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-6 flex w-full flex-col items-stretch gap-2.5 sm:mt-8 sm:flex-row sm:items-center sm:justify-center sm:gap-3"
          >
            <DndButton variant="ember" size="lg" className="w-full sm:min-w-[200px] sm:w-auto" onClick={onRegister}>
              <Sparkles className="h-4 w-4" />
              Começar grátis
            </DndButton>
            <DndButton
              variant="goldOutline"
              size="lg"
              className="w-full bg-dnd-obsidian-raised text-dnd-parchment sm:min-w-[200px] sm:w-auto"
              onClick={onLogin}
            >
              Já tenho conta
            </DndButton>
          </motion.div>

          <p className="mt-3 text-center font-ui text-[11px] text-dnd-parchment-muted sm:mt-4 sm:text-xs">
            Créditos de narração inclusos · BYOK opcional (Google AI Studio)
          </p>
        </motion.section>

        <DndDivider className="my-6 opacity-70 sm:my-8" />

        <div className="grid gap-3 pb-4 sm:grid-cols-2 sm:gap-4 sm:pb-0">
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              className="flex gap-3 rounded-2xl border border-dnd-gold/20 bg-dnd-obsidian-raised/95 p-3 shadow-[var(--dnd-shadow-card)] backdrop-blur-sm sm:gap-4 sm:p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dnd-gold/25 bg-dnd-mist/40 sm:h-11 sm:w-11">
                {item.icon}
              </div>
              <div>
                <h2 className="font-display text-base text-dnd-parchment sm:text-lg">{item.title}</h2>
                <p className="mt-0.5 font-ui text-xs leading-relaxed text-dnd-parchment/90 sm:mt-1 sm:text-sm">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
