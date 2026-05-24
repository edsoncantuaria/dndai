'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Dices, ScrollText, Sparkles } from 'lucide-react';
import { DndButton, DndDivider, DndHeading } from '@/components/primitives';
import { CinematicBackdrop } from '@/components/cinematic';
import { introSlides } from '@/lib/cinematicAssets';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { LandscapeBlocker } from './LandscapeBlocker';

const SLIDES = [
  {
    icon: <ScrollText className="h-10 w-10 text-dnd-gold" />,
    title: 'Crônicas narradas por IA',
    body: 'Cada escolha molda um mundo vivo. O texto é o palco — a imaginação, o limite.',
    ...introSlides[0],
  },
  {
    icon: <Sparkles className="h-10 w-10 text-dnd-ember" />,
    title: 'Mestre virtual à mesa',
    body: 'Regras de D&D, combate estruturado e diário automático — sem perder a imersão.',
    ...introSlides[1],
  },
  {
    icon: <Dices className="h-10 w-10 text-dnd-gold" />,
    title: 'Dados 3D de verdade',
    body: 'Rolagens físicas em tela cheia. Críticos brilham em ouro; falhas ecoam nas sombras.',
    ...introSlides[2],
  },
];

export interface IntroExperienceProps {
  onComplete: () => void;
}

export function IntroExperience({ onComplete }: IntroExperienceProps) {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) onComplete();
    else setIndex((i) => i + 1);
  };

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <div className="relative min-h-screen min-h-[100dvh] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.image}
          className="absolute inset-0"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <CinematicBackdrop
            image={slide.image}
            imageAlt={slide.imageAlt}
            intensity="strong"
            kenBurns
            className="min-h-screen min-h-[100dvh]"
          />
        </motion.div>
      </AnimatePresence>

      <LandscapeBlocker />

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] flex-col items-center justify-end px-4 pb-[calc(2rem+var(--dnd-safe-bottom))] pt-[calc(3rem+var(--dnd-safe-top))]">
        <div className="flex w-full max-w-lg flex-col items-center text-center">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="dnd-brand-accent mx-auto mb-4" aria-hidden />
            <p className="font-ui text-[11px] font-bold uppercase tracking-[0.35em] text-dnd-ember">
              Crônicas de Aventuras
            </p>
            <DndHeading variant="hero" className="mt-3 drop-shadow-lg">
              Bem-vindo à mesa
            </DndHeading>
          </motion.div>

          <DndDivider className="my-6 w-full max-w-xs opacity-80" />

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={reducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-4 rounded-2xl border border-dnd-gold/15 bg-dnd-obsidian/50 px-5 py-6 backdrop-blur-md"
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-full border border-dnd-gold/35 bg-dnd-mist shadow-[0_0_24px_var(--dnd-ember-glow)]">
                <Image src={slide.image} alt="" fill className="object-cover opacity-70" sizes="56px" />
                <div className="absolute inset-0 flex items-center justify-center bg-dnd-obsidian/40">
                  {slide.icon}
                </div>
              </div>
              <h2 className="font-display text-2xl text-dnd-parchment md:text-3xl">{slide.title}</h2>
              <p className="font-narrative text-lg leading-relaxed text-dnd-parchment-muted">{slide.body}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-8 bg-dnd-ember' : 'w-2 bg-dnd-mist-strong'
                }`}
              />
            ))}
          </div>

          <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
            {index > 0 ? (
              <DndButton variant="ghost" className="flex-1 border border-dnd-gold/20 bg-dnd-obsidian/40" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </DndButton>
            ) : (
              <div className="hidden flex-1 sm:block" />
            )}
            <DndButton variant="ember" size="lg" className="flex-1" onClick={goNext}>
              {isLast ? 'Começar a aventura' : 'Continuar'}
              {!isLast ? <ChevronRight className="h-4 w-4" /> : null}
            </DndButton>
          </div>

          {!isLast ? (
            <button
              type="button"
              onClick={onComplete}
              className="mt-4 font-ui text-xs text-dnd-parchment-muted underline-offset-2 hover:text-dnd-gold hover:underline"
            >
              Pular introdução
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
