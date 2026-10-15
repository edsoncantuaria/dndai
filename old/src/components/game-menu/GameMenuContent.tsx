/**
 * Roteador de estágios do app (hub, jogo, homebrew).
 * UI v2: `features/hub`, `features/homebrew`, `GameplayScreen`.
 */
'use client';

import PremiumLoader from '@/components/ui/PremiumLoader';
import Game from '@/components/Game';
import type { Character, SessaoIA } from '@/types';
import type { SessionFactsResponse } from '@/services/gameService';
import type { GameStage } from '@/types/gameStage';
import { HubShell } from '@/features/hub/HubShell';
import { HomebrewStorePage, TranslationStudioPage } from '@/features/homebrew';

export interface GameMenuContentProps {
  gameStage: GameStage;
  character: Character | null;
  sessions: SessaoIA[];
  characters: Character[];
  featuredSessionFacts: SessionFactsResponse | null;
  useAiHomebrew: boolean;
  isLoadingData: boolean;
  onSetStage: (stage: GameStage) => void;
  onReturnToMenu: () => void;
  onContinueGame: (sessionId: number) => void;
  onCharacterCreated: () => void;
  onStartFromVault: (character: Character, existingSession?: SessaoIA | null) => void;
  onRequestDeleteCharacter: (character: Character) => void;
  onRequestEditCharacter: (character: Character) => void;
  onRequestDeleteSession: (session: SessaoIA) => void;
  onRequestRenameSession: (session: SessaoIA) => void;
  onRequestCloneSession: (session: SessaoIA) => void;
  onOpenSettings: () => void;
  onOpenSystemTests: () => void;
  onOpenArchitecture: () => void;
  onLogout: () => void;
  user: { id?: number } | null;
  isActionModalOpen: boolean;
  selectedSessionForAction: SessaoIA | null;
  handleActionModalClose: () => void;
  openSessionActionModal: (session: SessaoIA) => void;
  editCharacterId?: string | number | null;
}

const HUB_STAGES: Array<'main_menu' | 'session_list' | 'character_vault'> = [
  'main_menu',
  'session_list',
  'character_vault',
];

const GameMenuContent: React.FC<GameMenuContentProps> = (props) => {
  const {
    gameStage,
    character,
    isLoadingData,
    onSetStage,
    onReturnToMenu,
    onCharacterCreated,
    user,
  } = props;

  const isAdmin = user?.id === 1;

  if (gameStage === 'playing' && !character) {
    return (
      <PremiumLoader actionLabel="Voltar ao menu" onAction={onReturnToMenu} />
    );
  }

  if (gameStage === 'playing' && character) {
    return (
      <Game
        onCharacterCreated={onCharacterCreated}
        returnToMenu={onReturnToMenu}
        gameStage={gameStage}
      />
    );
  }

  if ((gameStage === 'loading' || isLoadingData) && gameStage !== 'playing') {
    return (
      <PremiumLoader
        title="Abrindo o salão principal"
        subtitle="Sincronizando personagens, crônicas e trilhas sonoras."
        description="Buscando cofres, sessões salvas e recursos premium..."
        actionLabel="Voltar ao menu"
        onAction={() => onSetStage('main_menu')}
      />
    );
  }

  if (HUB_STAGES.includes(gameStage as (typeof HUB_STAGES)[number])) {
    return (
      <HubShell
        gameStage={gameStage}
        sessions={props.sessions}
        characters={props.characters}
        featuredSessionFacts={props.featuredSessionFacts}
        useAiHomebrew={props.useAiHomebrew}
        isAdmin={isAdmin}
        onSetStage={onSetStage}
        onContinueGame={props.onContinueGame}
        onStartFromVault={props.onStartFromVault}
        onRequestDeleteCharacter={props.onRequestDeleteCharacter}
        onRequestEditCharacter={props.onRequestEditCharacter}
        onRequestDeleteSession={props.onRequestDeleteSession}
        onRequestRenameSession={props.onRequestRenameSession}
        onRequestCloneSession={props.onRequestCloneSession}
        onOpenSettings={props.onOpenSettings}
        onLogout={props.onLogout}
      />
    );
  }

  if (gameStage === 'creating_character') {
    return (
      <Game
        onCharacterCreated={onCharacterCreated}
        returnToMenu={onReturnToMenu}
        gameStage={gameStage}
      />
    );
  }

  if (gameStage === 'editing_character') {
    return (
      <Game
        onCharacterCreated={onCharacterCreated}
        returnToMenu={onReturnToMenu}
        gameStage={gameStage}
        editCharacterId={props.editCharacterId}
      />
    );
  }

  if (gameStage === 'homebrew_store') {
    return <HomebrewStorePage onBack={() => onSetStage('main_menu')} />;
  }

  if (gameStage === 'translation_studio') {
    return <TranslationStudioPage onBack={() => onSetStage('main_menu')} />;
  }

  return <PremiumLoader actionLabel="Voltar ao menu" onAction={onReturnToMenu} />;
};

export default GameMenuContent;
