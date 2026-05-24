'use client';

import TranslationStudio from '@/components/Homebrew/TranslationStudio';
import { TranslationLayout } from './TranslationLayout';
import { LandscapeBlocker } from '@/features/intro/LandscapeBlocker';

export interface TranslationStudioPageProps {
  onBack: () => void;
}

export function TranslationStudioPage({ onBack }: TranslationStudioPageProps) {
  return (
    <TranslationLayout onBack={onBack}>
      <LandscapeBlocker />
      <TranslationStudio onCancel={onBack} variant="v2" />
    </TranslationLayout>
  );
}
