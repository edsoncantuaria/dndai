'use client';

import React from 'react';
import { GameplayScreen } from '@/features/gameplay/GameplayScreen';

interface GameScreenProps {
  returnToMenu: () => void;
}

const GameScreen: React.FC<GameScreenProps> = (props) => (
  <GameplayScreen returnToMenu={props.returnToMenu} />
);

export default GameScreen;

