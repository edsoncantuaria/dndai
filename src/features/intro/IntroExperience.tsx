'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Dices, ScrollText, Sparkles } from 'lucide-react';
import {
  AmbientBackground,
  DndButton,
  DndDivider,
  DndHeading,
} from '@/components/primitives';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { LandscapeBlocker } from './LandscapeBlocker';

const SLIDES = [
  {
    icon: <ScrollText className="h-12 w-12 text-dnd-gold" />,
    title: 'Crônicas narradas por IA',
    body: 'Cada escolha molda um mundo vivo. O texto é o palco — a imaginação, o limite.',
  },
  {
    icon: <Sparkles className="h-12 w-12 text-dnd-ember" />,
    title: 'Mestre virtual à mesa',
    body: 'Regras de D&D, combate estruturado e diário automático — sem perder a imersão.',
  },
  {
    icon: <Dices className="h-12 w-12 text-dnd-gold" />,
    title: 'Dados 3D de verdade',
    body: 'Rolagens físicas em tela cheia. Críticos brilham em ouro; falhas ecoam nas sombras.',
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <AmbientBackground variant="ember" />
      <LandscapeBlocker />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="font-ui text-xs uppercase tracking-[0.35em] text-dnd-gold">Crônicas de Aventuras</p>
          <DndHeading variant="hero" className="mt-3">
            Bem-vindo à mesa
          </DndHeading>
        </motion.div>

        <DndDivider className="my-8 w-full max-w-xs" />

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={reducedMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, x: -24 }}
            transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4 px-2"
          >
            <div className="rounded-full border border-dnd-gold/30 bg-dnd-mist p-5">{slide.icon}</div>
            <h2 className="font-display text-2xl text-dnd-parchment">{slide.title}</h2>
            <p className="font-narrative text-lg leading-relaxed text-dnd-parchment-muted">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-8 bg-dnd-gold' : 'w-2 bg-dnd-mist-strong'
              }`}
            />
          ))}
        </div>

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          {index > 0 ? (
            <DndButton variant="ghost" className="flex-1" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </DndButton>
          ) : (
            <div className="hidden flex-1 sm:block" />
          )}
          <DndButton variant="ember" className="flex-1" onClick={goNext}>
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
  );
}
