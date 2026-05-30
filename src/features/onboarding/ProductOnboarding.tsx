'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Play, UserPlus, Sparkles } from 'lucide-react';
import { DndButton, DndCard, DndDivider, DndHeading } from '@/components/primitives';
import { CinematicBackdrop } from '@/components/cinematic';
import { introSlides } from '@/lib/cinematicAssets';
import { useOnboarding, type OnboardingStep } from '@/contexts/OnboardingContext';
import { AiAccessStep } from './AiAccessStep';

const STEP_LABELS: Record<Exclude<OnboardingStep, 'done'>, string> = {
  welcome: 'O que é',
  ai_access: 'IA na mesa',
  create_hero: 'Criar herói',
  play: 'Jogar',
};

export function ProductOnboarding() {
  const { step, setStep, advanceStep, finishOnboarding, needsOnboarding } = useOnboarding();

  if (!needsOnboarding || step === 'done' || step === 'create_hero') {
    return null;
  }

  const slide = introSlides[1];
  const stepIndex = ['welcome', 'ai_access', 'create_hero', 'play'].indexOf(step);

  const handleWelcomeNext = () => advanceStep();
  const handleAiNext = () => advanceStep();
  const handleCreateHero = () => setStep('create_hero');
  const handlePlayFinish = async () => {
    await finishOnboarding();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <CinematicBackdrop
        image={slide.image}
        imageAlt={slide.imageAlt}
        intensity="medium"
        className="absolute inset-0"
      />
      <div className="absolute inset-0 bg-dnd-obsidian/75 backdrop-blur-sm" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg"
      >
        <DndCard padding="lg" className="shadow-[var(--dnd-shadow-elevated)]">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.3em] text-dnd-ember">
            Passo {stepIndex + 1} de 4 · {STEP_LABELS[step as keyof typeof STEP_LABELS]}
          </p>
          <DndHeading variant="section" className="mt-2">
            {step === 'welcome' && 'Bem-vindo à mesa digital'}
            {step === 'ai_access' && 'Como a IA entra na aventura'}
            {step === 'play' && 'Hora de jogar'}
          </DndHeading>

          <div className="mt-2 flex gap-1.5">
            {(['welcome', 'ai_access', 'create_hero', 'play'] as const).map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-dnd-ember' : 'bg-dnd-mist-strong'}`}
              />
            ))}
          </div>

          <DndDivider className="my-5" />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              {step === 'welcome' ? (
                <div className="space-y-4">
                  <p className="font-narrative text-lg leading-relaxed text-dnd-parchment-muted">
                    <strong className="text-dnd-parchment">Crônicas de Aventuras</strong> é um RPG solo
                    com mestre virtual: você descreve ações, o motor aplica D&D 5e, e a IA narra o
                    resultado — sem contradizer HP, ouro ou combate.
                  </p>
                  <ul className="space-y-2 font-ui text-sm text-dnd-parchment-muted">
                    <li>· Hub com personagens, sessões e homebrew</li>
                    <li>· Mesa com dados 3D, trilha ambiente e log narrativo</li>
                    <li>· Próximo passo: configurar IA e forjar seu primeiro herói</li>
                  </ul>
                  <DndButton variant="ember" size="lg" className="w-full" onClick={handleWelcomeNext}>
                    Entendi — continuar
                    <ChevronRight className="h-4 w-4" />
                  </DndButton>
                </div>
              ) : null}

              {step === 'ai_access' ? <AiAccessStep onContinue={handleAiNext} /> : null}

              {step === 'play' ? (
                <div className="space-y-4">
                  <p className="font-narrative text-base leading-relaxed text-dnd-parchment-muted">
                    Seu herói está pronto. Abra o cofre para iniciar uma sessão nova ou continuar uma
                    crônica salva.
                  </p>
                  <DndButton variant="ember" size="lg" className="w-full" onClick={handlePlayFinish}>
                    <Play className="h-4 w-4" />
                    Ir para o hub e jogar
                  </DndButton>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {step === 'ai_access' ? (
            <DndButton
              variant="ghost"
              className="mt-4 w-full border border-dnd-gold/20"
              onClick={handleCreateHero}
            >
              <UserPlus className="h-4 w-4" />
              Pular para criar herói
            </DndButton>
          ) : null}
        </DndCard>
      </motion.div>
    </div>
  );
}

/** Barra fina durante criação de personagem (passo 3). */
export function OnboardingCreateHeroBar() {
  const { step, advanceStep } = useOnboarding();
  if (step !== 'create_hero') return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[190] border-b border-dnd-gold/20 bg-dnd-obsidian/90 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-dnd-ember" />
          <p className="font-ui text-sm text-dnd-parchment">
            <strong>Passo 3:</strong> Forje seu primeiro herói
          </p>
        </div>
        <DndButton variant="ghost" size="sm" onClick={() => advanceStep()}>
          Já criei — continuar
        </DndButton>
      </div>
    </div>
  );
}
