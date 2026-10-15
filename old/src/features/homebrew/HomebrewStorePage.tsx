'use client';

import { useCallback, useState } from 'react';
import HomebrewStore from '@/components/Homebrew/HomebrewStore';
import { HomebrewLayout } from './HomebrewLayout';
import { LandscapeBlocker } from '@/features/intro/LandscapeBlocker';

export interface HomebrewStorePageProps {
  onBack: () => void;
}

type StoreView = 'list' | 'create' | 'edit';

/** Marketplace homebrew — sem estúdio de tradução do sistema */
export function HomebrewStorePage({ onBack }: HomebrewStorePageProps) {
  const [storeView, setStoreView] = useState<StoreView>('list');

  const handleViewChange = useCallback((view: StoreView) => {
    setStoreView(view);
  }, []);

  const inCreator = storeView === 'create' || storeView === 'edit';

  return (
    <HomebrewLayout
      title={inCreator ? (storeView === 'edit' ? 'Editar criação' : 'Nova criação') : 'Homebrew'}
      subtitle={
        inCreator
          ? 'Preencha as etapas. O conteúdo é validado ao salvar.'
          : 'Publique raças, classes, itens e monstros. Instale o que outros mestres compartilharam.'
      }
      onBack={inCreator ? () => setStoreView('list') : onBack}
      backLabel={inCreator ? 'Voltar ao Homebrew' : 'Voltar ao hub'}
    >
      <LandscapeBlocker />
      <HomebrewStore
        returnToMenu={onBack}
        embedded
        hideTranslationEntry
        showSourceBadges
        controlledView={storeView}
        onViewChange={handleViewChange}
      />
    </HomebrewLayout>
  );
}
