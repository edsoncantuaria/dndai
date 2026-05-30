'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Dices, ScrollText, Shield, Sparkles, Swords } from 'lucide-react';
import { DndButton, DndDivider, DndHeading } from '@/components/primitives';
import { CinematicBackdrop } from '@/components/cinematic';
import { introSlides } from '@/lib/cinematicAssets';
import { LandscapeBlocker } from '@/features/intro/LandscapeBlocker';

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

export interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const hero = introSlides[0];

  return (
    <div className="relative min-h-screen min-h-[100dvh] overflow-x-hidden">
      <CinematicBackdrop
        image={hero.image}
        imageAlt={hero.imageAlt}
        intensity="strong"
        kenBurns
        className="min-h-screen min-h-[100dvh]"
      />
      <LandscapeBlocker />

      <div className="relative z-10 mx-auto flex min-h-screen min-h-[100dvh] max-w-5xl flex-col px-4 pb-[calc(2rem+var(--dnd-safe-bottom))] pt-[calc(2.5rem+var(--dnd-safe-top))]">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="dnd-brand-accent mx-auto mb-3" aria-hidden />
          <p className="font-ui text-[11px] font-bold uppercase tracking-[0.35em] text-dnd-ember">
            Crônicas de Aventuras
          </p>
          <DndHeading variant="hero" className="mt-2 drop-shadow-lg">
            RPG de mesa com IA que respeita as regras
          </DndHeading>
          <p className="mx-auto mt-4 max-w-2xl font-narrative text-lg leading-relaxed text-dnd-parchment-muted">
            Crie heróis, explore mundos vivos e jogue campanhas solo com narração inteligente —
            sem a IA inventar dano ou ouro.
          </p>
        </motion.header>

        <DndDivider className="my-8 opacity-70" />

        <div className="grid gap-4 sm:grid-cols-2">
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-dnd-gold/15 bg-dnd-obsidian/55 p-4 backdrop-blur-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dnd-gold/25 bg-dnd-mist/40">
                {item.icon}
              </div>
              <div>
                <h2 className="font-display text-lg text-dnd-parchment">{item.title}</h2>
                <p className="mt-1 font-ui text-sm leading-relaxed text-dnd-parchment-muted">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <DndButton variant="ember" size="lg" className="min-w-[200px]" onClick={onRegister}>
            <Sparkles className="h-4 w-4" />
            Começar grátis
          </DndButton>
          <DndButton
            variant="ghost"
            size="lg"
            className="min-w-[200px] border border-dnd-gold/25 bg-dnd-obsidian/40"
            onClick={onLogin}
          >
            Já tenho conta
          </DndButton>
        </div>

        <p className="mt-6 text-center font-ui text-xs text-dnd-parchment-muted/90">
          Créditos de narração inclusos no cadastro · BYOK opcional (Google AI Studio)
        </p>

        <div className="pointer-events-none absolute right-4 top-24 hidden opacity-20 lg:block">
          <Image src={hero.image} alt="" width={120} height={120} className="rounded-full" />
        </div>
      </div>
    </div>
  );
}
