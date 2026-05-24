'use client';

import { useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/Auth/AuthForm';
import LicenseActivationForm from '@/components/Auth/LicenseActivationForm';
import ApiKeyForm from '@/components/Auth/ApiKeyForm';
import PremiumLoader from '@/components/ui/PremiumLoader';

/**
 * Fluxo de entrada: autenticação → licença → chave de API → conteúdo do jogo (Fase 6.3).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
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

    return <>{children}</>;
}
