/**
 * Roteador de estágios do app (hub, jogo, homebrew).
 * UI v2: `features/hub`, `features/homebrew`, `GameplayScreen`.
 */
'use client';

import PremiumLoader from '@/components/ui/PremiumLoader';
import Game from '@/components/Game';
import HomebrewStore from '@/components/Homebrew/HomebrewStore';
import TranslationStudio from '@/components/Homebrew/TranslationStudio';
import type { Character, SessaoIA } from '@/types';
import type { SessionFactsResponse } from '@/services/gameService';
import type { GameStage } from '@/types/gameStage';
import { isUiV2Enabled } from '@/lib/uiV2';
import { HubShell } from '@/features/hub/HubShell';
import { HomebrewStorePage, TranslationStudioPage } from '@/features/homebrew';
import {
  GameMenuContentLegacy,
  type GameMenuLegacyStage,
} from './GameMenuContentLegacy';

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
  /** UI v2: volta à HubLanding (fora do app interno). */
  onReturnToHubLanding?: () => void;
  onContinueGame: (sessionId: number) => void;
  onCharacterCreated: () => void;
  onStartFromVault: (character: Character, existingSession?: SessaoIA | null) => void;
  onRequestDeleteCharacter: (character: Character) => void;
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
}

const LEGACY_HUB_STAGES: GameMenuLegacyStage[] = ['main_menu', 'session_list', 'character_vault'];

const GameMenuContent: React.FC<GameMenuContentProps> = (props) => {
  const {
    gameStage,
    character,
    isLoadingData,
    onSetStage,
    onReturnToMenu,
    onReturnToHubLanding,
    onCharacterCreated,
    user,
  } = props;

  const exitToHubLanding = onReturnToHubLanding ?? (() => onSetStage('main_menu'));

  const isAdmin = user?.id === 1;
  const v2 = isUiV2Enabled();

  if (gameStage === 'playing' && !character) {
    return <PremiumLoader onCancel={onReturnToMenu} />;
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

  if (v2 && LEGACY_HUB_STAGES.includes(gameStage as GameMenuLegacyStage)) {
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
        onRequestDeleteSession={props.onRequestDeleteSession}
        onRequestRenameSession={props.onRequestRenameSession}
        onRequestCloneSession={props.onRequestCloneSession}
        onOpenSettings={props.onOpenSettings}
        onLogout={props.onLogout}
        onReturnToHubLanding={exitToHubLanding}
      />
    );
  }

  if (!v2 && LEGACY_HUB_STAGES.includes(gameStage as GameMenuLegacyStage)) {
    return (
      <GameMenuContentLegacy
        gameStage={gameStage as GameMenuLegacyStage}
        sessions={props.sessions}
        characters={props.characters}
        featuredSessionFacts={props.featuredSessionFacts}
        useAiHomebrew={props.useAiHomebrew}
        onSetStage={onSetStage}
        onContinueGame={props.onContinueGame}
        onStartFromVault={props.onStartFromVault}
        onRequestDeleteCharacter={props.onRequestDeleteCharacter}
        onRequestDeleteSession={props.onRequestDeleteSession}
        onRequestRenameSession={props.onRequestRenameSession}
        onRequestCloneSession={props.onRequestCloneSession}
        onOpenSettings={props.onOpenSettings}
        onOpenSystemTests={props.onOpenSystemTests}
        onOpenArchitecture={props.onOpenArchitecture}
        onLogout={props.onLogout}
        user={props.user}
        isActionModalOpen={props.isActionModalOpen}
        selectedSessionForAction={props.selectedSessionForAction}
        handleActionModalClose={props.handleActionModalClose}
        openSessionActionModal={props.openSessionActionModal}
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

  if (gameStage === 'homebrew_store') {
    if (v2) {
      return <HomebrewStorePage onBack={exitToHubLanding} />;
    }
    return <HomebrewStore returnToMenu={() => onSetStage('main_menu')} />;
  }

  if (gameStage === 'translation_studio') {
    if (v2) {
      return <TranslationStudioPage onBack={exitToHubLanding} />;
    }
    return <TranslationStudio onCancel={() => onSetStage('main_menu')} />;
  }

  return null;
};

export default GameMenuContent;
