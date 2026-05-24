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
  if (gameStage === 'main_menu') {
    return (
      <HubMain
        sessions={sessions}
        charactersCount={characters.length}
        featuredSessionFacts={featuredSessionFacts}
        useAiHomebrew={useAiHomebrew}
        isAdmin={isAdmin}
        onContinueGame={onContinueGame}
        onOpenVault={() => onSetStage('character_vault')}
        onOpenHomebrew={() => onSetStage('homebrew_store')}
        onOpenTranslation={isAdmin ? () => onSetStage('translation_studio') : undefined}
        onOpenAllSessions={() => onSetStage('session_list')}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
        onRequestRenameSession={onRequestRenameSession}
        onRequestCloneSession={onRequestCloneSession}
        onRequestDeleteSession={onRequestDeleteSession}
        onCreateHero={() => onSetStage('character_vault')}
      />
    );
  }

  if (gameStage === 'session_list') {
    return (
      <SessionListPage
        sessions={sessions}
        onBack={() => onSetStage('main_menu')}
        onContinueGame={onContinueGame}
        onCreateHero={() => onSetStage('character_vault')}
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
        onBack={() => onSetStage('main_menu')}
        onCreateHero={() => onSetStage('creating_character')}
        onStartWithHero={onStartFromVault}
        onDeleteHero={onRequestDeleteCharacter}
        onViewSessions={() => onSetStage('session_list')}
      />
    );
  }

  return null;
}
