'use client';

import type { GameMenuContentProps } from '@/components/game-menu/GameMenuContent';
import { HubMain } from './HubMain';
import { SessionListPage } from './SessionListPage';
import { HeroVault } from './vault/HeroVault';

type HubShellProps = Pick<
  GameMenuContentProps,
  | 'gameStage'
  | 'sessions'
  | 'characters'
  | 'featuredSessionFacts'
  | 'useAiHomebrew'
  | 'onSetStage'
  | 'onContinueGame'
  | 'onStartFromVault'
  | 'onRequestDeleteCharacter'
  | 'onRequestDeleteSession'
  | 'onRequestRenameSession'
  | 'onRequestCloneSession'
  | 'onOpenSettings'
  | 'onLogout'
  | 'isAdmin'
>;

export function HubShell({
  gameStage,
  sessions,
  characters,
  featuredSessionFacts,
  useAiHomebrew,
  onSetStage,
  onContinueGame,
  onStartFromVault,
  onRequestDeleteCharacter,
  onRequestDeleteSession,
  onRequestRenameSession,
  onRequestCloneSession,
  onOpenSettings,
  onLogout,
  isAdmin,
}: HubShellProps) {
  const goToMesa = () => onSetStage('main_menu');

  const openFromMesa = (stage: 'character_vault' | 'session_list' | 'homebrew_store' | 'translation_studio') => {
    onSetStage(stage);
  };

  if (gameStage === 'main_menu') {
    return (
      <HubMain
        sessions={sessions}
        charactersCount={characters.length}
        featuredSessionFacts={featuredSessionFacts}
        useAiHomebrew={useAiHomebrew}
        isAdmin={isAdmin}
        onContinueGame={onContinueGame}
        onOpenVault={() => openFromMesa('character_vault')}
        onOpenHomebrew={() => openFromMesa('homebrew_store')}
        onOpenTranslation={isAdmin ? () => openFromMesa('translation_studio') : undefined}
        onOpenAllSessions={() => openFromMesa('session_list')}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
        onRequestRenameSession={onRequestRenameSession}
        onRequestCloneSession={onRequestCloneSession}
        onRequestDeleteSession={onRequestDeleteSession}
        onCreateHero={() => openFromMesa('character_vault')}
      />
    );
  }

  if (gameStage === 'session_list') {
    return (
      <SessionListPage
        sessions={sessions}
        onBack={goToMesa}
        onContinueGame={onContinueGame}
        onCreateHero={() => {
          onSetStage('character_vault');
        }}
        onRequestRenameSession={onRequestRenameSession}
        onRequestCloneSession={onRequestCloneSession}
        onRequestDeleteSession={onRequestDeleteSession}
      />
    );
  }

  if (gameStage === 'character_vault') {
    return (
      <HeroVault
        characters={characters}
        sessions={sessions}
        onBack={goToMesa}
        onCreateHero={() => onSetStage('creating_character')}
        onStartWithHero={onStartFromVault}
        onDeleteHero={onRequestDeleteCharacter}
        onViewSessions={() => openFromMesa('session_list')}
      />
    );
  }

  return null;
}
