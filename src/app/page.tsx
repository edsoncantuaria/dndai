'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import GameContainer from '@/components/GameContainer';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/Auth/AuthForm';
import LicenseActivationForm from '@/components/Auth/LicenseActivationForm';
import ApiKeyForm from '@/components/Auth/ApiKeyForm';
import { SettingsProvider } from '@/contexts/SettingsContext';

const AppContent = () => {
  const { isAuthenticated, isLicenseActive, hasApiKey, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-full w-full items-center justify-center text-white">Carregando...</div>;
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
