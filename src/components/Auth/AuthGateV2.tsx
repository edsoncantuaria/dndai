'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { IntroExperience } from '@/features/intro/IntroExperience';
import { useIntroCompleted } from '@/features/intro/useIntroCompleted';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { LicenseStep } from '@/features/auth/LicenseStep';
import { LoadingOracle } from '@/features/gameplay/components/LoadingOracle';
import { AmbientBackground } from '@/components/primitives';

export default function AuthGateV2({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLicenseActive, isLoading } = useAuth();
  const { isComplete, markComplete } = useIntroCompleted();
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  useEffect(() => {
    setShowIntro(!isComplete());
  }, [isComplete]);

  const handleIntroComplete = () => {
    markComplete();
    setShowIntro(false);
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

  return children;
}
