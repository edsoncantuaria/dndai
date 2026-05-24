'use client';

import HomebrewStore from '@/components/Homebrew/HomebrewStore';
import { HomebrewLayout } from './HomebrewLayout';
import { LandscapeBlocker } from '@/features/intro/LandscapeBlocker';

export interface HomebrewStorePageProps {
  onBack: () => void;
}

/** Marketplace homebrew — sem entrada para o estúdio de tradução do sistema */
export function HomebrewStorePage({ onBack }: HomebrewStorePageProps) {
  return (
    <HomebrewLayout
      title="Oficina & marketplace"
      subtitle="Crie, instale e compartilhe raças, classes, itens e monstros. Traduções do jogo ficam em outro lugar."
      onBack={onBack}
    >
      <LandscapeBlocker />
      <div className="rounded-xl border border-dnd-gold/15 overflow-hidden">
        <HomebrewStore returnToMenu={onBack} embedded hideTranslationEntry showSourceBadges />
      </div>
    </HomebrewLayout>
  );
}
