'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import GameContainer from '@/components/GameContainer';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/Auth/AuthForm';
import LicenseActivationForm from '@/components/Auth/LicenseActivationForm';
import ApiKeyForm from '@/components/Auth/ApiKeyForm';
import { SettingsProvider } from '@/contexts/SettingsContext';
import PremiumLoader from '@/components/ui/PremiumLoader';

const AppContent = () => {
  const { isAuthenticated, isLicenseActive, hasApiKey, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PremiumLoader
        title="Carregando seus mundos"
        subtitle="Validando licença, aplicando preferências e preparando o mestre virtual."
        description="Sincronizando autenticação e recuperando configurações personalizadas..."
        showSkeletons={false}
      />
    );
  }

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  if (!isLicenseActive) {
    return <LicenseActivationForm />;
  }

  if (!hasApiKey) {
    return <ApiKeyForm />;
  }
  
  return (
    <GameStateProvider>
      <GameContainer />
    </GameStateProvider>
  );
};

export default function HomePage() {
  return (
    <main className="h-full w-full p-2 md:p-4 flex flex-col items-center justify-start md:justify-center">
      <SettingsProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SettingsProvider>
    </main>
  );
}
