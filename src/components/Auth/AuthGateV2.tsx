'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { HubIntent } from '@/contexts/HubIntentContext';
import { saveHubIntent } from '@/lib/hubIntentStorage';
import { IntroExperience } from '@/features/intro/IntroExperience';
import { useIntroCompleted } from '@/features/intro/useIntroCompleted';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { LicenseStep } from '@/features/auth/LicenseStep';
import { ApiKeyStep } from '@/features/auth/ApiKeyStep';
import { HubLanding } from '@/features/hub/landing/HubLanding';
import { LoadingOracle } from '@/features/gameplay/components/LoadingOracle';

const HUB_SESSION_KEY = 'dndai_hub_v2_entered';

/**
 * Fluxo UI v2: intro → auth → licença → API → landing → jogo
 */
export default function AuthGateV2({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLicenseActive, hasApiKey, isLoading } = useAuth();
  const { isComplete, markComplete } = useIntroCompleted();
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [hubEntered, setHubEntered] = useState(false);
  useEffect(() => {
    setShowIntro(!isComplete());
    setHubEntered(sessionStorage.getItem(HUB_SESSION_KEY) === '1');
  }, [isComplete]);

  const handleIntroComplete = () => {
    markComplete();
    setShowIntro(false);
  };

  const handleHubNavigate = (intent: HubIntent) => {
    saveHubIntent(intent);
    sessionStorage.setItem(HUB_SESSION_KEY, '1');
    setHubEntered(true);
  };

  if (isLoading || showIntro === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dnd-obsidian">
        <LoadingOracle label="Carregando seus mundos…" />
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

  if (!hasApiKey) {
    return <ApiKeyStep />;
  }

  if (!hubEntered) {
    return <HubLanding onNavigate={handleHubNavigate} />;
  }

  return <>{children}</>;
}
