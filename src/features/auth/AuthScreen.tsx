'use client';

import { useState } from 'react';
import { AmbientBackground, DndCard, DndHeading } from '@/components/primitives';
import { LoginFormV2 } from './LoginFormV2';
import { RegisterFormV2 } from './RegisterFormV2';
import { LandscapeBlocker } from '@/features/intro/LandscapeBlocker';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <AmbientBackground variant="midnight" />
      <LandscapeBlocker />

      <div className="relative z-10 w-full max-w-[480px]">
        <DndCard padding="lg" className="w-full">
          <DndHeading variant="label">Portal do aventureiro</DndHeading>
          <DndHeading variant="section" className="mt-1">
            {mode === 'login' ? 'Entrar na mesa' : 'Forjar sua conta'}
          </DndHeading>
          <p className="mt-2 font-ui text-sm leading-relaxed text-dnd-parchment/90">
            {mode === 'login'
              ? 'Retome suas crônicas com email ou usuário.'
              : 'Sincronize personagens, homebrew e mesas em segundos.'}
          </p>

          <div className="mt-6">
            {mode === 'login' ? (
              <LoginFormV2 onSwitchToRegister={() => setMode('register')} />
            ) : (
              <RegisterFormV2 onSwitchToLogin={() => setMode('login')} />
            )}
          </div>
        </DndCard>
      </div>
    </div>
  );
}
