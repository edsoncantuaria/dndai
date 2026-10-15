'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/features/landing/LandingPage';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { LicenseStep } from '@/features/auth/LicenseStep';
import { ApiKeyStep } from '@/features/auth/ApiKeyStep';
import { LoadingOracle } from '@/features/gameplay/components/LoadingOracle';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { clientCanInfer } from '@/lib/clientAiAccess';
import { AmbientBackground } from '@/components/primitives';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { ProductOnboarding, OnboardingCreateHeroBar } from '@/features/onboarding/ProductOnboarding';
import { completeOnboarding } from '@/services/userAiService';

type GuestView = 'landing' | 'auth';

export default function AuthGateV2({ children }: { children: React.ReactNode }) {
  const {
    isAuthenticated,
    isLicenseActive,
    isLoading,
    onboardingCompleted,
    aiAccess,
    isSettingsReady,
    revalidateUserSession,
  } = useAuth();
  const { apiKey } = useSettingsContext();
  const [guestView, setGuestView] = useState<GuestView>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (isAuthenticated) {
      setGuestView('landing');
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-dnd-obsidian">
        <AmbientBackground variant="cinematic" />
        <div className="relative z-10">
          <LoadingOracle label="Carregando seus mundos…" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (guestView === 'landing') {
      return (
        <LandingPage
          onLogin={() => {
            setAuthMode('login');
            setGuestView('auth');
          }}
          onRegister={() => {
            setAuthMode('register');
            setGuestView('auth');
          }}
        />
      );
    }
    return <AuthScreen initialMode={authMode} />;
  }

  if (!isLicenseActive) {
    return <LicenseStep />;
  }

  if (isSettingsReady && !clientCanInfer(aiAccess, apiKey)) {
    return <ApiKeyStep />;
  }

  return (
    <OnboardingProvider
      onboardingCompleted={onboardingCompleted}
      initialAiAccess={aiAccess}
      onCompleteOnboarding={async () => {
        await completeOnboarding();
        await revalidateUserSession();
      }}
    >
      <ProductOnboarding />
      <OnboardingCreateHeroBar />
      {children}
    </OnboardingProvider>
  );
}
