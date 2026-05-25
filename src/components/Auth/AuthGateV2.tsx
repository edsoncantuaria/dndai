'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { HubIntent } from '@/contexts/HubIntentContext';
import { saveHubIntent } from '@/lib/hubIntentStorage';
import { isHubSessionEntered, markHubSessionEntered } from '@/lib/hubSession';
import { HubNavigationProvider } from '@/contexts/HubNavigationContext';
import { IntroExperience } from '@/features/intro/IntroExperience';
import { useIntroCompleted } from '@/features/intro/useIntroCompleted';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { LicenseStep } from '@/features/auth/LicenseStep';
import { HubLanding } from '@/features/hub/landing/HubLanding';
import { LoadingOracle } from '@/features/gameplay/components/LoadingOracle';
import { AmbientBackground } from '@/components/primitives';

/**
 * Fluxo UI v2: intro → auth → licença → landing → jogo
 */
export default function AuthGateV2({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLicenseActive, isLoading } = useAuth();
  const { isComplete, markComplete } = useIntroCompleted();
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [hubEntered, setHubEntered] = useState(false);
  useEffect(() => {
    setShowIntro(!isComplete());
    setHubEntered(isHubSessionEntered());
  }, [isComplete]);

  const handleIntroComplete = () => {
    markComplete();
    setShowIntro(false);
  };

  const handleHubNavigate = (intent: HubIntent) => {
    saveHubIntent(intent);
    markHubSessionEntered();
    setHubEntered(true);
  };

  if (isLoading || showIntro === null) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-dnd-obsidian">
        <AmbientBackground variant="cinematic" />
        <div className="relative z-10">
          <LoadingOracle label="Carregando seus mundos…" />
        </div>
      </div>
    );
  }

  if (showIntro) {
    return <IntroExperience onComplete={handleIntroComplete} />;
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (!isLicenseActive) {
    return <LicenseStep />;
  }

  if (!hubEntered) {
    return <HubLanding onNavigate={handleHubNavigate} />;
  }

  return (
    <HubNavigationProvider onReturnToLanding={() => setHubEntered(false)}>
      {children}
    </HubNavigationProvider>
  );
}
