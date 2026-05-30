'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AiAccessStatus } from '@/types/aiAccess';

export type OnboardingStep = 'welcome' | 'ai_access' | 'create_hero' | 'play' | 'done';

type OnboardingContextValue = {
  needsOnboarding: boolean;
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  advanceStep: () => void;
  finishOnboarding: () => Promise<void>;
  aiAccess: AiAccessStatus | null;
  setAiAccess: (status: AiAccessStatus | null) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const STEP_ORDER: OnboardingStep[] = ['welcome', 'ai_access', 'create_hero', 'play', 'done'];

export function OnboardingProvider({
  children,
  onboardingCompleted,
  initialAiAccess,
  onCompleteOnboarding,
}: {
  children: ReactNode;
  onboardingCompleted: boolean;
  initialAiAccess?: AiAccessStatus | null;
  onCompleteOnboarding: () => Promise<void>;
}) {
  const [step, setStep] = useState<OnboardingStep>(
    onboardingCompleted ? 'done' : 'welcome',
  );
  const [aiAccess, setAiAccess] = useState<AiAccessStatus | null>(initialAiAccess ?? null);

  const needsOnboarding = !onboardingCompleted && step !== 'done';

  useEffect(() => {
    if (onboardingCompleted) {
      setStep('done');
    }
  }, [onboardingCompleted]);

  useEffect(() => {
    if (initialAiAccess) {
      setAiAccess(initialAiAccess);
    }
  }, [initialAiAccess]);

  const advanceStep = useCallback(() => {
    setStep((current) => {
      const idx = STEP_ORDER.indexOf(current);
      if (idx < 0 || idx >= STEP_ORDER.length - 1) return 'done';
      return STEP_ORDER[idx + 1]!;
    });
  }, []);

  const finishOnboarding = useCallback(async () => {
    await onCompleteOnboarding();
    setStep('done');
  }, [onCompleteOnboarding]);

  const value = useMemo(
    () => ({
      needsOnboarding,
      step,
      setStep,
      advanceStep,
      finishOnboarding,
      aiAccess,
      setAiAccess,
    }),
    [needsOnboarding, step, advanceStep, finishOnboarding, aiAccess],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    return {
      needsOnboarding: false,
      step: 'done' as OnboardingStep,
      setStep: () => {},
      advanceStep: () => {},
      finishOnboarding: async () => {},
      aiAccess: null,
      setAiAccess: () => {},
    };
  }
  return ctx;
}
